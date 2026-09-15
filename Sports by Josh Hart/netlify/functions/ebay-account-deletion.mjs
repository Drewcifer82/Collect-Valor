import crypto from 'node:crypto';

// eBay requires every production application to expose this endpoint before it
// enables the keyset. Collect Valor does not store eBay user data, so deletion
// notices only need to be acknowledged.
const ENDPOINT = 'https://collectvalor.com/.netlify/functions/ebay-account-deletion';
const VERIFICATION_TOKEN = 'CV_eBayDelete_2026_7kQ4mP9xR2vN8dL5sH1wT6y';

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const challengeCode = url.searchParams.get('challenge_code');
    if (!challengeCode) return json({ error: 'Challenge code is required' }, 400);

    const challengeResponse = crypto
      .createHash('sha256')
      .update(challengeCode + VERIFICATION_TOKEN + ENDPOINT)
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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
