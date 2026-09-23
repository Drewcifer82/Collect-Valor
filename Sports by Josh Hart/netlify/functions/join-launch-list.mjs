// Temporary opening-day notification signup. Stores only a normalized email in
// Supabase. No IP address, browser identifier, account token, or analytics data
// is written by this function.

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  // Quietly accept bot-filled forms without storing anything.
  if (String(body.website || '').trim()) return json({ ok: true });

  const email = String(body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: 'Signup is not configured yet.' }, 500);

  try {
    const response = await fetch(`${url}/rest/v1/launch_waitlist?on_conflict=email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    return json({ ok: true });
  } catch (error) {
    return json({ error: 'Could not save your email right now. Please try again.', detail: String(error && error.message || error) }, 502);
  }
};

function isEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
