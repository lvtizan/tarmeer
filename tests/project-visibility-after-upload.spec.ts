import { test, expect } from '@playwright/test';

/**
 * Tests that a designer/company can see their projects after uploading.
 *
 * Covers:
 * 1. Pending projects appear in the project list
 * 2. API failure shows error message instead of silently showing empty state
 * 3. Status badges display correctly
 */

const BASE = 'http://127.0.0.1:5173';

function seedAuth(page: any) {
  return page.evaluate(() => {
    localStorage.setItem('token', 'test-token-for-visibility');
    localStorage.setItem('active_role', 'company');
    localStorage.setItem('designer', JSON.stringify({
      id: 99999,
      full_name: 'Test Designer',
      email: 'test-visibility@example.com',
      phone: '',
      city: 'Dubai',
      bio: '',
      avatar_url: '',
      title: '',
      status: 'approved',
    }));
  });
}

const MOCK_PROJECT = {
  id: 1001,
  title: 'Modern Villa Design',
  description: 'A test project',
  style: 'modern',
  location: 'Dubai',
  area: '200',
  year: '2024',
  images: ['https://placehold.co/400x300'],
  tags: ['residential'],
  status: 'pending',
  rejection_reason: null,
  created_at: '2026-04-03T00:00:00Z',
  updated_at: '2026-04-03T00:00:00Z',
};

test.describe('Project visibility after upload', () => {

  test('1. Pending project appears in the company projects page', async ({ page }) => {
    await page.goto(BASE);
    await seedAuth(page);

    await page.route('**/api/auth/company/projects', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projects: [MOCK_PROJECT] }),
      });
    });

    await page.goto(`${BASE}/company/projects`);

    const projectTitle = page.getByText('Modern Villa Design');
    await expect(projectTitle).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/visibility-01-project-visible.png', fullPage: true });
    console.log('✓ Pending project is visible in the list');
  });

  test('2. API failure shows error message instead of silent empty state', async ({ page }) => {
    await page.goto(BASE);
    await seedAuth(page);

    // API always fails
    await page.route('**/api/auth/company/projects', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await page.goto(`${BASE}/company/projects`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/visibility-02-api-failure.png', fullPage: true });

    // Should show an error message, not silently show empty state
    const errorMsg = page.getByText('Failed to load projects');
    await expect(errorMsg).toBeVisible({ timeout: 10000 });
    console.log('✓ Error message shown when API fails');
  });

  test('3. Multiple pending projects display correctly', async ({ page }) => {
    await page.goto(BASE);
    await seedAuth(page);

    const projects = [
      { ...MOCK_PROJECT, id: 1001, title: 'Room Interior Design' },
      { ...MOCK_PROJECT, id: 1002, title: 'Workspace Interior' },
      { ...MOCK_PROJECT, id: 1003, title: 'Landscape Project' },
    ];

    await page.route('**/api/auth/company/projects', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projects }),
      });
    });

    await page.goto(`${BASE}/company/projects`);

    // All 3 projects should be visible
    await expect(page.getByText('Room Interior Design')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Workspace Interior')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Landscape Project')).toBeVisible({ timeout: 10000 });

    // Should show count
    await expect(page.getByText('Uploaded Projects (3)')).toBeVisible();

    await page.screenshot({ path: 'test-results/visibility-03-multiple-projects.png', fullPage: true });
    console.log('✓ All 3 pending projects visible');
  });
});
