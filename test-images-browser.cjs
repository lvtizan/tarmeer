const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEST_DIR = './test-screenshots';

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPage(browser, url, pageName) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${pageName}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  const results = {
    pageName,
    url,
    heroImage: { status: 'unknown' },
    projectImages: [],
    modalImages: [],
    errors: []
  };
  
  try {
    // Navigate and wait
    console.log('Navigating to page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for React to render
    console.log('Waiting for React to render...');
    await delay(3000);
    
    // Wait for images to start loading
    await page.waitForFunction(() => {
      return document.querySelectorAll('img').length > 0;
    }, { timeout: 10000 }).catch(() => console.log('No images found initially'));
    
    // Additional wait for lazy-loaded images
    await delay(5000);
    
    // Get page HTML for debugging
    const html = await page.content();
    fs.writeFileSync(path.join(TEST_DIR, `${pageName.toLowerCase()}-page.html`), html);
    console.log('Page HTML saved for debugging');
    
    // Take full page screenshot
    const mainScreenshot = path.join(TEST_DIR, `${pageName.toLowerCase()}-full.png`);
    await page.screenshot({ path: mainScreenshot, fullPage: true });
    console.log(`Screenshot saved: ${mainScreenshot}`);
    
    // Debug: List all images on page
    console.log('\n--- All images on page ---');
    const allImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map((img, idx) => ({
        idx,
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        display: window.getComputedStyle(img).display,
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height
      }));
    });
    
    allImages.forEach(img => {
      console.log(`  ${img.idx}: ${img.naturalWidth}x${img.naturalHeight} (${img.complete ? 'loaded' : 'not loaded'}) - Display: ${Math.round(img.width)}x${Math.round(img.height)}`);
      console.log(`    ${img.src.substring(0, 80)}...`);
    });
    
    // Check Hero section image
    console.log('\n--- Checking Hero Section ---');
    const heroImage = await page.evaluate(() => {
      const heroSection = document.querySelector('section.relative');
      if (!heroSection) return { found: false, reason: 'No hero section found' };
      
      const img = heroSection.querySelector('img');
      if (!img) return { found: false, reason: 'No image in hero section' };
      
      const rect = img.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(img);
      
      return {
        found: true,
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: rect.width,
        displayHeight: rect.height,
        isLoaded: img.complete && img.naturalWidth > 0,
        hasError: !img.complete || img.naturalWidth === 0,
        opacity: computedStyle.opacity
      };
    });
    
    results.heroImage = heroImage;
    if (heroImage.found) {
      const status = heroImage.hasError ? '❌ ERROR' : '✅ OK';
      console.log(`Hero Image: ${status}`);
      console.log(`  Size: ${heroImage.naturalWidth}x${heroImage.naturalHeight}`);
      console.log(`  URL: ${heroImage.src}`);
    } else {
      console.log('Hero Image: Not found -', heroImage.reason);
    }
    
    // Check project images - look for grid of project cards
    console.log('\n--- Checking Project Cover Images ---');
    const projectImages = await page.evaluate(() => {
      const images = [];
      
      // Find all images inside grid containers
      const gridContainer = document.querySelector('.grid-cols-2');
      if (!gridContainer) {
        return { error: 'Grid container not found', images: [] };
      }
      
      gridContainer.querySelectorAll('button').forEach((button, idx) => {
        const img = button.querySelector('img');
        if (!img) return;
        
        const rect = img.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 30) return;
        
        const titleEl = button.querySelector('h3');
        const cardTitle = titleEl ? titleEl.textContent : `Project ${idx + 1}`;
        
        images.push({
          title: cardTitle,
          src: img.src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          displayWidth: Math.round(rect.width),
          displayHeight: Math.round(rect.height),
          isLoaded: img.complete && img.naturalWidth > 0,
          hasError: !img.complete || img.naturalWidth === 0
        });
      });
      
      return { error: null, images };
    });
    
    if (projectImages.error) {
      console.log('Error:', projectImages.error);
    } else {
      results.projectImages = projectImages.images;
      console.log(`Found ${projectImages.images.length} project images:`);
      projectImages.images.forEach((img, idx) => {
        const status = img.hasError ? '❌ ERROR' : '✅ OK';
        console.log(`  ${idx + 1}. "${img.title}" - ${status}`);
        console.log(`     Size: ${img.naturalWidth}x${img.naturalHeight}, Display: ${img.displayWidth}x${img.displayHeight}`);
        console.log(`     URL: ${img.src}`);
        if (img.hasError) {
          results.errors.push(`Project "${img.title}": Image failed to load - ${img.src}`);
        }
      });
    }
    
    // Click on first project to test modal
    console.log('\n--- Testing Modal ---');
    try {
      // Scroll to projects section first
      await page.evaluate(() => {
        const grid = document.querySelector('.grid-cols-2');
        if (grid) grid.scrollIntoView();
      });
      await delay(500);
      
      // Take screenshot after scroll
      const scrollScreenshot = path.join(TEST_DIR, `${pageName.toLowerCase()}-projects.png`);
      await page.screenshot({ path: scrollScreenshot, fullPage: false });
      console.log(`Projects section screenshot: ${scrollScreenshot}`);
      
      // Find and click first project
      const buttons = await page.$$('.grid-cols-2 button');
      if (buttons.length > 0) {
        console.log(`Found ${buttons.length} project buttons, clicking first...`);
        
        await buttons[0].click();
        await delay(2000);
        
        // Take modal screenshot
        const modalScreenshot = path.join(TEST_DIR, `${pageName.toLowerCase()}-modal.png`);
        await page.screenshot({ path: modalScreenshot });
        console.log(`Modal screenshot saved: ${modalScreenshot}`);
        
        // Check modal images
        const modalImages = await page.evaluate(() => {
          const images = [];
          const modal = document.querySelector('[role="dialog"]');
          if (!modal) return { found: false, images: [] };
          
          modal.querySelectorAll('img').forEach((img, idx) => {
            const rect = img.getBoundingClientRect();
            const isGallery = rect.width > 100;
            
            images.push({
              index: idx,
              src: img.src,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              displayWidth: Math.round(rect.width),
              displayHeight: Math.round(rect.height),
              isLoaded: img.complete && img.naturalWidth > 0,
              hasError: !img.complete || img.naturalWidth === 0,
              isGalleryImage: isGallery,
              isThumbnail: !isGallery
            });
          });
          
          return { found: true, images };
        });
        
        if (modalImages.found) {
          results.modalImages = modalImages.images;
          console.log(`Found ${modalImages.images.length} images in modal:`);
          modalImages.images.forEach((img) => {
            const type = img.isGalleryImage ? 'Gallery' : 'Thumbnail';
            const status = img.hasError ? '❌ ERROR' : '✅ OK';
            console.log(`  ${type} ${img.index + 1}: ${status} - ${img.naturalWidth}x${img.naturalHeight}`);
            console.log(`    URL: ${img.src}`);
            if (img.hasError) {
              results.errors.push(`Modal image failed to load - ${img.src}`);
            }
          });
          
          // Test navigation buttons
          console.log('\n--- Testing Navigation Buttons ---');
          const prevBtn = await page.$('[aria-label="Previous"]');
          const nextBtn = await page.$('[aria-label="Next"]');
          console.log(`Previous button: ${prevBtn ? 'found' : 'not found'}`);
          console.log(`Next button: ${nextBtn ? 'found' : 'not found'}`);
          
          // Try clicking next
          if (nextBtn) {
            console.log('\nClicking next button...');
            await nextBtn.click();
            await delay(1000);
            
            const navScreenshot = path.join(TEST_DIR, `${pageName.toLowerCase()}-modal-next.png`);
            await page.screenshot({ path: navScreenshot });
            console.log(`After navigation screenshot: ${navScreenshot}`);
            
            // Check which image is now displayed
            const currentImg = await page.$eval('[role="dialog"] .aspect-video img, [role="dialog"] .aspect-\\[16\\/10\\] img', (img) => ({
              src: img.src,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight
            })).catch(() => null);
            
            if (currentImg) {
              console.log('Current gallery image after navigation:', currentImg);
            }
          }
          
          // Close modal
          const closeButton = await page.$('[aria-label="Close"]');
          if (closeButton) {
            await closeButton.click();
            await delay(500);
          }
        } else {
          console.log('Modal not found after clicking');
        }
      }
    } catch (e) {
      console.log('Modal test error:', e.message);
      results.errors.push(`Modal test: ${e.message}`);
    }
    
  } catch (e) {
    console.error('Page test error:', e.message);
    results.errors.push(`Page error: ${e.message}`);
  }
  
  await page.close();
  return results;
}

async function main() {
  console.log('Starting browser image test...');
  console.log('Time:', new Date().toISOString());
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Test New Home Design page
    const result1 = await testPage(
      browser,
      'http://localhost:5173/new-home-design',
      'newhomedesign'
    );
    
    // Test Soft Decoration page
    const result2 = await testPage(
      browser,
      'http://localhost:5173/soft-decoration',
      'softdecoration'
    );
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    
    const allResults = [result1, result2];
    
    allResults.forEach(result => {
      console.log(`\n📊 ${result.pageName}:`);
      
      if (result.heroImage.found) {
        const heroStatus = result.heroImage.hasError ? '❌ FAILED' : '✅ OK';
        console.log(`  Hero Image: ${heroStatus} (${result.heroImage.naturalWidth}x${result.heroImage.naturalHeight})`);
      } else {
        console.log(`  Hero Image: Not found - ${result.heroImage.reason || 'unknown'}`);
      }
      
      const failedProjects = result.projectImages.filter(i => i.hasError);
      const okProjects = result.projectImages.filter(i => !i.hasError);
      console.log(`  Project Images: ${okProjects.length} ✅ OK, ${failedProjects.length} ❌ FAILED`);
      
      if (failedProjects.length > 0) {
        console.log('  ❌ Failed projects:');
        failedProjects.forEach(p => {
          console.log(`    - "${p.title}" (${p.naturalWidth}x${p.naturalHeight})`);
          console.log(`      URL: ${p.src}`);
        });
      }
      
      const failedModal = result.modalImages.filter(i => i.hasError);
      console.log(`  Modal Images: ${result.modalImages.length - failedModal.length} ✅ OK, ${failedModal.length} ❌ FAILED`);
      
      if (failedModal.length > 0) {
        console.log('  ❌ Failed modal images:');
        failedModal.forEach(m => {
          console.log(`    - ${m.isGalleryImage ? 'Gallery' : 'Thumbnail'}: ${m.src}`);
        });
      }
    });
    
    // Write results to JSON
    fs.writeFileSync(
      path.join(TEST_DIR, 'test-results.json'),
      JSON.stringify(allResults, null, 2)
    );
    console.log(`\n📁 Results saved to ${path.join(TEST_DIR, 'test-results.json')}`);
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
