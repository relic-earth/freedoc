import { createHmac, timingSafeEqual } from 'crypto';
import { put } from '@vercel/blob';

// $1 per health check, or $25/month for unlimited checks. Gating switches on when STRIPE_SECRET_KEY is set; emergency screens are always free.
export const QUERY_PRICE_CENTS = 100;
export const SUBSCRIPTION_PRICE_CENTS = 2500;
export const billingOn = () => !!process.env.STRIPE_SECRET_KEY;

const secret = () => process.env.QUERY_TOKEN_SECRET || process.env.STRIPE_SECRET_KEY || process.env.BLOB_READ_WRITE_TOKEN || '';
const SUB_TTL_MS = 24 * 60 * 60 * 1000; // re-check the subscription with Stripe at least daily
const QUERY_TTL_MS = 30 * 60 * 1000; // a paid $1 check stays open for 30 minutes
const YEAR_S = 365 * 24 * 60 * 60;

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function pack(payload: string) {
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

function unpack(token: string | undefined): string | null {
  if (!token) return null;
  const [b, sig] = token.split('.');
  if (!b || !sig) return null;
  const payload = Buffer.from(b, 'base64url').toString();
  const a = Buffer.from(sig);
  const c = Buffer.from(sign(payload));
  if (a.length !== c.length || !timingSafeEqual(a, c)) return null;
  return payload;
}

export function readCookie(req: Request, name: string) {
  const h = req.headers.get('cookie') || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
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

const isActive = (status: string) => status === 'active' || status === 'trialing';

export async function createCheckout(origin: string, kind: 'check' | 'sub' = 'check') {
  const sub = kind === 'sub';
  const body = new URLSearchParams({
    mode: sub ? 'subscription' : 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(sub ? SUBSCRIPTION_PRICE_CENTS : QUERY_PRICE_CENTS),
    'line_items[0][price_data][product_data][name]': sub ? 'FreeDoc: unlimited health checks (monthly)' : 'FreeDoc: 1 health check',
    success_url: `${origin}/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?canceled=1`,
  });
  if (sub) body.set('line_items[0][price_data][recurring][interval]', 'month');
  const s = await stripe('/checkout/sessions', { method: 'POST', body });
  return s.url as string;
}

function subCookie(subId: string, custId: string) {
  return setCookie('fd_sub', pack(`${subId}.${custId}.${Date.now() + SUB_TTL_MS}`), YEAR_S);
}

// After Checkout: confirm payment, then issue a subscriber cookie (monthly plan) or a one-check cookie ($1).
export async function redeemSession(sessionId: string): Promise<string | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const s = await stripe(`/checkout/sessions/${sessionId}?expand[]=subscription`, { method: 'GET' });
  if (s.mode === 'subscription') {
    const sub = s.subscription;
    if (s.status !== 'complete' || !sub || typeof sub !== 'object' || !isActive(sub.status)) return null;
    return subCookie(sub.id, typeof s.customer === 'string' ? s.customer : s.customer?.id || sub.customer);
  }
  if (s.payment_status !== 'paid' || s.amount_total < QUERY_PRICE_CENTS) return null;
  try {
    await put(`used-sessions/${sessionId}`, '1', { access: 'public', addRandomSuffix: false, allowOverwrite: false });
  } catch {
    return null; // already redeemed
  }
  return setCookie('fd_q', pack(`q.${Date.now() + QUERY_TTL_MS}`), QUERY_TTL_MS / 1000);
}

export function subscriberFromCookie(req: Request) {
  const p = unpack(readCookie(req, 'fd_sub'));
  if (!p) return null;
  const [subId, custId, exp] = p.split('.');
  return subId && custId ? { subId, custId, exp: Number(exp) } : null;
}

export type Access = { ok: boolean; cookies: string[]; subscriber: boolean };

// Decides whether this request may run a check: subscribers always can; everyone else needs a paid $1 check.
export async function checkAccess(req: Request, step: string): Promise<Access> {
  const sub = subscriberFromCookie(req);
  if (sub) {
    if (sub.exp > Date.now()) return { ok: true, cookies: [], subscriber: true };
    try {
      const s = await stripe(`/subscriptions/${sub.subId}`, { method: 'GET' });
      if (isActive(s.status)) return { ok: true, cookies: [subCookie(sub.subId, sub.custId)], subscriber: true };
    } catch (e) {
      console.error('subscription check error', e);
    }
  }
  const q = unpack(readCookie(req, 'fd_q'));
  if (q?.startsWith('q.') && Number(q.slice(2)) > Date.now()) return { ok: true, cookies: [], subscriber: false };
  return { ok: false, cookies: [], subscriber: false };
}

// The paid $1 check is used up once a result (or support guide) has been delivered.
export const markFreeUsed = () => setCookie('fd_q', '', 0);

export async function createPortal(req: Request, origin: string) {
  const sub = subscriberFromCookie(req);
  if (!sub) return null;
  const s = await stripe('/billing_portal/sessions', { method: 'POST', body: new URLSearchParams({ customer: sub.custId, return_url: origin }) });
  return s.url as string;
}

// Registration (name, address, phone, email) is required before any check; this cookie records that it was done.
export const markRegistered = () => setCookie('fd_reg', pack('r'), YEAR_S);
export const isRegistered = (req: Request) => unpack(readCookie(req, 'fd_reg')) === 'r';
