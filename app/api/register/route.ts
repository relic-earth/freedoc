import { put } from '@vercel/blob';
import { markRegistered } from '@/lib/pay';

export const runtime = 'nodejs';

function clean(s: unknown, max = 300) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Everyone must give their name, address, phone number and email before using the symptom check.
export async function POST(req: Request) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  const name = clean(b.name, 120);
  const address = clean(b.address, 300);
  const phone = clean(b.phone, 40);
  const email = clean(b.email, 200).toLowerCase();
  if (name.length < 2) return Response.json({ error: 'Please enter your full name.' }, { status: 400 });
  if (address.length < 8) return Response.json({ error: 'Please enter your full address.' }, { status: 400 });
  if (phone.replace(/\D/g, '').length < 7) return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('registration store not configured');
    return Response.json({ error: 'Sign-in is not open yet. Please try again soon.' }, { status: 503 });
  }
  try {
    const now = new Date().toISOString();
    const rec = {
      name, address, phone, email, at: now,
      ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
      userAgent: req.headers.get('user-agent'),
    };
    await put(`registrations/${Date.now()}-${email.replace(/[^a-z0-9]/g, '_')}.json`, JSON.stringify(rec, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: true,
    });
    return Response.json({ ok: true }, { headers: { 'set-cookie': markRegistered() } });
  } catch (e) {
    console.error('registration save failed', e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
