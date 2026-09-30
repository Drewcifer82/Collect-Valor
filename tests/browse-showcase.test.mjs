import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import browseShowcase from '../Sports by Josh Hart/netlify/functions/browse-showcase.mjs';

test('Community gives unnamed collectors distinct private fallback names', async (t) => {
  const fields = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET'];
  const original = Object.fromEntries(fields.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test', SESSION_SECRET: 'test' });
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of fields) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  });

  const payload = Buffer.from(JSON.stringify({ u: 'viewer@example.test' })).toString('base64url');
  const token = `${payload}.${crypto.createHmac('sha256', 'test').update(payload).digest('base64url')}`;
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address.includes('/collection?')) {
      return Response.json([
        { id: 'one', owner: 'first@example.test', is_showcase: true, created_at: '2026-09-30T00:00:00Z', player: 'First' },
        { id: 'two', owner: 'second@example.test', is_showcase: true, created_at: '2026-09-30T00:00:00Z', player: 'Second' },
      ]);
    }
    if (address.includes('/collector_profiles?')) return Response.json([]);
    throw new Error(`Unexpected request: ${address}`);
  };

  const response = await browseShowcase(new Request('http://localhost/browse-showcase', { method: 'POST', body: JSON.stringify({ token }) }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.binders.length, 2);
  assert.match(data.binders[0].owner, /^Collector [A-F0-9]{10}$/);
  assert.match(data.binders[1].owner, /^Collector [A-F0-9]{10}$/);
  assert.notEqual(data.binders[0].owner, data.binders[1].owner);
});
