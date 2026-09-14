import crypto from 'node:crypto';

// eBay requires every production application to expose this endpoint before it
// enables the keyset. Collect Valor does not store eBay user data, so deletion
// notices only need to be acknowledged.
const ENDPOINT = 'https://collectvalor.com/.netlify/functions/ebay-account-deletion';

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const challengeCode = url.searchParams.get('challenge_code');
    const token = String(process.env.EBAY_DELETION_VERIFICATION_TOKEN || '').trim();
    if (!challengeCode || !validToken(token)) return json({ error: 'Verification is not configured' }, 500);

    const challengeResponse = crypto
      .createHash('sha256')
      .update(challengeCode + token + ENDPOINT)
      .digest('hex');
    return json({ challengeResponse });
  }

  if (req.method === 'POST') {
    // We do not retain eBay account data. A successful acknowledgement stops
    // eBay from retrying the notification.
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Method not allowed' }, 405);
};

function validToken(token) {
  return /^[A-Za-z0-9_-]{32,80}$/.test(token);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
