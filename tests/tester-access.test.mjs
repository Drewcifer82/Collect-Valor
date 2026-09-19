import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import testerAccess from '../Sports by Josh Hart/netlify/functions/tester-access.mjs';
import identify from '../Sports by Josh Hart/netlify/functions/identify.mjs';

const secret = 'tester-session-secret';
const passCode = 'CV-TEST-40';
const expiry = '2099-10-18T23:59:59.000Z';
const card = {
  identified: true, confidence: 'high', card_type: 'pokemon', category: 'Pokemon',
  player: 'Pikachu', team: '', sport: '', position: '', year: '2026', brand: 'Pokemon',
  set: 'Test Set', number: '1/100', variation: '', finish: 'Holofoil', rarity: 'Rare',
  rarity_mark: 'black star', special_stamp: '', language: 'English', rookie: false, estimate: '',
};

async function callAccess(code) {
  const response = await testerAccess(new Request('http://localhost/.netlify/functions/tester-access', {
    method: 'POST', body: JSON.stringify({ code }),
  }));
  return { status: response.status, data: await response.json() };
}

test('temporary tester pass', async t => {
  const originalFetch = globalThis.fetch;
  const keys = ['SESSION_SECRET', 'TESTER_PASS_CODE', 'TESTER_PASS_EXPIRES_AT', 'OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    SESSION_SECRET: secret, TESTER_PASS_CODE: passCode, TESTER_PASS_EXPIRES_AT: expiry,
    OPENAI_API_KEY: 'openai-test-key', SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'db-test-key',
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of keys) original[key] === undefined ? delete process.env[key] : process.env[key] = original[key];
  });

  await t.test('rejects the wrong pass code', async () => {
    const result = await callAccess('wrong-code');
    assert.equal(result.status, 401);
  });

  await t.test('creates an anonymous fixed-expiry session', async () => {
    const result = await callAccess(passCode);
    assert.equal(result.status, 200);
    assert.equal(result.data.email, 'Anonymous tester');
    assert.equal(result.data.scan_limit, 40);
    assert.equal(result.data.expires_at, expiry);
    const [payload, signature] = result.data.token.split('.');
    assert.equal(signature, crypto.createHmac('sha256', secret).update(payload).digest('base64url'));
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    assert.ok(decoded.tester);
    assert.equal(decoded.exp, Date.parse(expiry));
  });

  await t.test('consumes one of 40 scans before calling the vision provider', async () => {
    const { data: access } = await callAccess(passCode);
    let rpcCalled = false;
    globalThis.fetch = async (url) => {
      if (String(url).includes('/rpc/consume_tester_scan')) {
        rpcCalled = true;
        return Response.json(1);
      }
      assert.equal(rpcCalled, true);
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(card) }] }] });
    };
    const response = await identify(new Request('http://localhost/identify', { method: 'POST', body: JSON.stringify({ image: 'dGVzdA==', token: access.token }) }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.tester_scans_remaining, 39);
  });

  await t.test('blocks scan 41 before calling the paid provider', async () => {
    const { data: access } = await callAccess(passCode);
    let calls = 0;
    globalThis.fetch = async url => {
      calls += 1;
      assert.match(String(url), /consume_tester_scan/);
      return Response.json(null);
    };
    const response = await identify(new Request('http://localhost/identify', { method: 'POST', body: JSON.stringify({ image: 'dGVzdA==', token: access.token }) }));
    assert.equal(response.status, 429);
    assert.equal(calls, 1);
  });
});
