import { createHmac, timingSafeEqual } from 'crypto';

// Freemium: every visitor gets ONE free health issue (one full check, questions + result).
// After that FreeDoc is $25/month via Stripe Checkout (subscription).
// Gating switches on as soon as STRIPE_SECRET_KEY is set in Vercel; emergency screens are always free.
export const SUBSCRIPTION_PRICE_CENTS = 2500;
export const billingOn = () => !!process.env.STRIPE_SECRET_KEY;

const secret = () => process.env.QUERY_TOKEN_SECRET || process.env.STRIPE_SECRET_KEY || '';
const SUB_TTL_MS = 24 * 60 * 60 * 1000; // re-check the subscription with Stripe at least daily
const PROGRESS_TTL_MS = 30 * 60 * 1000; // a free check in progress stays open for 30 minutes
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

export async function createCheckout(origin: string) {
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(SUBSCRIPTION_PRICE_CENTS),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': 'FreeDoc: unlimited health checks',
    success_url: `${origin}/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?canceled=1`,
  });
  const s = await stripe('/checkout/sessions', { method: 'POST', body });
  return s.url as string;
}

function subCookie(subId: string, custId: string) {
  return setCookie('fd_sub', pack(`${subId}.${custId}.${Date.now() + SUB_TTL_MS}`), YEAR_S);
}

// After Checkout: confirm the session is a completed, active subscription and issue the subscriber cookie.
export async function redeemSubscription(sessionId: string): Promise<string | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const s = await stripe(`/checkout/sessions/${sessionId}?expand[]=subscription`, { method: 'GET' });
  const sub = s.subscription;
  if (s.mode !== 'subscription' || s.status !== 'complete' || !sub || typeof sub !== 'object' || !isActive(sub.status)) return null;
  return subCookie(sub.id, typeof s.customer === 'string' ? s.customer : s.customer?.id || sub.customer);
}

export function subscriberFromCookie(req: Request) {
  const p = unpack(readCookie(req, 'fd_sub'));
  if (!p) return null;
  const [subId, custId, exp] = p.split('.');
  return subId && custId ? { subId, custId, exp: Number(exp) } : null;
}

export type Access = { ok: boolean; cookies: string[]; subscriber: boolean };

// Decides whether this request may run a check. Subscribers always can; everyone else gets one free issue.
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
  const free = unpack(readCookie(req, 'fd_free'));
  if (free === 'u') return { ok: false, cookies: [], subscriber: false };
  if (free?.startsWith('p.') && Number(free.slice(2)) > Date.now()) return { ok: true, cookies: [], subscriber: false };
  if (step === 'questions' || !free) {
    // Opens the free check for 30 minutes so the follow-up questions and the result belong to one issue.
    return { ok: true, cookies: [setCookie('fd_free', pack(`p.${Date.now() + PROGRESS_TTL_MS}`), PROGRESS_TTL_MS / 1000)], subscriber: false };
  }
  return { ok: false, cookies: [], subscriber: false };
}

// The free issue is used up once a result (or support guide) has been delivered.
export const markFreeUsed = () => setCookie('fd_free', pack('u'), YEAR_S);

export async function createPortal(req: Request, origin: string) {
  const sub = subscriberFromCookie(req);
  if (!sub) return null;
  const s = await stripe('/billing_portal/sessions', { method: 'POST', body: new URLSearchParams({ customer: sub.custId, return_url: origin }) });
  return s.url as string;
}
