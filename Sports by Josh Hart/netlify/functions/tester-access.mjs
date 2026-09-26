import crypto from 'node:crypto';

const DAILY_LIMIT = 75;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const secret = process.env.SESSION_SECRET;
  const configuredCodes = String(process.env.TESTER_PASS_CODE || '').split(',').map(code => code.trim()).filter(Boolean);
  const expiresAt = Date.parse(String(process.env.TESTER_PASS_EXPIRES_AT || ''));
  if (!secret || !configuredCodes.length || !Number.isFinite(expiresAt)) return json({ error: 'Tester access is not configured.' }, 503);
  if (Date.now() >= expiresAt) return json({ error: 'This tester pass has expired.' }, 401);

  const submitted = String(body.code || '').trim();
  const matchedCode = configuredCodes.find(code => safeEqual(submitted, code));
  if (!matchedCode) return json({ error: 'Invalid tester pass.' }, 401);

  const passId = crypto.createHash('sha256').update(matchedCode).digest('hex').slice(0, 20);
  const payload = Buffer.from(JSON.stringify({
    u: `tester:${passId}`, tester: passId, exp: expiresAt, iat: Date.now(),
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return json({
    ok: true, token: `${payload}.${sig}`, email: 'Anonymous tester', plan: 'tester',
    entitled: true, expires_at: new Date(expiresAt).toISOString(), scan_limit: DAILY_LIMIT,
  });
};

function safeEqual(a, b) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
