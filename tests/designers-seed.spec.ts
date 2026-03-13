import { test, expect } from '@playwright/test';

async function expectImagesLoaded(locator: ReturnType<import('@playwright/test').Page['locator']>) {
  const count = await locator.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    await expect(locator.nth(i)).toHaveJSProperty('complete', true);
    const naturalWidth = await locator.nth(i).evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  }
}

test('public designers seed shows 15 designers with loaded avatars and case images', async ({ page }) => {
  await page.goto('/designers');
  await page.waitForLoadState('networkidle');

  const cards = page.locator('article');
  await expect(cards).toHaveCount(15);
  await expectImagesLoaded(page.locator('article img'));

  await cards.first().locator('a').first().click();
  await page.waitForLoadState('networkidle');

  const portfolioCards = page.locator('main a[href*="/projects/"]');
  const portfolioCount = await portfolioCards.count();
  expect(portfolioCount).toBeGreaterThanOrEqual(5);
  expect(portfolioCount).toBeLessThanOrEqual(8);

  await expectImagesLoaded(page.locator('aside img, main img'));
});

test('designer project opens detail modal on nested project route', async ({ page }) => {
  await page.goto('/designers/salma-nasser');
  await page.waitForLoadState('networkidle');

  const firstProject = page.locator('main a[href*="/projects/"]').first();
  await expect(firstProject).toBeVisible();
  await firstProject.click();

  await expect(page).toHaveURL(/\/designers\/salma-nasser\/projects\/salma-nasser-project-1$/);
  await expect(page.getByRole('dialog', { name: 'Project detail' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Palm Villa Reception' })).toBeVisible();
});
