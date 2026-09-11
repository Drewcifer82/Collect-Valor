// Keep-alive ping. Hit this from cron-job.org once a day so Supabase sees
// real database activity and never auto-pauses the project after 7 idle days.
//
// It does an ACTUAL DB read (not just a gateway hit) — a bare Supabase URL can
// 401 at the edge without ever touching Postgres, which is why a naive ping
// looks alive but lets the project pause anyway.
//
// No auth token: this is a public, read-only heartbeat. It returns a tiny JSON
// so you can eyeball it in a browser too.

export default async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ ok: false, error: 'Server not configured' }, 500);

  try {
    // Lightweight real query: touch one row so Postgres actually runs.
    const r = await fetch(
      `${url}/rest/v1/collection?select=id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!r.ok) throw new Error('DB read failed: ' + r.status);
    await r.json();
    return json({ ok: true, pinged: new Date().toISOString() });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) }, 502);
  }
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
