import crypto from 'node:crypto';

// Community binders: every user's SHOWCASED cards, grouped by owner.
// Token-gated (members only). Only rows with is_showcase = true ever leave the
// database here — private cards stay private. Images come back as short-lived
// signed URLs, same as the owner's own collection view.

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_SECRET;
  if (!url || !key || !secret) return json({ error: 'Server not configured' }, 500);

  const viewer = ownerFromToken(body.token, secret);
  if (!viewer) return json({ error: 'Not signed in' }, 401);

  // Showcased cards only, all users, newest first.
  let rows;
  try {
    const resp = await fetch(
      `${url}/rest/v1/collection?is_showcase=eq.true&order=owner.asc,created_at.desc&select=*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!resp.ok) return json({ error: 'Could not load binders' }, 502);
    rows = await resp.json();
  } catch {
    return json({ error: 'Could not load binders' }, 502);
  }
  if (!Array.isArray(rows)) rows = [];

  const paths = rows.map((r) => r.image_path).filter(Boolean);
  const signed = paths.length ? await signPaths(url, key, paths) : {};

  // Group by owner into binders.
  const byOwner = {};
  for (const r of rows) {
    const o = String(r.owner || '').trim().toLowerCase();
    if (!o) continue;
    if (!byOwner[o]) byOwner[o] = [];
    byOwner[o].push({
      id: r.id,
      player: r.player || '',
      year: r.year || '',
      brand: r.brand || '',
      set: r.card_set || '',
      number: r.card_number || '',
      variation: r.variation || '',
      rookie: r.rookie === true,
      is_slab: r.is_slab === true,
      grade: r.grade || '',
      value: r.value == null ? null : Number(r.value),
      image_url: r.image_path && signed[r.image_path] ? signed[r.image_path] : '',
    });
  }

  const binders = Object.keys(byOwner).sort().map((o) => ({
    owner: o,
    is_you: o === viewer,
    cards: byOwner[o],
    count: byOwner[o].length,
    total_value: byOwner[o].reduce((s, c) => s + (c.value || 0), 0),
  }));

  return json({ ok: true, binders });
};

async function signPaths(url, key, paths) {
  const out = {};
  try {
    const resp = await fetch(`${url}/storage/v1/object/sign/collection`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600, paths }),
    });
    if (!resp.ok) return out;
    const arr = await resp.json();
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const rel = item.signedURL || item.signedUrl;
        if (item.path && rel) out[item.path] = `${url}/storage/v1${rel}`;
      }
    }
  } catch {
    /* leave images blank if signing fails */
  }
  return out;
}

function ownerFromToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  let good = false;
  try {
    good = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return null;
  }
  if (!good) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const u = String(data.u || '').trim().toLowerCase();
    return u || null;
  } catch {
    return null;
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
