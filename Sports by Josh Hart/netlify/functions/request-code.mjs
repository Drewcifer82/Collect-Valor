import crypto from 'node:crypto';

// Step 1 of email verification. A signed-in user says "here's the email I paid
// with." We confirm that email has an ACTIVE subscription, then email them a
// 6-digit code (via Resend) to prove they own the inbox. The code is what stops
// someone from typing a stranger's paid email.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET, RESEND_API_KEY,
//      RESEND_FROM (optional, e.g. "Collect Valor <verify@collectvalor.com>").

const CODE_TTL_MIN = 10;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Collect Valor <verify@collectvalor.com>';
  if (!url || !key || !secret || !resendKey) return json({ error: 'Server not configured' }, 500);

  const username = verifyUser(body.token, secret);
  if (!username) return json({ error: 'Not signed in' }, 401);

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ error: 'Enter the email you paid with.' }, 400);

  try {
    // Must be an active subscriber.
    const subs = await sbGet(url, key, `/rest/v1/subscribers?email=eq.${enc(email)}&select=status`);
    const sub = Array.isArray(subs) && subs[0];
    if (!sub || String(sub.status).toLowerCase() !== 'active') {
      return json({ ok: false, error: "No active subscription found for that email yet. If you just paid, wait ~10 seconds and try again." }, 200);
    }

    // Anti-sharing: that email can't already belong to a different account.
    const taken = await sbGet(url, key, `/rest/v1/users?paid_email=eq.${enc(email)}&select=username`);
    const owner = Array.isArray(taken) && taken[0];
    if (owner && String(owner.username).toLowerCase() !== username) {
      return json({ ok: false, error: 'That email is already linked to another account.' }, 200);
    }

    // Generate + store a fresh code (replacing any prior ones for this user).
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();

    await sb(url, key, `/rest/v1/email_codes?username=eq.${enc(username)}`, 'DELETE', null, { Prefer: 'return=minimal' });
    await sb(url, key, `/rest/v1/email_codes`, 'POST',
      { username, email, code_hash: codeHash, expires_at: expiresAt, attempts: 0 },
      { Prefer: 'return=minimal' });

    // Email the code.
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your Collect Valor verification code',
        text: `Your Collect Valor code is ${code}. It expires in ${CODE_TTL_MIN} minutes.\n\nIf you didn't request this, you can ignore this email.`,
        html: `<div style="font-family:system-ui,Arial,sans-serif;max-width:420px;margin:0 auto">
          <h2 style="margin:0 0 8px">Collect Valor</h2>
          <p style="color:#444;margin:0 0 16px">Enter this code to unlock your account:</p>
          <div style="font-size:32px;letter-spacing:8px;font-weight:700;background:#0f172a;color:#fff;padding:14px;border-radius:10px;text-align:center">${code}</div>
          <p style="color:#888;font-size:13px;margin:16px 0 0">Expires in ${CODE_TTL_MIN} minutes. If you didn't request this, ignore this email.</p>
        </div>`,
      }),
    });
    if (!sent.ok) {
      const detail = await sent.text().catch(() => '');
      return json({ error: 'Could not send the code email. Try again in a moment.', detail }, 502);
    }

    return json({ ok: true });
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
