import crypto from 'node:crypto';

const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9 _-]{1,22}[A-Za-z0-9])$/;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body; try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, secret = process.env.SESSION_SECRET;
  const owner = ownerFromToken(body.token, secret);
  if (!url || !key || !secret) return json({ error: 'Server not configured' }, 500);
  if (!owner) return json({ error: 'Not signed in' }, 401);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (body.action === 'get') {
    const response = await fetch(`${url}/rest/v1/collector_profiles?owner=eq.${encodeURIComponent(owner)}&select=display_name`, { headers });
    if (!response.ok) return json({ error: 'Could not load your collector name' }, 502);
    const rows = await response.json();
    return json({ ok: true, display_name: rows[0] && rows[0].display_name || '' });
  }
  const displayName = String(body.display_name || '').trim();
  if (!NAME.test(displayName)) return json({ error: 'Use 3–24 letters, numbers, spaces, hyphens, or underscores.' }, 400);
  const response = await fetch(`${url}/rest/v1/collector_profiles?on_conflict=owner`, {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ owner, display_name: displayName, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) return json({ error: 'That collector name is already taken.' }, 409);
  return json({ ok: true, display_name: displayName });
};

function ownerFromToken(token, secret) {
  if (!token || !secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; } catch { return null; }
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); if (data.exp && Date.now() >= Number(data.exp)) return null; return String(data.u || '').trim().toLowerCase() || null; } catch { return null; }
}
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }
