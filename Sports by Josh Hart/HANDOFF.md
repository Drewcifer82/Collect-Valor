# ⚡ CURRENT STATE — Sep 7, 2026 — READ THIS FIRST

Everything below this block is older history (still useful for background). This block is the truth as of Sep 7, 2026.

## Where the files live (important)
- **Working folder (the one Claude connects to): `C:\Users\Parad\Downloads\Sports-by-Josh-Hart`.** ⚠️ CHANGED Sep 7: the old OneDrive\Desktop folder was REMOVED because OneDrive sync wiped the git history and spawned a duplicate 'collect valor' folder — a real mess. Do NOT use any OneDrive path for this project. **Only ONE folder connected per session** (multiple connected folders caused saves to the wrong folder repeatedly).
- **Git repo clone: `C:\Users\Parad\OneDrive\Documents\GitHub\Collect-Valor`** (note: under OneDrive\Documents, not plain Documents). Andrew has chosen NOT to connect this folder to Claude — do not ask again. He hand-copies changed files from the working folder into the repo, then commits/pushes with **GitHub Desktop**.
- Inside the repo the app files may sit in a `Sports by Josh Hart` SUBFOLDER (Netlify Base directory). Confirm where the live files actually are before telling Andrew where to paste.
- ⚠️ Files in the working folder reverted to older versions once (Sep 6) — suspected OneDrive sync. **After writing files, always verify with sha256sum + a content grep before telling Andrew they're ready.**

## Live site status (verified Sep 7 — ALL PUSHED, NOTHING STALE)
- ✅ Everything is LIVE and correct. Nothing is pending a push. (Confirmed against collectvalor.com Sep 7: new title, FAQ link in nav, PWA meta tags all present.)
- `index.html` (new SEO title + FAQ nav link), `faq.html` (35 Q + contact), `privacy.html` (info@collectvalor.com), `sitemap.xml`, `netlify.toml`, and the full PWA (manifest/sw/icons) are ALL deployed.
- ⚠️ DO NOT re-add a "stale files" note. This was wrong three times running — the working folder and live site match. If in doubt, fetch collectvalor.com and check before claiming anything is stale.

## 🚨 NEXT BIG BUILD (decided Sep 7) — PRICING PIVOT: Card Hedge → TCGplayer
**Decision:** Replace Card Hedge as the price source with TCGplayer market prices. Card Hedge is coming out.

**Why:** Over ~1 week of real scanning, ~95% of the time Collect Valor's price came in LOWER than TCGplayer — often way lower. TCG is the gold standard every pack-ripping app uses, so being 40%+ under makes us look broken and sends people to TCG. Proof case (Minior PAR #201/182, Illustration Rare, raw): our app (Card Hedge) = **$15.84**; TCGplayer market = **$27.25**; Rippz app priced it **$27.00** (confirms Rippz prices off TCG). ~42% gap on the exact same card.

**SCOPE LOCKED (Sep 8): Pokémon + Magic: The Gathering only.** Andrew is happy with just these two. No sports, no other games, no paid aggregator. Both sources are FREE, no API key, and TCGplayer-derived — both verified live.

**Sources (both FREE, no key):**
- **Pokémon → `pokemontcg.io`.** Field: `tcgplayer.prices.<variant>.market` (e.g. `holofoil`). Verified: `GET api.pokemontcg.io/v2/cards/sv4-201` → holofoil.market = **27.25**, updatedAt 2026/09/06 (fresh, exact TCG match). ⚠️ IGNORE `high` (junk outlier, showed $4,321) — use `market`. SKIP `cardmarket` block (stale, Nov 2025).
- **Magic → `api.scryfall.com`.** Field: `prices.usd` (and `prices.usd_foil`), TCGplayer-derived. Verified Sep 8: Sol Ring (CMM) usd = 2.25; Ragavan (MH2) usd = 40.70, both with tcgplayer purchase links. Lookups: `/cards/named?exact=<name>&set=<code>` or `/cards/<id>`.

**⚠️ The official TCGplayer API is CLOSED to new developers** (confirmed Sep 2026: "no longer granting new API access"). We never touch it — the two free APIs above already carry TCGplayer prices.

**Considered & rejected:** multi-game aggregators (tcgapi.dev = 54 games claiming TCG alignment but unverified; JustTCG = 18 games but BLENDS store + marketplace data so it won't match TCG exactly, plus $19–49/mo above the free tier). Not needed for a Pokémon + MTG build.

**Timeline:** Card Hedge subscription expires ~**Sep 19** — cancel once new pricing is live. Target built before **Wed Sep 10**. Planning/build session Tuesday.

**Next step (Tuesday):** wire the app's identify → price flow to route Pokémon lookups to pokemontcg.io and Magic lookups to Scryfall, replacing the Card Hedge call. Do NOT start coding yet — Andrew will say go.

## What shipped in the last two sessions
**Sep 5 — new UI merged.** ChatGPT/"Astra" redesign (`design-preview.html`) merged over the real app logic into one `index.html`. Design = dark navy, cyan/purple/pink/gold gradient, top nav (Price desk / Collection / Watchlist / Profile), result card with Overview/History/Sales/Grades tabs, blurred member-insights teaser + "$8.99/month" unlock. All backend untouched. 77 headless-browser checks pass against a mock of every Netlify function.
Merge decisions: guests see the price on free scans but deeper insights blur behind the paywall; photo → "Identify & price" button (not auto-identify); search-by-name works without a scan (member-gated); Grades tab uses REAL Card Hedge per-grade prices in a "Worth grading?" calculator (fee + shipping + selling %); Watchlist page is an honest "not live yet"; Profile prize card = highest-value card owned; dropped the dead username/PIN form and the "Pop" tab; eBay links stay off.

**Sep 6 — SEO phase 1.**
- `faq.html` (/faq) — 35 Q&As, ~2,140 words, FAQPage JSON-LD, sticky jump list.
- `privacy.html` (/privacy) — plain-English, warm, honest. Andrew is BIG on privacy and loved this page; keep its voice if edited. Contact = **info@collectvalor.com** (ImprovMX forwarding; MX + SPF verified; no DMARC; receive-only so replying *as* info@ needs SMTP someday).
- `index.html` — FAQ link in nav, FAQ/Privacy footer links, hash deep links (/#collection), and head retuned to lead with "price checker":
  - title: `Pokémon & Sports Card Price Checker + Scanner | Collect Valor`
  - description: "The free Pokémon and sports card price checker. Snap a photo to see what your card is worth right now — market value, recent sales, and graded prices."
- `sitemap.xml` 3 URLs; `netlify.toml` clean URLs + .html→clean 301s.

## Why "price checker" (GSC data, ~1 week in)
18 impressions, 0 clicks, **all Pokémon**: "pokemon card price checker / value checker / worth checker / value finder / check pokemon card value / scan my pokemon card value". Nobody searched "scanner app". People type **checker / finder**. Keyword research doc lives in the Claude Project: `claude/seo-keyword-research-2026-09-06.md`.
Note: do NOT submit anchor URLs (/faq#scanning) to GSC — Google strips fragments. Submit /faq and /privacy only.

---

# ✅ PWA — BUILT & LIVE (pushed; verified on collectvalor.com Sep 7)

**Status:** LIVE on collectvalor.com (PWA meta tags confirmed Sep 7). Built + verified in a headless browser — service worker registers + activates (scope = root), manifest parses (name "Collect Valor", 3 icons incl. maskable, display standalone, theme #0b0f19), offline page renders, all icons load.

**Files to copy into the repo + push (GitHub Desktop):**
- New: manifest.json, sw.js, offline.html, icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png
- Changed: index.html (head: manifest link, apple-touch PNG at /apple-touch-icon.png, apple-mobile-web-app tags, theme-color now #0b0f19; before </body>: SW registration + iOS "Add to Home Screen" hint + Android install button)

Verified hashes (first16 sha256): index.html `d35909c6a21fe617` (135075 b) · manifest.json `34bb618f0cb952ee` · sw.js `b7609097ef0018b6` · offline.html `81575829f68ba645`
Note: icon PNG byte-sizes on disk are larger than generated (OneDrive re-saved them) — content is pixel-identical, verified visually.

How it works: SW is network-first for HTML (new deploys show immediately), cache-first for icons/static, and NEVER caches `/.netlify/functions/*` (pricing + identify always hit network). Bump `CACHE` in sw.js on every deploy or users get stale HTML. iOS hint shows only for iOS Safari, non-standalone, dismissible (localStorage). Android fires beforeinstallprompt → real Install button.

After pushing: open collectvalor.com on a phone → Share → Add to Home Screen (iOS) / Install button (Android).

---

## PWA build spec (kept for reference)

Goal: make collectvalor.com installable so it gets a home-screen icon and opens fullscreen. Retention play, not an SEO play. Andrew understands and approved the tradeoffs.

**Why:** scanning is a phone-in-hand habit — an icon gets reopened, a bookmark doesn't. Also keeps the full $8.99 (no Apple 15–30% cut), no app-store review, instant updates via Netlify.

**Build (about an hour):**
1. `manifest.json` — name "Collect Valor", short_name "Collect Valor", `start_url: "/"`, `display: "standalone"`, `background_color`/`theme_color` `#0b0f19`, icons 192/512 + a 512 maskable, `description`, `categories`.
2. Icons — generate from the existing gradient/CV mark. Need 192×192, 512×512, 512×512 maskable (safe zone!), plus 180×180 apple-touch-icon PNG (the current apple-touch-icon points at favicon.svg — iOS wants PNG).
3. `sw.js` service worker — cache the app shell (index.html, faq.html, privacy.html, favicon, icons) with a versioned cache name, network-first for HTML so pushes appear immediately, cache-first for icons. **Never cache `/.netlify/functions/*`** — pricing and identification must always hit the network.
4. `index.html` head — `<link rel="manifest" href="/manifest.json">`, apple-touch-icon PNG, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and register the service worker.
5. Offline fallback — a small "You're offline" state; be honest that scanning needs a connection (Claude Vision + Card Hedge). Don't oversell offline.
6. iOS hint — Safari shows no install prompt, so add a dismissible one-line "Tap Share → Add to Home Screen" nudge for iOS Safari visitors only (localStorage-dismissed). Android/Chrome fires `beforeinstallprompt` — can show a real Install button.
7. Add manifest/sw/icons to the repo; verify Netlify serves `sw.js` from the root scope.
8. Re-run the headless test suite before delivering.

**Gotchas:** service worker must be served from the site root to control the whole site; bump the cache version on every deploy or people get stale HTML; test that the paywall/session still works inside standalone mode (localStorage persists, it should be fine, but verify).

**Watch out:** a badly scoped service worker can serve a stale index.html forever. Network-first for HTML avoids this. Don't ship a cache-first HTML strategy.

---

# 📋 After the PWA (backlog, agreed order)
1. **Auto "Trending cards" page** — a scheduled Netlify function writes a STATIC daily page from the Card Hedge top-movers endpoint (`{movers:true}` in cardhedge.mjs). This is the "blog that writes itself" — real player/Pokémon names and prices, fresh daily, crawlable. ⚠️ Check Card Hedge's terms on publicly displaying their data first. (Note: the OLD market-movers strip on the scan screen gave ZERO SEO value — it loaded via JS and only for sessions with a token, so Google never saw it. A static page fixes that.)
2. **Card notes / flip-to-write** — Andrew's idea and he's excited about it: tap a card in your Collection, it "activates" and flips over like you're playing with it, and instead of the card back you get a blank note area. Write where you got it — pulled from a pack, a convention, a gift from grandma. Offer BOTH: AI-written description or write-your-own. ⚠️ Only earns SEO if those notes are published on public showcase pages — the collection is behind a login. Must be opt-in.
3. **Evergreen guide pages** (one-time, no blogging — Andrew does not enjoy blogging): "Is grading worth it?" (calculator), "PSA vs BGS vs SGC vs CGC", "How to identify a rookie card", "How to spot a fake Pokémon card", "How to photograph cards for accurate scans", "Pokémon rarity symbols explained".
4. **Homepage H1** — still "Scan a card, get the market." with no "worth"/"price checker" in it. Flagged as the biggest remaining on-page lever; Andrew hasn't wanted to touch Astra's headline. Ask, don't assume.
5. Still open from before: Netlify Base directory fix, BGS/CGC "no data" handling in the Grades tab.

---
---

# SESSION UPDATE — Sep 3, 2026 (paywall live, $8.99, recolor, repo move)

**Big session. Everything below is the current state.**

## Paywall — LIVE (email-as-key, no PIN, no code)
- Username/PIN login REMOVED. Identity = the email someone subscribes with. Site opens straight into the app; first scan -> paywall -> Subscribe (Stripe) -> enter paid email -> unlocked. `start-session.mjs` mints the token from the email (active subscriber or comp allowlist). NO 6-digit code — Resend was abandoned (API key kept returning 401; domain verified under a different Resend account). `request-code.mjs`/`verify-code.mjs` are dormant/unused.
- Functions added: `start-session.mjs`, `stripe-webhook.mjs` (manual signature verify, no SDK). DB (Supabase utecxjkakbzywmypqlwu): `subscribers` (webhook writes), `free_scans`, users entitlement columns (paid_email UNIQUE = anti-sharing). See `paywall-schema.sql`.
- `PAYWALL_ON` flag (top of paywall JS in index.html) is the master switch.

## Pricing — $8.99/mo (was $16)
- $8.99/mo founding-member, locked for life. LIVE link in site: https://buy.stripe.com/8x2cN54rRbOug7q8oI0gw04 (old $16 link kept in a comment).
- LIVE Stripe webhook: Snapshot payload; events checkout.session.completed + customer.subscription.updated/deleted. `STRIPE_WEBHOOK_SECRET` set in Netlify. No Stripe secret key needed.

## Free trial — 7 scans/guest, server-side by IP
- `identify.mjs` enforces 7 free scans per IP (free_scans table); can't be reset by clearing cookies. Shows "X free scans left" then paywall. Members unlimited.

## New look (step one) — black / electric blue / white / magenta
- Recolored via CSS :root remap. Original navy/mint saved as `index.html.bak-navy`.
- Result card restyled to the mock: thumbnail left, slim magenta/blue momentum bar, magenta parallel chip, CV-logo header + FOUNDING MEMBER. Persistent $8.99 subscribe card on scan screen (hides when entitled).
- Favicon + og-image + og-image-square regenerated in the new scheme.

## SEO + analytics
- Added sitemap.xml, robots.txt, favicon.svg, og-image(.png/-square), full meta/OpenGraph/Twitter/JSON-LD. netlify.toml 404s internal docs. Google Search Console = Domain property (collectvalor.com), sitemap submitted. Plausible analytics snippet in <head>.

## Repo / Claude Code move
- GitHub repo `Collect-Valor`. App files are in a `Sports by Josh Hart` SUBFOLDER inside the repo -> Netlify 404s until **Base directory = "Sports by Josh Hart"** is set (or move files to repo root). .gitignore added; no secrets in files (all Netlify env). Keep repo PRIVATE (comp emails + Supabase URL in code).

## Other
- Josh re-added as paid member (jjameshart7@mail.com) via subscribers insert. Comp allowlist in start-session.mjs: paradigmnguy3339@gmail.com, @duck.com.
- Marketing: FB profile pic, cover banner, ads at $8.99 (min emojis). IP: naming Pokemon = ok; recreating real card art/logos = risk -> using generic creatures. Andrew runs each new post by Claude first.

## >>> NEW DIRECTION (next major push) <<<
- Andrew wants a BRAND-NEW LOOK for the web app — a real UI redesign, not just tweaks. The recolor above was step one; he's after a fuller new design direction. Start here next session.

## Still open
- Netlify Base directory fix (mid-fix). PWA prep (manifest + service worker). BGS/CGC "no data" handling. Re-scrape FB Sharing Debugger after deploys.

---

# HANDOFF — Sports Card Scanner & Price App

Read this first at the start of a session to get caught up. Pair it with DESIGN.md
(the locked look) and CLAUDE.md (the rules of engagement / how we work).

Live site: _(deployed on Netlify — URL not recorded here)_
Repo: _(not created yet)_

Partners: **Andrew** (product/vision + deploys) and **Josh** (sports card expertise).
Claude = writes all the code.

---

## What this is
A web app. Take a photo (camera or upload) or type a card name → the card is
identified → the app shows a market price. Growing into a collection + trading app.

Price source:
- **Card Hedge** (cardhedger.com) — sports card + Pokémon price API with curated,
  structured data. Primary path for identification AND pricing once approved.
- **PSA public API** — cert verification for graded slabs (see API notes below).

---

## Current state (Aug 28, 2026 — PAYWALL BUILT + TESTED, email-unlock on Stripe)

**The paywall is built and working end-to-end in Stripe TEST mode.** Sign-in changed completely: the username/PIN login is GONE. Identity is now the **email someone subscribes with**. There is NO email verification code (Resend was abandoned — see below). We are trusting the email for the beta.

### The access model (how it works now)
- Site opens **straight into the app** — no login screen. (The old login-view markup is left in `index.html` but hidden; `login.mjs` is unused.)
- First **scan** attempt → **paywall overlay**. It only appears when `PAYWALL_ON === true` (a flag at the top of the paywall JS block in index.html). Currently TRUE.
- Paywall has two buttons: **Subscribe** (opens the Stripe Payment Link in a new tab) and **"I already paid — verify my email"**.
- **Unlock = type the email you subscribed with.** No code. `start-session.mjs` confirms that email is an ACTIVE subscriber (or on the comp allowlist), then mints a session token signed FROM the email. That token is the same shape the old login produced, so every gated function keeps working — the collection `owner` is now the email.
- The session is saved in **localStorage** (`cv_session`) so people stay signed in across visits. "Sign out" clears it back to a guest state (it no longer shows a login screen).
- **Comp allowlist** (free-for-life) is hard-coded in `start-session.mjs` → `COMP_EMAILS`: currently `paradigmnguy3339@gmail.com` and `paradigmnguy3339@duck.com`. Add a friend's email to that array to give them free access (then redeploy).

### New/changed files
- `netlify/functions/start-session.mjs` (NEW) — passwordless login. `{email}` → active-subscriber-or-comp → returns `{ok, token, email, plan, entitled}`.
- `netlify/functions/stripe-webhook.mjs` (NEW) — Stripe → Supabase. Verifies the Stripe signature BY HAND (no SDK, no STRIPE_SECRET_KEY needed). Writes the `subscribers` table (status active/past_due/canceled) and mirrors status onto a bound `users` row. Listens to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- `netlify/functions/request-code.mjs` + `verify-code.mjs` (NEW but NOW UNUSED) — the old Resend 6-digit-code path. Dormant; the client no longer calls them. Safe to delete later.
- `netlify/functions/login.mjs` — old username/PIN login. UNUSED now, left in place.
- `paywall-schema.sql` (project root, ALREADY RUN in Supabase) — added to `users`: `plan`, `plan_status`, `paid_email` (unique index — this is the anti-double-use lock), `stripe_customer_id`, `stripe_subscription_id`, `plan_renews_at`. New tables `subscribers` and `email_codes` (email_codes now unused).
- `index.html` — paywall overlay + copy, the `PAYWALL_ON` scan gate, guest-on-load, localStorage session, email unlock via start-session. Backups: `index.html.bak-paywall`, `index.html.bak-nologin`.

### Pricing / messaging (locked)
- **$16/mo** founding-member beta, pitched as "sign up now and keep this $16/mo rate for life, as long as you stay a member." Regular = $20/mo later. Monthly only for now.

### Stripe — TEST vs LIVE  (READ BEFORE LAUNCH)
Everything so far is **Stripe TEST mode**:
- TEST payment link (currently wired into index.html): `https://buy.stripe.com/test_14AdR9bUjbOubRa34o0gw02`
- **LIVE** payment link (already created; saved in a comment in index.html for launch): `https://buy.stripe.com/eVq28r3nN8Ci5sMdJ20gw03`
- A TEST webhook endpoint exists (Snapshot payload, the 3 events). A separate LIVE webhook still must be created at launch — Stripe test and live webhooks are separate and have different signing secrets.
- Netlify currently holds the **TEST** `STRIPE_WEBHOOK_SECRET`.
- Env vars present: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (pre-existing), `STRIPE_WEBHOOK_SECRET` (test). The `RESEND_*` vars are no longer used and can be deleted.

### Resend — ABANDONED (why, so we don't retry blindly)
We tried Resend to email the 6-digit codes and could NOT get it working — the API key kept returning `401 "API key is invalid"` even after several brand-new keys. Complication: collectvalor.com is already verified under a different/existing Resend account, so a fresh account couldn't own the domain. Rather than keep burning time, we DROPPED email verification and switched to email-only unlock (trust for beta). If we ever want real codes back, `request-code.mjs` / `verify-code.mjs` are still there — but we'd need to sort the Resend key/domain-account mismatch first.

### LAUNCH CHECKLIST — going live (Andrew = dashboards, Claude = code)
Andrew does not code. When Andrew says "go live":
1. **Claude (code):** swap `PAYMENT_LINK` in index.html from the test link to the LIVE link (saved in the comment right above it). Confirm `PAYWALL_ON = true`.
2. **Andrew (Stripe, LIVE mode):** confirm the LIVE product + $16/mo recurring price + the LIVE payment link exist. Create a **LIVE webhook**: URL `https://collectvalor.com/.netlify/functions/stripe-webhook`, **Snapshot** payload, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the LIVE signing secret (`whsec_...`).
3. **Andrew (Netlify):** set `STRIPE_WEBHOOK_SECRET` to the LIVE secret. (RESEND_* can be deleted.)
4. **Andrew:** redeploy (drag-and-drop).
5. **Test once in live** with a real card (refund yourself after): subscribe → enter email → unlocked.
6. Decide whether to keep the comp allowlist emails.

### Still open / notes
- **`PAYWALL_ON` is TRUE** — the gate is live right now. Flip it to false in index.html (top of the paywall JS) if you want anyone to scan freely without paying.
- Collections saved under the OLD usernames (owner='andrew', etc.) won't appear under the new email identity. Expected, not a bug.
- PWA launch prep (web app manifest + service worker) is still pending from the Aug 23 plan.

## Current state (Aug 28, 2026 session)

**Big session: sports read/search fixes, Grades tab redesign, slab toggle removed, Josh removed from the project, branding cleaned, and the PAYWALL build started (Stripe).**

### Josh is OUT of the project
- Andrew is going solo — no more 50/50 with Josh (Josh wouldn't work except on his 2 days off). **"by Josh Hart" removed everywhere** (page `<title>`, login screen, header). App is now just **"Collect Valor."**
- Josh's login row still exists in Supabase — Andrew can delete it later if he wants. (The `sports` catch-up skill still says "Sports by Josh Hart" for the FOLDER name — that's just the local folder, leave it.)

### Sports scanning — much improved
- **`identify.mjs`:** added a targeted instruction to read the **full specific set/subset** (e.g. "Prizm Stained Glass", not just "Prizm") and read the **year from the card**, not a guess. (Kept minimal to avoid another regression like the "1969" prompt blowup — if a read gets worse, revert this one line.)
- **`index.html` pick-list search:** now searches **player + set + parallel** (not just name), **never hard-filters by the scanned number** (a misread number like #23 vs #SG-1 was HIDING the real card), and pulls **100** results. Result: the Tatis Prizm Stained Glass Blue Velocity now surfaces in the list (was impossible before).
- Candidate images that 404 now show a clean empty slot instead of a broken-image icon.
- **Reality check that stuck:** the ceiling is the vision READ. Nailing exact year/parallel off a phone photo is the hardest part even for big apps. The **manual search box is the reliable catch** for niche parallels — proven (Andrew found the $8.60 Blue Velocity by typing "2022 tatis prizm"). Cards genuinely NOT in Card Hedge (some modern basketball) can't be priced — confirmed not our bug.

### Graded slab toggle REMOVED + Grades tab redesigned
- The **"Raw card / Graded slab" toggle is hidden** — raw mode reads graded cards fine and the grade breakdown shows below, so the cert-OCR slab path was redundant (and flaky). Slab code left dormant; un-hide `#scan-mode` to restore.
- **Grades tab** now always lists the **top 3 graders for the card type**, each showing **10 / 9 / 8**: sports = **PSA / SGC / BGS**, Pokémon = **PSA / CGC / BGS**. Shows a price where Card Hedge has one, "— no data" where it doesn't. Each priced row still shows net-if-you-grade.
- **OPEN QUESTION:** Card Hedge is **PSA-heavy** — BGS/CGC rows are often "no data." Andrew was going to test a **CGC-heavy Pokémon** to see if CGC ever populates. If BGS/CGC are almost always empty, switch to only showing a grader when it has ≥1 price (one-line change). Also confirmed Card Hedge DOES carry BGS labels; CGC likely but unverified.

### PAYWALL — build STARTED (mirror ai/notes, on Stripe)
**Pricing decided:** $20/mo regular; **$16/mo beta "founding member," 20% off, locked for life as long as they stay.** Monthly only for now (yearly later if subscribers stack up). Ads pitch = "early-release beta." **Andrew connects his own Stripe account.**
**Scan cap:** cost is trivial (~500 scans = under $2, ~$0.004/scan). Cap is only an abuse guard for a shared login / scripted endpoint once charging. Use a **DAILY cap ~150–200/day**, not lifetime.
**Sequencing caution (agreed):** build the paywall now but **don't turn the gate ON** until scan testing confirms the core flow feels solid.

**DONE this session:** `login.mjs` now returns the user's `plan` + `entitled` boolean (comp = free lifetime; beta/pro must be plan_status='active'). It degrades gracefully (returns free/not-entitled) if the plan columns don't exist yet, so it's safe to deploy before the schema is added.

**REMAINING paywall steps (for the fresh chat, in order):**
1. **Supabase schema** — add to `users`: `plan text default 'free'`, `plan_status text`, `stripe_customer_id text`, `stripe_subscription_id text`, `plan_renews_at timestamptz`. Then `update users set plan='comp'` for Andrew + any friend accounts to keep them free.
2. **`create-checkout.mjs` (NEW)** — token-gated (same HMAC verify as cardhedge.mjs). Creates a Stripe **Checkout Session** (mode=subscription) via Stripe REST API (form-encoded, `Authorization: Bearer STRIPE_SECRET_KEY`). Set `client_reference_id`=username and `subscription_data[metadata][username]`=username. success_url `<origin>/?sub=success`, cancel_url `<origin>/?sub=cancel` (client passes its `origin`). Return `{url}`; client redirects.
3. **`stripe-webhook.mjs` (NEW)** — verify `Stripe-Signature` manually: header is `t=..,v1=..`; compute HMAC-SHA256(STRIPE_WEBHOOK_SECRET, `${t}.${rawBody}`) as **hex**, timing-safe compare to v1. Use `await req.text()` for the RAW body. Handle `checkout.session.completed` → set plan='beta', plan_status='active', store customer + subscription ids; handle `customer.subscription.updated`/`deleted` → update plan_status (map to 'active' / else). PATCH `users?username=eq.<client_reference_id or sub.metadata.username>` via service_role.
4. **Client gate (`index.html`)** — store `session.entitled`; in `handleFile` (scan) top: if not entitled, show a **paywall overlay** and return. Build the paywall UI: the $16 beta founding-member offer + "Subscribe" button → POST `/create-checkout` with `{token, origin}` → redirect to returned Stripe url. On return with `?sub=success`, re-check entitlement (quick re-login or a small `/me` check).
5. **Netlify env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BETA` (the $16/mo recurring price id), later `STRIPE_PRICE_REGULAR` ($20/mo). Env changes need a redeploy.
6. **Stripe dashboard (Andrew):** create Product "Collect Valor" with two recurring prices — **$16/mo (beta)** and **$20/mo (regular)** — grab the beta price id for `STRIPE_PRICE_BETA`; add a webhook endpoint → `https://collectvalor.com/.netlify/functions/stripe-webhook`, copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## Current state (Aug 22–23, 2026 session)

**Focus: honest pricing display, a calmer price chart, the Mewtwo misID hunt, and three new logins. All saved to the folder; Andrew deploys himself (drag-and-drop). Range fix + chart confirmed live.**

**Pricing display — market value vs last sale (index.html):**
- The headline already preferred Card Hedge FMV (market value) over the last-sale comp; that logic was correct. Added a **fair asking range ($low–$high)** under the price, and made the label **honest**: shows "MARKET VALUE" only when the number is a real FMV, and "LAST SALE" when we're falling back to a comp. `pickValue()` now returns `{value, source, low, high}`; both the scan path and the manual pick-list path use it. **Confirmed live** (Mewtwo shows "range $15.22–$16.78"). **Andrew reports scans are now noticeably more accurate / better prices across the board** — the FMV-first display + range is working as intended.

**Price-history chart redesign — the "heart attack" fix (owed item #3, DONE):**
- Chart now plots a **weekly average** over the **last ~6 months** instead of every individual sale (`smoothForChart()` windows to 183 days, falls back to all data if thinner, buckets by week and averages).
- **Y-axis padded** (`lo = max(0, dataLo - range*1.6)`, `hi = dataHi + range*0.8`) so ordinary swings read as a gentle wave, not a cliff. High/low **labels still show the real prices** at their true positions.
- Still TODO: the **3mo / 6mo / 12mo span toggle** (Andrew wants to switch spans; not built yet).

**Mewtwo misidentification — root cause is the VISION read, not the price:**
- Andrew's **WoTC Black Star Promo Mewtwo #14** kept getting identified as **"Legendary Collection #14/110 Reverse Holo"** — a different #14 that Card Hedge prices at ~$16, while the promo is ~$29 on TCGplayer. So the $16 wasn't wrong for the card it *thought* it saw; it picked the wrong #14.
- **It's intermittent:** across ~6 scans it returned Legendary Collection, then the right promo but priced as a 7.5 slab, then nailed it. That inconsistency = the vision reader describes this card slightly differently each scan → Card Hedge matches a different #14. Hard card: the promo art is identical to Base Set and it has almost no set markings.
- Added a **diagnostic** (dashed box under the price showing "VISION read" vs "CardHedge match") gated on `?debug=1`. **The query-param trigger does NOT survive on the live site** (Netlify almost certainly strips the query string) — the box never appeared. **TODO: switch the trigger to tapping the price 3× (no URL needed)**, then capture one read to confirm, then harden the promo match.

**New logins (Supabase `users`, PIN via `crypt(pin, gen_salt('bf'))`, usernames stored lowercase):**
- `chris` / 0666 and `travis` / 4390 added (SQL run by Andrew in the Supabase SQL editor — the MCP can't reach this project). Note: re-running a duplicate insert errors; Chris existed already on one attempt and had to be de-duped. **Accounts now: andrew, josh, joe, chris, travis.**

**Josh's iPhone bug (unresolved):** on Josh's iPhone the card **identifies (name shows) but no price/metrics appear**. Identify works, so it's the pricing step. Nothing obviously iOS-breaking in the client code; leading hunch is the Card Hedge pricing call hanging on iOS Safari. Was going to add a visible failure reason but Andrew declined — waiting on a screenshot from Josh. **Andrew is frustrated with Josh's lack of help and may cut him from the deal**, so this may become moot.

## Current state (end of Aug 20, 2026 session)

**Card Hedge dev plan is PAID (Andrew paid the morning of Aug 20) — the trial-ending worry is closed.**
Focus this session: scan speed, new price metrics, killing trading, UI cleanups. All saved to the
folder; **Andrew is deploying this batch himself** (nothing auto-deployed).

**Speed — a scan is now ~4s (Andrew confirmed live):**
- `identify.mjs` prompt trimmed to ONLY the fields needed to name + match a card. The verbose fields
  (highlights / visible_text / notes) were removed because output-token count is what drives latency.
  Output is one compact line; `max_tokens` 2000 → 700. Sonnet STAYS as the reader — the accuracy edge
  (exact `number` + `variation`/holo read) is explicitly emphasized in the prompt, since "don't call a
  plain card a holo" is how we beat Double Holo. **Side effect:** highlights/notes no longer render on a
  scan (dropped on purpose for speed).

**New price metrics — all live on the result card, under the price:**
- **Buy/Sell pressure bar** — red = buying (left), blue = selling (right), diverging from center with the
  % at the seam. NOT a head-count: it's momentum, computed in `cardhedge.mjs` `computeInsights()` from the
  30-day avg vs the 90-day baseline, blended with `fmv.index_pct_change`. Bar hidden (null) when < 3 sales
  in 90 days — never faked.
- **30-day & 90-day average** sale price + **SALES/90D** (liquidity), also from `computeInsights()`.
- Data source: `cardhedge.mjs` now fetches `prices-by-card` (90 days) IN PARALLEL inside `rawPath` and
  `priceByIdPath` (Promise.all, so ~no added latency) and returns an `insights` object.
- Each piece shows independently — thin data hides only that piece, not the whole block.

**TCGplayer link (Pokemon only):** searches JUST the Pokemon/card name (e.g. "Koraidon ex") — adding
year/set/number over-filtered to nothing. Shows on any identified Pokemon card, match or not.

**eBay DROPPED for good:** as of **July 2026 eBay requires sign-in to view SOLD/completed listings** for
everyone — a link can't get around it. The eBay button was removed. (Card Hedge already gives us sold comps.)

**Trading is CUT — Trade tab is now the Watchlist tab** (honest "not live yet" state). Trading UI + the
"⇄ Tradeable" collection filter removed. `is_tradeable` column stays in the DB, just unused for now.

**UI cleanups:**
- Card thumbnails much bigger: pick-list `.cand img` 34×46 → **72×100**; movers `.mkt-row img` 30×42 →
  **50×70** (Andrew couldn't see the card well enough to pick the right variant).
- Hid the horizontal scrollbar under the Overview/Grades/History/Sales/Pop tab strip on mobile (still swipes).

**New login added:** user **joe / PIN 0777**, inserted straight into Supabase:
`insert into public.users (username, pin_hash) values ('joe', crypt('0777', gen_salt('bf')));`
Users table columns = `id uuid, username text, pin_hash text, created_at`. **Usernames are stored
lowercase** (login.mjs lowercases input), so the row is `joe`. Accounts now: **andrew, josh, joe**.

### Decisions made Aug 20
- **TRADING CUT.** Brokering physical card swaps is an unmanageable scam/reputation risk — a disclaimer
  doesn't protect us, and becoming "the app where you get scammed" is fatal. The social/engagement value is
  already covered by Showcase + Binders + top-collection voting, none of which require mailing anything. If
  ever revisited, the ONLY safe version is a no-liability "connect / want-list" that brokers nothing and
  sends users off-platform — and even that waits until we're big.
- **Per-trade service fee is moot** (trading cut). For the record: a $0.15 micro-fee is uneconomical —
  processors take ~$0.30 + ~3% per charge, so you'd lose money per trade. Any future paid feature should use
  a credits bundle or the subscription, never micro-charges.
- **Paywall + removing the private sign-in are ON HOLD** until more features ship (esp. a working
  Watchlist). Don't gate a product that isn't feature-complete.

## Previous state (end of Aug 14, 2026 session)

**Big feature day. Vision upgraded to Sonnet, slab flow wired into the UI, pick-list
made accurate, plus four Double Holo-competing features: Grading ROI, price-history
chart, Market movers, and a nightly auto re-price job.**

**Aug 14 changes (all need a deploy to go live together):**
- **Vision: Haiku → Sonnet** (`identify.mjs`, model `claude-sonnet-4-5-20250929`,
  max_tokens 900 → 2000). The 900 cap truncated Sonnet's JSON and briefly broke ALL
  scans (11/11 failed) — fixed. Cost ~3x Haiku (~1¢/scan), accepted for accuracy.
- **Card Hedge docs verified against our code** (openapi at api.cardhedger.com/openapi.json;
  interactive at /docs). Key confirmations: **"Raw" IS the correct ungraded label**
  (no longer a guess); grade labels are e.g. "PSA 9"/"BGS 9.5"/"Raw"; card-match
  returns null below 0.5 confidence (by design); all our calls match the spec.
  top-movers is a GET with query params (only non-POST endpoint we use).
- **Plan changed: developer account $50/MONTH** (was $50/6mo commercial). card-request
  endpoint (ask them to add a missing card) is "commercial only" — unknown if dev plan has it.
- **Slab flow live in UI:** Raw card / Graded slab toggle on Scan tab. Slab mode skips
  Claude entirely → `prices-by-cert-ocr` → cert, grade chip, last sale, history.
  Saves with `is_slab: true`. Honest failure message on unreadable labels.
  - **Tested on real slabs: one read, one didn't.** Suspects for misses: our 1200px
    downscale shrinks label digits (bump to ~2000px for slab mode = TODO), glare,
    or non-PSA/BGS/SGC/CGC grader. **Typed-cert fallback (`prices-by-cert`, no OCR,
    exact) designed but NOT built — top of next session's pile.**
- **Pick-list accuracy overhaul** (Andrew: "found 98 showed 10" / wrong-character
  results — both fixed): auto-opens on failed match; tiered search (name+category+
  exact card number → drop number → drop category); 50 results (was 10) in a
  scrollable list; client-side ranking (number match 4pts, year 2, set 2, brand 1,
  variation 1); honest "showing the 50 closest" count. Pokemon searches use
  character name only; sports use year + player.
- **Grades tab (Grading ROI)** — Double Holo's headline feature. Per-grade prices
  from grade_prices, minus raw price, minus editable grading fee (default $25) =
  net if it grades. Green/red. Hidden honestly when no graded data.
- **History tab chart** — lazy-loads `prices-by-card` (365 days) on first tap; mint
  SVG line chart + tap-for-price tooltip + last-5 sales rows. Slab scans chart their
  cert history immediately.
- **Market movers** — `top-movers` weekly gainers card on the Scan tab (loads once
  per session, fails silently, never blocks scanning).
- **`reprice.mjs` (NEW) — scheduled function, daily 8:00 UTC:** re-prices every saved
  card with a card_id via `card-fmv-batch` (100/call), PATCHes changed values to
  Supabase. **Also heals the old value=null cards automatically.** VERIFY after next
  deploy: that drag-and-drop deploys register scheduled functions (check Netlify →
  Functions for "reprice" with a schedule badge).
- Netlify MCP was 502ing when we tried to read function logs — retry another day.

**Not built / consciously skipped from the Double Holo list:** social sentiment (no
data source), pack EV (no pull-rate data), "price forecasting" (we show real trend
data instead of pretending to predict). **Watchlist + price alerts (Discord/custom
rules) is the next big build — needs Andrew's product decisions on alert rules +
where they deliver.**

## Previous state (end of Aug 13, 2026 session)

**Card Hedge is APPROVED and integrated. Collections are LIVE — scan → star-save →
view → delete, with real market prices flowing in.**

**What's done and working:**
- **Login gate** — username + PIN sign-in. `login.mjs` Netlify function. Verified live.
- **Supabase** — project `utecxjkakbzywmypqlwu` (a different account than any Claude
  connector — work with it via keys/SQL, not the MCP). `users` table with RLS on;
  `verify_login(u,p)` Postgres function using pgcrypto `crypt()` (execute revoked from
  anon/public, granted to service_role only). Accounts: **andrew** and **josh**.
  - **NEW (Aug 13): `collection` table + private `collection` Storage bucket**
    (`schema.sql`, already run). RLS on with NO public policies — all access goes
    through the Netlify functions (service_role), which enforce ownership + caps in
    code, since the app uses custom PIN auth rather than Supabase Auth.
- **Scanner — now a two-step pipeline (Aug 13):**
  1. `identify.mjs` (Claude Haiku vision) TRANSCRIBES the card — now handles both
     **sports AND Pokemon** (Andrew's lane); emits a `category` field (specific sport
     or "Pokemon") that drives the price lookup.
  2. `cardhedge.mjs` (NEW) — four modes, dispatched by request body:
     - `{card}` or `{query}` → `card-match` (AI match) → FMV + comps. Used by the scan flow.
     - `{search}` → `card-search` → up to 10 candidate cards (id, description, image,
       per-grade prices). Powers the manual "Search by name" pick-list.
     - `{card_id, grade}` → FMV + comps + `all-prices-by-card`. Prices a picked candidate.
     - `{image}` → `prices-by-cert-ocr` slab-label OCR (any sport or Pokemon;
       PSA/BGS/SGC/CGC). UI doesn't call the slab path yet.
  - Price block shows "MARKET VALUE · Card Hedge" when matched; falls back honestly
    to the AI rough estimate when not. Sales tab fills with real comps.
  - **TESTED live (Aug 13): pricing works but is PARTIAL** — some cards get exact
    prices, some fall back. Expected causes: Haiku transcription quality, card not in
    Card Hedge's 3.5M DB, or the grade-label guess ("Raw") not matching their labels.
  - **Manual "Search by name" fallback — TESTED & WORKING (Aug 13):** link under
    the price opens a search box → Card Hedge `card-search` → tap-to-pick list of up
    to 10 real cards with photos → picked card is priced by `card_id`, details fold
    into the save, star resets for a corrected save. Andrew confirmed it live and
    likes the pick-list pattern ("all the other apps do it that way") — treat the
    pick-list as the app's standard for any future card-lookup UI.
  - **Key API fact:** Card Hedge has NO raw-photo ID endpoint — image endpoints are
    slab-label OCR only. Raw cards are identified via text match. So Haiku STAYS
    (demoted to transcriber), and `ANTHROPIC_API_KEY` stays too.
- **Collections (NEW Aug 13, verified saving to Supabase):**
  - `save-card.mjs` — token-gated; uploads the exact scanned image to the private
    bucket, writes the row, enforces caps (50 singles / 20 slabs), rolls back the
    image if the insert fails.
  - `load-collection.mjs` — returns the user's cards with 1-hour signed image URLs;
    powers the Collection tab, capacity bars, header count + total value.
  - `delete-card.mjs` — removes the stored image + row, ownership-checked.
  - UI: gold star by the price saves (clear → gold, DESIGN.md's one-accent rule
    knowingly broken here); collection grid shows image/name/value; ✕ on each tile
    is a two-tap delete (arms to "Delete?", 3s to confirm; no popup dialogs).
  - **Save/price race FIXED:** the star is locked until the Card Hedge check
    resolves, so saves capture the market value. Cards saved BEFORE this fix have
    `value = null` → show "No price yet" and don't count in the total. Fix: delete
    and rescan them (or build a re-price pass later).
- **Full redesign** (Aug 12) — navy + mint faceted look, see DESIGN.md. Deployed.
  Old `index-gold-backup.html` is rejected and can be deleted.

**Netlify env vars set (5):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`,
`ANTHROPIC_API_KEY`, `CARDHEDGE_API_KEY` (added Aug 13). Values live in Netlify → Site
configuration → Environment variables. Env var changes only take effect on a NEW deploy.

> **NEVER paste secret values into these .md files.** Netlify runs a secrets scanner on
> every build and will hard-fail the deploy if an env var's value appears in any repo file.
> This happened Aug 12 — `SESSION_SECRET`'s value was written here and broke the build.

**Card Hedge status: APPROVED Aug 13.** $50 for 6 months, free trial ends ~Aug 18.
Key lives in Netlify as `CARDHEDGE_API_KEY`. Auth header `X-API-Key`, base
`https://api.cardhedger.com/v1/cards`. OCR endpoints shared cap: 2000/day.
The original "replaces Haiku for both ID and pricing" plan was WRONG — see the
scanner pipeline note above (no raw-photo ID endpoint exists; text match instead).

**Still open from before:** how is the site deploying — drag-and-drop or GitHub repo?
Never confirmed. No repo created yet.

---

## Product decisions made Aug 12

### Collection
- **Singles (ungraded): max 50.** **Slabs (graded): max 20.** Total **70 images/user**.
- Stored images target **~200 KB each** (downscale on save).
- Storage math: 70 × 200 KB ≈ **14 MB/user** → Supabase free 1 GB holds **~70 users**.
  Paid tier is ~$25/mo for 100 GB when we cross it.
- Showcase = the cards a user chooses to show off publicly, split into singles and slabs.

### Showcase voting (decided Aug 14)
- Voting window is **Monday through Friday**. The winning collection ("Top Collection
  of the Week", by public thumbs-up count) **holds the crown over the weekend**, then
  votes **reset Monday** and the race starts fresh.
- One thumbs-up per user per card. Likes live in a new Supabase table (schema TBD in
  step 3 of the showcase build).
- Build order: 1) showcase toggle on own tiles (**BUILT Aug 14** — `update-card.mjs`
  + ★ button on collection tiles), 2) binder view (**BUILT Aug 14** —
  `browse-showcase.mjs` + "▤ Binders" pill on the Collection tab; shows every
  user's showcased cards grouped by owner with counts + total value; only
  is_showcase rows ever leave the server), 3) thumbs-up (needs a likes table —
  schema next session), 4) weekly winner display.

### Favorites
- Viewing another user's collection opens a window with a **star in the upper right**
  to save them into your favorite collections.

### Trading
- Users may post up to **5 cards** as tradeable.
- **Three match modes:**
  1. **Even trade** — match with cards at or near the same value.
  2. **Trade up** — auto-pair with people offering cards worth more than yours.
  3. **Help someone out** — offer one of your cards to someone trying to trade up.
- Not built. Needs collections + verified values first.

### Monetization — DECIDED: one package to start
Tiering (like Ludex's Pro/Standard/Lite) was considered and **deferred**. Reasoning:
no user base yet to tell us what people pay for, tier gates add real engineering
(entitlement checks everywhere), and splitting a small audience makes every tier feel
thin. One good price with everything included is the stronger opening move.
- **But: add a `plan` field to the user record from day one**, defaulted to a single
  value. Costs nothing now, makes tiering later a change to a few checks, not a rebuild.

---

## Security model (agreed, NOT yet implemented)
Andrew flagged he's new to this. Plain-English version of what matters once users can
see each other's collections and trade:

1. **Row-level security** — DB rule that says "you can only edit your own rows."
   RLS is already on for `users`; extend it to collection tables.
2. **Public vs private split** — showcase cards are visible to others, the rest aren't.
   A per-row visibility flag enforced in the database, not just hidden in the UI.
3. **Storage rules** — same idea for photos: only the owner can upload/delete theirs.
4. **Per-user daily scan cap** (e.g. 50/day) — every scan costs money. Turns a worst-case
   bill from unbounded into predictable.
5. **Signup friction** — email verification or invite-only. Without it, mass automated
   signups defeat the per-user cap (500 accounts × 50 scans = 25,000 scans).

**Threat model clarification (worth keeping straight):** random unauthenticated bots
hitting `identify.mjs` get rejected by the login gate and cost nothing. The real risk is
**automated abuse from an account that's already through the door** — a signed-up user
scripting the endpoint. That's what the per-user cap defends against. Risk is ~zero today
because signups are closed (only andrew + josh exist); it becomes real the day signups open.

**TODO:** verify `identify.mjs` checks the token BEFORE calling the paid API, not after.
Not confirmed in code yet.

**Non-technical risk:** the hardest part of trading is people — scams, shipping a
different card than shown. Handled with policy (PSA cert verification, trade history,
reporting), not encryption. Decide before launch.

---

## API notes

### PSA public API — chosen, token not yet obtained
- Free. Register at **psacard.com** → generates an access token. Token does not expire
  and can be regenerated anytime.
- Auth: `Authorization: bearer <token>` header. Docs: psacard.com/publicapi/documentation
- **CORRECTION (an earlier claim in-session was wrong):** the free public API is
  **cert verification only** — pass a certificate number, get the card description,
  grade, and label details. There is **NO** public PSA API for population reports,
  price guide data, or grade prediction. Don't plan features around pop data from PSA.
- Use case: user enters/scans a slab's cert number → we confirm it's genuine and pull
  the official PSA description + grade. Trust layer for trading.
- **Blocked on: Andrew registering and getting the token.**

### eBay — DROPPED for now
Andrew applied for API access ~4 days running and was **rejected every time**.
Not pursuing further unless something changes. (Would have been the best source of
sold comps.)

### Other candidates (not started)
- **balldontlie** — free NBA stats API, no approval needed, just a key. Would enrich
  card pages with real player stats. Other sports need paid providers (SportsRadar etc).
- **Supabase Storage** — already part of the project; this is what actually stores
  collection photos.

---

## How we deploy
- **Static site on Netlify.** Two options:
  1. **Drag-and-drop** the project folder onto Netlify (Deploys tab) — no build minutes.
  2. **Push to GitHub `main`** — auto-builds if linked.

**Build-minutes rule:** every push triggers a Netlify build. Batch multiple changes into
ONE push. Always ask before committing and pushing (CLAUDE.md Rule 3).

---

## What's confirmed working vs not (end of Aug 13)
- ✅ Scan → price (partial coverage) → gold-star save → card shows in Collection
  tab with image → header count + total value → two-tap delete. All verified live.
- ⚠️ Cards saved before the star/price-race fix have `value = null` ("No price
  yet", excluded from total) — delete + rescan them.
- ✅ Search-by-name pick-list: deployed, tested, Andrew approves the pattern.

## LAUNCH PLAN — decided Aug 23 (this is the plan)

**First market = a PWA (Progressive Web App), NOT the Chrome Web Store.**

- **Why not the Chrome Web Store:** it's desktop *extensions* only. Chrome on Android still has no mainstream extension support and Chrome on iPhone has none — so mobile users can't install/use anything from it, and phone-camera scanning is the whole app. Also, packaged web apps were removed from the Web Store years ago, so our website couldn't be listed there without being rebuilt as a desktop-only extension. Wrong path for a mobile-first app.
- **The plan — ship Collect Valor as a PWA:** users go to collectvalor.com → "Add to Home Screen" → they get a Collect Valor app icon that opens full-screen, uses the camera, and behaves like a native app. No Apple/Google approval, no store, nothing to download. We're ~90% there since it's already a deployed web app.
- **What building the PWA takes (small):** add a **web app manifest** (name, icons, theme colors, display: standalone) and a **service worker** (fast launch + basic offline shell). That's essentially it.
- **Paywall:** mirror the ai/notes paywall approach. It's independent of how people install, so it works the same on a PWA.
- **Later / optional:** a Play Store / App Store wrapper (TWA or Capacitor) if we want an actual store listing; a desktop-only Chrome extension only if we ever want a desktop presence.
- **Timeline (Andrew's gut):** ~2–3 weeks from launch.

## Next steps (top of the pile — updated Aug 23)
0. **PWA launch prep** (see LAUNCH PLAN above): manifest + service worker + icons, then the ai/notes-style paywall.
1. **Mewtwo misID — finish the diagnostic, then fix.** Switch the debug trigger from
   `?debug=1` (dead on the live site — Netlify strips the query) to **tapping the price 3×**.
   Capture one read of the Black Star Promo to confirm it's the vision reader wobbling, then
   harden it — likely emphasize "promo / no set name" in `identify.mjs` and/or pass a stronger
   promo signal to Card Hedge `card-match` so #14 promos stop resolving to Legendary Collection.
2. **Price chart span toggle (3mo / 6mo / 12mo).** The calmer smoothed 6-month chart is
   live; add the span switcher on top of it.
3. **Josh's iPhone: name shows, no price.** Waiting on Josh's screenshot; may be dropped
   if Josh is cut from the deal. Leading hunch: Card Hedge pricing call hanging on iOS Safari.
4. **Watchlist — the next big build.** Reuses the collection engine + pressure/averages.
   NEEDS two calls from Andrew: (a) price alerts in scope now or later, (b) where alerts
   deliver (push / email / in-app).
5. **PSA is likely SHELVED** — cert verification only, and PSA is mired in scandals/lawsuits
   (buyback #PSAUp-Gate, July 2026 class action). Low value since trading was cut. Confirm with
   Andrew, then drop "get the PSA token" from the list. (He said "we will likely not do that.")
6. **Typed-cert fallback for slabs** + bump slab photos to ~2000px before upload. (Carried over.)
7. **Per-user daily scan cap** before signups open (every scan costs Sonnet + Card Hedge).

## Parked UI polish (Andrew's list)
- **Grades tab cleanup (LATER):** redesign the graded-price display to show the **top grading companies in order** — PSA (10 / 9 / 8), then CGC (10 / 9 / 8), then the next most popular grader — instead of the current flat list. Andrew wants it clean and scannable.
- **Graded-slab toggle REMOVED (Aug 23):** the "Raw card / Graded slab" toggle is hidden — raw mode reads graded cards fine and the grade breakdown shows in the Grades tab, so the separate cert-OCR slab flow was redundant (and its OCR was flaky). Slab code (`handleSlab`, `slabPath`) left intact but dormant behind the hidden toggle; un-hide `#scan-mode` to restore.

## Roadmap / parked ideas
- **Palworld TCG pricing — strong future lane.** The Palworld TCG is out and selling
  (chase cards ~$90–$900) and is NOT on TCGplayer or Card Hedge. The only real path to be
  first is to CROWDSOURCE it through our own scanner — users log what they buy/sell for →
  we build and OWN the price index nobody else has. Palworld is #1 on Steam concurrent
  players (over COD / Arc Raiders), so it may stick. Fits our exact scanner+collection
  engine. Andrew is running it by Josh.
- **Hot Wheels — not viable now.** Card Hedge has no diecast data and eBay sold is
  login-walled, so there's no pricing source. Revisit only if the app starts making money.
  (Andrew knows collectors with '96–98 cars.)
- **Andrew's open question for next session:** Pokemon going up in value this year (he'll
  ask it directly).

## Later / roadmap
- Paywall + eventual Chrome Web Store listing.
- Manual "type a card name" entry path.
- Favorite collections feature.

---

## Hard constraints / lessons learned (carried over from the Pokémon build)
- The app **cannot be a Claude artifact** — the artifact sandbox blocks third-party
  API calls. Must stay a deployed Netlify site with functions.
- **Never put a README.md that Netlify would serve as the homepage** — it breaks the
  site. index.html is the homepage. (These .md docs are fine; they're not index.)
- **Keep API keys server-side** in the Netlify functions — never in client JS.
- **Unbuilt features show honest "not live yet" states** — never fake sample data.
