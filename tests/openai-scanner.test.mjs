import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import identify from '../Sports by Josh Hart/netlify/functions/identify.mjs';

const card = {
  identified: true, confidence: 'high', card_type: 'pokemon', category: 'Pokemon',
  player: "Hop's Dubwool", team: '', sport: '', position: '', year: '', brand: 'Pokemon',
  set: '', number: '136/159', variation: '', finish: 'Holofoil', rarity: 'Rare', rarity_mark: 'black star', special_stamp: '', language: 'English', rookie: false, estimate: '',
};
const secret = 'test-session-secret';
const payload = Buffer.from(JSON.stringify({ u: 'test@example.com' })).toString('base64url');
const token = payload + '.' + crypto.createHmac('sha256', secret).update(payload).digest('base64url');
const completed = () => ({ status: 'completed', output: [
  { type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(card) }] },
], usage: { input_tokens: 1000, output_tokens: 200 } });
async function scan(body = {}) {
  const response = await identify(new Request('http://localhost/identify', {
    method: 'POST', body: JSON.stringify({ image: 'data:image/jpeg;base64,dGVzdA==', token, ...body }),
  }));
  return { status: response.status, data: await response.json() };
}

test('OpenAI scanner integration', async t => {
  const originalFetch = globalThis.fetch;
  const fields = ['OPENAI_API_KEY', 'OPENAI_VISION_MODEL', 'SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const original = Object.fromEntries(fields.map(k => [k, process.env[k]]));
  Object.assign(process.env, { OPENAI_API_KEY: 'test-key', SESSION_SECRET: secret,
    SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-db-key' });
  delete process.env.OPENAI_VISION_MODEL;
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of fields) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  });
  await t.test('member scan sends high-detail image and strict schema to Responses', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      const request = JSON.parse(options.body);
      assert.equal(request.model, 'gpt-5-mini');
      assert.equal(request.store, false);
      assert.equal(request.input[0].content[1].detail, 'high');
      assert.equal(request.input[0].content[1].image_url, 'data:image/jpeg;base64,dGVzdA==');
      assert.equal(request.text.format.strict, true);
      assert.equal(request.text.format.schema.additionalProperties, false);
      assert.ok(request.text.format.schema.properties.finish);
      assert.ok(request.text.format.schema.properties.rarity_mark);
      return Response.json(completed());
    };
    const result = await scan();
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.card, card);
    assert.equal(result.data.member, true);
    assert.equal(result.data.usage.input_tokens, 1000);
  });
  await t.test('refusal, truncation, and invalid output are failures, not fabricated cards', async () => {
    for (const data of [
      { status: 'incomplete', output: [] },
      { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] },
      { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] },
    ]) {
      globalThis.fetch = async () => Response.json(data);
      assert.equal((await scan()).status, 502);
    }
  });
  await t.test('quota failure gives actionable error without exposing provider details', async () => {
    globalThis.fetch = async () => Response.json({ error: { code: 'credit_balance_exhausted', type: 'insufficient_quota', message: 'private provider details' } }, { status: 429 });
    const result = await scan();
    assert.equal(result.status, 502);
    assert.match(result.data.error, /billing/i);
    assert.equal(result.data.detail, undefined);
  });
  await t.test('missing image makes no provider call', async () => {
    globalThis.fetch = async () => { throw new Error('Unexpected request'); };
    assert.equal((await scan({ image: '' })).status, 400);
  });
  await t.test('guest limit prevents a scan before the provider is called', async () => {
    globalThis.fetch = async url => {
      assert.match(String(url), /consume_guest_scan/);
      return Response.json(0);
    };
    const result = await scan({ token: '' });
    assert.equal(result.status, 200);
    assert.equal(result.data.paywall, true);
  });
  await t.test('guest scan reserves one free scan and reports the remaining allowance', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('consume_guest_scan')) return Response.json(3);
      if (String(url).includes('api.openai.com')) return Response.json(completed());
      throw new Error(`Unexpected request ${url}`);
    };
    const result = await scan({ token: '', guest_id: 'device_identifier_1234' });
    assert.equal(result.status, 200);
    assert.equal(result.data.member, false);
    assert.equal(result.data.free_remaining, 32);
    assert.match(result.data.guest_token, /^[^.]+\.[^.]+$/);
    assert.match(result.data.price_proof, /^[^.]+\.[^.]+$/);
  });
  await t.test('failed guest scan returns its reserved allowance', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes('consume_guest_scan')) return Response.json(1);
      if (String(url).includes('api.openai.com')) return Response.json({ error: {} }, { status: 503 });
      if (String(url).includes('release_guest_scan')) return new Response(null, { status: 204 });
      throw new Error(`Unexpected request ${url}`);
    };
    assert.equal((await scan({ token: '' })).status, 502);
    assert.ok(calls.some(url => url.includes('release_guest_scan')));
  });
});
