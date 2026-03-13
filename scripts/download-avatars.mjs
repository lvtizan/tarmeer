#!/usr/bin/env node
/**
 * 下载真实人物头像（从多个可靠源）
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const SHOWCASE_DIR = 'public/images/showcase';
const DESIGNER_COUNT = 26;

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  fs.mkdirSync(SHOWCASE_DIR, { recursive: true });
  
  console.log('下载真实人物头像...');
  
  // Unsplash 人像照片 ID 列表（真实专业头像）
  const unsplashPortraitIds = [
    'ibwGeCsV9LA', // 专业女性 1
    'mEZ3PoFGs_k', // 专业男性 1
    'rDEOVtE7vOs', // 专业女性 2
    'Lc6cxLyiAeE', // 专业男性 2
    'XQemKhY9Exw', // 女性专业
    'hKG6Mgp4XxE', // 男性专业
    'GHHdo-WyMzI', // 女性
    'oXbs7w9qGdc', // 男性
    'IZp1iJWWRrA', // 女性
    'A2XAHRSpHhs', // 男性
    'bKJjlQLjfqQ', // 女性
    'W7b3eDUso_8', // 男性
    'mENbnJ7D2CE', // 女性
    '-mn3pF5h0fY', // 男性
    'XxWk1CQhqFQ', // 女性
    'hFzIoD0S6MY', // 男性
    'jzYjOrVPQFg', // 女性
    'E6btj3WBM0M', // 男性
    'D4YzByq-5TI', // 女性
    'QAB-WJballg', // 男性
    'YUIjDQQ1lag', // 女性
    'OjVMHgQIBpQ', // 男性
    'vI-ubZ8Pwog', // 女性
    'dcJaO6eYywo', // 男性
    'pVGuH0cqEiI', // 女性
    'W-jZBVcLKAc', // 男性
  ];
  
  for (let i = 0; i < DESIGNER_COUNT; i++) {
    const dest = path.join(SHOWCASE_DIR, `avatar-${String(i + 1).padStart(2, '0')}.jpg`);
    
    try {
      const photoId = unsplashPortraitIds[i];
      const url = `https://images.unsplash.com/photo-${photoId}?w=300&h=300&fit=crop&crop=face`;
      await downloadFile(url, dest);
      console.log(`  ✓ 头像 ${i + 1}/${DESIGNER_COUNT}`);
    } catch (err) {
      console.error(`  ✗ 头像 ${i + 1}: ${err.message}`);
    }
  }
  
  const files = fs.readdirSync(SHOWCASE_DIR);
  console.log(`\n头像数: ${files.filter(f => f.startsWith('avatar-')).length}`);
}

main().catch(console.error);
