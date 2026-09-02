import crypto from 'node:crypto';

// Deletes a card from the signed-in user's collection: removes the stored image
// from the private bucket, then the database row. Token-gated, and the row must
// belong to the token's user — you can only delete your own cards.

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

  const id = String(body.id || '').trim();
  if (!id) return json({ error: 'No card specified' }, 400);

  // Fetch the row first — confirms it exists AND that this user owns it.
  let row;
  try {
    const resp = await fetch(
      `${url}/rest/v1/collection?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}&select=id,image_path`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!resp.ok) return json({ error: 'Could not look up the card' }, 502);
    const rows = await resp.json();
    row = Array.isArray(rows) ? rows[0] : null;
  } catch {
    return json({ error: 'Could not look up the card' }, 502);
  }
  if (!row) return json({ error: 'Card not found' }, 404);

  // Delete the stored image (best-effort — an orphaned image should not block
  // the row delete; report cleanup failures without failing the request).
  let imageRemoved = true;
  if (row.image_path) {
    try {
      const del = await fetch(`${url}/storage/v1/object/collection/${row.image_path}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      imageRemoved = del.ok;
    } catch {
      imageRemoved = false;
    }
  }

  // Delete the row (owner filter again, belt and braces).
  try {
    const resp = await fetch(
      `${url}/rest/v1/collection?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`,
      { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!resp.ok) return json({ error: 'Could not delete the card' }, 502);
  } catch {
    return json({ error: 'Could not delete the card' }, 502);
  }

  return json({ ok: true, id, image_removed: imageRemoved });
};

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
