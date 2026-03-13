import { test, expect, Page } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = './test-screenshots-images';

// Helper function to check image loading status
async function checkImageStatus(page: Page, selector: string, label: string) {
  const images = await page.$$(selector);
  console.log(`\n  📷 ${label}: Found ${images.length} images`);
  
  const results = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const src = await img.getAttribute('src') || '';
    const alt = await img.getAttribute('alt') || '';
    
    // Check if image is loaded
    const isLoaded = await img.evaluate((el: HTMLImageElement) => {
      return el.complete && el.naturalWidth > 0;
    });
    
    const dimensions = await img.evaluate((el: HTMLImageElement) => ({
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
      complete: el.complete
    }));
    
    const status = isLoaded ? '✅' : '❌';
    console.log(`    ${status} Image ${i + 1}: "${alt}" - ${src.substring(0, 50)}...`);
    console.log(`       Loaded: ${dimensions.complete}, Size: ${dimensions.naturalWidth}x${dimensions.naturalHeight}`);
    
    results.push({ src, alt, isLoaded, dimensions });
  }
  
  return results;
}

// Helper function to check background image
async function checkBackgroundImage(page: Page, selector: string, label: string) {
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    
    const style = window.getComputedStyle(el);
    const bgImage = style.backgroundImage;
    
    return {
      found: true,
      backgroundImage: bgImage,
      hasImage: bgImage && bgImage !== 'none'
    };
  }, selector);
  
  if (result.found && result.hasImage) {
    console.log(`  ✅ ${label}: Background image found`);
    console.log(`     ${result.backgroundImage?.substring(0, 80)}...`);
  } else if (result.found) {
    console.log(`  ❌ ${label}: No background image!`);
  } else {
    console.log(`  ⚠️ ${label}: Element not found`);
  }
  
  return result;
}

test('New Home Design Page - Full Image Test', async ({ page }) => {
  console.log('\n' + '='.repeat(60));
  console.log('🏠 Testing NEW HOME DESIGN PAGE');
  console.log('='.repeat(60));
  
  // Navigate to page
  await page.goto('/new-home-design');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // 1. Check Hero Section
  console.log('\n🖼️ STEP 1: Checking Hero Section...');
  
  // Take full page screenshot
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, '01-new-home-full-page.png'),
    fullPage: true 
  });
  console.log('  📸 Saved: 01-new-home-full-page.png');
  
  // Check hero background (usually an img inside hero section)
  const heroSection = page.locator('section').first();
  await heroSection.screenshot({ 
    path: path.join(SCREENSHOT_DIR, '02-new-home-hero.png')
  });
  console.log('  📸 Saved: 02-new-home-hero.png');
  
  // Find hero images
  const heroImages = page.locator('section').first().locator('img');
  const heroImageCount = await heroImages.count();
  console.log(`  📷 Found ${heroImageCount} hero images`);
  
  for (let i = 0; i < heroImageCount; i++) {
    const img = heroImages.nth(i);
    const src = await img.getAttribute('src') || '';
    const alt = await img.getAttribute('alt') || '';
    const isLoaded = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
    const dims = await img.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, h: el.naturalHeight }));
    
    const status = isLoaded ? '✅' : '❌';
    console.log(`    ${status} Hero Image ${i + 1}: "${alt}"`);
    console.log(`       URL: ${src.substring(0, 60)}...`);
    console.log(`       Size: ${dims.w}x${dims.h}`);
  }
  
  // 2. Check Recent Projects Section
  console.log('\n🖼️ STEP 2: Checking Recent Projects Section...');
  
  // Scroll to projects section
  await page.evaluate(() => {
    const section = document.querySelectorAll('section')[1] || document.querySelector('[class*="projects"]');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  });
  await page.waitForTimeout(1500);
  
  // Check all project card images
  const projectImages = page.locator('img[src*="images.unsplash.com"], img[src*=".jpg"], img[src*=".png"], img[src*=".webp"]');
  const count = await projectImages.count();
  console.log(`  📷 Total images found on page: ${count}`);
  
  const imageResults = await checkImageStatus(page, 'img[src*="images.unsplash.com"], img[src*=".jpg"], img[src*=".png"], img[src*=".webp"]', 'Project Images');
  
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, '03-new-home-projects-section.png'),
    fullPage: false 
  });
  console.log('  📸 Saved: 03-new-home-projects-section.png');
  
  // 3. Click first project to open modal
  console.log('\n🖼️ STEP 3: Opening project modal...');
  
  // Find and click the first project button
  const projectButton = page.locator('button:has(img)').first();
  await projectButton.click();
  await page.waitForTimeout(1500);
  
  // Check if modal opened
  const modalVisible = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]') || 
                  document.querySelector('[class*="modal"]') ||
                  document.querySelector('.fixed');
    return modal ? window.getComputedStyle(modal).display !== 'none' : false;
  });
  
  if (modalVisible) {
    console.log('  ✅ Modal opened successfully');
    
    // Check modal images
    const modalImages = page.locator('.fixed img, [role="dialog"] img, [class*="modal"] img');
    const modalImageCount = await modalImages.count();
    console.log(`  📷 Modal images found: ${modalImageCount}`);
    
    for (let i = 0; i < modalImageCount; i++) {
      const img = modalImages.nth(i);
      const src = await img.getAttribute('src') || '';
      const alt = await img.getAttribute('alt') || '';
      const dims = await img.evaluate((el: HTMLImageElement) => ({
        w: el.naturalWidth,
        h: el.naturalHeight,
        complete: el.complete
      }));
      
      const status = dims.complete && dims.w > 0 ? '✅' : '❌';
      console.log(`    ${status} Modal Image ${i + 1}: "${alt}"`);
      console.log(`       URL: ${src.substring(0, 60)}...`);
      console.log(`       Size: ${dims.w}x${dims.h}`);
    }
    
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, '04-new-home-modal-open.png'),
      fullPage: false 
    });
    console.log('  📸 Saved: 04-new-home-modal-open.png');
    
    // 4. Test navigation buttons
    console.log('\n🖼️ STEP 4: Testing navigation buttons...');
    
    // Try to find and click next button
    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="next"], button[aria-label*="Next"]').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      console.log('  ✅ Clicked next button');
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, '05-new-home-modal-next.png'),
        fullPage: false 
      });
      console.log('  📸 Saved: 05-new-home-modal-next.png');
    } else {
      console.log('  ⚠️ Next button not found');
    }
    
    // Try to find and click previous button
    const prevBtn = page.locator('button:has-text("Previous"), button[aria-label*="prev"), button[aria-label*="Previous"]').first();
    if (await prevBtn.count() > 0) {
      await prevBtn.click();
      await page.waitForTimeout(500);
      console.log('  ✅ Clicked prev button');
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, '06-new-home-modal-prev.png'),
        fullPage: false 
      });
      console.log('  📸 Saved: 06-new-home-modal-prev.png');
    } else {
      console.log('  ⚠️ Prev button not found');
    }
    
    // 5. Test thumbnail navigation
    console.log('\n🖼️ STEP 5: Testing thumbnail navigation...');
    const thumbnails = page.locator('button img, [class*="thumbnail"] img, [class*="thumb"] img');
    const thumbCount = await thumbnails.count();
    
    if (thumbCount > 1) {
      await thumbnails.nth(1).click();
      await page.waitForTimeout(500);
      console.log(`  ✅ Clicked thumbnail 2 of ${thumbCount}`);
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, '07-new-home-modal-thumbnail.png'),
        fullPage: false 
      });
      console.log('  📸 Saved: 07-new-home-modal-thumbnail.png');
    } else {
      console.log(`  ℹ️ Found ${thumbCount} thumbnails`);
    }
  } else {
    console.log('  ❌ Modal did not open');
  }
  
  console.log('\n✅ New Home Design Page test complete!');
});

test('Soft Decoration Page - Full Image Test', async ({ page }) => {
  console.log('\n' + '='.repeat(60));
  console.log('🛋️ Testing SOFT DECORATION PAGE');
  console.log('='.repeat(60));
  
  // Navigate to page
  await page.goto('/soft-decoration');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // 1. Check Hero Section
  console.log('\n🖼️ STEP 1: Checking Hero Section...');
  
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, '08-soft-deco-full-page.png'),
    fullPage: true 
  });
  console.log('  📸 Saved: 08-soft-deco-full-page.png');
  
  // Check hero images
  const heroSection = page.locator('section').first();
  const heroImg = heroSection.locator('img');
  const heroCount = await heroImg.count();
  
  for (let i = 0; i < heroCount; i++) {
    const img = heroImg.nth(i);
    const src = await img.getAttribute('src') || '';
    const alt = await img.getAttribute('alt') || '';
    const dims = await img.evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
      complete: el.complete
    }));
    
    const status = dims.complete && dims.w > 0 ? '✅' : '❌';
    console.log(`    ${status} Hero Image ${i + 1}: "${alt}"`);
    console.log(`       URL: ${src.substring(0, 60)}...`);
    console.log(`       Size: ${dims.w}x${dims.h}`);
  }
  
  // 2. Check Recent Projects Section
  console.log('\n🖼️ STEP 2: Checking Recent Projects Section...');
  
  // Scroll to projects section
  await page.evaluate(() => {
    const section = document.querySelectorAll('section')[1] || document.querySelector('[class*="projects"]');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  });
  await page.waitForTimeout(1500);
  
  // Check all project card images
  await checkImageStatus(page, 'img[src*="images.unsplash.com"], img[src*=".jpg"], img[src*=".png"], img[src*=".webp"]', 'Project Images');
  
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, '09-soft-deco-projects-section.png'),
    fullPage: false 
  });
  console.log('  📸 Saved: 09-soft-deco-projects-section.png');
  
  // 3. Click a project to open modal
  console.log('\n🖼️ STEP 3: Opening project modal...');
  
  const projectButton = page.locator('button:has(img)').first();
  await projectButton.click();
  await page.waitForTimeout(1500);
  
  // Check if modal opened
  const modalVisible = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]') || 
                  document.querySelector('[class*="modal"]') ||
                  document.querySelector('.fixed');
    return modal ? window.getComputedStyle(modal).display !== 'none' : false;
  });
  
  if (modalVisible) {
    console.log('  ✅ Modal opened successfully');
    
    // Check modal images
    const modalImages = page.locator('.fixed img, [role="dialog"] img, [class*="modal"] img');
    const modalImageCount = await modalImages.count();
    console.log(`  📷 Modal images found: ${modalImageCount}`);
    
    for (let i = 0; i < modalImageCount; i++) {
      const img = modalImages.nth(i);
      const src = await img.getAttribute('src') || '';
      const alt = await img.getAttribute('alt') || '';
      const dims = await img.evaluate((el: HTMLImageElement) => ({
        w: el.naturalWidth,
        h: el.naturalHeight,
        complete: el.complete
      }));
      
      const status = dims.complete && dims.w > 0 ? '✅' : '❌';
      console.log(`    ${status} Modal Image ${i + 1}: "${alt}"`);
      console.log(`       URL: ${src.substring(0, 60)}...`);
      console.log(`       Size: ${dims.w}x${dims.h}`);
    }
    
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, '10-soft-deco-modal-open.png'),
      fullPage: false 
    });
    console.log('  📸 Saved: 10-soft-deco-modal-open.png');
  } else {
    console.log('  ❌ Modal did not open');
  }
  
  console.log('\n✅ Soft Decoration Page test complete!');
});
