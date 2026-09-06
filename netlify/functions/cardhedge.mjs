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
  const apiKey = process.env.CARDHEDGE_API_KEY;
  if (!secret || !apiKey) return json({ error: 'Server not configured' }, 500);

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
    return await rawPath(body, apiKey);            // scan transcription -> AI match
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

// ---- RAW card: text description -> card-match -> FMV + comps ----
async function rawPath(body, apiKey) {
  const query = String(body.query || buildQuery(body.card) || '').trim();
  if (!query) return json({ error: 'No card description to match' }, 400);

  const category = String(body.category || (body.card && (body.card.category || body.card.sport)) || '').trim();
  const grade = String(body.grade || 'Raw').trim();

  const matchReq = { query };
  if (category) matchReq.category = category;
  if (body.max_candidates) matchReq.max_candidates = body.max_candidates;

  const matchData = await ch('/card-match', matchReq, apiKey);
  const match = matchData && matchData.match;

  if (!match || !match.card_id) {
    return json({
      ok: true,
      matched: false,
      query,
      candidates_evaluated: matchData ? matchData.candidates_evaluated : 0,
    });
  }

  // Best-effort enrichment: never let a pricing hiccup sink the match result.
  // 90 days of dated sales powers the 30/90-day averages + the buy/sell pressure.
  const [fmv, comps, hist] = await Promise.all([
    ch('/card-fmv', { card_id: match.card_id, grade }, apiKey).catch(() => null),
    ch('/comps', { card_id: match.card_id, grade, count: 10, include_raw_prices: true }, apiKey).catch(() => null),
    ch('/prices-by-card', { card_id: match.card_id, grade, days: 90 }, apiKey).catch(() => null),
  ]);
  const shapedFmv = shapeFmv(fmv);
  const history90 = hist && Array.isArray(hist.prices) ? hist.prices : [];

  return json({
    ok: true,
    matched: true,
    source: 'cardhedge',
    query,
    card: {
      card_id: match.card_id,
      description: match.description || '',
      player: match.player || '',
      set: match.set || '',
      number: match.number || '',
      variant: match.variant || '',
      category: match.category || '',
      image: match.image || '',
      confidence: typeof match.confidence === 'number' ? match.confidence : null,
    },
    grade_prices: Array.isArray(match.prices) ? match.prices : [],
    fmv: shapedFmv,
    comps: shapeComps(comps),
    insights: computeInsights(history90, shapedFmv),
  });
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
