import { redeemSession } from '@/lib/pay';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let id = '';
  try {
    id = String((await req.json()).session_id || '');
  } catch {}
  try {
    const cookie = await redeemSession(id);
    if (!cookie) return Response.json({ error: 'Payment not found or already used.' }, { status: 402 });
    return Response.json({ ok: true }, { headers: { 'set-cookie': cookie } });
  } catch (e) {
    console.error('redeem error', e);
    return Response.json({ error: 'Could not verify payment.' }, { status: 502 });
  }
}
