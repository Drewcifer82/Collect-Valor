import crypto from 'node:crypto';

// Saves a scanned/uploaded card into the signed-in user's collection.
// Gated by the login session token. Talks to Supabase with the service_role key
// (server-side only), which is what enforces ownership + the collection caps here,
// since the app uses custom PIN auth rather than Supabase Auth.
//
// Flow: verify token -> check cap -> upload the image to the private 'collection'
// bucket -> insert the collection row -> return the saved card.

const SINGLES_MAX = 50;
const SLABS_MAX = 20;

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

  const card = (body.card && typeof body.card === 'object') ? body.card : {};
  const isSlab = !!body.is_slab;

  const imageData = String(body.image || '').replace(/^data:image\/\w+;base64,/, '');
  if (!imageData) return json({ error: 'No card image to save' }, 400);

  // Enforce the per-section cap before writing anything.
  let count;
  try {
    count = await countCards(url, key, owner, isSlab);
  } catch {
    return json({ error: 'Could not check your collection' }, 502);
  }
  const max = isSlab ? SLABS_MAX : SINGLES_MAX;
  if (count >= max) {
    return json({
      error: `Your ${isSlab ? 'slabs' : 'singles'} are full (${max} max). Remove one to add another.`,
      full: true,
    }, 409);
  }

  const id = crypto.randomUUID();
  const imagePath = `${owner}/${id}.jpg`;

  // 1) Upload the image.
  try {
    const buf = Buffer.from(imageData, 'base64');
    const up = await fetch(`${url}/storage/v1/object/collection/${imagePath}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: buf,
    });
    if (!up.ok) {
      const detail = await up.text().catch(() => '');
      return json({ error: 'Could not store the card image', detail: detail.slice(0, 200) }, 502);
    }
  } catch {
    return json({ error: 'Could not store the card image' }, 502);
  }

  // 2) Insert the row.
  const row = {
    id,
    owner,
    card_type: str(card.card_type) || (isSlab ? 'sports' : 'sports'),
    category: str(card.category),
    player: str(card.player),
    team: str(card.team),
    sport: str(card.sport),
    position: str(card.position),
    brand: str(card.brand),
    card_set: str(card.set),
    card_number: str(card.number),
    variation: str(card.variation),
    year: str(card.year),
    rookie: card.rookie === true,
    is_slab: isSlab,
    cert_number: str(body.cert_number || card.cert_number),
    grade: str(body.grade || card.grade),
    card_id: str(body.card_id || card.card_id),
    value: numOrNull(body.value),
    image_path: imagePath,
    is_showcase: false,
    is_tradeable: false,
  };

  try {
    const ins = await fetch(`${url}/rest/v1/collection`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    });
    if (!ins.ok) {
      const detail = await ins.text().catch(() => '');
      // Roll back the orphaned image so we don't leave junk in storage.
      await removeImage(url, key, imagePath).catch(() => {});
      return json({ error: 'Could not save the card', detail: detail.slice(0, 200) }, 502);
    }
    const saved = await ins.json();
    return json({ ok: true, saved: Array.isArray(saved) ? saved[0] : saved, count: count + 1, max });
  } catch {
    await removeImage(url, key, imagePath).catch(() => {});
    return json({ error: 'Could not save the card' }, 502);
  }
};

async function countCards(url, key, owner, isSlab) {
  const q = `${url}/rest/v1/collection?owner=eq.${encodeURIComponent(owner)}&is_slab=eq.${isSlab}&select=id`;
  const resp = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
  });
  if (!resp.ok) throw new Error('count failed');
  // content-range looks like "0-24/25"; fall back to array length.
  const range = resp.headers.get('content-range') || '';
  const total = range.includes('/') ? parseInt(range.split('/')[1], 10) : NaN;
  if (Number.isFinite(total)) return total;
  const rows = await resp.json();
  return Array.isArray(rows) ? rows.length : 0;
}

async function removeImage(url, key, path) {
  await fetch(`${url}/storage/v1/object/collection/${path}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
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

function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
