// Keep-alive endpoint. Ping this on a schedule (e.g. cron-job.org) so the
// Supabase free-tier project registers activity and does not auto-pause.
// Does one tiny read against the DB, which is what actually counts as activity.

export default async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ ok: false, error: 'Server not configured' }, 500);

  try {
    const resp = await fetch(
      `${url}/rest/v1/collection?select=id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const alive = resp.ok;
    return json({ ok: alive, pinged: new Date().toISOString() }, alive ? 200 : 502);
  } catch {
    return json({ ok: false, error: 'DB unreachable' }, 502);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
