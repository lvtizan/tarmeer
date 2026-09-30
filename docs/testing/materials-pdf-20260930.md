# Materials procurement PDF implementation — 2026-09-30

Scope: the nine tasks in `Tarmeer网站改进清单_2026-09-29(1).pdf`, the AE materials catalog, and shared supplier/inquiry security boundaries. Public identity remains platform sourcing: Tarmeer receives inquiries and coordinates suppliers; a supplier reference is not a certification or a disclosed legal company name. Existing VN routing remains country-isolated; the AE-only product-detail gate remains in place.

| PDF task | Implementation |
| --- | --- |
| T01 | Descriptive English publication gate for AE, separate Model specification, admin English-name editing, country-scoped review queue for translation/incomplete/possible duplicate; no auto-deletion. First-batch data contains 193 products from supplier-1127 plus the Snow-Covered Spring Mountains board. Existing original titles, images and prices are retained. Catalogue item numbers identify records where the source supplied no model; they are not invented manufacturer models. |
| T02 | Image/title direct to exact product; separate supplier link; safe return URL retains filters; loaded directory pages and scroll position are restored during navigation. |
| T03 | Explicit Tarmeer sourcing identity and receiver; unsupported Verified and delivery guarantees removed from affected UI and metadata. |
| T04 | Original currency selectable in filters; no conversion or assumed exchange rate; readable piece/m² units; fixed/from/range/request-quote statuses; missing price basis, costs and delivery labelled to confirm. Numeric saves require explicit original currency and unit. |
| T05 | URL-backed search/category, origin, material, recorded availability/lead time, currency/unit/budget, category specification and ordering; price comparison only in one currency and unit. Origin is not stock availability. |
| T06 | Product ID/title/model/supplier snapshot on server; quantity/unit or unknown; project area only for optional whole-project consultation; duplicate-safe receipt; failed input retained; admin displays context in its actual country. |
| T07 | Stable contain images; loading/missing/error distinguished; original fallback and retry; complete records preferred; manual duplicate review. |
| T08 | Smaller hero, secondary supplier login, compact filters and cards; desktop/mobile acceptance recorded below. |
| T09 | Navigation uses product_categories, matching directory; plural counts fixed; Materials is quote comparison, Mall is curated sourcing collections. |

## Content and operational follow-up

The complete published AE audit baseline is in `materials-pdf-baseline-20260930.json` (983 records). Missing commercial information must be confirmed with suppliers; no stock, lead time, certification or price is fabricated. First-batch JSON has before/after values and an original title for every item. The production operation is a transaction, checks current values against the audited version, backs up full rows, and asserts that unrelated fields/prices/images are unchanged.

## Validation and release gate

- Supplier enrichment already delivered separately: 35 product-gallery additions, six two-image cases; 188/188 static URLs and original prices verified.
- Focused backend tests, real local MySQL write/read tests, public-price API, form input/receipt tests and country walkthrough must pass after final fixes.
- Three sequential independent reviews are required before release; findings, repairs and final counts will be appended here.
- The clean origin/main smoke script referenced two files that did not exist in that commit (`company-china-options.mjs`, `lighting-category.mjs`). Those belong to unfinished work in a separate user workspace. Removed their dangling invocations, kept existing shipped checks, and added procurement checks. No company feature code from that workspace is included.
- This worktree initially used an external node_modules symlink that Turbopack rejects. A local copy of the same dependencies permits the normal `next build`; no dependency version change.
- Production DDL runs on the server using `/tarmeer/tarmeer_api/.env`; backend files are backed up and individually synchronized before restart. Frontend uses git pull/build/pm2 and BUILD_ID verification. No new raster assets are part of this code release.

## Measurement contract

`materials_directory_view`, `materials_product_view`, `materials_inquiry_start` and `materials_inquiry_success` send a session identifier, country and optional product ID. They never send names, telephone numbers, messages, search terms or URL queries. Local traffic carries `internal=true`. Measure unique sessions over the same time range, exclude internal/test traffic and recognized bots (existing request user-agent), and segment by viewport/device from existing analytics collection and product category via product ID.

- Completeness: published products with descriptive English title, enabled canonical category and main image / all published products. This is a recorded-data baseline, not a certification of every image's visual quality.
- Detail entry: sessions with product view / directory sessions.
- Inquiry start: sessions interacting with inquiry form / product-view sessions.
- Inquiry completion: sessions with successful receipt / form-start sessions.
- Valid inquiries: requires a sales-agreed qualification rule; no unverified historical ratio or improvement is claimed.

Performance measurements will distinguish production from local development and state dimensions/network conditions; no before/after gain is claimed without a comparable baseline.

## Acceptance observations (local, 2026-09-30)

- Desktop Chrome viewport 1440×900: first card top 529.5px, bottom 878.3px; full first row fits. Mobile 390×844 after collapsed controls: first-card document top 516.5px, bottom about 804px. No horizontal overflow at 390px or 412px. These are viewport simulations, not physical iOS/Android device certification.
- Mobile product image opened exact product 490 from `q=LED`; back link retained the encoded search. Quote with quantity unknown returned visible, focused `Receipt #126`; local database independently verified product 490, supplier 26, recipient Tarmeer, unknown quantity, and null project area. No production test lead was submitted.
- Database scenarios additionally exercise one piece, 80 m², and whole-project 140 m² consultation, then retrieve each through the actual admin controller and assert product/supplier/quantity/recipient context.
- Independent review 1: security/specification findings repaired (admin country, inquiry input contract, required migration, explicit price context, image validity/ownership, stale country response, return/filter context, content whitelist/category validation, analytics referrer). Final no blocking findings. Its focused checks: 76 backend + 34 database + 47 frontend + 4 startup; tsc/diff checks passed.
- Current final checks: smoke 41/41; country walkthrough 33/33; expanded procurement database 40/40. Remaining independent review/build/deployment evidence follows when complete.
- Review 2 fixes: persisted directory page count rebuilds deep returns after cache expiry/detail reload; shared canonical position keys treat `%20` and `+` consistently. Browser confirmed 48 loaded products and scroll Y 2783 after a detail hard reload. Return/filter helper 7/7 PASS.
- Legacy confirmed `CNY + 元/㎡` quotes display and filter as CNY per m² without changing amounts; conflicting currency/unit context fails closed. All canonical product units, including M, are available in the filter. Expanded DB 42/42 and price tests 29/29 PASS.
- Production content read-only preflight: 194/194 records still match the audit, all target categories enabled; pending 194. No data writes during preflight.
- Review 3 integration repairs include search/featured/category supplier references, removal of public legal-name search probing, explicit public supplier DTO whitelist, SA review access, secondary product image/title navigation with separate zoom, category/fallback SEO wording and country guards, and escaped fallback JSON-LD. Non-AE supplier galleries preserve their supported media behavior rather than linking to the AE-only product detail route. Translated Collection specs retain series grouping.
- Additional validation: public profile/list excludes licenses and account identifiers; backend 79/79; expanded local DB 53/53; supplier/category rendered-entry scenarios 11/11; video regression 28/28; price UI 102/102. These checks are included in or supplement the final smoke run.

## Independent review conclusions

| Round | Findings and closure | Final conclusion |
| --- | --- | --- |
| 1 — specification/security | 11 actionable issue groups repaired: country enforcement, quantity contract, startup migration, price context, image validation/ownership, stale country results, malformed requests, menu return/image handling, dependent filters, content operation guards, analytics referrer. One VN detail-routing report was withdrawn after checking the actual AE-only route. | Clear, no unresolved blockers. |
| 2 — regression/quality | 3 blocking issues repaired: cache-miss deep return, equivalent URL position keys, legacy currency/unit display and filtering. Also strengthened before-field whitelisting and removed unused code. | Clear, no unresolved blockers. |
| 3 — integration/omissions | 8 groups repaired: supplier identity/search, public DTO whitelist, SA review access, supplier-library links/images, category links/images, SEO/source claims and isolation, English-only AE name validity, Collection grouping. | Clear, no unresolved blockers. |

Final frozen source production build: `next build` exit 0. Country walkthrough after final country changes: 33/33 PASS. Normal development server restarted afterward in the isolated worktree; the user's other workspace was not modified.
Final frozen-source smoke: **42/42 PASS**. A stale static test expectation for the admin preview's unit argument was corrected without changing product code; round-3 reviewer independently reran it (102/102) and reaffirmed clearance. Public unit-normalization behavioral assertions remain intact.
