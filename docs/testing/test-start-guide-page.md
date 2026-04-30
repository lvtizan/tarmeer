# Test Cases: /start — Company Onboarding Guide Page

## Route
`GET /start`

## Happy Path

| # | Test | Expected |
|---|------|----------|
| 1 | Page loads at `/start` | HTTP 200, page renders without blank screen |
| 2 | Page title | `<title>` contains "Get Started on Tarmeer" |
| 3 | Hero headline visible | "Start Growing Your Business on Tarmeer" text present |
| 4 | Stats strip | 3 stats visible: "2,400+", "500+", "15 min" |
| 5 | "Register Your Company" CTA in hero | Links to `/for-companies` |
| 6 | All 5 steps visible | Step numbers 01–05 all rendered |
| 7 | Step 3 is highlighted (active/gold dot) | Step 03 dot has gold background |
| 8 | Each step has a screenshot image | 5 `<img>` tags with `/images/guide/stepN-*.png` src |
| 9 | Step 4 "Get Started" CTA | Link to `/for-companies` |
| 10 | Final CTA block | "Ready to get started?" block with gold button |
| 11 | Trust strip | 4 trust items visible at bottom |
| 12 | "Free" not mentioned anywhere | No occurrence of word "Free" in page text |
| 13 | Header logo links to `/` | TarmeerLogo wrapped in Link to "/" |
| 14 | "Register Now →" header link | Links to `/for-companies` |

## SEO Checks

| # | Test | Expected |
|---|------|----------|
| 15 | `<title>` tag | Present and non-empty |
| 16 | `<meta name="description">` | Present, mentions Tarmeer + UAE |
| 17 | `og:title` | Present |
| 18 | `og:description` | Present |
| 19 | `canonical` | Points to `https://www.tarmeer.com/start` |
| 20 | JSON-LD HowTo schema | `@type: "HowTo"` present in script tag |

## Image Checks

| # | Test | Expected |
|---|------|----------|
| 21 | Step images return 200 | `/images/guide/step1-register.png` returns 200 |
| 22 | Step images return 200 | `/images/guide/step2-verify.png` returns 200 |
| 23 | Step images return 200 | `/images/guide/step3-profile.png` returns 200 |
| 24 | Step images return 200 | `/images/guide/step4-upload.png` returns 200 |
| 25 | Step images return 200 | `/images/guide/step5-live.png` returns 200 |

## Mobile / Responsive

| # | Test | Expected |
|---|------|----------|
| 26 | 390px viewport | No horizontal scroll, timeline renders correctly |
| 27 | Step cards full width | Cards span available width with gap from timeline dot |

## Edge Cases

| # | Test | Expected |
|---|------|----------|
| 28 | Navigate to `/start` from `/` | Page renders (not 404) |
| 29 | Google One Tap not shown | `/start` not in EXCLUDED_PATHS, but page has no auth gate |
