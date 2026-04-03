import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';

function sqlEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function runMysql(sql: string) {
  execSync(`mysql -uroot tarmeer -e "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'pipe',
  });
}

function queryScalar(sql: string) {
  return execSync(`mysql -uroot tarmeer --batch --raw --skip-column-names -e "${sql.replace(/"/g, '\\"')}"`, {
    stdio: 'pipe',
  })
    .toString()
    .trim();
}

function hashPassword(password: string) {
  return execSync(
    `cd '${process.cwd()}/server' && node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 10).then((hash)=>process.stdout.write(hash));" '${password}'`,
    { stdio: 'pipe' },
  )
    .toString()
    .trim();
}

function buildTestPassword() {
  return ['Qa', 'Designer', '123!'].join('');
}

function cleanupLinkedDesignerAccount(email: string) {
  const escapedEmail = sqlEscape(email);
  runMysql(`
    DELETE FROM projects
    WHERE designer_id IN (SELECT id FROM designers WHERE email = '${escapedEmail}');
    DELETE FROM designers WHERE email = '${escapedEmail}';
    DELETE FROM users WHERE email = '${escapedEmail}';
  `);
}

function seedLinkedDesignerAccount(email: string, password: string) {
  const escapedEmail = sqlEscape(email);
  const passwordHash = hashPassword(password);
  const escapedHash = sqlEscape(passwordHash);
  const stamp = Date.now().toString().slice(-9);
  const phone = `+9715${stamp.slice(-8)}`;

  cleanupLinkedDesignerAccount(email);

  runMysql(`
    INSERT INTO users (
      email,
      password,
      full_name,
      phone,
      city,
      role,
      status,
      email_verified,
      active_role
    ) VALUES (
      '${escapedEmail}',
      '${escapedHash}',
      'QA Real Flow Designer',
      '${phone}',
      'Dubai',
      'designer',
      'active',
      1,
      'designer'
    );
  `);

  const userId = queryScalar(`
    SELECT id
    FROM users
    WHERE email = '${escapedEmail}'
    ORDER BY id DESC
    LIMIT 1;
  `);

  runMysql(`
    INSERT INTO designers (
      user_id,
      email,
      password,
      full_name,
      phone,
      city,
      email_verified,
      status,
      is_approved
    ) VALUES (
      ${userId},
      '${escapedEmail}',
      '${escapedHash}',
      'QA Real Flow Designer',
      '${phone}',
      'Dubai',
      1,
      'approved',
      1
    );
  `);
}

async function loginThroughUi(page: Parameters<typeof test>[0]['page'], email: string, password: string) {
  await page.goto('/auth');
  await page.getByPlaceholder('Enter your email').fill(email);
  await expect(page.getByText('Existing')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.describe.configure({ mode: 'serial' });

test('email registration smoke works with the current two-step auth UI', async ({ page }) => {
  const stamp = Date.now();
  const email = `qa.local.register.${stamp}@example.com`;
  const escapedEmail = sqlEscape(email);

  cleanupLinkedDesignerAccount(email);

  await page.goto('/auth');
  await page.getByPlaceholder('Enter your email').fill(email);
  await expect(page.getByText('New account')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Continue with email' }).click();

  await expect(page.getByText(`Enter password for ${email}`)).toBeVisible();
  await page.getByPlaceholder('Enter your password').fill('QaRegister123!');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Check Your Email')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(email)).toBeVisible();

  runMysql(`
    DELETE FROM users WHERE email = '${escapedEmail}';
    DELETE FROM designers WHERE email = '${escapedEmail}';
  `);
});

test('linked designer can log in, save a draft project, and stay on dashboard upload routes', async ({ page }) => {
  const stamp = Date.now();
  const email = `qa.local.designer.${stamp}@example.com`;
  const title = `QA Local Draft ${stamp}`;
  const password = buildTestPassword();
  const imagePath = path.join(process.cwd(), 'public/images/designers/projects/covers/cover-001.jpg');

  seedLinkedDesignerAccount(email, password);

  try {
    await loginThroughUi(page, email, password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/dashboard/upload');
    await expect(page.getByRole('heading', { name: 'Upload New Project' })).toBeVisible();

    await page.locator('input[name="title"]').fill(title);
    await page.locator('textarea[name="description"]').fill('Local smoke test draft description for real project upload flow.');
    await page.locator('select[name="style"]').selectOption('modern');
    await page.locator('input[name="location"]').fill('Dubai');
    await page.locator('input[name="area"]').fill('180');
    await page.setInputFiles('#gallery-upload', imagePath);

    await expect(page.locator('[data-testid="image-card-0"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Ready to submit')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Save Draft' }).click();

    await expect(page).toHaveURL(/\/dashboard\/upload\/\d+$/, { timeout: 15000 });
    await expect(page.getByText('Draft saved successfully.')).toBeVisible({ timeout: 10000 });

    await page.goto('/dashboard/projects');
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
  } finally {
    cleanupLinkedDesignerAccount(email);
  }
});
