# 🎴 Pokémon Reselling — Project HANDOFF / Seed Doc

**Created:** Sep 11, 2026
**Owner:** Andrew (Springfield, MO)
**Purpose of this file:** Drop this into the NEW project folder for the Pokémon reselling venture. It's the single source of truth to catch any AI (Claude or ChatGPT) up instantly. Keep it updated.

---

## 1. What this project is

A **buy-low / flip-for-profit Pokémon card reselling venture.** Andrew buys cheap graded slabs and sealed Simplified-Chinese booster product, then resells — individual packs, singles, and slabs — for a profit. Two things being built/decided here:

1. Whether to start a **Whatnot** live-selling account.
2. Building a **custom inventory-management app** (his own, not a paid tool) to track sales, buyers, addresses, items, cost, and profit.

Separate from his "Collect Valor" sports-card *scanner app* — don't mix them.

---

## 2. Current inventory (as of Sep 10–11, 2026)

**Graded slabs bought cheap to flip (all CGC/CGC-style, ~$6–10 each):**
- Minior — 2023 S&V Paradox Rift #201 (raw, ~$30 market as of Sep 2026)
- Zekrom EX — 2025 Black Bolt (CGC 9)
- Slowbro — 2026 Mega Evolution
- Team Rocket's Murkrow — 2025 Destined Rivals
- Squirtle, Ditto, Poké Ball — 2019 JPN "Old Maid" (Babanuki) playing cards (CGC 10)
- Ditto Wild Card + Eeveelutions +4 — 2021 JPN "Pocket UNO" cards
- Gengar — 2023 JPN Raging Surf 035/062 (CGC 9)
- Radiant Greninja — 2024 JPN Stellar Miracle Deck Build Box 004/044 (CGC 8.5) ← nicest of the lot
- ⚠️ Note: the "Old Maid" and "Pocket UNO" cards are TWO different sets, not one — can't be sold as one complete set.

**Sealed Simplified-Chinese slim booster boxes (6 total, 15 packs each = 90 packs):**
- CSV9C 星彩晶璃 (Pikachu) ×1
- CSV8C 璀璨诡幻 (Milotic) ×1 — got for $24.99
- CSV5C 黑晶炽诚 "Dark Crystal Blaze" (Charizard) ×2
- CSV10C 共逐荣光 (Giovanni/Mewtwo) ×2
- Total spend on boxes: ~$122.28 + $72.89 ≈ **$195**

**Big pulls so far (2 boxes opened):**
- Team Rocket's Giovanni SAR 279/222 (~$35) ← holding this one a while
- Team Rocket's Mewtwo ex 065/222 (~$10)
- Swablu AR (~$10–15), plus Ho-Oh ex, Greedent ex gold, Rotom
- Those pulls already ~covered the cost of the 2 opened boxes.

---

## 3. Key facts established (verified — don't re-litigate)

- ✅ **Simplified-Chinese Pokémon TCG is OFFICIAL and legit.** Pokémon launched officially in mainland China; sets like Dark Crystal Blaze (CSV5C, launched Sep 12 2025, printed in Japan) are licensed, authentic, and **gradable by CGC/PSA**. The 宝可梦 wordmark just = "Pokémon" in Chinese. (Andrew was right; don't call these fake.)
- ✅ **Pack-weighing to find "heavy" hit packs is unreliable** on modern product — code cards, energy, reverse holos muddy it. Treat weighed-pack claims as a myth.
- ⚠️ **Value caveat:** Simplified-Chinese cards generally trade at a discount vs. English/Japanese for the same card. Price flips against **Chinese-market comps**, not English.

---

## 4. Whatnot (live-selling) — research done

**Onboarding (easy, ~minutes):** In app → + Sell → Get Started → accept guidelines → pick Trading Cards → answer background Qs → enter legal name (matching ID) + fulfillment address → submit. Usually approved within minutes. No upfront fee.

**Fees:** 8% commission + 2.9% + $0.30 per order (US).
- $4 pack → nets ~$3.25
- $5 → ~$4.15
- $6 → ~$5.05
- Buyers usually pay shipping; Whatnot bundles one buyer's wins into a single shipment.

**Realistic first-stream projection (new account = tiny audience):**
| Scenario | Viewers | Packs sold | Avg | Net |
|---|---|---|---|---|
| Rough | 3–5 | ~10 | $4 | ~$33 |
| Realistic | 5–10 | ~18 | $4.75 | ~$70 |
| Good | 10–15 | ~30 | $5.50 | ~$137 |

- **The real bottleneck is AUDIENCE, not packs.** The guys moving 10 packs/min have a following. First streams = break-even + audience-building.
- Selling boxes sealed: market too thin to profit — rip and sell packs/singles instead.
- $4/pack floor is fair; live auctions realistically hit $6–10 on FOMO with a couple bidders.

**Taxes (not tax advice — confirm w/ a pro):** Reselling profit is taxable; Whatnot issues a 1099-K on gross. But taxed on **profit, not gross** — deduct cost of goods, Whatnot fees, shipping supplies, home-office room. Keep receipts + a buy-vs-sold log.

**Selling psychology that works:** Let buyers *pick* their bonus packs (choice > handed) — "buyer's choice bonus with slab purchase" bundles packs with slabs and anchors the slab price.

---

## 5. Inventory-tracker app — v1 plan

**Decided approach:** A **single self-contained HTML file** Andrew keeps on his laptop, opens in Chrome. Fully offline, no cloud, no monthly cost.
- Working data stored on-machine (browser IndexedDB).
- Prominent **Backup** (download JSON) + **Restore** (load JSON) buttons; auto-download a backup periodically. This is the safety net.
- ⚠️ Only real risk = manually clearing Chrome browsing data → that's what Backup protects against.
- Fallback if he wants it more robust: Supabase (his known stack) + a keep-alive ping.

**v1 fields to track:**
- Each sale: date, buyer username, ship-to name + address, item, sale price, Whatnot fee, shipping, **net**
- Status: paid → shipped → done (daily mail queue)
- Inventory/cost: what he paid per box so profit auto-calcs
- Dashboard: total revenue, fees, cost, **profit**, + a clean tax number

**NOT yet decided:** manual entry vs. Whatnot CSV import vs. both. (Whatnot Seller Hub exports orders as CSV — bulk import would save typing.)

---

## 6. Working conventions

- **Two-AI workflow:** Andrew bounces between Claude and ChatGPT. Rule: keep ONE source of truth. Each AI updates a **"Here's What Has Changed.md"** file before handing back to the other, so they never build off different versions.
- Andrew directs; the AI writes all the code and delivers the **finished updated file** (never patches/diffs to apply himself).
- **Keep responses short and to the point.** Long replies cost him a lot of time to read/process. Not about limiting voice — it's about moving fast.
- One step at a time; wait before proceeding. Don't second-guess his decisions.
- **On factual/checkable things (prices, sets, markets): CHECK/search FIRST, then answer.** Don't tell him he's wrong from memory.
- No CLI; drag-and-drop / downloadable files preferred.
- Deploys via Netlify; comfortable with Supabase.

---

## 7. Open decisions / next steps

1. Decide: start a Whatnot account? (Lean = yes, set it up, start small, treat early streams as audience-building not payday.)
2. Rip the other 4 boxes or list some sealed as an A/B test (rip box #1 for packs, list box #2 sealed — clean side-by-side).
3. Finalize inventory-app v1 scope (entry method) → then build the single-file HTML app.
4. Camera nerves for Whatnot: it's hands-only (no face) — gets easy by stream 3. Has an empty room to set up as a little studio.

---

*Keep this file current. It's the anchor for both AIs.*
