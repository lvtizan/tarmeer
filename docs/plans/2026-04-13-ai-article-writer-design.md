# AI Article Writer — Design Doc

**Date**: 2026-04-13
**Goal**: Article management system with AI draft generation, admin API key config, public blog pages with SEO.

---

## Admin: API Configuration
- Admin Settings: "AI Configuration" section
- Fields: Provider (OpenAI/Google Gemini), API Key, Model name
- Stored in system_config table (key-value pairs)
- When API key empty, company "Generate" button shows "Coming soon"

## Database: articles table
- id, company_profile_id, title, slug, content (markdown), excerpt
- cover_image, tags (JSON), status (draft/published)
- seo_title, seo_description, created_at, updated_at

## Company Dashboard: /company/articles
- Article list (my articles)
- "AI Generate" button → select project → LLM generates draft
- Editor: title, markdown content, cover image, tags
- Publish/draft toggle

## Public Pages
- /blog — article listing page
- /blog/{slug} — article detail with Helmet + Article JSON-LD
- Added to sitemap

## API Endpoints
- POST /api/articles/generate — call LLM for draft
- CRUD /api/auth/company/articles — company article management
- GET /api/public/articles — public list
- GET /api/public/articles/:slug — public detail

## LLM Integration
- Abstracted provider interface (OpenAI now, Google Gemini later)
- Config from DB system_config table
- Prompt: generate SEO article based on company + project data
