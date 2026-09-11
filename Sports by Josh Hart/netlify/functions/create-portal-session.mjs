import crypto from 'node:crypto';

// Opens the Stripe Customer Portal for the signed-in member so they can update
// their card, see invoices, or CANCEL — all self-service, no email to us.
// Token-gated (same signed token as every other gated function). We map the
// token's email -> the subscriber's Stripe customer id, then mint a one-time
// portal session URL and hand it back for the client to redirect to.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET, STRIPE_SECRET_KEY.

const COMP_EMAILS = [
  'paradigmnguy3339@gmail.com',
  'paradigmnguy3339@duck.com',
];

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!url || !key || !secret || !stripeKey) return json({ error: 'Server not configured' }, 500);

  const email = ownerFromToken(body.token, secret);
  if (!email) return json({ ok: false, error: 'Not signed in' }, 401);

  // Comp accounts have no Stripe subscription to manage.
  if (COMP_EMAILS.includes(email)) {
    return json({ ok: false, comp: true, error: "This account is comped — there's no paid subscription to manage." }, 200);
  }

  // Find the payer's Stripe customer id.
  let customer = null;
  try {
    const rows = await sbGet(url, key, `/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=stripe_customer_id`);
    customer = Array.isArray(rows) && rows[0] && rows[0].stripe_customer_id;
  } catch (err) {
    return json({ error: 'Server error', detail: String(err && err.message || err) }, 500);
  }
  if (!customer) {
    return json({ ok: false, error: "We couldn't find a subscription for this email. If you just subscribed, give it a minute and try again." }, 200);
  }

  // Mint a one-time Stripe billing portal session.
  const origin = originFrom(req);
  try {
    const form = new URLSearchParams();
    form.set('customer', customer);
    form.set('return_url', `${origin}/#profile`);
    const r = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = await r.json();
    if (!r.ok || !data || !data.url) {
      const msg = (data && data.error && data.error.message) || `Stripe ${r.status}`;
      return json({ ok: false, error: 'Could not open the billing portal. Please try again.', detail: msg }, 200);
    }
    return json({ ok: true, url: data.url }, 200);
  } catch (err) {
    return json({ error: 'Server error', detail: String(err && err.message || err) }, 500);
  }
};

function originFrom(req) {
  try {
    const o = req.headers.get('origin');
    if (o && /^https?:\/\//.test(o)) return o.replace(/\/$/, '');
  } catch {}
  return 'https://collectvalor.com';
}

function ownerFromToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  let good = false;
  try { good = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return null; }
  if (!good) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const u = String(data.u || '').trim().toLowerCase();
    return u || null;
  } catch { return null; }
}

async function sbGet(url, key, path) {
  const r = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Supabase GET ${path} -> ${r.status}`);
  return r.json();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
