# Future pricing and slab ideas

This is a research/backlog note only. Do not build or purchase anything from it without Andrew's direction.

## Keep for later

- The scanner can later read a slab label: grading company, assigned grade, and certification number. It already uses strict JSON output; add these only when slab support returns.
- Add a price cache after a card has been matched. Key it by the provider card ID plus the exact printing, and save price, source, and checked time. This avoids repeat pricing calls while keeping the existing collection table intact.
- For a slab with no verified source price, offer an eBay sold-listings search link for that exact card, grading company, and grade.

## Do not use

- Do not invent slab values from raw-card multipliers. They would look like real prices without a reliable market source.
- Do not replace the current Supabase collection schema with Google's proposed `cards`, `user_collections`, and `cached_prices` tables. It conflicts with the running app and leaves out details already in use.
- `public.cards` is unrelated to trading-card pricing; it is a general protocol for publishing public structured data.

## Already in place

- Card photos are converted in the browser to JPEG, 1,200px maximum, at 0.85 quality before scanning.
- Scanner output is strict JSON and now reads Pokemon finish, rarity, rarity mark, and special stamps.

## Providers to research before any integration

### PriceCharting

- Official API is paid and uses a private token.
- It supports a text product query, such as a card name plus number, and returns current card values including ungraded and several graded-price fields.
- It limits API calls to one per second and does not provide historic prices or historic sales through that API.
- Not usable for Collect Valor's public price display without PriceCharting's express written permission. Its current terms allow price data to be cited externally only with clear attribution and a visible PriceCharting link; they prohibit use in third-party-accessible software or redistribution without written permission.

### Card Ladder

- Possible slab/sales-data source. Andrew reported an approximately $30/month API plan with a 20-lookups-per-minute limit.
- Verify current API availability, commercial rights, price, coverage, and exact limits directly with Card Ladder before using it.
