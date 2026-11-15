import { createHmac, timingSafeEqual } from 'crypto';
import { put } from '@vercel/blob';

// $1 per query on freedoc.live. Charging switches on as soon as STRIPE_SECRET_KEY is set in Vercel.
export const QUERY_PRICE_CENTS = 100;
export const billingOn = () => !!process.env.STRIPE_SECRET_KEY;

const TOKEN_TTL_MS = 30 * 60 * 1000;
const secret = () => process.env.QUERY_TOKEN_SECRET || process.env.STRIPE_SECRET_KEY || '';

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeToken(sessionId: string) {
  const payload = `${sessionId}.${Date.now() + TOKEN_TTL_MS}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

export function tokenValid(token: string | null) {
  if (!token) return false;
  const [b, sig] = token.split('.');
  if (!b || !sig) return false;
  const payload = Buffer.from(b, 'base64url').toString();
  const good = sign(payload);
  const a = Buffer.from(sig);
  const c = Buffer.from(good);
  if (a.length !== c.length || !timingSafeEqual(a, c)) return false;
  return Number(payload.split('.')[1]) > Date.now();
}

async function stripe(path: string, init?: RequestInit) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded', ...(init?.headers || {}) },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Stripe error');
  return j;
}

export async function createCheckout(origin: string) {
  const body = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(QUERY_PRICE_CENTS),
    'line_items[0][price_data][product_data][name]': 'FreeDoc: 1 query',
    success_url: `${origin}/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?canceled=1`,
  });
  const s = await stripe('/checkout/sessions', { method: 'POST', body });
  return s.url as string;
}

// Verifies the session is paid and consumes it exactly once.
export async function redeem(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const s = await stripe(`/checkout/sessions/${sessionId}`, { method: 'GET' });
  if (s.payment_status !== 'paid' || s.amount_total < QUERY_PRICE_CENTS) return null;
  try {
    await put(`used-sessions/${sessionId}`, '1', { access: 'public', addRandomSuffix: false, allowOverwrite: false });
  } catch {
    return null; // already redeemed
  }
  return makeToken(sessionId);
}
