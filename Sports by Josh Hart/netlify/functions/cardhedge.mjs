import crypto from 'node:crypto';

// Card Hedge bridge. Two paths, both gated by the login session token so only
// signed-in users can spend the API key. CARDHEDGE_API_KEY stays server-side.
//
//   RAW cards  → the client sends the text fields Claude vision already read off
//                the card (or a ready-made `query`). We ask Card Hedge card-match
//                to resolve it to a real card_id, then pull FMV + recent-sale comps.
//   GRADED slabs → the client sends the slab photo as `image`. Card Hedge OCR reads
//                the grading label, returns the cert, card details and price history.
//
// Card Hedge has NO raw-photo identifier, so raw cards must arrive as text — the
// vision step (identify.mjs) does that transcription first.

const API = 'https://api.cardhedger.com/v1/cards';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const secret = process.env.SESSION_SECRET;
  const apiKey = process.env.CARDHEDGE_API_KEY; // legacy paths (slab/movers/history) only
  if (!secret) return json({ error: 'Server not configured' }, 500);

  // Gate on the session token BEFORE spending any paid API call.
  if (!verify(body.token, secret)) {
    return json({ error: 'Not signed in' }, 401);
  }

  const image = String(body.image || '').replace(/^data:image\/\w+;base64,/, '');

  try {
    if (body.movers) {
      return await moversPath(body, apiKey);       // weekly top gainers
    }
    if (body.history_for) {
      return await historyPath(body, apiKey);      // card_id -> sale history
    }
    if (body.search) {
      return await searchPath(body, apiKey);       // text -> list of candidate cards
    }
    if (body.card_id) {
      return await priceByIdPath(body, apiKey);    // picked candidate -> prices
    }
    if (image) {
      return await slabPath(image, apiKey);        // slab photo -> label OCR
    }
    return await rawPath(body);            // scan transcription -> AI match
  } catch (err) {
    return json({ error: 'Card Hedge request failed', detail: String(err && err.message || err) }, 502);
  }
};

// ---- MOVERS: weekly top price gainers (GET endpoint) ----
async function moversPath(body, apiKey) {
  const params = { count: 10 };
  if (body.category) params.category = String(body.category).trim();
  const data = await chGet('/top-movers', params, apiKey);
  const cards = Array.isArray(data && data.cards) ? data.cards : [];
  return json({
    ok: true,
    movers: cards.map((c) => ({
      card_id: c.card_id || '',
      description: c.description || '',
      player: c.player || '',
      set: c.set || '',
      number: c.number || '',
      category: c.category || '',
      image: c.image || '',
      gain: c.gain != null && Number.isFinite(Number(c.gain)) ? Number(c.gain) : null,
      prices: Array.isArray(c.prices) ? c.prices : [],
    })),
  });
}

// ---- HISTORY: card_id + grade -> up to a year of individual sales ----
async function historyPath(body, apiKey) {
  const cardId = String(body.history_for || '').trim();
  if (!cardId) return json({ error: 'No card to look up' }, 400);
  const grade = String(body.grade || 'Raw').trim();
  let days = parseInt(body.days, 10);
  if (!Number.isFinite(days)) days = 365;
  days = Math.max(30, Math.min(366, days));
  const data = await ch('/prices-by-card', { card_id: cardId, grade, days }, apiKey);
  const prices = Array.isArray(data && data.prices) ? data.prices : [];
  return json({
    ok: true,
    grade,
    history: prices.map((p) => ({
      price: numOrNull(p.price),
      date: p.closing_date || '',
      grade: p.Grade || grade,
    })),
  });
}

// ---- SEARCH: free text -> candidate cards the user can pick from ----
async function searchPath(body, apiKey) {
  const search = String(body.search || '').trim();
  if (!search) return json({ error: 'Nothing to search for' }, 400);
  let ps = parseInt(body.page_size, 10);
  if (!Number.isFinite(ps)) ps = 10;
  ps = Math.max(1, Math.min(100, ps));
  const reqBody = { search, page: 1, page_size: ps };
  if (body.category) reqBody.category = String(body.category).trim();
  if (body.number) reqBody.number = String(body.number).replace(/^#/, '').trim();
  const data = await ch('/card-search', reqBody, apiKey);
  const cards = Array.isArray(data && data.cards) ? data.cards : [];
  return json({
    ok: true,
    results: cards.map((c) => ({
      card_id: c.card_id || '',
      description: c.description || '',
      player: c.player || '',
      set: c.set || '',
      number: c.number || '',
      variant: c.variant || '',
      category: c.category || '',
      image: c.image || '',
      rookie: c.rookie === true,
      prices: Array.isArray(c.prices) ? c.prices : [],
    })),
    count: data && data.count ? data.count : cards.length,
  });
}

// ---- PRICE BY ID: a chosen card_id -> FMV + comps + per-grade prices ----
async function priceByIdPath(body, apiKey) {
  const cardId = String(body.card_id || '').trim();
  const grade = String(body.grade || 'Raw').trim();
  const [fmv, comps, all, hist] = await Promise.all([
    ch('/card-fmv', { card_id: cardId, grade }, apiKey).catch(() => null),
    ch('/comps', { card_id: cardId, grade, count: 10, include_raw_prices: true }, apiKey).catch(() => null),
    ch('/all-prices-by-card', { card_id: cardId }, apiKey).catch(() => null),
    ch('/prices-by-card', { card_id: cardId, grade, days: 90 }, apiKey).catch(() => null),
  ]);
  const shapedFmv = shapeFmv(fmv);
  const history90 = hist && Array.isArray(hist.prices) ? hist.prices : [];
  return json({
    ok: true,
    matched: true,
    source: 'cardhedge',
    grade_prices: all && Array.isArray(all.prices) ? all.prices : [],
    fmv: shapedFmv,
    comps: shapeComps(comps),
    insights: computeInsights(history90, shapedFmv),
  });
}

// ---- RAW card price via tcgapi.dev (TCGplayer market price). POKEMON ONLY. ----
// Replaces the old Card Hedge match+FMV path. Returns the same shape the frontend
// reads: data.matched + data.fmv.price. Other tabs (grades/history/sales/movers)
// intentionally come back empty for now.
async function rawPath(body) {
  const tcgKey = process.env.TCGAPI_KEY;
  if (!tcgKey) return json({ error: 'Server not configured (no TCGAPI_KEY)' }, 500);

  const card = (body && body.card) || {};
  // Vision sets player = "Charizard ex" etc. for Pokemon; that's the best search term.
  const name = String(body.query || card.player || card.set || '').trim();
  const number = String(card.number || body.number || '').replace(/^#/, '').trim();
  const setName = String(card.set || '').trim();
  if (!name) return json({ ok: true, matched: false });

  let results;
  try {
    results = await tcgSearch(name, tcgKey);
  } catch (err) {
    return json({ error: 'tcgapi request failed', detail: String(err && err.message || err) }, 502);
  }
  if (!results.length) return json({ ok: true, matched: false, query: name });

  // Pick the printing: exact collector number > set-name match > highest price (list
  // is already sorted price_desc).
  let pick = null;
  if (number) pick = results.find((r) => sameNumber(r.number, number));
  if (!pick && setName) pick = results.find((r) => (r.set || '').toLowerCase().includes(setName.toLowerCase()));
  if (!pick) pick = results[0];

  const price = pick.market_price;
  return json({
    ok: true,
    matched: true,
    source: 'tcgplayer',
    query: name,
    card: {
      card_id: pick.id || '',
      description: pick.name || '',
      player: pick.name || card.player || '',
      set: pick.set || setName,
      number: pick.number || number,
      variant: pick.variant || '',
      category: 'pokemon',
      image: pick.image || '',
      confidence: null,
    },
    grade_prices: [],
    fmv: price != null
      ? { price, low: null, high: null, grade_label: '', confidence_grade: '', as_of_date: '', explanation: '', index_pct_change: null }
      : null,
    comps: null,
    insights: null,
    _debug_sample: results[0], // raw-ish first result, so we can confirm fields on the first live scan
  });
}

// Search tcgapi.dev, normalize each hit to the handful of fields we use.
async function tcgSearch(q, key) {
  const url = 'https://api.tcgapi.dev/v1/search?' +
    new URLSearchParams({ q, game: 'pokemon', sort: 'price_desc' }).toString();
  const resp = await fetch(url, { headers: { 'X-API-Key': key } });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`search ${resp.status}${detail ? ': ' + detail.slice(0, 200) : ''}`);
  }
  const b = await resp.json();
  const list = Array.isArray(b && b.data) ? b.data
    : Array.isArray(b && b.cards) ? b.cards
    : Array.isArray(b && b.results) ? b.results
    : Array.isArray(b) ? b : [];
  return list.map(normalizeCard).filter(Boolean);
}

// Field names aren't verified against a live call yet, so pull the market price from
// every plausible path. _debug_sample above lets us lock this down after one scan.
function normalizeCard(c) {
  if (!c || typeof c !== 'object') return null;
  const p = c.price || c.prices || c.pricing || {};
  const market = firstNum([
    p.market_price, p.market, p.marketPrice,
    p.tcgplayer && (p.tcgplayer.market || p.tcgplayer.market_price),
    c.market_price, c.market,
  ]);
  return {
    id: c.id || c.card_id || c.uuid || '',
    name: c.name || c.card_name || '',
    set: (c.set && (c.set.name || c.set)) || c.set_name || c.expansion || '',
    number: c.number || c.collector_number || c.card_number || '',
    variant: c.variant || c.printing || c.finish || '',
    image: c.image || c.image_url || (c.images && (c.images.small || c.images.large)) || '',
    market_price: market,
  };
}

function firstNum(cands) {
  for (const v of cands) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sameNumber(a, b) {
  const norm = (s) => String(s || '').replace(/^#/, '').split('/')[0].trim().toLowerCase();
  return norm(a) === norm(b) && norm(a) !== '';
}

function shapeFmv(fmv) {
  if (!fmv) return null;
  return {
    price: numOrNull(fmv.price),
    low: numOrNull(fmv.price_low),
    high: numOrNull(fmv.price_high),
    grade_label: fmv.grade_label || '',
    confidence_grade: fmv.confidence_grade || '',
    as_of_date: fmv.as_of_date || '',
    explanation: fmv.price_explanation || '',
    index_pct_change: fmv.index_pct_change != null ? fmv.index_pct_change : null,
  };
}

function shapeComps(comps) {
  if (!comps) return null;
  return {
    comp_price: numOrNull(comps.comp_price),
    high: numOrNull(comps.high),
    low: numOrNull(comps.low),
    count_used: comps.count_used || 0,
    sales: Array.isArray(comps.raw_prices) ? comps.raw_prices.map(cleanSale) : [],
  };
}

// ---- INSIGHTS: 30/90-day averages + buy/sell pressure from dated sales ----
// avg_30 / avg_90 are the trailing average sale prices (steadier than one last sale).
// n_30 / n_90 are the sale counts in each window (liquidity — how easy it is to sell).
// pressure_buy is 0-100: the RED (buying) share of the bar. It's momentum, not a head-
// count — recent 30-day price vs the 90-day baseline, blended with Card Hedge's own index
// move. Rising price = buyers in control; falling = sellers. Null when sales are too thin
// to be honest about it.
function computeInsights(history, fmv) {
  const DAY = 86400000;
  const now = Date.now();
  const pts = (Array.isArray(history) ? history : [])
    .map((p) => ({ price: numOrNull(p.price), t: Date.parse(p.date || p.closing_date || '') }))
    .filter((p) => p.price != null && Number.isFinite(p.t));

  const within = (days) => pts.filter((p) => now - p.t <= days * DAY);
  const mean = (arr) => (arr.length ? arr.reduce((s, p) => s + p.price, 0) / arr.length : null);
  const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

  const w30 = within(30);
  const w90 = within(90);
  const avg30 = mean(w30);
  const avg90 = mean(w90);

  let pressure = null;
  const idx = fmv && fmv.index_pct_change != null ? Number(fmv.index_pct_change) : null;
  if (avg30 != null && avg90 != null && avg90 > 0 && w90.length >= 3) {
    let pct = (avg30 - avg90) / avg90;                 // +ve = rising = buying
    if (idx != null && Number.isFinite(idx)) pct = (pct + idx / 100) / 2;
    pressure = clampPct(50 + pct * 200);
  } else if (idx != null && Number.isFinite(idx)) {
    pressure = clampPct(50 + (idx / 100) * 200);       // fall back to the index move alone
  }

  return {
    avg_30: round2(avg30),
    avg_90: round2(avg90),
    n_30: w30.length,
    n_90: w90.length,
    pressure_buy: pressure,
  };
}

function clampPct(v) {
  return Math.round(Math.min(95, Math.max(5, v)));
}

// ---- GRADED slab: photo -> OCR the label -> cert + details + price history ----
async function slabPath(imageBase64, apiKey) {
  const data = await ch('/prices-by-cert-ocr', { image_base64: imageBase64, days: 180 }, apiKey);
  const cert = data && data.cert_info;

  if (!cert || !cert.cert) {
    return json({ ok: true, matched: false, slab: true, error: 'No grading label detected' });
  }

  const prices = Array.isArray(data.prices) ? data.prices : [];
  const latest = prices.length ? prices[prices.length - 1] : null;

  return json({
    ok: true,
    matched: true,
    slab: true,
    source: 'cardhedge',
    cert: {
      grader: cert.grader || '',
      cert: cert.cert || '',
      grade: cert.grade || '',
      description: cert.description || '',
    },
    card: data.card ? {
      card_id: data.card.card_id || '',
      description: data.card.description || '',
      player: data.card.player || '',
      set: data.card.set || '',
      number: data.card.number || '',
      variant: data.card.variant || '',
      category: data.card.category || '',
      image: data.card.image || '',
    } : null,
    last_sale: latest ? { price: numOrNull(latest.price), date: latest.closing_date || '', grade: latest.Grade || '' } : null,
    history: prices.map((p) => ({ price: numOrNull(p.price), date: p.closing_date || '', grade: p.Grade || '' })),
  });
}

// Build a natural-language query from the vision fields identify.mjs returns.
function buildQuery(card) {
  if (!card || typeof card !== 'object') return '';
  const num = card.number ? '#' + String(card.number).replace(/^#/, '') : '';
  return [card.year, card.brand, card.set, card.player, num, card.variation]
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean)
    .join(' ');
}

async function chGet(path, params, apiKey) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(API + path + (qs ? '?' + qs : ''), {
    headers: { 'X-API-Key': apiKey },
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const e = new Error(`${path} ${resp.status}${detail ? ': ' + detail.slice(0, 200) : ''}`);
    e.status = resp.status;
    throw e;
  }
  return resp.json();
}

async function ch(path, payload, apiKey) {
  const resp = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const e = new Error(`${path} ${resp.status}${detail ? ': ' + detail.slice(0, 200) : ''}`);
    e.status = resp.status;
    throw e;
  }
  return resp.json();
}

function cleanSale(s) {
  return {
    price: numOrNull(s.price),
    date: s.sale_date || '',
    grade: s.grade || '',
    source: s.price_source || '',
    sale_type: s.sale_type || '',
    title: s.title || '',
    url: s.sale_url || '',
  };
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
