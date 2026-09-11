# DESIGN — Collect Valor by Josh Hart

The locked visual + interaction design for the sports card scanner. Pair with
HANDOFF.md (status) and CLAUDE.md (how we work).

**Superseded Aug 12, 2026.** The original gold-on-black scheme was scrapped —
it read cheap/casino rather than premium. Current direction below.

## Vibe
Modern, technical, sporty-premium. Deep navy with faceted background planes and a
single mint-green accent. Inspired by the feel of apps like Ludex — **not copied**;
our own layout, our own identity.

## Color palette
| Token | Hex | Use |
|---|---|---|
| `--navy` | `#0A1A2B` | Page background |
| `--navy-facet` | `#0E2438` | Angled background plane 1 |
| `--navy-facet2` | `#0C1F31` | Angled background planes 2–3 |
| `--panel` | `#10283D` | Cards, stat chips, rows |
| `--panel-2` | `#0F2233` | Inset panels, inputs, small stats |
| `--slot` | `#16344B` | Image placeholders, muted chips |
| `--mint` | `#34E3AE` | THE accent — prices, active pills, CTAs, scan frame |
| `--mint-dark` | `#062018` | Text sitting on mint fills |
| `--line` | `#294A63` | Outlined buttons/pills, input borders |
| `--text` | `#EAF1F7` | Primary text |
| `--text-dim` | `#B7C6D4` | Secondary text |
| `--muted` | `#7C93A8` | Labels |
| `--muted-2` | `#566B7E` | Hints, disabled |
| `--danger` | `#FF6B6B` | Errors |

Rule: **mint is the only accent.** Everything else is navy, white, or muted blue-gray.
Prices are always mint. Don't introduce a second accent color.

## Type
- System sans stack. Uppercase + letter-spacing for section titles ("COLLECTION", "TRADE FLOOR").
- Monospace for anything numeric/technical: counts (`37/50`), cert numbers, stat values.
- Labels are 8.5–10px uppercase with ~1px letter-spacing.

## Shape language
- Buttons and pills are **fully rounded** (`border-radius: 20–24px`).
- Cards/panels use 10–16px radius.
- Scan frame: 1px mint border with 2px mint corner brackets.
- Faceted background: 3 large rotated rectangles, fixed position, behind all content.

## Layout — screens

### Login
Centered. "CV" mark in a bracketed mint square, COLLECT VALOR / by Josh Hart,
then a panel with username + PIN and a full-width mint "Sign in" button.

### App shell
- Header: brand on the left, stat chip on the right (collection value in mint,
  card count in mono, e.g. `0/70 CARDS`).
- Fixed bottom nav, 4 tabs: **Scan · Collection · Trade · Profile**. Active tab is mint.

### Scan tab
Scan frame → Scan (mint, filled) / Upload (outlined) buttons → result panel.
Busy state is a full-cover overlay with an animated mint bar + "IDENTIFYING CARD".

### Result panel
Identified tag → card name → set/number detail → chips (ROOKIE chip is mint-filled)
→ highlights → big mint price block → **data tabs: Overview · History · Sales · Pop**.
Those four tabs are the room we built for Card Hedge + PSA data. Currently only
Overview has fields; the rest show honest "not live yet" panels.

### Collection tab
Filter pills: **Singles · Slabs · ★ Showcase · ⇄ Tradeable**.
Below: a capacity bar showing usage against that section's cap, then the list
(currently an empty state).

### Trade tab
Explains the three match modes (Even trade / Trade up / Help someone out) with a
clear "not live yet" panel.

### Profile tab
Signed in as, plan, singles count, slabs count, scans today, favorite collections,
then Sign out.

## Interaction / platform
- Two input paths, both working on iOS (Safari) and Android (Chrome):
  - Scan → `<input type="file" accept="image/*" capture="environment">`
  - Upload → `<input type="file" accept="image/*">`
- A "type name" manual path is still planned.
- iPhone HEIC / large photos: downscaled + converted to JPEG in-browser before upload
  (`fileToJpeg`, max 1200px, quality 0.85).
- **Stored collection images target ~200 KB each** to protect Supabase Storage.

## Honesty rule for unbuilt sections
Unbuilt features show real structure with a plain "not live yet" message — never
fake sample cards or fake prices. Anyone demoing the app should be able to tell
what works from what doesn't.

## Notes
- Card Hedge does both identification and pricing once access is approved.
- Stays a deployed Netlify site (not a Claude artifact) so camera/library + API calls work.
- API keys server-side in the Netlify functions only.
