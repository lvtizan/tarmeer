import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = './test-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForImages(page, timeout = 15000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const images = await page.$$('img');
    let allLoaded = true;
    
    for (const img of images) {
      const complete = await img.evaluate(el => el.complete);
      const naturalWidth = await img.evaluate(el => el.naturalWidth);
      if (!complete || naturalWidth === 0) {
        allLoaded = false;
        break;
      }
    }
    
    if (allLoaded && images.length > 0) {
      return true;
    }
    
    await wait(500);
  }
  
  return false;
}

async function testPage(pageUrl, pageName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${pageName}`);
  console.log(`URL: ${pageUrl}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Enable request interception to track failed images
  const failedImages = [];
  const imageRequests = [];
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('unsplash') || url.match(/\.(jpg|jpeg|png|webp)/i)) {
      const status = response.status();
      imageRequests.push({ url, status });
      if (status >= 400) {
        failedImages.push({ url, status });
      }
    }
  });

  try {
    console.log('\n⏳ Loading page...');
    
    // Go to page with extended timeout
    await page.goto(pageUrl, { 
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 60000 
    });
    
    console.log('  Page loaded, waiting for React...');
    await wait(5000);
    
    // Check page title to confirm React rendered
    const title = await page.title();
    console.log(`  Page title: ${title}`);
    
    // Get page content sample
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log(`  Page content: ${bodyText.substring(0, 100)}...`);
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(2000);

    // Test 1: Hero Section
    console.log('\n📸 Testing Hero Section:');
    
    // Find hero image - it's in section with class "relative"
    const heroSection = await page.$('section.relative, section');
    if (heroSection) {
      const heroImg = await heroSection.$('img');
      if (heroImg) {
        const heroData = await heroImg.evaluate(img => ({
          src: img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          display: window.getComputedStyle(img).display,
          visibility: window.getComputedStyle(img).visibility,
          width: img.offsetWidth,
          height: img.offsetHeight
        }));
        
        console.log(`  Hero Image found:`);
        console.log(`    URL: ${heroData.src.substring(0, 70)}...`);
        console.log(`    Complete: ${heroData.complete}`);
        console.log(`    Natural Size: ${heroData.naturalWidth}x${heroData.naturalHeight}`);
        console.log(`    Display Size: ${heroData.width}x${heroData.height}`);
        console.log(`    Display: ${heroData.display}, Visibility: ${heroData.visibility}`);
        
        if (heroData.complete && heroData.naturalWidth > 0) {
          console.log(`  ✅ Hero image loaded successfully`);
        } else {
          console.log(`  ❌ Hero image FAILED to load`);
        }
        
        // Screenshot hero
        await heroSection.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${pageName}-01-hero.png`)
        });
        console.log(`  📷 Screenshot: ${pageName}-01-hero.png`);
      } else {
        console.log('  ⚠️ No hero image element found');
      }
    }

    // Test 2: Project Cover Images
    console.log('\n📸 Testing Project Cover Images:');
    
    // Scroll to projects section
    const projectsHeading = await page.$('text=/Recent Projects/i, text=/Projects/i');
    if (projectsHeading) {
      await projectsHeading.scrollIntoViewIfNeeded();
      await wait(2000);
    }
    
    // Find all project images - they have aspect-ratio containers
    const projectContainers = await page.$$('button[group], .grid button, button:has(img)');
    console.log(`  Found ${projectContainers.length} project buttons`);
    
    const allImages = await page.$$('img');
    console.log(`  Total images on page: ${allImages.length}`);
    
    let loadedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < allImages.length; i++) {
      const img = allImages[i];
      try {
        const imgData = await img.evaluate(el => ({
          src: el.src,
          complete: el.complete,
          naturalWidth: el.naturalWidth,
          naturalHeight: el.naturalHeight,
          alt: el.alt || '',
          width: el.offsetWidth,
          height: el.offsetHeight
        }));
        
        // Skip very small images (likely icons)
        if (imgData.width < 50 || imgData.height < 50) continue;
        
        const status = (imgData.complete && imgData.naturalWidth > 0) ? '✅' : '❌';
        
        if (imgData.complete && imgData.naturalWidth > 0) {
          loadedCount++;
        } else {
          failedCount++;
        }
        
        console.log(`  ${status} Image ${i + 1}: ${imgData.alt || 'unnamed'}`);
        console.log(`      URL: ${imgData.src.substring(0, 70)}...`);
        console.log(`      Natural: ${imgData.naturalWidth}x${imgData.naturalHeight}, Display: ${imgData.width}x${imgData.height}`);
      } catch (e) {
        console.log(`  ⚠️ Error reading image ${i + 1}`);
      }
    }
    
    console.log(`\n  📊 Summary: ${loadedCount} loaded, ${failedCount} failed`);
    
    // Full page screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, `${pageName}-02-fullpage.png`),
      fullPage: true
    });
    console.log(`  📷 Full page: ${pageName}-02-fullpage.png`);

    // Test 3: Open project modal
    console.log('\n📸 Testing Project Modal:');
    
    // Find a project card with image (not the Back button)
    const projectCards = await page.$$('button:has(img)');
    
    if (projectCards.length > 1) {
      // Click second button (first project card)
      console.log('  Clicking first project card...');
      await projectCards[1].click();
      await wait(2000);
      
      // Check if modal opened
      const modal = await page.$('.fixed.z-\\[100\\], .fixed[class*="modal"]');
      
      if (modal) {
        console.log('  ✅ Modal opened');
        
        // Screenshot modal
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, `${pageName}-03-modal.png`)
        });
        console.log(`  📷 Modal: ${pageName}-03-modal.png`);
        
        // Check modal images
        const modalImages = await modal.$$('img');
        console.log(`  Found ${modalImages.length} images in modal`);
        
        for (let i = 0; i < modalImages.length; i++) {
          const imgData = await modalImages[i].evaluate(el => ({
            src: el.src,
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight,
            width: el.offsetWidth,
            height: el.offsetHeight
          }));
          
          const status = imgData.naturalWidth > 0 ? '✅' : '❌';
          console.log(`  ${status} Modal Image ${i + 1}: ${imgData.src.substring(0, 60)}...`);
          console.log(`      Natural: ${imgData.naturalWidth}x${imgData.naturalHeight}`);
        }
        
        // Test navigation buttons
        console.log('\n📸 Testing Navigation:');
        
        const nextBtn = await page.$('button[aria-label="Next"], button:has([class*="ChevronRight"])');
        if (nextBtn) {
          console.log('  Testing Next button...');
          
          await nextBtn.click();
          await wait(800);
          await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `${pageName}-04-next.png`)
          });
          console.log(`  📷 After Next: ${pageName}-04-next.png`);
          
          // Click again
          await nextBtn.click();
          await wait(800);
          await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `${pageName}-05-next2.png`)
          });
          console.log(`  📷 After Next Again: ${pageName}-05-next2.png`);
          
          // Test Previous
          const prevBtn = await page.$('button[aria-label="Previous"], button:has([class*="ChevronLeft"])');
          if (prevBtn) {
            await prevBtn.click();
            await wait(800);
            await page.screenshot({ 
              path: path.join(SCREENSHOT_DIR, `${pageName}-06-prev.png`)
            });
            console.log(`  📷 After Prev: ${pageName}-06-prev.png`);
          }
        }
        
        // Test thumbnails
        const thumbnails = await page.$$('.flex.gap-2 button, .flex.gap-\\[0\\.5rem\\] button');
        if (thumbnails.length > 1) {
          console.log(`\n  Found ${thumbnails.length} thumbnails`);
          await thumbnails[1].click();
          await wait(500);
          await page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, `${pageName}-07-thumbnail.png`)
          });
          console.log(`  📷 After Thumbnail: ${pageName}-07-thumbnail.png`);
        }
      } else {
        console.log('  ⚠️ Modal did not open');
      }
    } else {
      console.log('  ⚠️ No project cards found');
    }

    // Summary
    console.log('\n📊 Final Summary:');
    console.log(`  Network image requests: ${failedImages.length === 0 ? 'All successful' : `${failedImages.length} failed`}`);
    
    if (failedImages.length > 0) {
      console.log('\n❌ Failed Images:');
      for (const img of failedImages) {
        console.log(`  - HTTP ${img.status}: ${img.url.substring(0, 80)}...`);
      }
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🚀 Starting Image Testing...\n');
  console.log(`Screenshots will be saved to: ${path.resolve(SCREENSHOT_DIR)}\n`);
  
  // Test New Home Design page
  await testPage(`${BASE_URL}/services/new-home-design`, 'newhomedesign');
  
  // Test Soft Decoration page
  await testPage(`${BASE_URL}/services/soft-decoration`, 'softdecoration');

  console.log('\n✅ All tests complete!');
  console.log(`\n📁 Check ${SCREENSHOT_DIR}/ for screenshots.`);
}

main().catch(console.error);
