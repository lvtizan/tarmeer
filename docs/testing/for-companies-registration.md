# For-Companies Registration Flow Test Cases

## Tables involved
- `company_leads` - form data + CRM push
- `users` - account creation
- `company_profiles` - company profile auto-creation
- `admin_users` - email conflict check

## TC-FC-01: Complete registration flow (happy path)

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/company-leads with phone, email, companyName, city | 201, lead created |
| 2 | Check company_leads table | Record exists with correct data |
| 3 | POST /api/auth/register with email, password, phone, city, role=company | 201, user created |
| 4 | Check users table | phone, city, role=company set |
| 5 | POST /api/auth/login with email, password | 200, token returned |
| 6 | POST /api/auth/company/profile with company_name, phone, city | Profile created |
| 7 | Check company_profiles table | company_name, phone, city match form data |

## TC-FC-02: Duplicate email registration

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/auth/register with already-registered email | Error: email already registered |
| 2 | Check users table | No duplicate row created |

## TC-FC-03: company_leads CRM push

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/company-leads | 201 |
| 2 | Check server logs | "[CRM Push] Company lead created" or config missing message |

## TC-FC-04: Phone number sync

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register with phone +971501234567 | users.phone = +971501234567 |
| 2 | Create company profile with same phone | company_profiles.phone = +971501234567 |
| 3 | Phones must match across tables | PASS if identical |

## TC-FC-05: Empty/invalid email

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/auth/register with empty email | 400 error |
| 2 | POST /api/auth/register with invalid format | 400 error |

## TC-FC-06: Password too short

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/auth/register with password < MIN_PASSWORD_LENGTH | 400 error |
