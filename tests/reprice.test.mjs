import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../Sports by Josh Hart/netlify/functions/reprice.mjs';

test('daily reprice keeps yesterday’s value and refreshes the exact Pokémon printing', async t => {
  const originalFetch = globalThis.fetch;
  const saved = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TCGAPI_KEY'].map(key => process.env[key]);
  process.env.SUPABASE_URL = 'https://db.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'db-key';
  process.env.TCGAPI_KEY = 'tcg-key';
  t.after(() => {
    globalThis.fetch = originalFetch;
    ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TCGAPI_KEY'].forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
    });
  });
  let patch;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target === 'https://db.example.test/rest/v1/collection?id=eq.card-row') {
      patch = JSON.parse(options.body);
      return new Response(null, { status: 204 });
    }
    if (target.startsWith('https://db.example.test/rest/v1/collection?')) {
      return Response.json([{ id: 'card-row', card_id: 'tcg:12345:Reverse%20Holofoil', value: 4.25 }]);
    }
    if (target === 'https://api.tcgapi.dev/v1/cards/12345/prices?printing=Reverse+Holofoil') {
      assert.equal(options.headers['X-API-Key'], 'tcg-key');
      return Response.json({ data: [{ printing: 'Reverse Holofoil', market_price: 5.5 }] });
    }
    throw new Error('Unexpected request: ' + target);
  };
  const response = await handler();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, scanned: 1, updated: 1, failed: 0 });
  assert.equal(patch.value, 5.5);
  assert.equal(patch.previous_value, 4.25);
  assert.ok(Date.parse(patch.price_updated_at));
});
