import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import handler from '../Sports by Josh Hart/netlify/functions/ebay-account-deletion.mjs';

const endpoint = 'https://collectvalor.com/.netlify/functions/ebay-account-deletion';

test('eBay challenge response uses the required SHA-256 input order', async () => {
  const challenge = 'ebay-challenge-123';
  const response = await handler(new Request(`${endpoint}?challenge_code=${challenge}`));
  const body = await response.json();
  const expected = crypto.createHash('sha256')
    .update(challenge + 'CV_eBayDelete_2026_7kQ4mP9xR2vN8dL5sH1wT6y' + endpoint)
    .digest('hex');

  assert.equal(response.status, 200);
  assert.equal(body.challengeResponse, expected);
});

test('eBay deletion notice is acknowledged without retaining its data', async () => {
  const response = await handler(new Request(endpoint, { method: 'POST', body: '{}' }));
  assert.equal(response.status, 204);
});
