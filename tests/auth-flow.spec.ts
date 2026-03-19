import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

/**
 * Database helper functions for test setup and cleanup
 */
function runMysql(sql: string) {
  execSync(`mysql -uroot tarmeer -e "${sql.replace(/"/g, '\\"')}"`);
}

function cleanupTestDesigner(email: string) {
  runMysql(`DELETE FROM designers WHERE email = '${email}'`);
}

function verifyTestDesigner(email: string) {
  runMysql(`UPDATE designers SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE email = '${email}'`);
}

/**
 * Test suite configuration - run tests serially to avoid conflicts
 */
test.describe.configure({ mode: 'serial' });

/**
 * Helper function to generate unique test credentials
 */
function generateTestCredentials() {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  return {
    fullName: '测试设计师',
    email: `test${timestamp}${randomSuffix}@example.com`,
    phone: '501234567',
    city: 'Dubai',
    password: 'test123456',
    confirmPassword: 'test123456',
  };
}

/**
 * REGISTRATION FLOW TESTS
 */
test.describe('Registration Flow', () => {
  test('should successfully register a new designer account', async ({ page }) => {
    const credentials = generateTestCredentials();

    // Cleanup before test in case of previous failed run
    cleanupTestDesigner(credentials.email);

    await test.step('Navigate to auth page and switch to registration tab', async () => {
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      const createAccountButton = page.getByRole('button', { name: 'Create account' }).first();
      await createAccountButton.click();

      await expect(page.getByText('Create your studio profile')).toBeVisible();
    });

    await test.step('Fill in the registration form', async () => {
      // Full Name
      await page.locator('input[name="fullName"]').fill(credentials.fullName);

      // Email
      await page.locator('input[name="email"]').fill(credentials.email);
      await page.locator('input[name="email"]').blur();
      await page.waitForTimeout(500); // Wait for email validation

      // Verify email validation message
      await expect(page.getByText('Email looks good')).toBeVisible();

      // Phone Country Code (UAE +971)
      const phoneCountrySelect = page.locator('select[aria-label="Country code"]');
      await phoneCountrySelect.selectOption('+971');

      // Phone Number
      await page.locator('input[name="phone"]').fill(credentials.phone);
      await page.locator('input[name="phone"]').blur();
      await page.waitForTimeout(500); // Wait for phone validation

      // City
      await page.locator('select[name="city"]').selectOption(credentials.city);

      // Password
      await page.locator('input[name="password"]').fill(credentials.password);
      await page.locator('input[name="password"]').blur();

      // Confirm Password
      await page.locator('input[name="confirmPassword"]').fill(credentials.confirmPassword);
      await page.locator('input[name="confirmPassword"]').blur();
      await page.waitForTimeout(500); // Wait for password match validation

      // Verify password match message
      await expect(page.getByText('Passwords match')).toBeVisible();

      // Privacy Policy checkbox
      await page.locator('input[name="agree"]').check();
    });

    await test.step('Submit registration form', async () => {
      const submitButton = page.locator('form').getByRole('button', { name: 'Create account' });
      await submitButton.click();

      // Wait for success message or error
      await page.waitForTimeout(2000);

      // Verify success message or email sent message
      const successMessage = page.getByText(/Registration successful|verification email/);
      await expect(successMessage).toBeVisible({ timeout: 5000 });

      console.log(`✓ Registration initiated for ${credentials.email}`);
    });

    // Cleanup after test
    cleanupTestDesigner(credentials.email);
  });

  test('should validate password mismatch', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    const credentials = generateTestCredentials();

    // Fill form with mismatched passwords
    await page.locator('input[name="fullName"]').fill(credentials.fullName);
    await page.locator('input[name="email"]').fill(credentials.email);
    await page.locator('select[aria-label="Country code"]').selectOption('+971');
    await page.locator('input[name="phone"]').fill(credentials.phone);
    await page.locator('select[name="city"]').selectOption(credentials.city);

    await page.locator('input[name="password"]').fill(credentials.password);
    await page.locator('input[name="password"]').blur();

    await page.locator('input[name="confirmPassword"]').fill('differentpassword');
    await page.locator('input[name="confirmPassword"]').blur();
    await page.waitForTimeout(500);

    // Verify password mismatch error
    await expect(page.getByText('Passwords do not match')).toBeVisible();

    // Verify submit button is disabled
    const submitButton = page.locator('form').getByRole('button', { name: 'Create account' });
    await expect(submitButton).toBeDisabled();

    console.log('✓ Password mismatch validation working correctly');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    // Try to submit without filling any fields
    const submitButton = page.locator('form').getByRole('button', { name: 'Create account' });
    await expect(submitButton).toBeDisabled();

    // Fill only some fields and try to submit
    await page.locator('input[name="fullName"]').fill('Test Designer');
    await expect(submitButton).toBeDisabled();

    await page.locator('input[name="email"]').fill('test@example.com');
    await expect(submitButton).toBeDisabled();

    await page.locator('select[aria-label="Country code"]').selectOption('+971');
    await page.locator('input[name="phone"]').fill('501234567');
    await expect(submitButton).toBeDisabled();

    await page.locator('input[name="password"]').fill('test123456');
    await page.locator('input[name="confirmPassword"]').fill('test123456');
    await expect(submitButton).toBeDisabled();

    // City is still missing
    await expect(submitButton).toBeDisabled();

    // Select city
    await page.locator('select[name="city"]').selectOption('Dubai');
    await expect(submitButton).toBeDisabled();

    // Terms not agreed
    // Agree to terms
    await page.locator('input[name="agree"]').check();

    // Now button should be enabled
    await expect(submitButton).toBeEnabled();

    console.log('✓ Required fields validation working correctly');
  });

  test('should check email availability in real-time', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    // Test with known existing email
    await page.locator('input[name="email"]').fill('faisal.nour@example.ae');
    await page.locator('input[name="email"]').blur();

    // Wait for availability check
    await page.waitForTimeout(1000);

    // Should show "Email already registered" error
    await expect(page.getByText('Email already registered')).toBeVisible();

    console.log('✓ Email availability check working correctly');
  });

  test('should check phone availability in real-time', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    // Test with known existing phone
    await page.locator('select[aria-label="Country code"]').selectOption('+971');
    await page.locator('input[name="phone"]').fill('501234567');
    await page.locator('input[name="phone"]').blur();

    // Wait for availability check
    await page.waitForTimeout(1000);

    // Should show "Phone already registered" error
    await expect(page.getByText('Phone already registered')).toBeVisible();

    console.log('✓ Phone availability check working correctly');
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    const invalidEmails = [
      'invalid',
      'invalid@',
      '@example.com',
      'invalid@.com',
      'invalid..email@example.com',
    ];

    for (const invalidEmail of invalidEmails) {
      await page.locator('input[name="email"]').fill(invalidEmail);
      await page.locator('input[name="email"]').blur();
      await page.waitForTimeout(300);

      // Should show email format error
      await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    }

    console.log('✓ Email format validation working correctly');
  });

  test('should validate phone format', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    // Test with phone that's too short
    await page.locator('select[aria-label="Country code"]').selectOption('+971');
    await page.locator('input[name="phone"]').fill('123');
    await page.locator('input[name="phone"]').blur();

    // Should show phone format error
    await expect(page.getByText('Please enter a valid phone number')).toBeVisible();

    console.log('✓ Phone format validation working correctly');
  });

  test('should validate minimum password length', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    // Test with short password
    await page.locator('input[name="password"]').fill('12345');
    await page.locator('input[name="password"]').blur();

    // Should show minimum length error
    await expect(page.getByText(/At least \d+ characters/)).toBeVisible();

    console.log('✓ Password length validation working correctly');
  });

  test('should strip non-digit characters from phone field', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    const phoneField = page.locator('input[name="phone"]');

    // Fill with letters, spaces, and special characters
    await phoneField.fill('50abc-12+34@! 56');

    // Should strip to only digits
    await expect(phoneField).toHaveValue('50123456');

    console.log('✓ Phone field sanitization working correctly');
  });
});

/**
 * LOGIN FLOW TESTS
 */
test.describe('Login Flow', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    const credentials = generateTestCredentials();

    // Create and verify test designer in database
    await test.step('Setup test designer in database', async () => {
      cleanupTestDesigner(credentials.email);

      runMysql(`
        INSERT INTO designers (email, password, full_name, phone, city, email_verified)
        VALUES ('${credentials.email}', 'test-password', '${credentials.fullName}', '+971${credentials.phone}', '${credentials.city}', 1)
      `);

      // Get the designer ID
      const id = Number(
        execSync(
          `mysql -uroot tarmeer --batch --raw --skip-column-names -e "SELECT id FROM designers WHERE email = '${credentials.email}' ORDER BY id DESC LIMIT 1;"`,
        )
          .toString()
          .trim()
      );

      console.log(`✓ Created test designer with ID: ${id}`);
    });

    await test.step('Navigate to login page', async () => {
      await page.goto('/auth');

      // Ensure we're on the login tab (default)
      await expect(page.getByRole('button', { name: 'Sign in' })).toHaveClass(/border border-stone-200 bg-white/);
    });

    await test.step('Fill in login credentials', async () => {
      await page.locator('input[name="email"]').fill(credentials.email);
      await page.locator('input[name="password"]').fill('test-password');
    });

    await test.step('Submit login form', async () => {
      const submitButton = page.getByRole('button', { name: 'Sign in' });
      await submitButton.click();

      // Wait for redirect to dashboard
      await page.waitForURL('**/designer/dashboard', { timeout: 5000 });

      // Verify we're on the dashboard
      await expect(page).toHaveURL(/\/designer\/dashboard/);

      console.log('✓ Login successful and redirected to dashboard');
    });

    // Cleanup after test
    cleanupTestDesigner(credentials.email);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth');

    await page.locator('input[name="email"]').fill('nonexistent@example.com');
    await page.locator('input[name="password"]').fill('wrongpassword');

    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await submitButton.click();

    await page.waitForTimeout(2000);

    // Should show error message
    await expect(page.getByText(/Login failed|Invalid credentials/)).toBeVisible();

    console.log('✓ Login error handling working correctly');
  });

  test('should show error for unverified email', async ({ page }) => {
    const credentials = generateTestCredentials();

    // Create unverified designer
    cleanupTestDesigner(credentials.email);

    runMysql(`
      INSERT INTO designers (email, password, full_name, phone, city, email_verified)
      VALUES ('${credentials.email}', 'test-password', '${credentials.fullName}', '+971${credentials.phone}', '${credentials.city}', 0)
    `);

    await page.goto('/auth');

    await page.locator('input[name="email"]').fill(credentials.email);
    await page.locator('input[name="password"]').fill('test-password');

    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await submitButton.click();

    await page.waitForTimeout(2000);

    // Should show verification error
    await expect(page.getByText(/verify your email/)).toBeVisible();

    // Should show resend verification button
    await expect(page.getByRole('button', { name: 'Resend verification email' })).toBeVisible();

    console.log('✓ Email verification check working correctly');

    // Cleanup
    cleanupTestDesigner(credentials.email);
  });

  test('should show validation errors for empty login fields', async ({ page }) => {
    await page.goto('/auth');

    // Try to submit without filling fields (HTML5 validation should trigger)
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    // Both fields should be required
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');

    console.log('✓ Login field required validation working correctly');
  });
});

/**
 * TAB SWITCHING TESTS
 */
test.describe('Tab Switching', () => {
  test('should switch between login and registration tabs', async ({ page }) => {
    await page.goto('/auth');

    await test.step('Verify initial state is login tab', async () => {
      await expect(page.getByRole('button', { name: 'Sign in' })).toHaveClass(/border border-stone-200 bg-white/);
      await expect(page.locator('input[name="email"]').first()).toBeVisible();
    });

    await test.step('Switch to registration tab', async () => {
      await page.getByRole('button', { name: 'Create account' }).first().click();

      await expect(page.getByRole('button', { name: 'Create account' })).toHaveClass(/border border-stone-200 bg-white/);
      await expect(page.locator('input[name="fullName"]')).toBeVisible();
    });

    await test.step('Switch back to login tab', async () => {
      await page.getByRole('button', { name: 'Sign in' }).first().click();

      await expect(page.getByRole('button', { name: 'Sign in' })).toHaveClass(/border border-stone-200 bg-white/);
      await expect(page.locator('input[name="email"]').first()).toBeVisible();
    });

    console.log('✓ Tab switching working correctly');
  });

  test('should clear errors when switching tabs', async ({ page }) => {
    await page.goto('/auth');

    // Go to registration tab
    await page.getByRole('button', { name: 'Create account' }).first().click();

    // Trigger an error
    await page.locator('input[name="email"]').fill('invalid-email');
    await page.locator('input[name="email"]').blur();
    await page.waitForTimeout(500);

    await expect(page.getByText('Please enter a valid email address')).toBeVisible();

    // Switch to login tab
    await page.getByRole('button', { name: 'Sign in' }).first().click();

    // Switch back to registration tab
    await page.getByRole('button', { name: 'Create account' }).first().click();

    // Error should be cleared
    await expect(page.getByText('Please enter a valid email address')).not.toBeVisible();

    console.log('✓ Error clearing on tab switch working correctly');
  });
});

/**
 * PASSWORD VISIBILITY TESTS
 */
test.describe('Password Visibility', () => {
  test('should toggle password visibility in registration form', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Create account' }).first().click();

    await test.step('Test password field visibility toggle', async () => {
      const passwordInput = page.locator('input[name="password"]');
      const toggleButton = passwordInput.locator('..').getByRole('button').filter({ hasText: /Show|Hide/ });

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Click to show password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');

      // Click to hide password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    await test.step('Test confirm password field visibility toggle', async () => {
      const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
      const toggleButton = confirmPasswordInput.locator('..').getByRole('button').filter({ hasText: /Show|Hide/ });

      // Initially password should be hidden
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      // Click to show password
      await toggleButton.click();
      await expect(confirmPasswordInput).toHaveAttribute('type', 'text');

      // Click to hide password
      await toggleButton.click();
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    console.log('✓ Password visibility toggles working correctly');
  });

  test('should toggle password visibility in login form', async ({ page }) => {
    await page.goto('/auth');

    const passwordInput = page.locator('input[name="password"]').first();
    const toggleButton = passwordInput.locator('..').getByRole('button').filter({ hasText: /Show|Hide/ });

    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click to hide password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    console.log('✓ Login password visibility toggle working correctly');
  });
});

/**
 * FULL END-TO-END FLOW TEST
 */
test.describe('End-to-End Auth Flow', () => {
  test('should complete full registration and login flow', async ({ page }) => {
    const credentials = generateTestCredentials();

    // Cleanup before test
    cleanupTestDesigner(credentials.email);

    await test.step('Registration', async () => {
      await page.goto('/auth');
      await page.getByRole('button', { name: 'Create account' }).first().click();

      // Fill registration form
      await page.locator('input[name="fullName"]').fill(credentials.fullName);
      await page.locator('input[name="email"]').fill(credentials.email);
      await page.locator('input[name="email"]').blur();
      await page.waitForTimeout(500);

      await page.locator('select[aria-label="Country code"]').selectOption('+971');
      await page.locator('input[name="phone"]').fill(credentials.phone);
      await page.locator('input[name="phone"]').blur();
      await page.waitForTimeout(500);

      await page.locator('select[name="city"]').selectOption(credentials.city);
      await page.locator('input[name="password"]').fill(credentials.password);
      await page.locator('input[name="confirmPassword"]').fill(credentials.confirmPassword);
      await page.locator('input[name="agree"]').check();

      // Submit registration
      await page.locator('form').getByRole('button', { name: 'Create account' }).click();

      // Wait for success message
      await page.waitForTimeout(2000);
      await expect(page.getByText(/Registration successful|verification email/)).toBeVisible();

      console.log(`✓ Registration completed for ${credentials.email}`);
    });

    await test.step('Verify email in database', async () => {
      verifyTestDesigner(credentials.email);
      console.log('✓ Email verified in database');
    });

    await test.step('Login', async () => {
      // Should be automatically switched to login tab after registration
      await page.waitForTimeout(1000);

      // Fill login credentials
      await page.locator('input[name="email"]').first().fill(credentials.email);
      await page.locator('input[name="password"]').first().fill(credentials.password);

      // Submit login
      await page.getByRole('button', { name: 'Sign in' }).first().click();

      // Wait for redirect to dashboard
      await page.waitForURL('**/designer/dashboard', { timeout: 5000 });

      // Verify we're on the dashboard
      await expect(page).toHaveURL(/\/designer\/dashboard/);

      console.log('✓ Login successful and redirected to dashboard');
    });

    // Cleanup after test
    cleanupTestDesigner(credentials.email);
  });
});
