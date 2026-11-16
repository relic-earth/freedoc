import { redeemSubscription } from '@/lib/pay';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let id = '';
  try {
    id = String((await req.json()).session_id || '');
  } catch {}
  try {
    const cookie = await redeemSubscription(id);
    if (!cookie) return Response.json({ error: 'Subscription not found or not active yet.' }, { status: 402 });
    return Response.json({ ok: true }, { headers: { 'set-cookie': cookie } });
  } catch (e) {
    console.error('redeem error', e);
    return Response.json({ error: 'Could not verify your subscription.' }, { status: 502 });
  }
}
