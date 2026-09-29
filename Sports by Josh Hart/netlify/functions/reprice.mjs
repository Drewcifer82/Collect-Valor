// Daily collection re-price. Netlify invokes this at 8:00 UTC (about 3am
// Central). It refreshes each saved Pokémon printing directly from TCG API and
// retains the prior value so the Collection page can show a 24-hour movement.
export const config = { schedule: '0 8 * * *' };

export default async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tcgKey = process.env.TCGAPI_KEY;
  if (!url || !key || !tcgKey) return json({ error: 'Server not configured' }, 500);

  let rows;
  try {
    const response = await fetch(url + '/rest/v1/collection?select=id,card_id,value,grade&card_id=like.tcg%3A%25', {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error('collection query failed: ' + response.status);
    rows = await response.json();
  } catch (error) {
    return json({ error: 'Could not read collection', detail: String(error && error.message || error) }, 502);
  }

  let updated = 0, failed = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    try {
      const price = await pokemonPrice(row.card_id, tcgKey, row.grade);
      if (price == null) { failed++; continue; }
      const response = await fetch(url + '/rest/v1/collection?id=eq.' + encodeURIComponent(row.id), {
        method: 'PATCH',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ value: price, previous_value: row.value == null ? null : Number(row.value), price_updated_at: new Date().toISOString() }),
      });
      if (response.ok) updated++; else failed++;
    } catch { failed++; }
  }
  return json({ ok: true, scanned: Array.isArray(rows) ? rows.length : 0, updated, failed });
};

async function pokemonPrice(cardId, key, grade) {
  const [, encodedId, encodedPrinting = ''] = String(cardId || '').split(':');
  const id = decodeURIComponent(encodedId || '');
  const printing = decodeURIComponent(encodedPrinting || '');
  if (!/^\d+$/.test(id)) return null;
  const suffix = printing ? '?' + new URLSearchParams({ printing }) : '';
  const condition = conditionName(grade);
  const endpoint = condition ? '/prices/conditions' : '/prices';
  const response = await fetch('https://api.tcgapi.dev/v1/cards/' + encodeURIComponent(id) + endpoint + suffix, {
    headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('TCG API price request failed: ' + response.status);
  const data = await response.json();
  const rows = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
  const matching = condition ? rows.filter(item => String(item.condition || '').toLowerCase() === condition.toLowerCase()) : rows;
  const row = printing ? matching.find(item => String(item.printing || '').toLowerCase() === printing.toLowerCase())
    : matching.length === 1 ? matching[0] : null;
  const value = row && (condition
    ? (row.median_with_shipping ?? row.lowest_with_shipping ?? row.low_price)
    : (row.market_price ?? row.price));
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function conditionName(value) {
  return ({ NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', DMG: 'Damaged' })[String(value || '').trim().toUpperCase()] || '';
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
