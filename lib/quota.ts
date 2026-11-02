import { put, list } from '@vercel/blob';

// Hard cap on AI searches. Each new search (the "questions" step) is one query; each is stored as a
// tiny blob under queries/, so counting needs no read-modify-write. When the cap is reached, the owner
// gets one email (the notified marker makes sure it is sent only once).
export const QUERY_LIMIT = 1000;
const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'h@taa.world';

export async function usedQueries(): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 0;
  let n = 0;
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: 'queries/', limit: 1000, cursor });
    n += r.blobs.length;
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && n < QUERY_LIMIT + 1);
  return n;
}

export async function recordQuery(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await put(`queries/${Date.now()}`, '1', { access: 'private', addRandomSuffix: true, contentType: 'text/plain' });
}

async function sendEmail(subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.FROM_EMAIL || 'FreeDoc <onboarding@resend.dev>', to: [NOTIFY_TO], subject, text }),
  });
  return r.ok;
}

// Sends the "limit reached" email once. Returns after attempting; never throws.
export async function notifyLimitOnce(): Promise<void> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    const existing = await list({ prefix: 'meta/limit-notified', limit: 1 });
    if (existing.blobs.length) return;
    const sent = await sendEmail(
      `FreeDoc reached its ${QUERY_LIMIT}-search limit`,
      `FreeDoc (freedoc.live) has used all ${QUERY_LIMIT} free AI searches. New searches are paused until the limit is raised (QUERY_LIMIT in lib/quota.ts) or the queries/ blobs are cleared.\n\nTime: ${new Date().toISOString()}`,
    );
    console.error(`FREEDOC QUERY LIMIT REACHED (${QUERY_LIMIT}); email ${sent ? 'sent' : 'NOT sent (set RESEND_API_KEY)'}`);
    if (sent) await put('meta/limit-notified', new Date().toISOString(), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'text/plain' });
  } catch (e) {
    console.error('limit notify failed', e);
  }
}
