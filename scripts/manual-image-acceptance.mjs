import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const SEED_AVATAR_IDS = [
  'photo-1472099645785-5658abf4ff4e',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1494790108377-be9c29b29330',
  'photo-1519085360753-af0119f7cbe7',
  'photo-1500648767791-00dcc994a43e',
  'photo-1573496359142-b8d87734a5a2',
];

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

function hasDuplicates(values) {
  const filtered = values.filter(Boolean);
  return uniqueCount(filtered) !== filtered.length;
}

function containsSeedAvatar(values) {
  return values.some((value) => SEED_AVATAR_IDS.some((id) => value.includes(id)));
}

async function collectImageInfo(page, selector) {
  return page.$$eval(selector, (elements) => elements.map((element) => ({
    src: element.getAttribute('src') || '',
    naturalWidth: element.naturalWidth || 0,
    naturalHeight: element.naturalHeight || 0,
  })));
}

async function collectVisibleImageInfo(page, selector) {
  return page.$$eval(selector, (elements) => elements
    .map((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        src: element.getAttribute('src') || '',
        naturalWidth: element.naturalWidth || 0,
        naturalHeight: element.naturalHeight || 0,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
      };
    })
    .filter((item) => item.visible));
}

async function countVisible(page, selector) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }).length
  );
}

async function testHome(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const designerCards = page.locator('#designers article');
  const cardCount = await designerCards.count();
  const projectImages = await collectImageInfo(page, '#designers article a img');
  const avatarImages = await collectImageInfo(page, '#designers article div img[alt$="avatar"]');

  return {
    page: 'home',
    cardCount,
    projectImageCount: projectImages.length,
    projectImagesLoaded: projectImages.every((item) => item.naturalWidth > 0),
    projectImagesDuplicate: hasDuplicates(projectImages.map((item) => item.src)),
    avatarVisibleCount: avatarImages.length,
    avatarImagesLoaded: avatarImages.every((item) => item.naturalWidth > 0),
    seedAvatarVisible: containsSeedAvatar(avatarImages.map((item) => item.src)),
  };
}

async function testServicePage(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  const cards = page.locator('button.group.text-left');
  const cardCount = await cards.count();
  const covers = await collectImageInfo(page, 'button.group.text-left img');
  const result = {
    page: path,
    cardCount,
    coversLoaded: covers.every((item) => item.naturalWidth > 0),
    coversDuplicate: hasDuplicates(covers.map((item) => item.src)),
    modalChecks: [],
  };

  const checks = Math.min(2, cardCount);
  for (let i = 0; i < checks; i++) {
    await cards.nth(i).click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(800);
    const modalImages = await collectVisibleImageInfo(page, '[role="dialog"] img');
    const nextButton = page.locator('[role="dialog"] button[aria-label="Next"]').first();
    if (await nextButton.count()) {
      await nextButton.click({ force: true });
      await page.waitForTimeout(800);
    }
    const modalImagesAfter = await collectVisibleImageInfo(page, '[role="dialog"] img');
    result.modalChecks.push({
      index: i,
      imageCount: modalImages.length,
      loaded: modalImages.every((item) => item.naturalWidth > 0),
      afterNextLoaded: modalImagesAfter.every((item) => item.naturalWidth > 0),
    });
    await page.locator('[role="dialog"] button[aria-label="Close"]').first().click({ force: true });
    await page.waitForTimeout(200);
  }

  return result;
}

async function testDesignersPage(page) {
  await page.goto(`${BASE_URL}/designers`, { waitUntil: 'networkidle' });
  const cards = page.locator('article.group');
  const cardCount = await cards.count();
  const projectImages = await collectImageInfo(page, 'article.group a img');
  const avatars = await collectImageInfo(page, 'article.group img[alt$="avatar"]');

  return {
    page: '/designers',
    cardCount,
    projectImagesLoaded: projectImages.every((item) => item.naturalWidth > 0),
    projectImagesDuplicate: hasDuplicates(projectImages.map((item) => item.src)),
    avatarVisibleCount: avatars.length,
    avatarImagesLoaded: avatars.every((item) => item.naturalWidth > 0),
    seedAvatarVisible: containsSeedAvatar(avatars.map((item) => item.src)),
  };
}

async function testDesignerDetail(page) {
  await page.goto(`${BASE_URL}/designers`, { waitUntil: 'networkidle' });
  const firstCardLink = page.locator('article.group a').first();
  await firstCardLink.click();
  await page.waitForLoadState('networkidle');

  const profileAvatarVisible = await countVisible(page, 'aside img[alt$="profile"]');
  const profileAvatarImages = profileAvatarVisible
    ? await collectImageInfo(page, 'aside img[alt$="profile"]')
    : [];
  const portfolioImages = await collectImageInfo(page, 'main a img');
  const portfolioLinks = page.locator('main a[href*="/projects/"]');
  const projectCount = await portfolioLinks.count();

  let modalLoaded = false;
  if (projectCount > 0) {
    await portfolioLinks.first().click();
    await page.waitForSelector('[role="dialog"]');
    const modalImages = await collectImageInfo(page, '[role="dialog"] img');
    modalLoaded = modalImages.length > 0 && modalImages.every((item) => item.naturalWidth > 0);
  }

  return {
    page: '/designers/:slug',
    profileAvatarVisible,
    profileAvatarSeedLike: containsSeedAvatar(profileAvatarImages.map((item) => item.src)),
    portfolioCount: projectCount,
    portfolioImagesLoaded: portfolioImages.every((item) => item.naturalWidth > 0),
    portfolioDuplicate: hasDuplicates(portfolioImages.map((item) => item.src)),
    modalLoaded,
  };
}

async function testMaterialsPage(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  const projectImages = await collectImageInfo(page, 'article img');

  return {
    page: path,
    cardCount: projectImages.length,
    projectImagesLoaded: projectImages.every((item) => item.naturalWidth > 0),
    projectImagesDuplicate: hasDuplicates(projectImages.map((item) => item.src)),
  };
}

async function testBrandPage(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  const workImages = await collectImageInfo(page, 'section img');

  return {
    page: path,
    workImageCount: workImages.length,
    workImagesLoaded: workImages.every((item) => item.naturalWidth > 0),
    workImagesDuplicate: hasDuplicates(workImages.map((item) => item.src)),
  };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

try {
  const results = [];
  results.push(await testHome(page));
  results.push(await testServicePage(page, '/services/new-home-design'));
  results.push(await testServicePage(page, '/services/soft-decoration'));
  results.push(await testDesignersPage(page));
  results.push(await testDesignerDetail(page));
  results.push(await testMaterialsPage(page, '/materials/hard-materials'));
  results.push(await testBrandPage(page, '/materials/brands/suofeiya-furniture'));

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
