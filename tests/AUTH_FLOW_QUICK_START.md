# Authentication Flow Tests - Quick Start Guide

## Overview
Comprehensive Playwright test suite for Tarmeer's authentication system covering registration, login, validation, and edge cases.

## Quick Start

### Run All Tests
```bash
cd "/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0"
npx playwright test tests/auth-flow.spec.ts
```

### Run Tests in Browser (Watch Mode)
```bash
npx playwright test tests/auth-flow.spec.ts --headed
```

### Run Specific Test Suite
```bash
# Registration tests only
npx playwright test tests/auth-flow.spec.ts --grep "Registration Flow"

# Login tests only
npx playwright test tests/auth-flow.spec.ts --grep "Login Flow"

# End-to-end test only
npx playwright test tests/auth-flow.spec.ts --grep "End-to-End Auth Flow"
```

### View HTML Report
```bash
npx playwright test tests/auth-flow.spec.ts --reporter=html
npx playwright show-report
```

## Test Summary

### Total Coverage: 17 Tests across 5 Suites

#### 1. Registration Flow (9 tests)
- ✓ Successful registration with form validation
- ✓ Password mismatch validation
- ✓ Required fields validation
- ✓ Email availability real-time check
- ✓ Phone availability real-time check
- ✓ Email format validation
- ✓ Phone format validation
- ✓ Password length validation
- ✓ Phone field sanitization (non-digit stripping)

#### 2. Login Flow (4 tests)
- ✓ Successful login with valid credentials
- ✓ Invalid credentials error handling
- ✓ Unverified email blocking
- ✓ Empty field HTML5 validation

#### 3. Tab Switching (2 tests)
- ✓ Login/Registration tab navigation
- ✓ Error clearing on tab switch

#### 4. Password Visibility (2 tests)
- ✓ Registration form password toggles
- ✓ Login form password toggle

#### 5. End-to-End Flow (1 test)
- ✓ Complete registration → verification → login → dashboard flow

## Test Scenarios

### Registration Flow
```typescript
Scenario: User registers a new account
Given I am on the auth page
And I switch to "Create account" tab
When I fill in:
  | Full Name       | 测试设计师                      |
  | Email           | test1234567890123@example.com |
  | Phone Country   | +971                           |
  | Phone           | 501234567                      |
  | City            | Dubai                          |
  | Password        | test123456                     |
  | Confirm Password| test123456                     |
And I agree to Privacy Policy
And I submit the form
Then I should see success message
And the form should be cleared
And I should be switched to login tab
```

### Login Flow
```typescript
Scenario: User logs in with valid credentials
Given I have a verified account
  | Email   | test1234567890123@example.com |
  | Password| test-password                 |
When I go to the auth page
And I fill in email and password
And I click "Sign in"
Then I should be redirected to /designer/dashboard
```

### Validation Scenarios
```typescript
Scenario: Email availability check
Given I am on registration tab
When I enter "faisal.nour@example.ae" (existing email)
And I blur the email field
Then I should see "Email already registered" error

Scenario: Password mismatch
Given I am on registration tab
When I enter password "test123456"
And I enter confirm password "differentpassword"
Then I should see "Passwords do not match" error
And submit button should be disabled
```

## Key Features Tested

### Real-time Validation
- Email format and availability checking
- Phone format and availability checking
- Password matching validation
- Field-level error messages

### Form Behavior
- Required field enforcement
- Submit button state (enabled/disabled)
- Error clearing on tab switch
- Password visibility toggles
- Phone number sanitization

### User Flow
- Registration → Email Verification → Login
- Error handling and messaging
- Redirect after successful login
- Form state management

## Database Operations

### Automatic Cleanup
Each test automatically cleans up:
```sql
DELETE FROM designers WHERE email = 'test{timestamp}@example.com'
```

### Test Data Creation
Tests create accounts as needed:
```sql
INSERT INTO designers (email, password, full_name, phone, city, email_verified)
VALUES ('test@example.com', 'test-password', 'Test Designer', '+971501234567', 'Dubai', 1)
```

## Expected Results

### All Tests Pass
```
PASS tests/auth-flow.spec.ts (17 tests)
  ✓ Registration Flow (9)
  ✓ Login Flow (4)
  ✓ Tab Switching (2)
  ✓ Password Visibility (2)
  ✓ End-to-End Auth Flow (1)

Duration: ~60s
```

### Screenshot Locations
On failure, screenshots saved to:
```
test-results/
  ├── auth-flow-spec/
  │   ├── test-failure-1.png
  │   └── test-failure-2.png
```

## Troubleshooting

### Tests Fail Immediately
Check MySQL is running:
```bash
mysql -uroot -e "SELECT 1"
```

### Tests Timeout
Increase timeout in playwright.config.ts:
```javascript
use: {
  actionTimeout: 10000,
}
```

### Port 5173 Already in Use
Kill existing process:
```bash
lsof -ti:5173 | xargs kill -9
```

## File Locations

- **Test File**: `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/tests/auth-flow.spec.ts`
- **Config File**: `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/playwright.config.ts`
- **Auth Page**: `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/src/pages/AuthPage.tsx`
- **Documentation**: `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/tests/AUTH_FLOW_TESTS.md`

## Next Steps

1. **Run the tests**: `npx playwright test tests/auth-flow.spec.ts`
2. **View the report**: `npx playwright show-report`
3. **Read detailed docs**: `tests/AUTH_FLOW_TESTS.md`
4. **Add new tests**: Follow templates in test file

## Test Statistics

| Metric | Value |
|--------|-------|
| Total Tests | 17 |
| Test Suites | 5 |
| Avg Duration | 60-90s |
| Coverage | Registration, Login, Validation, UI, E2E |
| Auto-cleanup | Yes |
| Screenshot on Failure | Yes |
| Video on Failure | Yes |

## Validation Rules Covered

- Email format (regex: `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`)
- Phone E.164 format (regex: `/^\+[1-9]\d{7,14}$/`)
- Password min length: 8 characters
- Required fields: Full Name, Email, Phone, City, Password, Confirm Password, Privacy Policy
- Real-time availability: Email, Phone
- Duplicate detection: Email, Phone

## Success Criteria

✓ All 17 tests pass
✓ Registration flow completes successfully
✓ Login flow redirects to dashboard
✓ Validation messages appear correctly
✓ Error handling works as expected
✓ Database cleanup completes
✓ No console errors
✓ Screenshot captured on failure

---

**Created**: 2026-03-19
**Test Framework**: Playwright 1.58.2
**Test Environment**: http://127.0.0.1:5173
**Database**: MySQL (tarmeer)
