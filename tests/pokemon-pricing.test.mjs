import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../Sports by Josh Hart/netlify/functions/cardhedge.mjs';

// Provider contract examples: https://tcgapi.dev/api/search/ and /api/cards/.
const card = { id: 12345, name: 'Charizard ex', number: '125/197', set_name: 'Obsidian Flames', printing: 'Normal' };
const secret = 'local-test-secret';
const token = 'test.' + crypto.createHmac('sha256', secret).update('test').digest('base64url');
async function request(body) {
  const response = await handler(new Request('http://localhost/cardhedge', {
    method: 'POST', body: JSON.stringify({ token, ...body }),
  }));
  return { status: response.status, data: await response.json() };
}

test('Pokemon pricing integration', async t => {
  const originalFetch = globalThis.fetch;
  const oldSecret = process.env.SESSION_SECRET;
  const oldKey = process.env.TCGAPI_KEY;
  process.env.SESSION_SECRET = secret;
  process.env.TCGAPI_KEY = 'test-key';
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = oldSecret;
    if (oldKey === undefined) delete process.env.TCGAPI_KEY; else process.env.TCGAPI_KEY = oldKey;
  });
  const scan = { card: { player: card.name, number: card.number, set: card.set_name, category: 'pokemon' } };
  for (const [label, fields, expected] of [
    ['numeric price', { price: 12.47 }, 12.47],
    ['market price', { market_price: 24.99 }, 24.99],
    ['string price', { price: '12.47' }, 12.47],
    ['zero price', { price: 0 }, 0],
    ['missing price', { price: null }, null],
    ['invalid price', { price: false }, null],
  ]) await t.test(label, async () => {
    globalThis.fetch = async () => Response.json({ data: [{ ...card, ...fields }] });
    const result = await request(scan);
    assert.equal(result.status, 200);
    assert.equal(result.data.fmv?.price ?? null, expected);
    assert.equal(result.data.card.card_id, 'tcg:12345:Normal');
  });
  await t.test('search and selected-card refresh use TCG API only', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      assert.equal(options.headers['X-API-Key'], 'test-key');
      assert.equal(new URL(url).hostname, 'api.tcgapi.dev');
      return Response.json({ data: String(url).includes('/prices')
        ? [{ printing: 'Normal', market_price: 24.99 }, { printing: 'Foil', market_price: 42.50 }]
        : [{ ...card, price: 12.47 }] });
    };
    const search = await request({ search: 'Charizard', category: 'Pokémon' });
    assert.equal(search.data.results[0].prices[0].price, 12.47);
    const selected = await request({ card_id: search.data.results[0].card_id, grade: 'Raw' });
    assert.equal(selected.data.fmv.price, 24.99);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /\/cards\/12345\/prices\?printing=Normal$/);
  });
  await t.test('general search includes Pokemon without relying on Card Hedge', async () => {
    globalThis.fetch = async url => {
      if (String(url).includes('cardhedger')) return Response.json({ error: 'unavailable' }, { status: 503 });
      return Response.json({ data: [{ ...card, price: 12.47 }] });
    };
    const result = await request({ search: 'Charizard' });
    assert.equal(result.data.results[0].card_id, 'tcg:12345:Normal');
  });
  await t.test('ambiguous scans ask for a selection instead of using an expensive card', async () => {
    globalThis.fetch = async () => Response.json({ data: [{ ...card, price: 12.47 }, { ...card, id: 54321, price: 900 }] });
    assert.equal((await request(scan)).data.matched, false);
  });
  await t.test('provider rejection does not become a successful empty search', async () => {
    globalThis.fetch = async () => Response.json({ error: 'X-PAYMENT header is required' }, { status: 402 });
    assert.equal((await request(scan)).status, 502);
    assert.equal((await request({ search: 'Charizard', category: 'pokemon' })).status, 502);
  });
  await t.test('unauthenticated requests spend no API calls', async () => {
    globalThis.fetch = async () => { throw new Error('must not fetch'); };
    assert.equal((await request({ token: 'bad', ...scan })).status, 401);
  });
});
