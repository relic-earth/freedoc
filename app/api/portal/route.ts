import { billingOn, createPortal } from '@/lib/pay';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

// Lets a subscriber manage or cancel their $25/month plan in Stripe's billing portal.
export async function POST(req: Request) {
  if (!billingOn()) return Response.json({ error: 'Billing is not configured.' }, { status: 503 });
  try {
    const url = await createPortal(req, SITE);
    if (!url) return Response.json({ error: 'No subscription found on this device.' }, { status: 404 });
    return Response.json({ url });
  } catch (e) {
    console.error('portal error', e);
    return Response.json({ error: 'Could not open billing. Please try again.' }, { status: 502 });
  }
}
