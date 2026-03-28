# Portfolio Enhancement & Company Page Redesign

## Overview

Expand the UAE companies dataset from 30 to 100 companies, scrape portfolio images organized by each company's original categories, and redesign the company detail page to a high-end, content-rich experience.

## Module 1: Scraper Enhancement

### 1.1 Company Discovery (Add 70 Companies)

Priority order by fame:
- **Batch 1 (International/Regional):** HBA, Gensler, Perkins&Will, KEO, Godwin Austen Johnson, DWP, Wilson Associates, and other international firms with UAE presence
- **Batch 2 (UAE Local Leaders):** High-rated, high-review-count local companies not in the current 30
- **Discovery channels:** Google Maps API search for "interior design company Dubai/Abu Dhabi", sorted by rating and review count

### 1.2 Category-Based Crawling

- Visit each company homepage, extract navigation links to portfolio/project category pages (e.g., `/projects/residential`, `/portfolio/commercial`)
- Enter each category page, follow individual project links
- Extract all high-quality images from each project page
- Limits: max 20 images per category, max 100 images per company
- Fallback: if no categories detected, all images go under `"Projects"`

### 1.3 Data Structure

Change from flat array to category-organized JSON:

```json
{
  "portfolio": {
    "Residential": [
      { "url": "/images/.../1.jpg", "title": "Modern Villa" }
    ],
    "Commercial": [
      { "url": "/images/.../1.jpg", "title": "Office Tower" }
    ]
  }
}
```

### 1.4 Local Storage

```
public/images/uae-companies/portfolio/{slug}/{category}/{n}.jpg
```

### 1.5 Database Changes

- `portfolio_images` field changes from flat JSON array to nested JSON object (keyed by category)
- Serialization layer maintains backward compatibility with old flat array format

## Module 2: Company Detail Page Redesign

### 2.1 Layout (Top to Bottom)

1. **Fixed Top Bar** - Back button, company name, website + social links
2. **Full-Screen Hero (100vh)** - Best portfolio image as background, company name + tagline + city + year overlaid, bottom gradient + scroll hint
3. **Brand Stats Bar** - Project count | Years experience | Services count | Google rating
4. **About Section (2-column)** - Left 2/3: brand story, services tag grid, specialties. Right 1/3: sticky contact card (address, phone, email, WhatsApp, "Request Consultation" CTA)
5. **Portfolio Gallery (full-width)** - Category tabs (All | Residential | Commercial | Villa ...), Masonry/waterfall layout (3-4 columns desktop, 2 tablet, 1 mobile)
6. **Footer** - Back to list CTA

### 2.2 Visual Style

- **Colors:** Gold-brown palette (`#c6a065` / `#b8864a`), dark sections `#1c1917`, warm bg `#faf9f7`
- **Typography:** Cormorant Garamond (serif headings), Inter (body)
- **Effects:**
  - Hero parallax scroll (Framer Motion)
  - Gallery category switch transition animation
  - Image scroll entrance: fade-in + slight upward shift (staggered)
  - Lightbox open/close zoom animation
- **Texture:** Glass-morphism cards (`backdrop-blur`), subtle shadows, rounded corners

### 2.3 Masonry Gallery Details

- Desktop 3-4 columns, tablet 2 columns, mobile 1 column
- Images maintain original aspect ratio, naturally staggered
- Category tabs with underline indicator + switch animation
- "Load more" button when images exceed 12 (loads 12 per click)
- Empty categories auto-hidden from tabs

### 2.4 Lightbox (Light Theme)

- Background: white/warm gray (`#faf9f7`) with semi-transparent overlay
- Close button and navigation arrows: dark (`#2c2c2c`)
- Bottom thumbnail strip: white background + subtle shadow
- Image title and category name: dark text
- Navigate within current category (keyboard arrow keys supported)
- Gesture support: swipe left/right to switch

## Technical Stack

- **Scraper:** Puppeteer (existing), Node.js HTTP client
- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + Framer Motion
- **Database:** MySQL, `portfolio_images` JSON field
- **Masonry:** CSS columns or lightweight library (no heavy dependencies)
