import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import save from '../Sports by Josh Hart/netlify/functions/save-card.mjs';

test('collection uses one 50-card limit and rejects new slabs', async t => {
  const originalFetch = globalThis.fetch;
  const fields = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET'];
  const original = Object.fromEntries(fields.map(k => [k, process.env[k]]));
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test', SESSION_SECRET: 'test' });
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of fields) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  });
  const payload = Buffer.from(JSON.stringify({ u: 'collector' })).toString('base64url');
  const token = payload + '.' + crypto.createHmac('sha256', 'test').update(payload).digest('base64url');
  const request = (extra = {}) => save(new Request('http://localhost/save-card', { method: 'POST', body: JSON.stringify({ token, image: 'data:image/jpeg;base64,dGVzdA==', card: { player: 'Test card' }, ...extra }) }));
  await t.test('new slab rejected without upload or database write', async () => {
    globalThis.fetch = async () => { throw Error('Unexpected network call'); };
    assert.equal((await request({ is_slab: true })).status, 400);
  });
  await t.test('50 existing cards including old slabs prevents upload', async () => {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(options.method, undefined);
      assert.equal(new URL(url).searchParams.get('owner'), 'eq.collector');
      assert.equal(new URL(url).searchParams.has('is_slab'), false);
      return new Response('[]', { headers: { 'content-range': '0-49/50' } });
    };
    const response = await request();
    assert.equal(response.status, 409);
    assert.equal((await response.json()).full, true);
    assert.equal(calls, 1);
  });
  await t.test('49 existing cards allows the fiftieth raw card', async () => {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      if (calls === 1) return new Response('[]', { headers: { 'content-range': '0-48/49' } });
      if (calls === 2) { assert.match(url, /storage\/v1\/object\/collection\/collector\//); return new Response('{}'); }
      const row = JSON.parse(options.body);
      assert.equal(row.is_slab, false);
      assert.equal(row.is_showcase, false);
      assert.equal(row.owner, 'collector');
      return new Response(JSON.stringify([row]));
    };
    const response = await request();
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.count, 50);
    assert.equal(data.max, 50);
    assert.equal(calls, 3);
  });
});
