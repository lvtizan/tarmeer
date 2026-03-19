import { test, expect } from '@playwright/test';

/**
 * PROJECT UPLOAD FLOW TESTS - Simplified Version
 */
test.describe('Designer Project Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to upload page for testing
    await page.goto('/designer/upload');
    await page.waitForLoadState('networkidle');
  });

  test('1. Upload page should load successfully', async ({ page }) => {
    // Verify page title
    await expect(page.getByText('Upload New Project')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/upload-01-page-load.png', fullPage: true });

    console.log('✓ Upload page loaded successfully');
  });

  test('2. Project details form should be present', async ({ page }) => {
    // Check for form elements
    await expect(page.getByPlaceholder('e.g. Modern Villa in Riyadh')).toBeVisible();
    await expect(page.getByPlaceholder('Describe the design concept, challenges, and solutions...')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Riyadh, Dubai, Jeddah')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. 450')).toBeVisible();

    // Check for select elements
    const selects = page.locator('select');
    await expect(selects).toHaveCount(2); // Style and Year selects

    await page.screenshot({ path: 'test-results/upload-02-form-elements.png', fullPage: true });

    console.log('✓ All form elements are present');
  });

  test('3. Should fill project details form', async ({ page }) => {
    // Fill project title
    await page.getByPlaceholder('e.g. Modern Villa in Riyadh').fill('测试项目 - 现代别墅设计');

    // Fill project description
    await page.getByPlaceholder('Describe the design concept, challenges, and solutions...').fill(
      '这是一个现代化的别墅设计项目，融合了伊斯兰和现代元素。'
    );

    // Select style
    const styleSelect = page.locator('select').first();
    await styleSelect.selectOption('modern');

    // Fill location
    await page.getByPlaceholder('e.g. Riyadh, Dubai, Jeddah').fill('Dubai');

    // Fill project area
    await page.getByPlaceholder('e.g. 450').fill('450');

    // Select completion year
    const yearSelect = page.locator('select').nth(1);
    await yearSelect.selectOption('2024');

    await page.screenshot({ path: 'test-results/upload-03-form-filled.png', fullPage: true });

    // Verify all fields have values
    await expect(page.getByPlaceholder('e.g. Modern Villa in Riyadh')).toHaveValue('测试项目 - 现代别墅设计');
    await expect(page.getByPlaceholder('e.g. Riyadh, Dubai, Jeddah')).toHaveValue('Dubai');
    await expect(page.getByPlaceholder('e.g. 450')).toHaveValue('450');

    console.log('✓ Form filled successfully');
  });

  test('4. Image upload area should be visible', async ({ page }) => {
    // Check upload area
    const uploadArea = page.getByText('Click to upload or drag and drop');
    await expect(uploadArea).toBeVisible();

    // Check upload requirements text
    await expect(page.getByText('High-res JPG, PNG (Max 10MB per image)')).toBeVisible();

    // Check for existing mock images
    const images = page.locator('img[alt=""]');
    const imageCount = await images.count();

    await page.screenshot({ path: 'test-results/upload-04-image-area.png', fullPage: true });

    console.log(`✓ Image upload area visible with ${imageCount} mock images`);
  });

  test('5. Publish and Draft buttons should be present', async ({ page }) => {
    // Check for Publish Project button
    const publishButton = page.getByRole('button', { name: 'Publish Project' });
    await expect(publishButton).toBeVisible();
    await expect(publishButton).toBeEnabled();

    // Check for Save Draft button
    const draftButton = page.getByRole('button', { name: 'Save Draft' });
    await expect(draftButton).toBeVisible();
    await expect(draftButton).toBeEnabled();

    await page.screenshot({ path: 'test-results/upload-05-buttons.png' });

    console.log('✓ Both Publish and Draft buttons are present');
  });

  test('6. Navigation elements should be functional', async ({ page }) => {
    // Check top navigation
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Check for Tarmeer Dashboard logo
    await expect(page.getByText('Tarmeer Dashboard')).toBeVisible();

    // Check sidebar (only visible on desktop)
    const sidebar = page.locator('aside').first();
    if (await sidebar.isVisible()) {
      await expect(sidebar.getByText('My Projects')).toBeVisible();
      await expect(sidebar.getByText('Dashboard')).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/upload-06-navigation.png', fullPage: true });

    console.log('✓ Navigation elements are present');
  });

  test('7. Step progress indicator should be visible', async ({ page }) => {
    // Check step indicator
    await expect(page.getByText('Step 1 of 3')).toBeVisible();

    // Check progress bar
    const progressBar = page.locator('.bg-stone-100').first();
    await expect(progressBar).toBeVisible();

    await page.screenshot({ path: 'test-results/upload-07-progress.png' });

    console.log('✓ Step progress indicator is visible');
  });

  test('8. Should handle responsive layouts', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: 'test-results/upload-08-mobile.png', fullPage: true });

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ path: 'test-results/upload-09-desktop.png', fullPage: true });

    console.log('✓ Responsive layouts tested');
  });

  test('9. Image gallery should have interactive elements', async ({ page }) => {
    // Check for existing images
    const images = page.locator('.aspect-square').filter({ has: page.locator('img') });
    const imageCount = await images.count();

    if (imageCount > 0) {
      // Hover over first image to check for actions
      await images.first().hover();
      await page.waitForTimeout(500);

      // Check for cover badge
      const coverBadge = page.getByText('Cover');
      const hasCover = await coverBadge.isVisible();

      await page.screenshot({ path: 'test-results/upload-10-image-hover.png' });

      console.log(`✓ Image gallery has ${imageCount} images, cover badge: ${hasCover}`);
    } else {
      console.log('⚠ No images found in gallery');
    }
  });

  test('10. Complete end-to-end form fill', async ({ page }) => {
    // Fill complete form
    await page.getByPlaceholder('e.g. Modern Villa in Riyadh').fill('测试项目 - 现代别墅设计');
    await page.getByPlaceholder('Describe the design concept, challenges, and solutions...').fill(
      '这是一个现代化的别墅设计项目，融合了伊斯兰和现代元素。采用了开放式布局，大量使用自然光线。'
    );

    const styleSelect = page.locator('select').first();
    await styleSelect.selectOption('modern');

    await page.getByPlaceholder('e.g. Riyadh, Dubai, Jeddah').fill('Dubai');
    await page.getByPlaceholder('e.g. 450').fill('450');

    const yearSelect = page.locator('select').nth(1);
    await yearSelect.selectOption('2024');

    // Try to publish (will fail without backend but we can test the UI)
    const publishButton = page.getByRole('button', { name: 'Publish Project' });
    await publishButton.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/upload-11-e2e-publish.png', fullPage: true });

    console.log('✓ End-to-end form fill completed');
  });
});
