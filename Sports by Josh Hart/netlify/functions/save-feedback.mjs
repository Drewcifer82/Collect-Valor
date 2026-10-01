import crypto from 'node:crypto';

const CATEGORIES = new Set(['bug', 'idea', 'pricing', 'general']);

// Private product feedback. The service key stays server-side; ownership comes
// only from the signed session token, never from the browser request body.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, secret = process.env.SESSION_SECRET;
  if (!url || !key || !secret) return json({ error: 'Server not configured' }, 500);
  const owner = ownerFromToken(body.token, secret);
  if (!owner) return json({ error: 'Sign in to send feedback.' }, 401);

  const rating = Number(body.rating);
  const category = String(body.category || '').trim().toLowerCase();
  const message = String(body.message || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: 'Choose a rating from 1 to 5 stars.' }, 400);
  if (!CATEGORIES.has(category)) return json({ error: 'Choose a feedback category.' }, 400);
  if (!message || message.length > 750) return json({ error: 'Feedback must be between 1 and 750 characters.' }, 400);

  try {
    const response = await fetch(`${url}/rest/v1/feedback`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ owner, rating, category, message, contact_ok: body.contact_ok === true, share_ok: body.share_ok === true }),
    });
    if (!response.ok) return json({ error: 'Could not save your feedback.' }, 502);
    return json({ ok: true });
  } catch { return json({ error: 'Could not save your feedback.' }, 502); }
};

function ownerFromToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try { if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null; } catch { return null; }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && Date.now() >= Number(data.exp)) return null;
    return String(data.u || '').trim().toLowerCase() || null;
  } catch { return null; }
}

function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }
