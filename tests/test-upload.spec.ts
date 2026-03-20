import { test, expect } from '@playwright/test';

test('basic upload page test', async ({ page }) => {
  await page.goto('/designer/upload');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Upload New Project')).toBeVisible();
  await page.screenshot({ path: 'test-results/basic-upload-test.png' });
});
