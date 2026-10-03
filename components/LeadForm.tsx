'use client';
import { useState } from 'react';
import { track } from '@vercel/analytics';
import TermsCheck, { TERMS_VERSION } from './TermsCheck';

type Field = { name: string; label: string; type?: string; options?: string[]; textarea?: boolean; required?: boolean };

export default function LeadForm({ kind, fields, button, done }: { kind: 'plus' | 'sponsor'; fields: Field[]; button: string; done: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'ok'>('idle');
  const [err, setErr] = useState('');
  const [agree, setAgree] = useState(false);
  const [wire, setWire] = useState(false);
  const [renew, setRenew] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    if (!agree || (kind === 'sponsor' && (!wire || !renew))) { setErr('Please tick every box to continue.'); return; }
    setState('sending');
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, kind, termsAccepted: TERMS_VERSION, wireAck: kind === 'sponsor' ? wire : undefined, renewalAck: kind === 'sponsor' ? renew : undefined }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      track(`lead_${kind}`);
      setState('ok');
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.');
      setState('idle');
    }
  }

  if (state === 'ok') return <p className="ok">✓ {done}</p>;

  return (
    <form className="form" onSubmit={submit}>
      {fields.map((f) =>
        f.options ? (
          <select key={f.name} name={f.name} aria-label={f.label} defaultValue="">
            <option value="" disabled>
              {f.label}
            </option>
            {f.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : f.textarea ? (
          <textarea key={f.name} name={f.name} placeholder={f.label} aria-label={f.label} rows={3} />
        ) : (
          <input key={f.name} name={f.name} type={f.type || 'text'} placeholder={f.label} aria-label={f.label} required={f.required} />
        )
      )}
      <input name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden />
      {kind === 'sponsor' && (
        <p className="plus-note" style={{ fontSize: 18 }}>
          Before you book: a sponsorship is $500 per section per month, billed monthly in advance by invoice, and the first invoice arrives within one business day. It renews every month until you cancel by emailing info@island.contact before the next billing period. Sponsored content is labeled and never changes a care level. Payments are non-refundable except where the law requires.
        </p>
      )}
      <TermsCheck checked={agree} onChange={setAgree} />
      {kind === 'sponsor' && (
        <>
          <TermsCheck checked={renew} onChange={setRenew}>I understand this sponsorship renews monthly until I cancel by emailing info@island.contact before the next billing period.</TermsCheck>
          <TermsCheck checked={wire} onChange={setWire}>I understand that wire and ACH payments are final and cannot be reversed once sent, and that I must verify payment instructions with FreeDoc by phone or email before sending funds.</TermsCheck>
        </>
      )}
      {err && <p className="err">{err}</p>}
      <button className="go" disabled={state === 'sending' || !agree || (kind === 'sponsor' && (!wire || !renew))}>
        {state === 'sending' ? 'Sending…' : button}
      </button>
    </form>
  );
}
