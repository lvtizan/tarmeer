# Test Cases: Company Type Expansion + Signup Flow

## Feature Summary
- Expanded company_type from 2 to 7 types
- Added 8 new services
- Signup form: removed email, added Year of Establishment, company type selector
- /for-companies -> /join redirect flow with Google + Email auth
- Public pages: type filter on /companies, type badge on cards + detail page
- AdminSelect: ref forwarding + error state

## TC-1: Company Type Validation (Backend)
- POST /auth/company/profile with company_type='mep_contractor' -> 200 OK
- POST /auth/company/profile with company_type='invalid_type' -> 400 error
- POST /auth/company/profile with company_type='design_studio' -> 200 OK (backward compat)

## TC-2: Signup Form Validation (/for-companies)
- Submit without Contact Name -> browser native required prompt
- Submit without Phone -> browser native required prompt
- Submit without Company Name -> browser native required prompt
- Submit without Company Type -> red border on dropdown, auto-focus
- Submit with incomplete phone -> error message
- Submit with fake phone number -> phoneValidation error
- Year of Establishment accepts 1900-2026, optional field

## TC-3: Signup Flow Redirect
- Fill form on /for-companies -> submit -> redirects to /join?role=company&company_name=...&...
- /join page shows Google button + Email input (initial step)
- Email param NOT in URL (email collected at /join, not /for-companies)
- company_name, contact_person, phone, city, company_type, establishment_year in URL params

## TC-4: Registration via /join (Email)
- Enter email -> continue -> enter password -> registers with role=company
- Auto-creates company_profiles with company_type from URL params
- Redirects to /company dashboard
- Existing email -> login flow -> still creates company profile

## TC-5: Registration via /join (Google)
- Click Google -> OAuth flow -> callback -> role=company
- sessionStorage has pending_company_profile data
- Company profile created after Google callback

## TC-6: Public Companies Page (/companies)
- Sidebar shows Company Type filter (only if types exist in data)
- Selecting a type filters company list
- Active filter chip shows type label
- Page title/description updates based on selected type
- Company cards show type badge (warm gold pill)
- Sidebar scrollable when content overflows

## TC-7: Company Detail Page (/companies/:id)
- Type badge shown in header next to project count
- "Type" row in Business Details sidebar
- SEO title includes company type
- JSON-LD includes additionalType and services in knowsAbout

## TC-8: Admin Pages
- CompanyEditModal: 7 types in dropdown + 8 new services
- AdminApplicationsTable: colored type badges per type
- AdminRoleManagementPage: short type labels
- AdminRegisteredCompanyDetailPage: full type labels

## TC-9: Company Dashboard
- TYPE_OPTIONS has 7 entries
- SERVICES list has 21 entries (13 original + 8 new)
- Company type select shows all options

## TC-10: Import Service
- Excel import with "Design" -> design_studio
- Excel import with "MEP" or "HVAC" -> mep_contractor
- Excel import with "Construction" -> general_contractor
- Excel import with "Maintenance" -> maintenance_company
- Excel import with "Landscape" -> landscaping
- Excel import with "Glass" -> specialty_trade
- Excel import with unknown type -> renovation_company (default)

## TC-11: Notification Service
- New company registration email shows correct type label for all 7 types
- Unknown type falls back to raw value
