import crypto from 'node:crypto';

// Passwordless session start. Identity = the email the person subscribed with.
// If that email is an active subscriber (or on the comp allowlist), we mint a
// session token signed FROM the email — same token shape the old login used, so
// every existing gated function keeps working (owner = the email).
// No 6-digit code for now: we trust the email during beta.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET.

const COMP_EMAILS = [
  'paradigmnguy3339@gmail.com',
  'paradigmnguy3339@duck.com',
];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_SECRET;
  if (!url || !key || !secret) return json({ error: 'Server not configured' }, 500);

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ ok: false, error: 'Enter a valid email.' }, 200);

  // Comp allowlist = free lifetime access.
  if (COMP_EMAILS.includes(email)) {
    return json({ ok: true, token: sign(email, secret), email, plan: 'comp', entitled: true });
  }

  // Otherwise the email must be an active subscriber.
  try {
    const subs = await sbGet(url, key, `/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=status`);
    const sub = Array.isArray(subs) && subs[0];
    if (sub && String(sub.status).toLowerCase() === 'active') {
      return json({ ok: true, token: sign(email, secret), email, plan: 'beta', entitled: true });
    }
    return json({ ok: false, error: 'No active subscription found for that email. If you just subscribed, wait a few seconds and try again.' }, 200);
  } catch (err) {
    return json({ error: 'Server error', detail: String(err && err.message || err) }, 500);
  }
};

function sign(u, secret) {
  const payload = Buffer.from(JSON.stringify({ u, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
async function sbGet(url, key, path) {
  const r = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Supabase GET ${path} -> ${r.status}`);
  return r.json();
}
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }
