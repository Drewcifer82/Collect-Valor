import crypto from 'node:crypto';

// Verifies a username + PIN against Supabase and returns a signed session token.
// PIN hashing/verification happens inside Postgres (pgcrypto), so raw PINs and
// hashes never leave the database. This function talks to Supabase with the
// service_role key, which stays server-side only.

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const username = String(body.username || '').trim().toLowerCase();
  const pin = String(body.pin || '').trim();
  if (!username || !pin) return json({ error: 'Enter a username and PIN' }, 400);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_SECRET;
  if (!url || !key || !secret) return json({ error: 'Server not configured' }, 500);

  let ok;
  try {
    const resp = await fetch(`${url}/rest/v1/rpc/verify_login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ u: username, p: pin }),
    });
    if (!resp.ok) return json({ error: 'Auth service error' }, 502);
    ok = await resp.json(); // boolean from verify_login()
  } catch {
    return json({ error: 'Could not reach auth service' }, 502);
  }

  if (ok !== true) return json({ error: 'Invalid username or PIN' }, 401);

  // Look up the user's subscription plan so the app can gate scanning.
  let plan = 'free', entitled = false;
  try {
    const uResp = await fetch(
      `${url}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=plan,plan_status`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (uResp.ok) {
      const rows = await uResp.json();
      const u = (Array.isArray(rows) && rows[0]) || {};
      plan = u.plan || 'free';
      entitled = isEntitled(u);
    }
  } catch { /* if the lookup fails, treat as not entitled (safe default) */ }

  const token = sign(username, secret);
  return json({ ok: true, username, token, plan, entitled });
};

// Comp = free lifetime access (friends/founders). Paid plans must be 'active'.
function isEntitled(u) {
  const plan = String(u.plan || 'free').toLowerCase();
  if (plan === 'comp') return true;
  if (plan === 'beta' || plan === 'pro') return String(u.plan_status || '').toLowerCase() === 'active';
  return false;
}

function sign(username, secret) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, iat: Date.now() })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
