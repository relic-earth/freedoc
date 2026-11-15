import { billingOn, createCheckout } from '@/lib/pay';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

export async function POST() {
  if (!billingOn()) return Response.json({ error: 'Billing is not configured.' }, { status: 503 });
  try {
    return Response.json({ url: await createCheckout(SITE) });
  } catch (e) {
    console.error('checkout error', e);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
  }
}
