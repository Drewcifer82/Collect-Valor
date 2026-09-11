// Nightly collection re-price. Runs on a schedule (8:00 UTC ≈ 3am Central):
// pulls every saved card that has a Card Hedge card_id, asks card-fmv-batch for
// fresh values (100 per call), and writes updated prices back to Supabase.
// This also heals older cards saved with value = null ("No price yet").
//
// No auth token here — this never runs from the browser. Netlify invokes it on
// the schedule; it talks straight to Supabase with the service_role key.

export const config = { schedule: '0 8 * * *' };

const CH_API = 'https://api.cardhedger.com/v1/cards';

export default async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const chKey = process.env.CARDHEDGE_API_KEY;
  if (!url || !key || !chKey) return resp({ error: 'Server not configured' }, 500);

  // 1) Every saved card that we can re-price (has a Card Hedge id).
  let rows;
  try {
    const r = await fetch(
      `${url}/rest/v1/collection?select=id,card_id,grade,is_slab,value&card_id=not.is.null`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!r.ok) throw new Error('collection query failed: ' + r.status);
    rows = await r.json();
  } catch (err) {
    return resp({ error: 'Could not read collection', detail: String(err && err.message || err) }, 502);
  }

  const priceable = (Array.isArray(rows) ? rows : []).filter((r) => r.card_id && !String(r.card_id).startsWith('tcg:'));
  if (!priceable.length) return resp({ ok: true, updated: 0, note: 'nothing to re-price' });

  // 2) Batch-price them, 100 at a time (the endpoint's max).
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < priceable.length; i += 100) {
    const chunk = priceable.slice(i, i + 100);
    const items = chunk.map((r) => ({
      card_id: r.card_id,
      grade: r.grade && String(r.grade).trim() ? String(r.grade).trim() : 'Raw',
    }));

    let results;
    try {
      const r = await fetch(CH_API + '/card-fmv-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-API-Key': chKey },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) throw new Error('card-fmv-batch ' + r.status);
      const data = await r.json();
      results = Array.isArray(data && data.results) ? data.results : [];
    } catch {
      failed += chunk.length;
      continue; // skip this chunk, keep going
    }

    // 3) Write back by position (results echo the request order).
    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const res = results[j];
      const price = res && res.price != null && Number.isFinite(Number(res.price))
        ? Number(res.price) : null;
      if (price == null || price === Number(row.value)) continue;
      try {
        const u = await fetch(`${url}/rest/v1/collection?id=eq.${encodeURIComponent(row.id)}`, {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ value: price }),
        });
        if (u.ok) updated++; else failed++;
      } catch {
        failed++;
      }
    }
  }

  return resp({ ok: true, scanned: priceable.length, updated, failed });
};

function resp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
