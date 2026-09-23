import { test } from 'node:test';
import assert from 'node:assert/strict';
import joinLaunchList from '../Sports by Josh Hart/netlify/functions/join-launch-list.mjs';

async function submit(body, method = 'POST') {
  const response = await joinLaunchList(new Request('http://localhost/.netlify/functions/join-launch-list', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  }));
  return { status: response.status, data: await response.json() };
}

test('opening-day notification signup', async t => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://db.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  t.after(() => {
    globalThis.fetch = originalFetch;
    originalUrl === undefined ? delete process.env.SUPABASE_URL : process.env.SUPABASE_URL = originalUrl;
    originalKey === undefined ? delete process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  await t.test('accepts only POST', async () => {
    const result = await submit({}, 'GET');
    assert.equal(result.status, 405);
  });

  await t.test('rejects an invalid email', async () => {
    const result = await submit({ email: 'not-an-email' });
    assert.equal(result.status, 400);
  });

  await t.test('quietly ignores the bot honeypot', async () => {
    globalThis.fetch = async () => { throw new Error('should not store bot submission'); };
    const result = await submit({ email: 'bot@example.com', website: 'spam' });
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);
  });

  await t.test('normalizes and upserts the email without visitor data', async () => {
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url: String(url), options };
      return new Response(null, { status: 201 });
    };
    const result = await submit({ email: '  Collector@Example.COM  ' });
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);
    assert.equal(request.url, 'https://db.example.test/rest/v1/launch_waitlist?on_conflict=email');
    assert.deepEqual(JSON.parse(request.options.body), { email: 'collector@example.com' });
    assert.equal(request.options.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  });
});
