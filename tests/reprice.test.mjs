import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../Sports by Josh Hart/netlify/functions/reprice.mjs';

test('daily reprice keeps yesterday’s value and refreshes market or condition pricing', async t => {
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
  const patches = {};
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.startsWith('https://db.example.test/rest/v1/collection?id=eq.')) {
      patches[target.split('id=eq.')[1]] = JSON.parse(options.body);
      return new Response(null, { status: 204 });
    }
    if (target.startsWith('https://db.example.test/rest/v1/collection?')) {
      assert.match(target, /select=id,card_id,value,grade/);
      return Response.json([
        { id: 'card-row', card_id: 'tcg:12345:Reverse%20Holofoil', value: 4.25, grade: '' },
        { id: 'condition-row', card_id: 'tcg:54321:Holofoil', value: 9, grade: 'LP' },
      ]);
    }
    if (target === 'https://api.tcgapi.dev/v1/cards/12345/prices?printing=Reverse+Holofoil') {
      assert.equal(options.headers['X-API-Key'], 'tcg-key');
      return Response.json({ data: [{ printing: 'Reverse Holofoil', market_price: 5.5 }] });
    }
    if (target === 'https://api.tcgapi.dev/v1/cards/54321/prices/conditions?printing=Holofoil') {
      return Response.json({ data: [{ printing: 'Holofoil', condition: 'Lightly Played', median_with_shipping: 7.75 }] });
    }
    throw new Error('Unexpected request: ' + target);
  };
  const response = await handler();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, scanned: 2, updated: 2, failed: 0 });
  assert.equal(patches['card-row'].value, 5.5);
  assert.equal(patches['card-row'].previous_value, 4.25);
  assert.equal(patches['condition-row'].value, 7.75);
  assert.equal(patches['condition-row'].previous_value, 9);
  assert.ok(Date.parse(patches['card-row'].price_updated_at));
});
