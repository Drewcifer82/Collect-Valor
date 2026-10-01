import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import saveFeedback from '../Sports by Josh Hart/netlify/functions/save-feedback.mjs';

const secret = 'feedback-test-secret';

function token(owner = 'collector@example.test') {
  const payload = Buffer.from(JSON.stringify({ u: owner, exp: Date.now() + 60_000 })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

test('feedback saves only validated fields under the signed-in owner', async (t) => {
  const originalFetch = globalThis.fetch;
  const original = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET: process.env.SESSION_SECRET };
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SESSION_SECRET: secret });
  t.after(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  let request;
  globalThis.fetch = async (url, options) => { request = { url: String(url), options }; return new Response('', { status: 201 }); };
  const response = await saveFeedback(new Request('http://localhost/save-feedback', { method: 'POST', body: JSON.stringify({ token: token(), rating: 5, category: 'idea', message: 'A useful idea.', contact_ok: true, share_ok: false, owner: 'attacker@example.test' }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(request.url, 'https://db.example.test/rest/v1/feedback');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { owner: 'collector@example.test', rating: 5, category: 'idea', message: 'A useful idea.', contact_ok: true, share_ok: false });
});

test('feedback rejects unsigned or invalid submissions before saving', async (t) => {
  const originalFetch = globalThis.fetch;
  const original = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET: process.env.SESSION_SECRET };
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SESSION_SECRET: secret });
  t.after(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  globalThis.fetch = async () => { throw new Error('must not write'); };
  const unsigned = await saveFeedback(new Request('http://localhost/save-feedback', { method: 'POST', body: JSON.stringify({ rating: 5, category: 'idea', message: 'No session' }) }));
  assert.equal(unsigned.status, 401);
  const invalid = await saveFeedback(new Request('http://localhost/save-feedback', { method: 'POST', body: JSON.stringify({ token: token(), rating: 8, category: 'idea', message: 'Invalid rating' }) }));
  assert.equal(invalid.status, 400);
});
