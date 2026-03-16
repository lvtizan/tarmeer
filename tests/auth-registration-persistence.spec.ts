import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';

function runMysql(sql: string) {
  execSync(`mysql -uroot tarmeer -e "${sql.replace(/"/g, '\\"')}"`);
}

function createAuthenticatedDesignerSession(stamp: number) {
  const email = `qa.session.${stamp}@example.com`;
  const phone = `+971${String(stamp).slice(-9)}`;
  runMysql(`
    INSERT INTO designers (email, password, full_name, phone, city, email_verified)
    VALUES ('${email}', 'test-password', 'QA Session Designer', '${phone}', 'Dubai', 1)
  `);

  const id = Number(
    execSync(
      `mysql -uroot tarmeer --batch --raw --skip-column-names -e "SELECT id FROM designers WHERE email = '${email}' ORDER BY id DESC LIMIT 1;"`,
    )
      .toString()
      .trim(),
  );

  const token = execSync(
    `cd '${process.cwd()}/server' && node -e "const jwt=require('jsonwebtoken'); process.stdout.write(jwt.sign({id:${id},email:'${email}'}, 'dev_jwt_secret_min_32_chars_for_local_testing_only', {expiresIn:'7d'}));"`,
  )
    .toString()
    .trim();

  return {
    id,
    email,
    token,
  };
}

test.describe.configure({ mode: 'serial' });

test('register form warns about duplicate email and phone before submit', async ({ page }) => {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Create account' }).first().click();

  await page.locator('input[name="email"]').fill('faisal.nour@example.ae');
  await page.locator('input[name="email"]').blur();
  await expect(page.getByText('Email already registered')).toBeVisible();

  await page.locator('input[name="phone"]').fill('501234567');
  await page.locator('input[name="phone"]').blur();
  await expect(page.getByText('Phone already registered')).toBeVisible();
});

test('register phone field strips letters and special characters', async ({ page }) => {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Create account' }).first().click();

  const phoneField = page.locator('input[name="phone"]');
  await phoneField.fill('50abc-12+34@! 56');

  await expect(phoneField).toHaveValue('50123456');
});

test('designer project survives logout and login again', async ({ page }) => {
  const stamp = Date.now();
  const title = `QA Persistence ${stamp}`;
  const imagePath = path.join(process.cwd(), 'public/images/designers/projects/covers/cover-001.jpg');
  const session = createAuthenticatedDesignerSession(stamp);

  await page.goto('/auth');
  await page.evaluate((designerSession) => {
    localStorage.setItem('token', designerSession.token);
    localStorage.setItem('designer', JSON.stringify({
      id: designerSession.id,
      full_name: 'QA Persistence',
      email: designerSession.email,
    }));
  }, session);

  await page.goto('/designer/upload');
  await page.locator('input[name="title"]').fill(title);
  await page.locator('textarea[name="description"]').fill('Persistence test project description');
  await page.locator('select[name="style"]').selectOption('modern');
  await page.locator('input[name="location"]').fill('Dubai');
  await page.locator('input[name="area"]').fill('180');
  await page.setInputFiles('#gallery-upload', imagePath);
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Submit for Review' }).click();
  await page.waitForURL('**/designer/projects');
  await expect(page.getByText(title)).toBeVisible();
  await page.reload();
  await expect(page.getByText(title)).toBeVisible();

  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('designer');
  });

  await page.goto('/auth');
  await page.evaluate((designerSession) => {
    localStorage.setItem('token', designerSession.token);
    localStorage.setItem('designer', JSON.stringify({
      id: designerSession.id,
      full_name: 'QA Persistence',
      email: designerSession.email,
    }));
  }, session);

  await page.goto('/designer/projects');
  await expect(page.getByText(title)).toBeVisible();
});

test('designer project with a heavy gallery survives a My Projects refresh', async ({ page }) => {
  const stamp = Date.now();
  const title = `QA Heavy Refresh ${stamp}`;
  const imagePaths = Array.from({ length: 10 }, (_, index) =>
    path.join(process.cwd(), `public/images/designers/projects/covers/cover-${String(index + 1).padStart(3, '0')}.jpg`),
  );
  const session = createAuthenticatedDesignerSession(stamp);

  await page.goto('/auth');
  await page.evaluate((designerSession) => {
    localStorage.setItem('token', designerSession.token);
    localStorage.setItem('designer', JSON.stringify({
      id: designerSession.id,
      full_name: 'QA Heavy Refresh',
      email: designerSession.email,
    }));
  }, session);

  await page.goto('/designer/upload');
  await page.locator('input[name="title"]').fill(title);
  await page.locator('textarea[name="description"]').fill('Heavy gallery refresh regression test');
  await page.locator('select[name="style"]').selectOption('modern');
  await page.locator('input[name="location"]').fill('Dubai');
  await page.locator('input[name="area"]').fill('280');
  await page.setInputFiles('#gallery-upload', imagePaths);
  await expect(page.locator('aside img')).toHaveCount(10);
  await page.getByRole('button', { name: 'Submit for Review' }).click();
  await page.waitForURL('**/designer/projects');
  await expect(page.getByText(title)).toBeVisible();

  await page.reload();

  await expect(page.getByText(title)).toBeVisible();
});

test('new draft stays on an edit route and survives refresh', async ({ page }) => {
  const stamp = Date.now();
  const title = `QA Draft ${stamp}`;
  const imagePath = path.join(process.cwd(), 'public/images/designers/projects/covers/cover-005.jpg');
  const session = createAuthenticatedDesignerSession(stamp);

  await page.goto('/auth');
  await page.evaluate((designerSession) => {
    localStorage.setItem('token', designerSession.token);
    localStorage.setItem('designer', JSON.stringify({
      id: designerSession.id,
      full_name: 'QA Draft Upload',
      email: designerSession.email,
    }));
  }, session);

  await page.goto('/designer/upload');
  await page.locator('input[name="title"]').fill(title);
  await page.locator('textarea[name="description"]').fill('Draft persistence test project description');
  await page.locator('select[name="style"]').selectOption('modern');
  await page.locator('input[name="location"]').fill('Dubai');
  await page.locator('input[name="area"]').fill('180');
  await page.setInputFiles('#gallery-upload', imagePath);
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Save Draft' }).click();

  await page.waitForURL('**/designer/upload/*');
  await expect(page.getByText('Draft saved successfully.')).toBeVisible();
  await expect(page.locator('input[name="title"]')).toHaveValue(title);
  await expect(page.locator('aside img')).toHaveCount(1);

  await page.reload();

  await expect(page.locator('input[name="title"]')).toHaveValue(title);
  await expect(page.locator('aside img')).toHaveCount(1);

  await page.goto('/designer/projects');
  await expect(page.getByText(title)).toBeVisible();
});

test('duplicate gallery images trigger a visible upload warning and stay unique', async ({ page }) => {
  const stamp = Date.now();
  const email = `qa.duplicate.${stamp}@example.com`;
  const password = 'QaDuplicate123!';
  const imagePath = path.join(process.cwd(), 'public/images/designers/projects/covers/cover-002.jpg');

  await page.goto('/auth');
  await page.getByRole('button', { name: 'Create account' }).first().click();
  await page.locator('input[name="fullName"]').fill('QA Duplicate Upload');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="email"]').blur();
  await page.locator('input[name="phone"]').fill(`${stamp}`.slice(-9));
  await page.locator('input[name="phone"]').blur();
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.locator('select').nth(1).selectOption({ value: 'Dubai' });
  await page.locator('input[name="agree"]').check();
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText(/Registration successful|verification email could not be delivered/i)).toBeVisible();

  runMysql(`UPDATE designers SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE email = '${email}'`);

  await page.getByRole('button', { name: 'Sign in' }).first().click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/designer/dashboard');

  await page.goto('/designer/upload');
  await page.setInputFiles('#gallery-upload', imagePath);
  await page.waitForTimeout(1000);
  await page.setInputFiles('#gallery-upload', imagePath);

  await expect(page.getByText('Duplicate images skipped')).toBeVisible();
  await expect(page.getByText('This upload already contains these files. Choose different images or keep the current selection.')).toBeVisible();
  await expect(page.locator('aside img')).toHaveCount(1);
});

test('selected gallery images can be reordered by drag and drop', async ({ page }) => {
  const firstImagePath = path.join(process.cwd(), 'public/images/designers/projects/covers/cover-003.jpg');
  const secondImagePath = path.join(process.cwd(), 'public/images/designers/projects/covers/cover-004.jpg');

  await page.goto('/auth');
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake-token-for-reorder');
    localStorage.setItem('designer', JSON.stringify({
      id: 888888,
      full_name: 'QA Reorder Upload',
      email: 'qa-reorder@example.com',
    }));
  });

  await page.goto('/designer/upload');
  await page.setInputFiles('#gallery-upload', [firstImagePath, secondImagePath]);
  await page.waitForTimeout(1200);

  const firstCard = page.locator('[data-testid="image-card-0"]');
  const secondCard = page.locator('[data-testid="image-card-1"]');
  const firstBefore = await firstCard.locator('img').getAttribute('src');
  const secondBefore = await secondCard.locator('img').getAttribute('src');

  await secondCard.dragTo(firstCard);

  await expect(firstCard.locator('img')).toHaveAttribute('src', secondBefore || '');
  await expect(secondCard.locator('img')).toHaveAttribute('src', firstBefore || '');
});

test('my projects keeps a single upload entry point visible when project sync fails', async ({ page }) => {
  await page.goto('/auth');
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake-token-for-empty-state');
    localStorage.setItem('designer', JSON.stringify({
      id: 999999,
      full_name: 'QA Empty State',
      email: 'qa-empty@example.com',
    }));
  });

  await page.goto('/designer/projects');

  await expect(page.getByText("You haven’t added any projects yet.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Upload Your First Project' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add Project' })).toHaveCount(0);
});

test('edit project shows incomplete submission status with explicit missing fields', async ({ page }) => {
  await page.goto('/auth');
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake-token-for-completion-status');
    localStorage.setItem('designer', JSON.stringify({
      id: 666666,
      full_name: 'QA Completion Status',
      email: 'qa-status@example.com',
    }));
  });

  await page.goto('/designer/upload');

  await expect(page.getByText('Incomplete submission')).toBeVisible();
  await expect(page.getByText(/Missing:/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for Review' })).toBeDisabled();
});
