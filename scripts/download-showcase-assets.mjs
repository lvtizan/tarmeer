#!/usr/bin/env node
/**
 * 下载真实人物头像和项目案例图片
 * 头像：使用真实人像照片服务
 * 项目图：Picsum Photos
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const SHOWCASE_DIR = 'public/images/showcase';
const DESIGNER_COUNT = 26;
const PROJECT_IMAGE_COUNT = 60;

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    
    const request = protocol.get(url, (response) => {
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
  
  // 使用随机用户 API 获取真实人像
  // 混合男女头像，每个设计师一个唯一 ID
  const avatarIds = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26
  ];
  
  for (let i = 0; i < DESIGNER_COUNT; i++) {
    const dest = path.join(SHOWCASE_DIR, `avatar-${String(i + 1).padStart(2, '0')}.jpg`);
    
    try {
      // 使用 randomuser.me 的头像服务，每个种子生成一个唯一真人头像
      const gender = i % 2 === 0 ? 'male' : 'female';
      const url = `https://randomuser.me/api/?inc=picture&results=1&gender=${gender}&seed=tarmeer-${i}-v3`;
      
      // 直接用随机头像服务
      const avatarUrl = `https://i.pravatar.cc/300?img=${avatarIds[i] + 30}`;
      await downloadFile(avatarUrl, dest);
      console.log(`  ✓ 头像 ${i + 1}/${DESIGNER_COUNT}`);
    } catch (err) {
      console.error(`  ✗ 头像 ${i + 1} 失败: ${err.message}`);
    }
  }
  
  console.log('\n检查结果...');
  const files = fs.readdirSync(SHOWCASE_DIR);
  const avatars = files.filter(f => f.startsWith('avatar-'));
  const projects = files.filter(f => f.startsWith('project-'));
  console.log(`头像: ${avatars.length}`);
  console.log(`项目图: ${projects.length}`);
}

main().catch(console.error);
