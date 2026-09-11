import crypto from 'node:crypto';

// Stripe webhook. Stripe calls this on every subscription event. We verify the
// signature by hand (no Stripe SDK), then keep our tables in sync:
//   subscribers — one row per paying email (source of truth for "is this paid?")
//   users       — if the payer has already verified/bound their email to an
//                 account, we mirror the status onto that account so login.mjs
//                 sees it (comp accounts are never touched).
//
// Configure the Stripe endpoint to send exactly these events (Snapshot payload):
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
//
// Env needed: STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

export default async (req) => {
  if (req.method !== 'POST') return text('Method not allowed', 405);

  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!whSecret || !url || !key) return text('Server not configured', 500);

  // RAW body is required for the signature — do NOT req.json() first.
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  if (!verifyStripeSig(raw, sig, whSecret)) return text('Bad signature', 400);

  let event;
  try { event = JSON.parse(raw); } catch { return text('Bad payload', 400); }

  const obj = (event.data && event.data.object) || {};
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // First payment. Record the payer; if they already bound this email to
        // an account, activate that account too.
        const email = lc((obj.customer_details && obj.customer_details.email) || obj.customer_email);
        if (email) {
          await upsertSubscriber(url, key, {
            email,
            status: 'active',
            stripe_customer_id: obj.customer || null,
            stripe_subscription_id: obj.subscription || null,
          });
          await syncUsers(url, key, `paid_email=eq.${enc(email)}`, {
            plan_status: 'active',
            stripe_customer_id: obj.customer || null,
            stripe_subscription_id: obj.subscription || null,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Renewal, reactivation, or a status change (past_due, etc.).
        const status = mapStatus(obj.status);
        const renews = tsToIso(obj.current_period_end);
        await patchSubscriber(url, key, `stripe_subscription_id=eq.${enc(obj.id)}`, {
          status, plan_renews_at: renews, stripe_customer_id: obj.customer || null,
        });
        await syncUsers(url, key, `stripe_subscription_id=eq.${enc(obj.id)}`, {
          plan_status: status, plan_renews_at: renews,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription ended — cut access.
        await patchSubscriber(url, key, `stripe_subscription_id=eq.${enc(obj.id)}`, { status: 'canceled' });
        await syncUsers(url, key, `stripe_subscription_id=eq.${enc(obj.id)}`, { plan_status: 'canceled' });
        break;
      }

      default:
        break; // ignore anything we didn't subscribe to
    }
  } catch (err) {
    // Return 500 so Stripe retries a transient DB failure. Real error text shows
    // in Netlify → Functions → stripe-webhook logs.
    return text('Handler error: ' + (err && err.message || err), 500);
  }

  return text('ok', 200);
};

// ---- Stripe signature (manual, no SDK) -------------------------------------
function verifyStripeSig(raw, header, secret) {
  if (!header) return false;
  let t = null; const v1s = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i), v = part.slice(i + 1);
    if (k === 't') t = v;
    else if (k === 'v1') v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  // Reject stale timestamps (replay guard); 5-minute tolerance.
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const eb = Buffer.from(expected);
  return v1s.some((v) => {
    const vb = Buffer.from(v);
    return vb.length === eb.length && crypto.timingSafeEqual(vb, eb);
  });
}

// ---- Supabase helpers ------------------------------------------------------
async function upsertSubscriber(url, key, row) {
  row.updated_at = new Date().toISOString();
  await sb(url, key, `/rest/v1/subscribers?on_conflict=email`, 'POST', row,
    { Prefer: 'resolution=merge-duplicates,return=minimal' });
}
async function patchSubscriber(url, key, filter, patch) {
  patch.updated_at = new Date().toISOString();
  await sb(url, key, `/rest/v1/subscribers?${filter}`, 'PATCH', patch, { Prefer: 'return=minimal' });
}
async function syncUsers(url, key, filter, patch) {
  // Mirrors status onto a bound account if one exists (no-op otherwise).
  await sb(url, key, `/rest/v1/users?${filter}`, 'PATCH', patch, { Prefer: 'return=minimal' });
}
async function sb(url, key, path, method, body, extra = {}) {
  const resp = await fetch(`${url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Supabase ${method} ${path} -> ${resp.status} ${detail}`);
  }
  return resp;
}

// ---- tiny utils ------------------------------------------------------------
function mapStatus(s) {
  s = String(s || '').toLowerCase();
  if (s === 'active' || s === 'trialing') return 'active';
  if (s === 'past_due' || s === 'unpaid') return 'past_due';
  return 'canceled'; // canceled, incomplete, incomplete_expired, paused
}
function tsToIso(sec) { return sec ? new Date(Number(sec) * 1000).toISOString() : null; }
function lc(s) { return String(s || '').trim().toLowerCase(); }
function enc(s) { return encodeURIComponent(s); }
function text(msg, status = 200) { return new Response(msg, { status, headers: { 'Content-Type': 'text/plain' } }); }
