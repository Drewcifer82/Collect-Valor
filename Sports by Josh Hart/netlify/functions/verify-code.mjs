import crypto from 'node:crypto';

// Step 2 of email verification. The user types the 6-digit code we emailed. If
// it matches (and hasn't expired), we BIND that paid email to their account and
// flip them to an active 'beta' plan. The unique index on users.paid_email means
// one paid email unlocks exactly one account — the anti-sharing guarantee.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET.

const MAX_ATTEMPTS = 5;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_SECRET;
  if (!url || !key || !secret) return json({ error: 'Server not configured' }, 500);

  const username = verifyUser(body.token, secret);
  if (!username) return json({ error: 'Not signed in' }, 401);

  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit code.' }, 400);

  try {
    // Newest code for this user + email.
    const rows = await sbGet(url, key,
      `/rest/v1/email_codes?username=eq.${enc(username)}&email=eq.${enc(email)}&order=created_at.desc&limit=1&select=id,code_hash,expires_at,attempts`);
    const row = Array.isArray(rows) && rows[0];
    if (!row) return json({ ok: false, error: 'No code found — request a new one.' }, 200);

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ ok: false, error: 'That code expired — request a new one.' }, 200);
    }
    if ((row.attempts || 0) >= MAX_ATTEMPTS) {
      return json({ ok: false, error: 'Too many tries — request a new code.' }, 200);
    }

    const matches = timingEqual(sha256(code), row.code_hash);
    if (!matches) {
      await sb(url, key, `/rest/v1/email_codes?id=eq.${enc(row.id)}`, 'PATCH',
        { attempts: (row.attempts || 0) + 1 }, { Prefer: 'return=minimal' });
      return json({ ok: false, error: 'Wrong code. Check the email and try again.' }, 200);
    }

    // Code is good. Confirm the subscription is still active.
    const subs = await sbGet(url, key,
      `/rest/v1/subscribers?email=eq.${enc(email)}&select=status,stripe_customer_id,stripe_subscription_id,plan_renews_at`);
    const sub = Array.isArray(subs) && subs[0];
    if (!sub || String(sub.status).toLowerCase() !== 'active') {
      return json({ ok: false, error: 'That subscription is no longer active.' }, 200);
    }

    // Anti-sharing: reject if the email already belongs to a different account.
    const taken = await sbGet(url, key, `/rest/v1/users?paid_email=eq.${enc(email)}&select=username`);
    const owner = Array.isArray(taken) && taken[0];
    if (owner && String(owner.username).toLowerCase() !== username) {
      return json({ ok: false, error: 'That email is already linked to another account.' }, 200);
    }

    // Don't downgrade a comp (free-for-life) account.
    const meRows = await sbGet(url, key, `/rest/v1/users?username=eq.${enc(username)}&select=plan`);
    const currentPlan = (Array.isArray(meRows) && meRows[0] && String(meRows[0].plan || '').toLowerCase()) || 'free';
    const newPlan = currentPlan === 'comp' ? 'comp' : 'beta';

    // Bind the email + activate. The unique index enforces one email per account.
    const patchResp = await fetch(
      `${url}/rest/v1/users?username=eq.${enc(username)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
        body: JSON.stringify({
          paid_email: email,
          plan: newPlan,
          plan_status: 'active',
          stripe_customer_id: sub.stripe_customer_id || null,
          stripe_subscription_id: sub.stripe_subscription_id || null,
          plan_renews_at: sub.plan_renews_at || null,
        }),
      });
    if (!patchResp.ok) {
      const detail = await patchResp.text().catch(() => '');
      // 23505 = unique violation on paid_email (raced with another bind).
      if (patchResp.status === 409 || detail.includes('23505')) {
        return json({ ok: false, error: 'That email is already linked to another account.' }, 200);
      }
      throw new Error(`bind failed ${patchResp.status} ${detail}`);
    }

    // Clean up used codes.
    await sb(url, key, `/rest/v1/email_codes?username=eq.${enc(username)}`, 'DELETE', null, { Prefer: 'return=minimal' });

    return json({ ok: true, plan: newPlan, entitled: true });
  } catch (err) {
    return json({ error: 'Server error', detail: String(err && err.message || err) }, 500);
  }
};

// ---- helpers ---------------------------------------------------------------
function verifyUser(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return String(data.u || '').toLowerCase() || null;
  } catch { return null; }
}
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function timingEqual(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
function enc(s) { return encodeURIComponent(s); }
async function sbGet(url, key, path) {
  const r = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Supabase GET ${path} -> ${r.status}`);
  return r.json();
}
async function sb(url, key, path, method, body, extra = {}) {
  const r = await fetch(`${url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { const d = await r.text().catch(() => ''); throw new Error(`Supabase ${method} ${path} -> ${r.status} ${d}`); }
  return r;
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
