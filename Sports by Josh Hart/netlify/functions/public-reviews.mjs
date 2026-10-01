// Public, consented reviews only. Reviewer emails and private feedback never
// leave this function. Rating totals are anonymous aggregates.
export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: 'Server not configured' }, 500);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const [ratingsResponse, reviewsResponse] = await Promise.all([
      fetch(`${url}/rest/v1/feedback?select=rating`, { headers }),
      fetch(`${url}/rest/v1/feedback?public_display_ok=eq.true&order=created_at.desc&select=owner,rating,message,created_at`, { headers }),
    ]);
    if (!ratingsResponse.ok || !reviewsResponse.ok) return json({ error: 'Could not load reviews.' }, 502);
    const ratings = await ratingsResponse.json(), reviews = await reviewsResponse.json();
    const counts = [1, 2, 3, 4, 5].reduce((out, rating) => ({ ...out, [rating]: 0 }), {});
    for (const row of Array.isArray(ratings) ? ratings : []) { if (counts[row.rating] !== undefined) counts[row.rating] += 1; }
    const publicRows = Array.isArray(reviews) ? reviews : [];
    const names = await displayNames(url, key, [...new Set(publicRows.map((row) => row.owner).filter(Boolean))]);
    return json({ ok: true, total: Object.values(counts).reduce((sum, count) => sum + count, 0), counts, reviews: publicRows.map((row) => ({ rating: row.rating, message: row.message, created_at: row.created_at, name: names[String(row.owner || '').toLowerCase()] || 'Collect Valor collector' })) });
  } catch { return json({ error: 'Could not load reviews.' }, 502); }
};

async function displayNames(url, key, owners) {
  if (!owners.length) return {};
  try {
    const response = await fetch(`${url}/rest/v1/collector_profiles?owner=in.(${owners.map(encodeURIComponent).join(',')})&select=owner,display_name`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) return {};
    const rows = await response.json();
    return Object.fromEntries((Array.isArray(rows) ? rows : []).map((row) => [String(row.owner || '').toLowerCase(), String(row.display_name || '')]));
  } catch { return {}; }
}

function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
