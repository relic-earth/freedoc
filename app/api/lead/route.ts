import { put } from '@vercel/blob';

export const runtime = 'nodejs';

const KINDS = ['plus', 'sponsor'] as const;

function clean(s: unknown, max = 300) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function POST(req: Request) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  if (b.website) return Response.json({ ok: true }); // honeypot
  if (b.termsAccepted !== '2026-10-03' || (b.kind === 'sponsor' && (b.wireAck !== true || b.renewalAck !== true))) {
    return Response.json({ error: 'Please accept the Terms of Use and every required acknowledgment.' }, { status: 400 });
  }
  const kind = (KINDS as readonly string[]).includes(b.kind) ? b.kind : null;
  const email = clean(b.email, 200).toLowerCase();
  if (!kind || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  const lead = {
    kind,
    email,
    name: clean(b.name, 120),
    company: clean(b.company, 160),
    plan: clean(b.plan, 40),
    topic: clean(b.topic, 80),
    budget: clean(b.budget, 60),
    note: clean(b.note, 1200),
    at: new Date().toISOString(),
    terms: {
      version: b.termsAccepted,
      acceptedAt: new Date().toISOString(),
      ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
      userAgent: req.headers.get('user-agent'),
      text: 'I am 18 or older and I agree to the Terms of Use (including binding individual arbitration, a class action and jury trial waiver, and a limitation of liability) and the Privacy Policy.',
      wireFinalityAck: b.wireAck === true ? true : undefined,
      renewalAck: b.renewalAck === true ? true : undefined,
    },
  };
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('lead store not configured', lead.kind);
    return Response.json({ error: 'Sign-ups are not open yet. Please try again soon.' }, { status: 503 });
  }
  try {
    const safe = email.replace(/[^a-z0-9]/g, '_');
    await put(`leads/${kind}/${Date.now()}-${safe}.json`, JSON.stringify(lead, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: true,
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error('lead save failed', e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
