import { billingOn, createCheckout } from '@/lib/pay';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let kind: 'check' | 'sub' = 'check';
  try { if ((await req.json()).kind === 'sub') kind = 'sub'; } catch {}
  if (!billingOn()) return Response.json({ error: 'Billing is not configured.' }, { status: 503 });
  try {
    return Response.json({ url: await createCheckout(SITE, kind) });
  } catch (e) {
    console.error('checkout error', e);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
  }
}
