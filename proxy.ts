import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Site-wide password gate. Password: "Slytherin" (case-insensitive). Override with SITE_PASSWORD in Vercel.
const PASSWORD = () => (process.env.SITE_PASSWORD || 'Slytherin').trim().toLowerCase();
const KEY = () => process.env.QUERY_TOKEN_SECRET || process.env.STRIPE_SECRET_KEY || process.env.BLOB_READ_WRITE_TOKEN || 'freedoc-gate';
const token = () => createHmac('sha256', KEY()).update(`gate:${PASSWORD()}`).digest('base64url');

function valid(v: string | undefined) {
  if (!v) return false;
  const a = Buffer.from(v);
  const b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

function page(error: boolean, next: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>FreeDoc</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1f14;color:#e8efe9;font-family:system-ui,sans-serif}
form{width:min(92vw,380px);padding:34px;border:1px solid #2a7a4b;border-radius:14px;background:#10301f;text-align:center}
h1{margin:0 0 6px;font-size:28px;letter-spacing:.04em}p{margin:0 0 20px;color:#9fc4ad}
input{width:100%;padding:14px;border-radius:8px;border:1px solid #2a7a4b;background:#0b1f14;color:#fff;font-size:18px;margin-bottom:14px}
button{width:100%;padding:14px;border:0;border-radius:8px;background:#2a7a4b;color:#fff;font-size:18px;font-weight:700;cursor:pointer}
.e{color:#ff8a8a;font-weight:700;margin-bottom:12px}</style></head><body>
<form method="post" action="/__gate"><h1>FreeDoc</h1><p>This site is password protected.</p>${error ? '<div class="e">Wrong password.</div>' : ''}
<input type="password" name="password" placeholder="Password" autofocus required autocomplete="current-password"><input type="hidden" name="next" value="${esc(next)}"><button type="submit">Enter</button></form></body></html>`;
  return new NextResponse(html, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/__gate' && req.method === 'POST') {
    const f = await req.formData();
    const pw = String(f.get('password') || '').trim().toLowerCase();
    let next = String(f.get('next') || '/');
    if (!next.startsWith('/') || next.startsWith('//')) next = '/';
    if (pw !== PASSWORD()) return page(true, next);
    const res = NextResponse.redirect(new URL(next, req.url), 303);
    res.cookies.set('fd_gate', token(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }
  if (valid(req.cookies.get('fd_gate')?.value)) return NextResponse.next();
  return page(false, pathname + search);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
