import crypto from 'node:crypto';

// Updates flags on a card the signed-in user owns. Step 1 of Showcase:
// currently handles is_showcase; built to take is_tradeable later.
// Ownership is enforced in the query itself (id AND owner must match).

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

  const upd = {};
  if (typeof body.is_showcase === 'boolean') upd.is_showcase = body.is_showcase;
  if (body.story && typeof body.story === 'object') {
    const story = body.story;
    upd.story_origin = text(story.origin, 40);
    upd.story_place = text(story.place, 120);
    upd.story_year = wholeNumber(story.year, 1900, 2100);
    upd.story_age = wholeNumber(story.age, 0, 120);
    upd.story_price_paid = money(story.price_paid);
    upd.story_note = text(story.note, 2000);
  }
  if (!Object.keys(upd).length) return json({ error: 'Nothing to update' }, 400);

  try {
    const q = `${url}/rest/v1/collection?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`;
    const res = await fetch(q, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(upd),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: 'Could not update the card', detail: detail.slice(0, 200) }, 502);
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) {
      return json({ error: 'Card not found' }, 404);
    }
    return json({ ok: true, card: rows[0] });
  } catch {
    return json({ error: 'Could not update the card' }, 502);
  }
};

function text(value, maximum) { return String(value || '').trim().slice(0, maximum); }
function wholeNumber(value, minimum, maximum) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}
function money(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1000000 ? Math.round(number * 100) / 100 : null;
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
    if (data.exp && Date.now() >= Number(data.exp)) return null;
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
