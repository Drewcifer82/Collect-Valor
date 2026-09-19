import crypto from 'node:crypto';

const BUILT_IN_COMP_EMAILS = ['paradigmnguy3339@gmail.com', 'paradigmnguy3339@duck.com'];
const COMP_EMAILS = [...BUILT_IN_COMP_EMAILS, ...String(process.env.COMP_EMAILS || '')
  .split(',').map(email => email.trim().toLowerCase()).filter(Boolean)];
const LIMITED_COMP_EMAILS = String(process.env.LIMITED_COMP_EMAILS || '')
  .split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
const LIMITED_COMP_DAILY_SCANS = 40;
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

// A person must prove they own an allowed inbox before receiving a session.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_SECRET, resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Collect Valor <verify@collectvalor.com>';
  if (!url || !key || !secret || !resendKey) return json({ error: 'Server not configured' }, 500);
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ error: 'Enter a valid email.' }, 400);
  if (body.action === 'verify') return verifyCode({ body, email, url, key, secret });
  return sendCode({ email, url, key, resendKey, from });
};

async function sendCode({ email, url, key, resendKey, from }) {
  // Do not reveal whether an email has an account.
  if (!await allowedEmail(url, key, email)) return json({ ok: true, sent: true });
  const username = codeOwner(email), code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
  try {
    await sb(url, key, `/rest/v1/email_codes?username=eq.${enc(username)}`, 'DELETE');
    await sb(url, key, '/rest/v1/email_codes', 'POST', { username, email, code_hash: sha256(code), expires_at: expiresAt, attempts: 0 });
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from, to: [email], subject: 'Your Collect Valor sign-in code', text: `Your Collect Valor sign-in code is ${code}. It expires in ${CODE_TTL_MIN} minutes.\n\nIf you did not request this, you can ignore this email.` }),
    });
    if (!sent.ok) return json({ error: 'Could not send the code email. Try again in a moment.' }, 502);
    return json({ ok: true, sent: true });
  } catch { return json({ error: 'Could not start sign-in. Try again in a moment.' }, 502); }
}

async function verifyCode({ body, email, url, key, secret }) {
  const code = String(body.code || '').trim();
  if (!/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit code.' }, 400);
  try {
    const rows = await sbGet(url, key, `/rest/v1/email_codes?username=eq.${enc(codeOwner(email))}&email=eq.${enc(email)}&order=created_at.desc&limit=1&select=id,code_hash,expires_at,attempts`);
    const row = Array.isArray(rows) && rows[0];
    if (!row || new Date(row.expires_at).getTime() < Date.now() || (row.attempts || 0) >= MAX_ATTEMPTS) return json({ error: 'That code is no longer valid. Request a new one.' }, 401);
    if (!timingEqual(sha256(code), row.code_hash)) {
      await sb(url, key, `/rest/v1/email_codes?id=eq.${enc(row.id)}`, 'PATCH', { attempts: (row.attempts || 0) + 1 });
      return json({ error: 'That code is not correct.' }, 401);
    }
    if (!await allowedEmail(url, key, email)) return json({ error: 'This account is not currently active.' }, 401);
    await sb(url, key, `/rest/v1/email_codes?username=eq.${enc(codeOwner(email))}`, 'DELETE');
    const scanLimit = LIMITED_COMP_EMAILS.includes(email) ? LIMITED_COMP_DAILY_SCANS : null;
    return json({ ok: true, token: sign(email, secret, scanLimit), email, plan: COMP_EMAILS.includes(email) ? 'comp' : 'beta', entitled: true, scan_limit: scanLimit });
  } catch { return json({ error: 'Could not verify the code. Try again.' }, 502); }
}

async function allowedEmail(url, key, email) {
  if (COMP_EMAILS.includes(email)) return true;
  const subs = await sbGet(url, key, `/rest/v1/subscribers?email=eq.${enc(email)}&select=status`);
  const sub = Array.isArray(subs) && subs[0];
  return !!sub && String(sub.status).toLowerCase() === 'active';
}
function codeOwner(email) { return `session:${email}`; }
function sign(u, secret, scanLimit = null) { const payload = Buffer.from(JSON.stringify({ u, iat: Date.now(), ...(scanLimit ? { scan_limit: scanLimit } : {}) })).toString('base64url'); return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`; }
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function timingEqual(a, b) { const ab = Buffer.from(a), bb = Buffer.from(b); return ab.length === bb.length && crypto.timingSafeEqual(ab, bb); }
function enc(s) { return encodeURIComponent(s); }
async function sbGet(url, key, path) { const r = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }); if (!r.ok) throw new Error('Database request failed'); return r.json(); }
async function sb(url, key, path, method, body) { const r = await fetch(`${url}${path}`, { method, headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' }, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error('Database request failed'); return r; }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }
