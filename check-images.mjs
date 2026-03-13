import https from 'https';
import http from 'http';
import { URL } from 'url';

const BASE_URL = 'http://localhost:5175';
const TIMEOUT = 10000;

// Fetch HTML content
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.get(url, { timeout: TIMEOUT }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Check if an image URL is accessible
function checkImageUrl(imgUrl) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(imgUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.get(imgUrl, { 
        method: 'HEAD',
        timeout: 5000 
      }, (res) => {
        resolve({
          url: imgUrl,
          status: res.statusCode,
          contentType: res.headers['content-type'],
          contentLength: res.headers['content-length'],
          ok: res.statusCode >= 200 && res.statusCode < 400
        });
      });
      
      req.on('error', (err) => {
        resolve({ url: imgUrl, status: 0, error: err.message, ok: false });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ url: imgUrl, status: 0, error: 'Timeout', ok: false });
      });
    } catch (err) {
      resolve({ url: imgUrl, status: 0, error: err.message, ok: false });
    }
  });
}

// Extract image URLs from HTML
function extractImageUrls(html, baseUrl) {
  const imgUrls = new Set();
  
  // Match src attributes in img tags
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgSrcRegex.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith('http')) {
      imgUrls.add(src);
    } else if (src.startsWith('/')) {
      imgUrls.add(new URL(src, baseUrl).href);
    } else if (!src.startsWith('data:')) {
      imgUrls.add(new URL(src, baseUrl).href);
    }
  }
  
  // Match background-image URLs in style attributes
  const bgImgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgImgRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith('http')) {
      imgUrls.add(url);
    } else if (!url.startsWith('data:')) {
      imgUrls.add(new URL(url, baseUrl).href);
    }
  }
  
  // Match background image in style tags
  const styleBgRegex = /url\(["']?([^"')]+)["']?\)/gi;
  while ((match = styleBgRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith('http')) {
      imgUrls.add(url);
    } else if (!url.startsWith('data:') && !url.includes('.css')) {
      imgUrls.add(new URL(url, baseUrl).href);
    }
  }
  
  return Array.from(imgUrls);
}

async function testPage(pagePath, pageName) {
  console.log('\n' + '='.repeat(60));
  console.log(`📄 Testing: ${pageName}`);
  console.log(`URL: ${BASE_URL}${pagePath}`);
  console.log('='.repeat(60));
  
  try {
    console.log('\n⏳ Fetching page...');
    const html = await fetchHtml(`${BASE_URL}${pagePath}`);
    console.log(`✅ Page fetched (${html.length} bytes)`);
    
    // Extract image URLs
    console.log('\n🖼️ Extracting image URLs...');
    const imgUrls = extractImageUrls(html, BASE_URL);
    console.log(`Found ${imgUrls.length} unique image URLs\n`);
    
    // Check each image
    const results = [];
    for (let i = 0; i < imgUrls.length; i++) {
      const url = imgUrls[i];
      console.log(`Checking ${i + 1}/${imgUrls.length}: ${url.substring(0, 70)}...`);
      
      const result = await checkImageUrl(url);
      results.push(result);
      
      if (result.ok) {
        console.log(`  ✅ Status: ${result.status}, Type: ${result.contentType}, Size: ${result.contentLength || 'unknown'} bytes`);
      } else {
        console.log(`  ❌ FAILED: ${result.error || `Status ${result.status}`}`);
      }
    }
    
    // Summary
    console.log('\n📊 Summary for', pageName);
    console.log('-'.repeat(40));
    
    const successful = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Images:');
      failed.forEach(r => {
        console.log(`  - ${r.url.substring(0, 80)}`);
        console.log(`    Error: ${r.error || `Status ${r.status}`}`);
      });
    }
    
    return { pageName, total: imgUrls.length, successful: successful.length, failed: failed.length, results };
    
  } catch (err) {
    console.log(`❌ Error testing page: ${err.message}`);
    return { pageName, error: err.message };
  }
}

async function main() {
  console.log('🚀 Starting Image URL Check...\n');
  console.log('This checks if image URLs are accessible (HTTP status check)');
  console.log('Note: Unsplash URLs often work but may have CORS restrictions\n');
  
  const pages = [
    { path: '/new-home-design', name: 'New Home Design Page' },
    { path: '/soft-decoration', name: 'Soft Decoration Page' }
  ];
  
  const allResults = [];
  
  for (const page of pages) {
    const result = await testPage(page.path, page.name);
    allResults.push(result);
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 FINAL SUMMARY');
  console.log('='.repeat(60));
  
  allResults.forEach(r => {
    if (r.error) {
      console.log(`\n❌ ${r.pageName}: Error - ${r.error}`);
    } else {
      const status = r.failed === 0 ? '✅ All OK' : `⚠️ ${r.failed} failed`;
      console.log(`\n${r.pageName}: ${status}`);
      console.log(`   Total: ${r.total}, Successful: ${r.successful}, Failed: ${r.failed}`);
    }
  });
  
  console.log('\n✅ Testing complete!');
}

main().catch(console.error);
