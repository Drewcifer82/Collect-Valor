import assert from 'node:assert/strict';
import test from 'node:test';
import publicReviews from '../Sports by Josh Hart/netlify/functions/public-reviews.mjs';

test('public reviews expose anonymous rating totals and consented collector names only', async (t) => {
  const originalFetch = globalThis.fetch;
  const original = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key' });
  t.after(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('feedback?select=rating')) return Response.json([{ rating: 5 }, { rating: 5 }, { rating: 4 }]);
    if (target.includes('feedback?public_display_ok=eq.true')) return Response.json([{ owner: 'member@example.test', rating: 5, message: 'Easy to use.', created_at: '2026-10-01T00:00:00Z' }]);
    if (target.includes('collector_profiles?')) return Response.json([{ owner: 'member@example.test', display_name: 'Roger' }]);
    throw new Error(`Unexpected request: ${target}`);
  };
  const response = await publicReviews(new Request('http://localhost/public-reviews'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.counts, { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 });
  assert.equal(data.total, 3);
  assert.deepEqual(data.reviews, [{ rating: 5, message: 'Easy to use.', created_at: '2026-10-01T00:00:00Z', name: 'Roger' }]);
  assert.equal(JSON.stringify(data).includes('member@example.test'), false);
});
