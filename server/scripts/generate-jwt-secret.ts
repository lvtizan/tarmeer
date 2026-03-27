#!/usr/bin/env node
/**
 * JWT密钥生成工具
 * 运行: node server/scripts/generate-jwt-secret.ts
 */

import crypto from 'crypto';

function generateSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

function calculateEntropy(str: string): number {
  const uniqueChars = new Set(str.split(''));
  const charsetSize = uniqueChars.size;
  return Math.floor(str.length * Math.log2(charsetSize));
}

console.log('🔐 JWT Secret Generator\n');
console.log('生成安全的JWT密钥...\n');

const secret = generateSecret(64);
const entropy = calculateEntropy(secret);

console.log('✅ 生成的JWT密钥:');
console.log('━'.repeat(80));
console.log(secret);
console.log('━'.repeat(80));
console.log(`\n📊 密钥信息:`);
console.log(`   长度: ${secret.length} 字符`);
console.log(`   熵值: ${entropy} 位`);
console.log(`   强度: ${entropy >= 256 ? '✅ 非常强' : entropy >= 128 ? '✅ 强' : '⚠️  中等'}`);

console.log('\n📝 使用方法:');
console.log('   1. 将上面的密钥复制到你的 .env 文件');
console.log('   2. 设置 JWT_SECRET=<复制的密钥>');
console.log('   3. 重启服务器\n');

console.log('💡 安全提示:');
console.log('   - 请妥善保管你的密钥，不要提交到版本控制系统');
console.log('   - 定期轮换密钥以提高安全性');
console.log('   - 生产环境建议使用至少128位熵值的密钥\n');

console.log('🚀 快速设置命令:');
console.log(`   export JWT_SECRET="${secret}"`);
console.log(`   echo "JWT_SECRET=${secret}" >> .env\n`);
