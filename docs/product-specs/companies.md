# Companies

## Overview

Two types of companies exist in the system:

1. **Directory companies** -- scraped from UAE sources, stored in `uae_companies` table.
2. **Approved companies** -- users register as company role, admin approves, stored in `company_profiles` table.

Both types are surfaced through the same UI on `CompaniesPage.tsx` and `CompanyDetailPage.tsx`.

## Directory Companies

- **Source**: Scraped data from UAE design/renovation company websites.
- **Storage**: `uae_companies` table in MySQL. Filtered by `is_active = 1`.
- **Have**: Portfolio images (organized by category), descriptions, services, specialties, city, founded year, website, phone, email, Instagram.
- **Portfolio categories**: Images grouped by project type (e.g., "Residential", "Office", "Hotel"). Stored as JSON in `portfolio_categories` column.
- **Display**: Shown first in all listings (data completeness rule).

## Approved Companies (Registered)

- **Source**: Users register via `/auth` page, select "Professional Company" role during onboarding, then fill out company profile. Admin reviews and approves via admin panel.
- **Application flow**: User submits via `POST /api/company-applications` with company name, license number, phone, city, address, description. Admin reviews at `PUT /api/admin/company-applications/:id/review`.
- **May lack**: Portfolio images initially (they upload projects over time).
- **Display**: Shown after directory companies in all listings.

## Merge Rule (CRITICAL)

Directory companies ALWAYS appear before approved companies in any listing. This is enforced in `fetchPublicCompanies()` in `src/lib/publicApi.ts`:

1. Two parallel API calls: `GET /api/companies` (directory) and `GET /api/public/companies` (approved).
2. Directory companies are placed first.
3. Approved companies are appended, but only if their name (case-insensitive) does not already appear in the directory list.
4. Result is capped at the requested limit.

This deduplication-by-name prevents showing the same company twice when a registered user has been bound to a scraped company record.

## Company Interface

Defined in `src/lib/companyData.ts`:

```
id, name, description, shortDescription, city, address, foundedYear,
website, instagram, phone, email, styles[], projectCount, services[],
featured, coverImage, projectImages[], portfolioCategories, isClaimed
```

Key field: `isClaimed` (boolean) -- true if a real user manages this company. Controls image click behavior on the detail page.

## Company Detail

- Portfolio displayed via `MasonryGallery` component with categorized images and tabs.
- **Claimed companies** (`isClaimed: true`): clicking an image opens a lightbox on-site.
- **Unclaimed companies** (`isClaimed: false`): clicking an image redirects to the company's source website (`externalWebsite` prop).
- Logo is only shown in listing cards if the `coverImage` URL contains `/logos/`.
- Company card shows: project image, name, project count, city, founded year, short description, services tags, phone, website link.
- Filters available: city, founded year range, style, services, free-text search.

## API Endpoints

### Directory Companies (scraped data)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/companies` | List directory companies. Query params: `limit`, `page`, `order` (`home` or `list`) |
| GET | `/api/companies/:slug` | Get single directory company by slug |

### Approved Companies (registered users)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/companies` | List approved company profiles. Query params: `limit` |
| GET | `/api/public/companies/:id` | Get single approved company detail |
| GET | `/api/public/companies/categories` | Get available service categories |

### Authenticated Company Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/company/profile` | Create/update own company profile |
| GET | `/api/auth/company/profile` | Get own company profile |
| GET | `/api/auth/company/projects` | Get own company projects |
| GET | `/api/auth/company/services` | Get service option list |
| POST | `/api/auth/company/scrape-portfolio` | Scrape portfolio from external URL |

### Company Applications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/company-applications` | Submit application to become a company |
| GET | `/api/company-applications/mine` | Check own application status |

### Admin Company Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/companies` | List all scraped companies |
| GET | `/api/admin/companies/:id/detail` | Get scraped company detail |
| GET | `/api/admin/companies/:id/full-detail` | Get full detail with projects |
| PUT | `/api/admin/companies/:id/edit` | Edit scraped company |
| PUT | `/api/admin/companies/:id/display-order` | Set display order |
| PUT | `/api/admin/companies/:id/home-display-order` | Set home page display order |
| PUT | `/api/admin/companies/:id/list-display-order` | Set list page display order |
| POST | `/api/admin/companies/:id/bind` | Bind user to scraped company (super admin) |
| DELETE | `/api/admin/companies/:id/bind` | Unbind user from company (super admin) |
| GET | `/api/admin/roles/companies` | List registered company profiles |
| POST | `/api/admin/roles/companies/:id/approve` | Approve company profile |
| POST | `/api/admin/roles/companies/:id/reject` | Reject company profile |
| GET | `/api/admin/companies/merge-candidates` | List merge candidates |
| POST | `/api/admin/companies/:id/merge` | Merge registered company with scraped (super admin) |
| POST | `/api/admin/companies/:id/unmerge` | Unmerge company (super admin) |
