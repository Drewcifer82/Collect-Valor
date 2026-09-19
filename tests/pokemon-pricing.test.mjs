import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../Sports by Josh Hart/netlify/functions/cardhedge.mjs';

// Provider contract examples: https://tcgapi.dev/api/search/ and /api/cards/.
const card = { id: 12345, name: 'Charizard ex', number: '125/197', set_name: 'Obsidian Flames', printing: 'Normal' };
const secret = 'local-test-secret';
const tokenPayload = Buffer.from(JSON.stringify({ u: 'test@example.com' })).toString('base64url');
const token = tokenPayload + '.' + crypto.createHmac('sha256', secret).update(tokenPayload).digest('base64url');
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
    assert.equal(search.data.results[0].prices[0].price, 24.99);
    assert.equal(search.data.results[1].variant, 'Foil');
    const selected = await request({ card_id: search.data.results[0].card_id, grade: 'Raw' });
    assert.equal(selected.data.fmv.price, 24.99);
    assert.equal(calls.length, 3);
    assert.match(calls[1], /\/cards\/12345\/prices$/);
    assert.match(calls[2], /\/cards\/12345\/prices\?printing=Normal$/);
  });
  await t.test('repeat searches fetch all editions and selected prices stay fresh with database configured', async () => {
    const envKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const saved = envKeys.map(k => process.env[k]);
    process.env.SUPABASE_URL = 'https://db.example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-db-key';
    let reads = 0;
    globalThis.fetch = async url => {
      const parsed = new URL(url);
      assert.equal(parsed.hostname, 'api.tcgapi.dev');
      if (parsed.pathname === '/v1/search') return Response.json({ data: [
        { ...card, name: 'Unown S', number: '87/105', printing: '1st Edition' },
      ] });
      assert.equal(parsed.pathname, '/v1/cards/12345/prices');
      reads++;
      const rows = [
        { printing: '1st Edition', market_price: 5 },
        { printing: 'Unlimited', market_price: reads },
      ];
      return Response.json({ data: parsed.searchParams.has('printing')
        ? rows.filter(r => r.printing === parsed.searchParams.get('printing')) : rows });
    };
    try {
      for (let i = 1; i <= 2; i++) {
        const result = await request({ search: 'Unown S', category: 'pokemon', number: '87/105' });
        assert.equal(result.status, 200);
        assert.deepEqual(result.data.results.map(c => c.variant), ['1st Edition', 'Unlimited']);
        assert.equal(result.data.results[1].prices[0].price, i);
      }
      for (let i = 3; i <= 4; i++) {
        const result = await request({ card_id: 'tcg:12345:Unlimited', grade: 'Raw' });
        assert.equal(result.data.fmv.price, i);
      }
      assert.equal(reads, 4);
    } finally {
      envKeys.forEach((k, i) => {
        if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i];
      });
    }
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
  await t.test('Koraidon search expands regular and reverse holo without mixing promos', async () => {
    const calls = [];
    globalThis.fetch = async url => {
      calls.push(String(url));
      if (String(url).includes('/search?')) return Response.json({ data: [
        { ...card, id: 111, name: 'Koraidon', number: '119/162', printing: 'Reverse Holofoil' },
        { ...card, id: 111, name: 'Koraidon', number: '119/162', printing: 'Reverse Holofoil' },
        { ...card, id: 222, name: 'Koraidon (Cosmos Holo)', number: '119/162' },
        { ...card, id: 333, number: '001/100' },
      ] });
      if (String(url).includes('/111/prices')) return Response.json({ data: [
        { printing: 'Holofoil', market_price: 0.08 },
        { printing: 'Reverse Holofoil', market_price: 0.13 },
      ] });
      assert.match(String(url), /222\/prices$/);
      return Response.json({ data: { printing: 'Holofoil', market_price: 2.50 } });
    };
    const result = await request({ search: 'Koraidon', category: 'pokemon', number: '119/162' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.results.map(c => [c.card_id, c.prices[0].price]), [
      ['tcg:111:Holofoil', 0.08], ['tcg:111:Reverse%20Holofoil', 0.13], ['tcg:222:Holofoil', 2.50],
    ]);
    assert.equal(calls.length, 3);
    const selected = await request({ card_id: 'tcg:111:Holofoil', grade: 'Raw' });
    assert.equal(selected.data.fmv.price, 0.08);
  });
  await t.test('single search hit with multiple finishes requires selection', async () => {
    globalThis.fetch = async url => Response.json({ data: String(url).includes('/prices')
      ? [{ printing: 'Holofoil', market_price: 0.08 }, { printing: 'Reverse Holofoil', market_price: 0.13 }]
      : [{ ...card, printing: 'Reverse Holofoil', price: 0.13 }] });
    assert.equal((await request(scan)).data.matched, false);
  });
  await t.test('a clearly read finish selects its exact TCG API price', async () => {
    globalThis.fetch = async url => Response.json({ data: String(url).includes('/prices')
      ? [{ printing: 'Normal', market_price: 0.08 }, { printing: 'Foil', market_price: 1.13 }]
      : [card] });
    const result = await request({ card: { ...scan.card, finish: 'Holofoil' } });
    assert.equal(result.data.matched, true);
    assert.equal(result.data.card.card_id, 'tcg:12345:Foil');
    assert.equal(result.data.fmv.price, 1.13);
  });
  await t.test('scan identity maps set name to set ID and sends rarity and printing filters', async () => {
    globalThis.fetch = async url => {
      const target = String(url);
      if (target.includes('/games/pokemon/sets?')) return Response.json({ data: [
        { id: 777, name: 'Obsidian Flames', abbreviation: 'OBF' },
      ] });
      if (target.includes('/search?')) {
        const params = new URL(target).searchParams;
        assert.equal(params.get('set_id'), '777');
        assert.equal(params.get('rarity'), 'Double Rare');
        assert.equal(params.get('printing'), 'Foil');
        return Response.json({ data: [{ ...card, rarity: 'Double Rare' }] });
      }
      return Response.json({ data: [{ printing: 'Foil', market_price: 9.99 }] });
    };
    const result = await request({ card: { ...scan.card, set: 'Obsidian Flames', rarity: 'Double Rare', finish: 'Holofoil' } });
    assert.equal(result.data.matched, true);
    assert.equal(result.data.fmv.price, 9.99);
  });
  await t.test('exact match resolves TCG and TCGplayer IDs before price lookup', async () => {
    globalThis.fetch = async url => {
      const target = String(url);
      if (target.includes('/games/pokemon/sets?')) return Response.json({ data: [] });
      if (target.includes('/search?')) return Response.json({ data: [card] });
      if (/\/cards\/12345$/.test(target)) return Response.json({ data: { ...card, tcgplayer_id: 987654 } });
      return Response.json({ data: [{ printing: 'Normal', market_price: 3.21 }] });
    };
    const result = await request({ card: { ...scan.card, set: '' } });
    assert.equal(result.data.card.card_id, 'tcg:12345:Normal');
    assert.equal(result.data.card.tcgplayer_id, 987654);
    assert.equal(result.data.fmv.price, 3.21);
  });
  await t.test('failed finish lookup is an error, never an incomplete successful list', async () => {
    globalThis.fetch = async url => String(url).includes('/prices')
      ? Response.json({ error: 'quota' }, { status: 429 }) : Response.json({ data: [card] });
    assert.equal((await request({ search: 'Charizard', category: 'pokemon' })).status, 502);
  });
  await t.test('broad searches request refinement before spending on finishes', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ data: Array.from({ length: 13 }, (_, id) => ({ ...card, id: id + 1 })) }); };
    const result = await request({ search: 'Charizard', category: 'pokemon' });
    assert.equal(result.status, 422);
    assert.equal(result.data.code, 'refine_search');
    assert.equal(calls, 1);
  });
  await t.test('card number narrows a watchlist search before its finish prices are requested', async () => {
    const calls = [];
    globalThis.fetch = async url => {
      calls.push(String(url));
      if (String(url).includes('/search?')) return Response.json({ data: [
        { ...card, id: 11, number: '149/147' }, { ...card, id: 12, number: '138/147' },
      ] });
      assert.match(String(url), /\/cards\/11\/prices$/);
      return Response.json({ data: [{ printing: 'Normal', market_price: 4.25 }] });
    };
    const result = await request({ search: 'Lugia', number: '149/147', category: 'pokemon' });
    assert.equal(result.status, 200);
    assert.equal(result.data.results.length, 1);
    assert.equal(result.data.results[0].number, '149/147');
    assert.equal(calls.length, 2);
  });
  await t.test('unauthenticated requests spend no API calls', async () => {
    globalThis.fetch = async () => { throw new Error('must not fetch'); };
    assert.equal((await request({ token: 'bad', ...scan })).status, 401);
  });
  await t.test('Chinese printings and uncertain scans do not receive English catalog prices', async () => {
    globalThis.fetch = async () => { throw new Error('must not fetch'); };
    for (const fields of [{ language: 'Simplified Chinese' }, { confidence: 'low' }, { identified: false }]) {
      const result = await request({ card: { ...scan.card, ...fields } });
      assert.equal(result.status, 200);
      assert.equal(result.data.matched, false);
      assert.equal(result.data.fmv, undefined);
    }
  });
});
