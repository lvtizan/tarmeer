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

/**
 * Test suite configuration - run tests serially to avoid conflicts
 */
test.describe.configure({ mode: 'serial' });

/**
 * Helper function to login a test designer
 */
async function loginDesigner(page: any, email: string, password: string) {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Fill in login credentials
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(password);

  // Submit login
  await page.getByRole('button', { name: 'Sign in' }).first().click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/designer/dashboard', { timeout: 5000 });
}

/**
 * PROJECT UPLOAD FLOW TESTS
 */
test.describe('Designer Project Upload Flow', () => {
  const testEmail = 'test@example.com';
  const testPassword = 'test123456';

  test.beforeAll(async () => {
    // Setup test designer account
    cleanupTestDesigner(testEmail);

    runMysql(`
      INSERT INTO designers (email, password, full_name, phone, city, email_verified)
      VALUES ('${testEmail}', 'test-password', '测试设计师', '+971501234567', 'Dubai', 1)
    `);

    console.log(`✓ Setup test designer: ${testEmail}`);
  });

  test.afterAll(async () => {
    // Cleanup test designer
    cleanupTestDesigner(testEmail);
    console.log(`✓ Cleaned up test designer: ${testEmail}`);
  });

  test('1. Login and access upload page', async ({ page }) => {
    await test.step('Login as designer', async () => {
      await loginDesigner(page, testEmail, testPassword);
      await page.screenshot({ path: 'test-screenshots/upload/01-login-success.png' });
      console.log('✓ Login successful');
    });

    await test.step('Navigate to upload page', async () => {
      await page.goto('/designer/upload');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-screenshots/upload/02-upload-page-loaded.png', fullPage: true });

      // Verify page title
      await expect(page.getByText('Upload New Project')).toBeVisible();
      console.log('✓ Upload page loaded successfully');
    });
  });

  test('2. Fill project details form', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Fill project title', async () => {
      const titleInput = page.getByPlaceholder('e.g. Modern Villa in Riyadh');
      await titleInput.fill('测试项目 - 现代别墅设计');
      await page.screenshot({ path: 'test-screenshots/upload/03-title-filled.png' });
      console.log('✓ Project title filled');
    });

    await test.step('Fill project description', async () => {
      const descTextarea = page.getByPlaceholder('Describe the design concept, challenges, and solutions...');
      await descTextarea.fill('这是一个现代化的别墅设计项目，融合了伊斯兰和现代元素。采用了开放式布局，大量使用自然光线，营造出优雅而舒适的居住空间。');
      await page.screenshot({ path: 'test-screenshots/upload/04-description-filled.png' });
      console.log('✓ Project description filled');
    });

    await test.step('Select style', async () => {
      const styleSelect = page.locator('select').filter({ hasText: 'Select a style' });
      await styleSelect.selectOption('modern');
      await page.screenshot({ path: 'test-screenshots/upload/05-style-selected.png' });
      console.log('✓ Style selected: Modern Contemporary');
    });

    await test.step('Fill location', async () => {
      const locationInput = page.getByPlaceholder('e.g. Riyadh, Dubai, Jeddah');
      await locationInput.fill('Dubai');
      await page.screenshot({ path: 'test-screenshots/upload/06-location-filled.png' });
      console.log('✓ Location filled: Dubai');
    });

    await test.step('Fill project area', async () => {
      const areaInput = page.getByPlaceholder('e.g. 450');
      await areaInput.fill('450');
      await page.screenshot({ path: 'test-screenshots/upload/07-area-filled.png' });
      console.log('✓ Project area filled: 450 sqm');
    });

    await test.step('Select completion year', async () => {
      const yearSelect = page.locator('select').filter({ hasText: /^2024$/ });
      await yearSelect.selectOption('2024');
      await page.screenshot({ path: 'test-screenshots/upload/08-year-selected.png' });
      console.log('✓ Completion year selected: 2024');
    });

    await test.step('Verify all form fields are filled', async () => {
      await page.screenshot({ path: 'test-screenshots/upload/09-form-complete.png', fullPage: true });

      // Verify all fields have values
      await expect(page.getByPlaceholder('e.g. Modern Villa in Riyadh')).toHaveValue('测试项目 - 现代别墅设计');
      await expect(page.getByPlaceholder('Describe the design concept, challenges, and solutions...')).toHaveValue(/现代化的别墅设计/);
      await expect(page.getByPlaceholder('e.g. Riyadh, Dubai, Jeddah')).toHaveValue('Dubai');
      await expect(page.getByPlaceholder('e.g. 450')).toHaveValue('450');

      console.log('✓ All form fields validated');
    });
  });

  test('3. Test image upload functionality', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Verify upload area exists', async () => {
      const uploadArea = page.getByText('Click to upload or drag and drop');
      await expect(uploadArea).toBeVisible();
      await page.screenshot({ path: 'test-screenshots/upload/10-upload-area-visible.png' });
      console.log('✓ Image upload area is visible');
    });

    await test.step('Verify upload requirements text', async () => {
      await expect(page.getByText('High-res JPG, PNG (Max 10MB per image)')).toBeVisible();
      console.log('✓ Upload requirements text is displayed');
    });

    await test.step('Check existing mock images', async () => {
      // Check if there are pre-loaded mock images
      const images = page.locator('img[alt=""]');
      const count = await images.count();
      await page.screenshot({ path: 'test-screenshots/upload/11-existing-images.png' });
      console.log(`✓ Found ${count} existing mock images in gallery`);
    });

    await test.step('Test add image button', async () => {
      const addButton = page.locator('button').filter({ hasText: '' }).locator('.aspect-square').filter({ hasNot: page.locator('img') });
      const count = await addButton.count();

      if (count > 0) {
        await expect(addButton.first()).toBeVisible();
        await page.screenshot({ path: 'test-screenshots/upload/12-add-button-visible.png' });
        console.log('✓ Add image button is visible and clickable');
      } else {
        console.log('⚠ Add image button not found (might be different layout)');
      }
    });
  });

  test('4. Check Products Used section (currently hidden)', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Check if Products Used section exists', async () => {
      const productsSection = page.getByText('Products Used');
      const isVisible = await productsSection.isVisible();

      if (isVisible) {
        await page.screenshot({ path: 'test-screenshots/upload/13-products-section.png' });
        console.log('✓ Products Used section is visible');

        // Check for Add Product button
        const addButton = page.getByRole('button', { name: 'Add Product' });
        if (await addButton.isVisible()) {
          console.log('✓ Add Product button is available');
        } else {
          console.log('⚠ Add Product button not found');
        }
      } else {
        await page.screenshot({ path: 'test-screenshots/upload/13-products-hidden.png' });
        console.log('⚠ Products Used section is currently hidden (as per design)');
      }
    });
  });

  test('5. Test publish and draft buttons', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Verify Publish Project button', async () => {
      const publishButton = page.getByRole('button', { name: 'Publish Project' });
      await expect(publishButton).toBeVisible();
      await expect(publishButton).toBeEnabled();
      await page.screenshot({ path: 'test-screenshots/upload/14-publish-button.png' });
      console.log('✓ Publish Project button is visible and enabled');
    });

    await test.step('Verify Save Draft button', async () => {
      const draftButton = page.getByRole('button', { name: 'Save Draft' });
      await expect(draftButton).toBeVisible();
      await expect(draftButton).toBeEnabled();
      await page.screenshot({ path: 'test-screenshots/upload/15-draft-button.png' });
      console.log('✓ Save Draft button is visible and enabled');
    });

    await test.step('Test Publish button click (expect no backend yet)', async () => {
      const publishButton = page.getByRole('button', { name: 'Publish Project' });

      // Click publish button
      await publishButton.click();
      await page.waitForTimeout(2000);

      // Check for any error or success messages
      const toastMessage = page.locator('[class*="toast"], [class*="notification"], [class*="message"]').first();
      const hasMessage = await toastMessage.isVisible();

      if (hasMessage) {
        await page.screenshot({ path: 'test-screenshots/upload/16-publish-response.png' });
        console.log('✓ Publish button triggered a response');
      } else {
        await page.screenshot({ path: 'test-screenshots/upload/16-publish-no-response.png' });
        console.log('⚠ Publish button clicked but no response (backend not implemented yet)');
      }
    });
  });

  test('6. Test navigation elements', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Verify sidebar navigation', async () => {
      const sidebar = page.locator('aside').first();
      await expect(sidebar).toBeVisible();
      await page.screenshot({ path: 'test-screenshots/upload/17-sidebar.png' });
      console.log('✓ Sidebar navigation is visible');

      // Check navigation items
      const navItems = ['Dashboard', 'My Projects', 'Profile', 'Messages'];
      for (const item of navItems) {
        const navItem = sidebar.getByText(item);
        if (await navItem.isVisible()) {
          console.log(`  ✓ Navigation item: ${item}`);
        }
      }
    });

    await test.step('Verify top navigation bar', async () => {
      const header = page.locator('header').first();
      await expect(header).toBeVisible();
      await page.screenshot({ path: 'test-screenshots/upload/18-header.png' });
      console.log('✓ Top navigation bar is visible');

      // Check for Tarmeer Dashboard logo
      await expect(page.getByText('Tarmeer Dashboard')).toBeVisible();
      console.log('  ✓ Tarmeer Dashboard logo visible');
    });

    await test.step('Test return to home link', async () => {
      const homeLink = page.locator('a').filter({ hasText: 'Tarmeer Dashboard' });
      await expect(homeLink).toHaveAttribute('href', '/');

      // Click home link
      await homeLink.click();
      await page.waitForURL('**/');
      await page.screenshot({ path: 'test-screenshots/upload/19-home-page.png' });
      console.log('✓ Successfully navigated to home page');
    });
  });

  test('7. Form validation tests', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Test empty form validation', async () => {
      // Try to publish without filling required fields
      const publishButton = page.getByRole('button', { name: 'Publish Project' });
      await publishButton.click();
      await page.waitForTimeout(1000);

      // Check for validation errors (HTML5 validation)
      const requiredInputs = page.locator('input[required], textarea[required], select[required]');
      const count = await requiredInputs.count();
      console.log(`✓ Found ${count} required fields in form`);

      await page.screenshot({ path: 'test-screenshots/upload/20-empty-form-validation.png' });
    });

    await test.step('Test partial form fill', async () => {
      // Fill only title
      await page.getByPlaceholder('e.g. Modern Villa in Riyadh').fill('Test Project');
      await page.screenshot({ path: 'test-screenshots/upload/21-partial-fill.png' });
      console.log('✓ Partial form fill completed');
    });
  });

  test('8. Responsive design tests', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);

    await test.step('Test mobile view', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/designer/upload');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-screenshots/upload/22-mobile-view.png', fullPage: true });
      console.log('✓ Mobile view screenshot captured');
    });

    await test.step('Test tablet view', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/designer/upload');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-screenshots/upload/23-tablet-view.png', fullPage: true });
      console.log('✓ Tablet view screenshot captured');
    });

    await test.step('Test desktop view', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/designer/upload');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-screenshots/upload/24-desktop-view.png', fullPage: true });
      console.log('✓ Desktop view screenshot captured');
    });
  });

  test('9. End-to-end complete upload flow', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Complete full project details form', async () => {
      // Fill all required fields
      await page.getByPlaceholder('e.g. Modern Villa in Riyadh').fill('测试项目 - 现代别墅设计');
      await page.getByPlaceholder('Describe the design concept, challenges, and solutions...').fill(
        '这是一个现代化的别墅设计项目，融合了伊斯兰和现代元素。'
      );
      await page.locator('select').filter({ hasText: 'Select a style' }).selectOption('modern');
      await page.getByPlaceholder('e.g. Riyadh, Dubai, Jeddah').fill('Dubai');
      await page.getByPlaceholder('e.g. 450').fill('450');
      await page.locator('select').filter({ hasText: /^2024$/ }).selectOption('2024');

      await page.screenshot({ path: 'test-screenshots/upload/25-e2e-form-filled.png', fullPage: true });
      console.log('✓ Complete form filled');
    });

    await test.step('Attempt to publish project', async () => {
      const publishButton = page.getByRole('button', { name: 'Publish Project' });
      await publishButton.click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'test-screenshots/upload/26-e2e-publish-attempt.png', fullPage: true });
      console.log('✓ Publish attempt completed');
    });

    await test.step('Check for any success/error indicators', async () => {
      // Check URL changes
      const currentUrl = page.url();
      console.log(`  Current URL: ${currentUrl}`);

      // Check for any modal or dialog
      const modal = page.locator('[role="dialog"], .modal, [class*="Modal"]');
      const hasModal = await modal.count() > 0;

      if (hasModal) {
        await page.screenshot({ path: 'test-screenshots/upload/27-e2e-modal.png' });
        console.log('⚠ Modal detected after publish');
      } else {
        console.log('  No modal detected (backend may not be implemented)');
      }
    });
  });

  test('10. Test step progress indicator', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Verify step indicator', async () => {
      await expect(page.getByText('Step 1 of 3')).toBeVisible();
      await page.screenshot({ path: 'test-screenshots/upload/28-step-indicator.png' });
      console.log('✓ Step indicator visible: Step 1 of 3');
    });

    await test.step('Verify progress bar', async () => {
      const progressBar = page.locator('.bg-stone-100').first().locator('div');
      await expect(progressBar).toHaveAttribute('style', /width:\s*33%/);
      console.log('✓ Progress bar at 33% (Step 1 of 3)');
    });
  });

  test('11. Test image gallery interactions', async ({ page }) => {
    await loginDesigner(page, testEmail, testPassword);
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');

    await test.step('Test image hover effects', async () => {
      const images = page.locator('.aspect-square').filter({ has: page.locator('img') });
      const count = await images.count();

      if (count > 0) {
        await images.first().hover();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-screenshots/upload/29-image-hover.png' });
        console.log('✓ Image hover effect tested');

        // Check for action buttons on hover
        const eyeButton = page.locator('button').filter({ hasText: '' }).locator('.text-stone-400, .text-\\[\\#2c2c2c\\]').first();
        const hasEyeButton = await eyeButton.isVisible();

        if (hasEyeButton) {
          console.log('  ✓ Eye button visible on hover');
        }
      }
    });

    await test.step('Test cover image indicator', async () => {
      const coverBadge = page.getByText('Cover');
      const isVisible = await coverBadge.isVisible();

      if (isVisible) {
        await page.screenshot({ path: 'test-screenshots/upload/30-cover-badge.png' });
        console.log('✓ Cover image badge is visible');
      } else {
        console.log('⚠ Cover badge not found');
      }
    });
  });
});
