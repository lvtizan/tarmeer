# Design & UX expert walkthrough (设计专家 / UX专家 走查)

## Summary of changes made

### 1. Footer navigation (与顶部一致的底部导航)
- Added a footer nav row with the same links as the top: Home, Designers, Pricing, Materials, Become a Partner, Contact Us.
- Improves discoverability and gives the footer a fuller, more consistent look.

### 2. Homepage designer module — 16:9 images
- Designer card project image aspect ratio changed from 4:5 to **16:9** (`aspect-video`).
- Better for landscape project photos and consistent with common content ratios.

### 3. Materials module (建材城) — aligned with tarmeer-3.0
- **Landing page (/materials):**
  - Intro paragraph explaining the materials offer and inviting quotes/showroom visits.
  - Five category cards with full descriptions (core customization, building facade, hard materials, furniture & soft, smart tech).
  - Bottom CTA section: quote, product info, showroom visit + Contact us button.
- **Category pages (/materials/:category):**
  - Hero with category title, subtitle, and short description (from 3.0 structure).
  - **Selected projects** section with 4–6 case studies per category, taken from tarmeer-3.0:
    - Core Customization: 4 cases (Marina Villa, Downtown Kitchen, Palm Mansion, JVC Renovation).
    - Building Facade: 4 cases (Business Bay Tower, Downtown Facade, Marina Villa, Palm Hotel).
    - Hard Materials: 6 cases (flooring, tiling, wood, coatings, cladding, outdoor).
    - Furniture & Soft: 6 cases (villa furnishing, penthouse, sanitary, office, kids, living room).
    - Smart Tech: 6 cases (smart villa, smart office, lighting, construction tech, outdoor lighting, smart home).
  - Each case: image, category, location, title, description, feature list (✓).
  - CTA block: quote + showroom mention + Contact us.

### 4. Design expert (设计) checks
- **Visual consistency:** Footer nav matches top nav; Materials cards and category pages use the same Havenly-style (light, cards, gold accents).
- **Hierarchy:** One clear h1 per page; section titles (h2) for “Selected projects” and CTAs.
- **Spacing and layout:** PageContainer (max-w-6xl) used on all inner pages; Materials landing and category content have clear sections and breathing room.

### 5. UX expert (UX) checks
- **Navigation:** Footer provides a second way to reach main sections; back links on Materials and category pages (“Back to Materials”, “Back to Home”).
- **Affordances:** Category cards and CTAs are clearly clickable; primary buttons use `.btn-primary` (dark gold, white text).
- **Accessibility:**
  - Meaningful `alt` on images: designer cards (project + designer name), designer profile (avatar, portfolio project), materials categories and case study images.
  - Footer nav has `aria-label="Footer navigation"`; category page projects section has `aria-labelledby="projects-heading"`; feature lists have `aria-label="Project features"`.
- **Content completeness:** No empty states left for Materials; every category has multiple case studies and a clear CTA.
- **Mobile:** Existing responsive grid and stacking preserved; footer nav wraps on small screens.

## Recommendations for next iteration
- Add a “Skip to main content” link for keyboard/screen reader users.
- Consider breadcrumbs on Materials category pages (e.g. Home > Materials > Hard Materials).
- If the site grows, add a sitemap or search for materials/products.
