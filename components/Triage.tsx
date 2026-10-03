'use client';
import TermsCheck, { TERMS_VERSION } from './TermsCheck';
import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import { detectEmergency, type EmergencyKind } from '@/lib/emergency';
import { LEVELS, WHO, medlineUrl, type Question, type Verdict, type Who } from '@/lib/triage';
import { CARE, SPONSOR } from '@/lib/partners';
import { BotLine, Reactor } from '@/components/Chrome';

type Step = 'start' | 'loadingQ' | 'questions' | 'loadingV' | 'verdict' | 'emergency';

const EXAMPLES: Record<Who, string[]> = {
  me: ['Headache and fever since yesterday', 'Sore throat and it hurts to swallow', 'Twisted my ankle and it is swollen', 'Stomach pain on the lower right side'],
  kid: ['Fever of 102 and very tired', 'Cough that won’t stop at night', 'Rash all over after a new food', 'Threw up three times today'],
  parent: ['Dizzy when standing up', 'Fell but did not hit their head', 'More confused than usual today', 'Swollen ankles for a week'],
  someone: ['Fever and body aches', 'Deep cut on a finger', 'Bad headache that came on fast', 'Burn from a hot pan'],
};

// Clipboard with a fallback for browsers or contexts where the async API is unavailable.
async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function Triage({ initialText = '', initialWho = 'me' as Who, autoFocus = false }) {
  const [who, setWho] = useState<Who>(initialWho);
  const [text, setText] = useState(initialText);
  const [step, setStep] = useState<Step>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [emergency, setEmergency] = useState<EmergencyKind>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeHealth, setAgreeHealth] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const topRef = useRef<HTMLDivElement>(null);
  const whatRef = useRef<HTMLTextAreaElement>(null);
  const levelRef = useRef<HTMLParagraphElement>(null);
  const emRef = useRef<HTMLParagraphElement>(null);

  // Focus the box on load so visitors can type right away, and keep anything typed before hydration.
  useEffect(() => {
    const el = whatRef.current;
    if (!el) return;
    if (el.value && !text) setText(el.value);
    if (autoFocus && (document.activeElement === document.body || document.activeElement === null)) {
      el.focus({ preventScroll: true });
      const n = el.value.length;
      el.setSelectionRange(n, n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On every step change after the first render: bring the card to the top and move focus to it.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (step === 'start') whatRef.current?.focus({ preventScroll: true });
    if (step === 'verdict') levelRef.current?.focus({ preventScroll: true });
    if (step === 'emergency') emRef.current?.focus({ preventScroll: true });
    const el = topRef.current;
    if (!el) return;
    const bar = (document.querySelector('.topbar') as HTMLElement | null)?.offsetHeight ?? 96;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - bar - 16), behavior: reduce ? 'auto' : 'smooth' });
  }, [step]);

  function goEmergency(kind: EmergencyKind) {
    setEmergency(kind);
    setStep('emergency');
    track('emergency_screen');
  }

  async function post(payload: any) {
    const r = await fetch('/api/triage', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terms-accepted': TERMS_VERSION, 'x-health-consent': '1' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
    return j;
  }

  async function start(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    const t = text.trim();
    if (!t) return setError('Tell us what is going on first.');
    const em = detectEmergency(t);
    if (em) return goEmergency(em);
    if (!agreeTerms || !agreeHealth) return setError('Please tick both boxes below to continue.');
    setStep('loadingQ');
    track('triage_start');
    try {
      const j = await post({ step: 'questions', who, text: t });
      if (j.type === 'emergency') return goEmergency(j.kind);
      if (!j.questions?.length) return finish({});
      setQuestions(j.questions);
      setAnswers({});
      setStep('questions');
    } catch (err: any) {
      setError(err.message);
      setStep('start');
    }
  }

  async function finish(ans = answers) {
    setError('');
    const list = questions.map((q) => ({ q: q.text, a: (ans[q.id] || []).join(', ') || 'Not answered' }));
    const em = detectEmergency(list.map((x) => x.a).join(' '));
    if (em) return goEmergency(em);
    setStep('loadingV');
    try {
      const j = await post({ step: 'verdict', who, text: text.trim(), answers: list });
      if (j.type === 'emergency') return goEmergency(j.kind);
      setVerdict(j.verdict);
      setStep('verdict');
      track('triage_verdict');
    } catch (err: any) {
      setError(err.message);
      setStep('questions');
    }
  }

  function pick(q: Question, opt: string) {
    setAnswers((prev) => {
      const cur = prev[q.id] || [];
      if (!q.multi) return { ...prev, [q.id]: [opt] };
      if (/^none/i.test(opt)) return { ...prev, [q.id]: cur.includes(opt) ? [] : [opt] };
      const base = cur.filter((o) => !/^none/i.test(o));
      return { ...prev, [q.id]: base.includes(opt) ? base.filter((o) => o !== opt) : [...base, opt] };
    });
  }

  function reset() {
    setStep('start');
    setVerdict(null);
    setQuestions([]);
    setAnswers({});
    setEmergency(null);
    setText('');
  }

  const summary = useMemo(() => {
    if (!verdict) return '';
    const L = LEVELS[verdict.level];
    const date = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const qa = questions.map((q) => `• ${q.text} ${(answers[q.id] || []).join(', ') || 'Not answered'}`).join('\n');
    return [
      `FreeDoc symptom summary — ${date}`,
      `Who: ${WHO[who].label}`,
      ``,
      `What's going on:`,
      text.trim(),
      ``,
      `Details:`,
      qa,
      ``,
      `FreeDoc suggested care level (AI-generated, not a diagnosis): ${L.label}`,
      verdict.summary,
      ``,
      `Go to the ER or call 911 if:`,
      ...verdict.watchFor.map((w) => `• ${w}`),
      ``,
      `Questions for the doctor:`,
      ...verdict.askDoctor.map((w) => `• ${w}`),
      ``,
      `FreeDoc is an AI tool that shares general health information. It is not medical advice and not a diagnosis. freedoc.live`,
    ].join('\n');
  }, [verdict, questions, answers, who, text]);

  const shareUrl = verdict ? `https://freedoc.live/v?l=${verdict.level}` : 'https://freedoc.live';

  async function share() {
    if (!verdict) return;
    const L = LEVELS[verdict.level];
    const msg = `FreeDoc suggested: ${L.label}. Free AI symptom check.`;
    track('share_result');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FreeDoc', text: msg, url: shareUrl });
        return;
      }
    } catch {
      return;
    }
    if (await copyText(`${msg} ${shareUrl}`)) flash('link');
  }

  function flash(what: string) {
    setCopied(what);
    setTimeout(() => setCopied(''), 2200);
  }

  async function copySummary() {
    track('summary_copy');
    if (await copyText(summary)) flash('summary');
  }

  // ---------- RENDER ----------
  return (
    <div ref={topRef} className="triage" id="check">
      {step === 'start' && (
        <form onSubmit={start} className="card start-card">
          <p className="composer-h">
            <span className="hud-mono">MESSAGE #triage</span>
            <span className="hud-mono dim">AI tool · Not a doctor or nurse</span>
          </p>
          <label htmlFor="what" className="ask-label">What’s going on?</label>
          <textarea
            id="what"
            ref={whatRef}
            className="what"
            rows={2}
            value={text}
            autoFocus={autoFocus}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) start(e as any);
            }}
            placeholder={`e.g. ${EXAMPLES[who][0]}`}
          />
          <div className="examples">
            {EXAMPLES[who].map((ex) => (
              <button type="button" key={ex} className="chip" onClick={() => {
                setText(ex);
                whatRef.current?.focus();
              }}>
                {ex}
              </button>
            ))}
          </div>
          <p className="step-label who-label">Who is it for?</p>
          <div className="who-row compact" role="radiogroup" aria-label="Who is the symptom check for?">
            {(Object.keys(WHO) as Who[]).map((w) => (
              <button type="button" key={w} role="radio" aria-checked={who === w} className={`who ${who === w ? 'on' : ''}`} onClick={() => setWho(w)}>
                <span className="who-emoji" aria-hidden>{WHO[w].emoji}</span>
                {WHO[w].label}
              </button>
            ))}
          </div>
          {error && <p className="err">{error}</p>}
          <TermsCheck checked={agreeTerms} onChange={setAgreeTerms} />
          <TermsCheck checked={agreeHealth} onChange={setAgreeHealth}>
            I understand this is not medical or mental-health care, not for emergencies (call 911 / 988), and I consent to my submission being processed by AI providers as described in the <a href="/privacy" target="_blank" rel="noopener" style={{ textDecoration: 'underline', fontWeight: 700, color: 'inherit' }}>Privacy Policy</a> and <a href="/health-data" target="_blank" rel="noopener" style={{ textDecoration: 'underline', fontWeight: 700, color: 'inherit' }}>Consumer Health Data Privacy Policy</a>.
          </TermsCheck>
          <button className="go" type="submit" disabled={!(agreeTerms && agreeHealth) && !detectEmergency(text.trim())}>
            Check symptoms — free
          </button>
          <p className="fine">
            You are using an AI tool, not talking to a doctor or nurse. By tapping the button, you confirm you are 18 or older, agree to the <a href="/terms">Terms</a>, and consent to sending what you type to our AI provider to get a suggestion, as described in our{' '}
            <a href="/health-data">Health Data Policy</a>. FreeDoc is not medical advice. Emergency? Call 911.
          </p>
        </form>
      )}

      {(step === 'loadingQ' || step === 'loadingV') && (
        <div className="card loading" aria-live="polite">
          <BotLine note="is typing…" />
          <div className="load-reactor">
            <Reactor />
          </div>
          <p className="big">{step === 'loadingQ' ? 'Reading your symptoms…' : 'Checking how urgent this is…'}</p>
        </div>
      )}

      {step === 'questions' && (
        <div className="card">
          <BotLine />
          <p className="step-label">A few quick questions</p>
          <p className="lede">Tap the answers that fit. They help FreeDoc suggest how soon to get care.</p>
          {questions.map((q, i) => (
            <fieldset key={q.id} className="q">
              <legend>
                <span className="qn">{i + 1}</span> {q.text}
                {q.multi && <span className="multi"> (tap all that apply)</span>}
              </legend>
              <div className="opts">
                {q.options.map((o) => {
                  const on = (answers[q.id] || []).includes(o);
                  return (
                    <button type="button" key={o} className={`opt ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => pick(q, o)}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {error && <p className="err">{error}</p>}
          <button className="go" onClick={() => finish()}>
            See my suggested next step
          </button>
          <button className="link-btn" onClick={reset}>
            Start over
          </button>
        </div>
      )}

      {step === 'emergency' && (
        <div className="card emergency">
          <p className="hud-mono em-alert">⚠ PRIORITY ALERT</p>
          {emergency === 'crisis' ? (
            <>
              <p className="em-title" ref={emRef} tabIndex={-1}>You don’t have to go through this alone.</p>
              <p className="lede">You can talk to someone right now. It’s free and open 24/7.</p>
              <a className="em-btn" href="tel:988" onClick={() => track('crisis_call')}>Call 988</a>
              <a className="em-btn alt" href="sms:988">Text 988</a>
              <a className="em-btn ghost" href="tel:911">Call 911 if you are in danger now</a>
            </>
          ) : (
            <>
              <p className="em-title" ref={emRef} tabIndex={-1}>🔴 This could be an emergency.</p>
              <p className="lede">Call 911 now. Don’t wait for an online answer.</p>
              <a className="em-btn" href="tel:911" onClick={() => track('emergency_call')}>Call 911</a>
              <a className="em-btn alt" href="tel:18002221222">Poison Control: 1‑800‑222‑1222</a>
            </>
          )}
          <button className="link-btn" onClick={reset}>
            This isn’t an emergency — start over
          </button>
        </div>
      )}

      {step === 'verdict' && verdict && (
        <div className="verdict-wrap">
          <div className="verdict" style={{ ['--lv' as any]: LEVELS[verdict.level].color, ['--lvbg' as any]: LEVELS[verdict.level].bg }}>
            <BotLine />
            <p className="v-kicker">Suggested care level · AI-generated</p>
            <p className="v-level" ref={levelRef} tabIndex={-1}>
              <span aria-hidden>{LEVELS[verdict.level].emoji}</span> {LEVELS[verdict.level].label}
            </p>
            {verdict.headline && <p className="v-head">{verdict.headline}</p>}
            <p className="v-sum">{verdict.summary}</p>
            <p className="v-legal">This is general information from an AI, not a diagnosis or medical advice. If symptoms get worse, last, or worry you, seek care in person, even if FreeDoc suggested a lower level. In an emergency, call 911.</p>
          </div>

          {/* Monetization 1: referral at the moment of need */}
          <div className="card care">
            <p className="step-label">{verdict.level === 'er' ? 'Get help now' : 'Care options'}</p>
            <div className="care-grid">
              {CARE[verdict.level].map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target={c.kind === 'call' ? undefined : '_blank'}
                  rel="noopener sponsored"
                  className={`care-btn ${c.kind}`}
                  onClick={() => track('care_click')}
                >
                  <span className="care-title">{c.title} →</span>
                  <span className="care-sub">{c.sub}</span>
                </a>
              ))}
            </div>
            <p className="disclose">These are third-party services that FreeDoc does not run or endorse. FreeDoc may earn a referral fee from some links, and fees never change the suggested care level.</p>
          </div>

          {/* Virality 2 + 4: share and send */}
          <div className="card actions">
            <p className="step-label">Share &amp; send</p>
            <div className="act-grid">
              <button className="act primary" onClick={share}>
                {copied === 'link' ? '✓ Link copied' : <><span className="act-ic" aria-hidden>📣</span> Share my result</>}
              </button>
              <a className="act" href={`/api/og?l=${verdict.level}&download=1`} download="freedoc-result.png" onClick={() => track('card_download')}>
                <span className="act-ic" aria-hidden>🖼️</span> Save result card
              </a>
              <a className="act" href={`sms:?&body=${encodeURIComponent(summary)}`} onClick={() => track('send_family')}>
                <span className="act-ic" aria-hidden>💬</span> Text to family
              </a>
              <a
                className="act"
                href={`mailto:?subject=${encodeURIComponent('Symptom summary from FreeDoc')}&body=${encodeURIComponent(summary)}`}
                onClick={() => track('send_doctor')}
              >
                <span className="act-ic" aria-hidden>✉️</span> Email to my doctor
              </a>
              <button className="act" onClick={copySummary}>
                {copied === 'summary' ? '✓ Summary copied' : <><span className="act-ic" aria-hidden>📋</span> Copy summary</>}
              </button>
              <button
                className="act"
                onClick={() => {
                  track('print_summary');
                  window.print();
                }}
              >
                <span className="act-ic" aria-hidden>🖨️</span> Print for the visit
              </button>
            </div>
            <p className="disclose">Shared links show only the suggested care level. Your symptoms are never included.</p>
          </div>

          <div className="grid2">
            {verdict.doNow.length > 0 && (
              <div className="card">
                <p className="step-label">Steps to consider now</p>
                <ul className="list">{verdict.doNow.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
            )}
            {verdict.watchFor.length > 0 && (
              <div className="card danger">
                <p className="step-label">Go to the ER or call 911 if</p>
                <ul className="list">{verdict.watchFor.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
            )}
            {verdict.possibleCauses.length > 0 && (
              <div className="card">
                <p className="step-label">Things a doctor may check for</p>
                <ul className="list">
                  {verdict.possibleCauses.map((c) => (
                    <li key={c.name}>
                      <strong>{c.name}.</strong> {c.note}
                    </li>
                  ))}
                </ul>
                <p className="disclose">These are general possibilities a clinician may consider. They are not a diagnosis, and only a clinician who examines the person can diagnose.</p>
              </div>
            )}
            {verdict.askDoctor.length > 0 && (
              <div className="card">
                <p className="step-label">Ask your doctor</p>
                <ul className="list">{verdict.askDoctor.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="card source-card">
            <p>
              Learn more from the U.S. National Library of Medicine:{' '}
              <a href={medlineUrl(verdict.topic)} target="_blank" rel="noopener">
                MedlinePlus on “{verdict.topic}” →
              </a>
            </p>
            <p className="disclose">FreeDoc is not affiliated with or endorsed by the National Library of Medicine.</p>
          </div>

          {/* Monetization 3: topic sponsorship slot (house ad until sold) */}
          <a className="sponsor" href={SPONSOR.url} onClick={() => track('sponsor_click')}>
            <span className="sp-tag">{SPONSOR.name ? 'Sponsored' : 'Sponsor this page'}</span>
            <span className="sp-line">{SPONSOR.name ? `${SPONSOR.name} — ${SPONSOR.line}` : SPONSOR.line}</span>
          </a>

          {/* Monetization 2: FreeDoc Plus */}
          <a className="plus-teaser" href="/plus" onClick={() => track('plus_teaser_click')}>
            <span className="pt-badge">FreeDoc Plus</span>
            <span className="pt-line">Family profiles, saved history, and doctor-ready summaries are coming soon. Join the free waitlist.</span>
            <span className="pt-cta">Join waitlist →</span>
          </a>

          <button className="go ghost" onClick={reset}>
            Check another symptom
          </button>

          {/* Printed only */}
          <pre className="print-only">{summary}</pre>
        </div>
      )}
    </div>
  );
}
