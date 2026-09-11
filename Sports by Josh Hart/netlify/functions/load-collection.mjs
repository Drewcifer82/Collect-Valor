import crypto from 'node:crypto';

// Returns the signed-in user's saved cards for the Collection tab.
// Token-gated. Reads with the service_role key (server-side), and hands back
// short-lived signed image URLs so the private bucket images can be shown without
// making the bucket public.

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

  const owner = ownerFromToken(body.token, secret);
  if (!owner) return json({ error: 'Not signed in' }, 401);

  // Fetch the user's rows, newest first.
  let rows;
  try {
    const resp = await fetch(
      `${url}/rest/v1/collection?owner=eq.${encodeURIComponent(owner)}&order=created_at.desc&select=*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!resp.ok) return json({ error: 'Could not load your collection' }, 502);
    rows = await resp.json();
  } catch {
    return json({ error: 'Could not load your collection' }, 502);
  }
  if (!Array.isArray(rows)) rows = [];

  // Sign all image paths in one call.
  const paths = rows.map((r) => r.image_path).filter(Boolean);
  const signed = paths.length ? await signPaths(url, key, paths) : {};

  const cards = rows.map((r) => ({
    id: r.id,
    card_type: r.card_type || '',
    category: r.category || '',
    player: r.player || '',
    team: r.team || '',
    year: r.year || '',
    brand: r.brand || '',
    set: r.card_set || '',
    number: r.card_number || '',
    variation: r.variation || '',
    rookie: r.rookie === true,
    is_slab: r.is_slab === true,
    cert_number: r.cert_number || '',
    grade: r.grade || '',
    card_id: r.card_id || '',
    value: r.value == null ? null : Number(r.value),
    is_showcase: r.is_showcase === true,
    is_tradeable: r.is_tradeable === true,
    image_url: r.image_path && signed[r.image_path] ? signed[r.image_path] : '',
  }));

  const singles = cards.filter((c) => !c.is_slab).length;
  const slabs = cards.filter((c) => c.is_slab).length;
  const value = cards.reduce((sum, c) => sum + (c.value || 0), 0);

  return json({
    ok: true,
    cards,
    counts: { singles, slabs, total: cards.length },
    value,
  });
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
