import crypto from 'node:crypto';

// Identifies a trading card (sports OR Pokemon) from a photo using Claude (Sonnet)
// vision. Gated by the session token issued at login, so only signed-in users can
// spend the API key. The ANTHROPIC_API_KEY stays server-side only.
// Upgraded Haiku -> Sonnet (Aug 14) for better transcription accuracy — misreads
// were the main cause of Card Hedge match failures.
//
// This is the TRANSCRIBER step: it reads the card into structured text. Card Hedge
// (cardhedge.mjs) then matches that text to a real card_id and returns pricing. The
// "category" field it emits is the handshake — Card Hedge needs the specific sport
// for sports cards, or exactly "Pokemon" for Pokemon cards.

const MODEL = 'claude-sonnet-4-5-20250929';
const FREE_LIMIT = 7; // free trial scans per guest, counted server-side by IP

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const secret = process.env.SESSION_SECRET;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !apiKey) return json({ error: 'Server not configured' }, 500);

  const image = String(body.image || '').replace(/^data:image\/\w+;base64,/, '');
  if (!image) return json({ error: 'No image provided' }, 400);

  // Members (token decodes to an email) scan unlimited. Guests get FREE_LIMIT free
  // scans, counted server-side by IP so clearing cookies / reopening can't reset it.
  const member = memberFromToken(body.token, secret);
  let guestHash = null, guestUsed = 0, freeRemaining = null, guestToken = null;
  if (!member) {
    if (!sbUrl || !sbKey) return json({ error: 'Server not configured' }, 500);
    guestHash = hashIp(clientIp(req), secret);
    try { guestUsed = await getFreeCount(sbUrl, sbKey, guestHash); } catch { guestUsed = 0; }
    if (guestUsed >= FREE_LIMIT) {
      return json({ ok: false, paywall: true, free_remaining: 0, error: 'Free scans used up' });
    }
    freeRemaining = FREE_LIMIT - (guestUsed + 1);
    guestToken = signGuest(guestHash, secret);
  }

  // SPEED NOTE (Aug 18): trimmed to only the fields needed to name + price the card.
  // The slow part of a scan is how much text the model has to WRITE, so the verbose
  // fields (highlights / visible_text / notes) were removed from this blocking call.
  // Accuracy-critical fields (number, variation) are kept and emphasized — that read
  // is our edge over apps that default cards to "holo". Output is one compact line.
  const prompt =
    'You are an expert trading-card identifier covering BOTH sports cards ' +
    '(baseball, basketball, football, hockey, soccer, etc.) AND Pokemon cards. ' +
    'Decide which kind it is, then read it carefully. Be exact on the collector "number" ' +
    'and the "variation" (holo vs non-holo, parallel, refractor, insert, serial #) — do NOT ' +
    'assume a card is holo/special unless the card clearly shows it. ' +
    'Read "set" exactly as printed on the card INCLUDING any insert or parallel subset name ' +
    '(e.g. "Prizm Stained Glass", "Donruss Optic", "Select", "Mosaic") — use the full specific ' +
    'set name, not just the base brand. Read "year" from the card itself (copyright/design), not a guess. ' +
    'Respond with ONLY a single-line raw JSON object, no markdown fences, no commentary, ' +
    'no extra whitespace, exactly this shape: ' +
    '{"identified":boolean,"confidence":"high"|"medium"|"low","card_type":"sports"|"pokemon"|"other",' +
    '"category":string,"player":string,"team":string,"sport":string,"position":string,' +
    '"year":string,"brand":string,"set":string,"number":string,"variation":string,"language":string,' +
    '"rookie":boolean,"estimate":string}. ' +
    'Use empty strings for unknowns. "category" MUST be set — it drives the price lookup: for a ' +
    'sports card the specific sport capitalized ("Baseball","Basketball","Football","Hockey","Soccer"), ' +
    'for a Pokemon card exactly "Pokemon". ' +
    'SPORTS: "player"=athlete, "team"=team, "sport"=sport, "position"=position, "brand"=manufacturer ' +
    '(Topps, Panini, Upper Deck, Bowman, Fleer, Donruss, etc.), "rookie"=true only if a rookie card, ' +
    '"variation"=parallel/insert/refractor/serial/auto/relic note. ' +
    'POKEMON: "player"=Pokemon plus card name (e.g. "Charizard ex","Pikachu VMAX"), "brand"="Pokemon", ' +
    '"set"=set/expansion (e.g. "151","Base Set"), "number"=collector number exactly as printed ' +
    '(e.g. "199/165","4/102"), "variation"=rarity/parallel (holo, reverse holo, full art, illustration ' +
    'rare, 1st edition, promo, etc.); leave "team","sport","position" empty and "rookie" false. ' +
    'Read the collector number digit by digit from the bottom edge and then recheck it against the photo. ' +
    'Do not substitute a familiar card number, set, year, or English card title based on the artwork. ' +
    'If any number digit is obscured, blurred, or uncertain, leave number empty and lower confidence. ' +
    '"language"=the language printed on the card, such as English, Japanese, Simplified Chinese, or Traditional Chinese. ' +
    'For non-English cards preserve the printed card title in player if you cannot verify the official English title. ' +
    'Do not assume a translated title, English expansion, or English release year describes the same printing. ' +
    'High confidence requires the name and full collector number to be clearly readable. ' +
    '"estimate" must be empty: transcribe the card only, never invent a value or price range. ' +
    'If you cannot identify the exact card, still fill what you can and set identified=false. ' +
    'Never return an all-empty object.';

  let text;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: image },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: 'Vision service error', detail }, 502);
    }
    const data = await resp.json();
    text = data?.content?.[0]?.text || '';
  } catch {
    return json({ error: 'Could not reach vision service' }, 502);
  }

  const card = parseCard(text);
  if (!member && guestHash) { try { await bumpFreeCount(sbUrl, sbKey, guestHash, guestUsed); } catch {} }
  return json({ ok: true, card, raw: text, member: !!member, free_remaining: freeRemaining, guestToken });
};

function parseCard(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { identified: false, notes: text.slice(0, 300) };
  }
}

function verify(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function memberFromToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (d && d.u && !d.guest) return String(d.u).toLowerCase();
    return null;
  } catch { return null; }
}

function signGuest(iphash, secret) {
  const payload = Buffer.from(JSON.stringify({ guest: true, ip: iphash, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function clientIp(req) {
  return req.headers.get('x-nf-client-connection-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'unknown';
}
function hashIp(ip, secret) { return crypto.createHmac('sha256', secret).update('ip:' + ip).digest('hex'); }

async function getFreeCount(url, key, id) {
  const r = await fetch(`${url}/rest/v1/free_scans?id=eq.${encodeURIComponent(id)}&select=count`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) return 0;
  const rows = await r.json();
  return (Array.isArray(rows) && rows[0] && Number(rows[0].count)) || 0;
}
async function bumpFreeCount(url, key, id, used) {
  await fetch(`${url}/rest/v1/free_scans?on_conflict=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, count: used + 1, last_at: new Date().toISOString() }),
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
