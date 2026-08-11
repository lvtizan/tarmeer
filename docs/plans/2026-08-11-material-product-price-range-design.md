# Material Product Price Range Design

## Goal

Show a product's public price on `/materials`, including a minimum-to-maximum range when one is configured, while preserving all existing single-price products.

## Data model

- Keep `supplier_products.price` as the required minimum/base price for backward compatibility.
- Add nullable `supplier_products.price_max DECIMAL(12,2)`.
- A range is valid only when `price_max` is absent or `price_max >= price`.
- Existing rows require no backfill: `price_max = NULL` keeps their current single-price or starting-price behavior.

## Display contract

- `price` and `price_max`: `AED 120–200 / m²`.
- `price` only: `AED 120 / m²`.
- `price` with `price_from`: `From AED 120 / m²`.
- Missing/invalid price: render no price.
- When a range exists, the range takes precedence over the legacy `price_from` flag.
- Currency comes from `price_currency`; when absent, existing country-based fallback remains unchanged.

## Data flow

The supplier product create/edit endpoint and admin partial-update endpoint accept `price_max`. Public product queries return it alongside the existing price fields. Frontend API mappers preserve it as `number | null`, and one shared formatter produces the single-price, starting-price, or range label used by all public product-card variants.

## UI scope

- Supplier product create/edit form: add an optional maximum-price input next to the minimum price.
- Admin product editor: add the same optional field.
- `/materials`: show the formatted price under the product title in popular-product and product-search cards.
- Shared public product cards and category product grids use the same formatter so the behavior remains consistent beyond the hub.
- Products without a valid price remain visually unchanged.

## Error handling and validation

- Both write paths reject non-numeric, zero/negative, or maximum-below-minimum values with an actionable message.
- Admin partial updates validate against the effective stored minimum/maximum, so updating only one bound cannot create an invalid range.
- API mapping treats absent `price_max` as `null` and never fabricates a range from descriptions or supplier text.

## Verification

- Unit-test formatting for range, single price, starting price, absent price, decimals, and currency/unit formatting.
- Extend the real-MySQL supplier price harness for schema presence, create, update, invalid range, and admin partial-update cases.
- Run the project smoke harness and a production-mode Next build.
- Complete the required three independent review rounds before reporting completion.

