# Authentication Flow Tests

Comprehensive Playwright test suite for Tarmeer website's authentication system, covering registration, login, validation, and edge cases.

## Test Coverage

### 1. Registration Flow Tests
- **Successful Registration**: Complete registration flow with form validation
- **Password Mismatch Validation**: Ensures passwords must match
- **Required Fields Validation**: Verifies all required fields are enforced
- **Email Availability Check**: Real-time email duplicate detection
- **Phone Availability Check**: Real-time phone duplicate detection
- **Email Format Validation**: Tests various invalid email formats
- **Phone Format Validation**: Validates phone number format requirements
- **Password Length Validation**: Ensures minimum password length
- **Phone Sanitization**: Verifies non-digit characters are stripped from phone

### 2. Login Flow Tests
- **Successful Login**: Valid credentials redirect to dashboard
- **Invalid Credentials Error**: Proper error messaging
- **Unverified Email Check**: Blocks login for unverified accounts
- **Empty Field Validation**: HTML5 required attribute validation

### 3. Tab Switching Tests
- **Tab Navigation**: Switch between login and registration tabs
- **Error Clearing**: Errors clear when switching tabs

### 4. Password Visibility Tests
- **Registration Form**: Toggle password visibility for both password fields
- **Login Form**: Toggle password visibility

### 5. End-to-End Flow Tests
- **Complete Auth Flow**: Registration → Email Verification → Login → Dashboard

## Prerequisites

### Database Setup
Tests require MySQL access and use the `tarmeer` database:

```bash
# Ensure MySQL is running
mysql -uroot -e "SELECT 1"

# Verify tarmeer database exists
mysql -uroot -e "USE tarmeer; SHOW TABLES;"
```

### Development Server
Tests use Playwright's built-in web server (configured in `playwright.config.ts`):

```javascript
webServer: {
  command: 'npm run dev -- --host 127.0.0.1',
  url: 'http://127.0.0.1:5173',
  reuseExistingServer: true,
}
```

## Running Tests

### Run All Auth Flow Tests
```bash
npx playwright test tests/auth-flow.spec.ts
```

### Run Specific Test Suites
```bash
# Registration tests only
npx playwright test tests/auth-flow.spec.ts --grep "Registration Flow"

# Login tests only
npx playwright test tests/auth-flow.spec.ts --grep "Login Flow"

# Tab switching tests only
npx playwright test tests/auth-flow.spec.ts --grep "Tab Switching"
```

### Run with Visual Feedback (Headed Mode)
```bash
npx playwright test tests/auth-flow.spec.ts --headed
```

### Run Specific Test
```bash
npx playwright test tests/auth-flow.spec.ts --grep "should successfully register"
```

### Debug Mode
```bash
npx playwright test tests/auth-flow.spec.ts --debug
```

## Test Configuration

### Serial Execution
Tests run serially (`test.describe.configure({ mode: 'serial' })`) to avoid:
- Database conflicts between concurrent tests
- Email/phone uniqueness violations
- Session state interference

### Screenshot & Video
Captured on failure by default (configured in `playwright.config.ts`):
```javascript
use: {
  screenshot: 'on',
  video: 'retain-on-failure',
}
```

### Cleanup
Each test automatically cleans up created database records:
```typescript
cleanupTestDesigner(credentials.email);
```

## Test Data

### Generated Credentials
Each test generates unique credentials using timestamps:
```typescript
const timestamp = Date.now();
const randomSuffix = Math.floor(Math.random() * 10000);
const email = `test${timestamp}${randomSuffix}@example.com`;
```

### Known Test Data
Tests use these known accounts for validation tests:
- **Email**: `faisal.nour@example.ae` (existing email check)
- **Phone**: `+971501234567` (existing phone check)

## Database Helpers

### cleanupTestDesigner(email)
Removes a designer account from the database:
```bash
DELETE FROM designers WHERE email = '${email}'
```

### verifyTestDesigner(email)
Marks a designer's email as verified:
```bash
UPDATE designers SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE email = '${email}'
```

## Validation Rules Tested

### Email Validation
- Must be valid email format (regex: `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`)
- Real-time availability check via `/auth/check-availability`
- Error: "Please enter a valid email address" or "Email already registered"

### Phone Validation
- Must be valid E.164 format (regex: `/^\+[1-9]\d{7,14}$/`)
- Country code + phone number combined
- Non-digit characters stripped automatically
- Real-time availability check
- Error: "Please enter a valid phone number" or "Phone already registered"

### Password Validation
- Minimum length: 8 characters (from `MIN_PASSWORD_LENGTH`)
- Must match confirmation password
- Error: "At least 8 characters" or "Passwords do not match"

### Required Fields
- Full Name
- Email
- Phone
- City
- Password
- Confirm Password
- Privacy Policy agreement

## Test Output

### Console Logs
Tests provide progress feedback:
```
✓ Registration initiated for test1234567890123@example.com
✓ Password mismatch validation working correctly
✓ Email availability check working correctly
```

### HTML Report
Generate interactive HTML report:
```bash
npx playwright test tests/auth-flow.spec.ts --reporter=html
npx playwright show-report
```

### Test Results
Results saved to `test-results/`:
- Screenshots on failure
- Videos on failure
- Trace files on retry

## Troubleshooting

### Test Timeout
If tests timeout, increase timeout in `playwright.config.ts`:
```javascript
use: {
  actionTimeout: 10000, // 10 seconds
}
```

### Database Connection Error
Ensure MySQL is running:
```bash
mysql -uroot -e "SELECT 1"
```

### Port Already in Use
If port 5173 is busy:
```bash
# Kill existing process
lsof -ti:5173 | xargs kill -9

# Or use different port in playwright.config.ts
```

### Tests Pass but No Screenshots
Screenshots only capture on failure. To capture always:
```javascript
use: {
  screenshot: 'only-on-failure', // Change to 'on' for always
}
```

## Adding New Tests

### Template for New Test
```typescript
test('should test new feature', async ({ page }) => {
  const credentials = generateTestCredentials();

  // Setup (cleanup, database inserts)
  cleanupTestDesigner(credentials.email);

  // Test steps
  await page.goto('/auth');
  // ... test actions ...

  // Assertions
  await expect(page.getByText('Expected text')).toBeVisible();

  // Cleanup
  cleanupTestDesigner(credentials.email);
});
```

## Continuous Integration

### GitHub Actions Example
```yaml
- name: Run Auth Flow Tests
  run: |
    mysql -uroot -e "CREATE DATABASE IF NOT EXISTS tarmeer"
    npx playwright test tests/auth-flow.spec.ts
```

## Performance

### Typical Test Duration
- Single test: 2-5 seconds
- Full suite: 60-90 seconds

### Optimization Tips
- Use `page.waitForTimeout()` sparingly
- Prefer `await expect(...).toBeVisible()` over fixed waits
- Reuse page context when possible

## Maintenance

### Update Known Test Data
If database changes, update:
- `faisal.nour@example.ae` email check
- `+971501234567` phone check

### Update Validation Rules
If form validation changes, update:
- Email regex in tests
- Phone regex in tests
- Password length requirements
- Required fields list

## Related Files

- `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/tests/auth-flow.spec.ts` - Test file
- `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/playwright.config.ts` - Playwright config
- `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/src/pages/AuthPage.tsx` - Auth page component
- `/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/tests/auth-registration-persistence.spec.ts` - Related auth tests

## Test Statistics

- **Total Tests**: 17
- **Test Suites**: 5
- **Coverage Areas**: Registration, Login, Validation, UI Interaction, End-to-End
- **Database Operations**: Create, Read, Update, Delete
- **Test Data**: Dynamic generation + static known accounts

## Best Practices

1. **Always cleanup** test data to avoid flaky tests
2. **Use unique credentials** for each test run
3. **Test validation** at both client and server level
4. **Check accessibility** (ARIA labels, required attributes)
5. **Verify error states** as thoroughly as success states
6. **Test edge cases** (empty fields, invalid formats, duplicates)
7. **Use descriptive test names** that explain what is being tested
8. **Log key actions** for debugging and audit trail
