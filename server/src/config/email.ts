import nodemailer from 'nodemailer';
import config from './index';

// 阿里云邮件推送 Node 示例: https://help.aliyun.com/zh/direct-mail/smtp-nodejs
// ECS 建议用 465(SSL)，25 端口通常被禁用
export const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465 || config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass
  },
  // 连接超时设置（毫秒）
  connectionTimeout: 10000,  // 10秒连接超时
  socketTimeout: 30000,      // 30秒socket超时
  // 连接池设置
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// 开发环境邮件发送模拟
export async function sendMailDevMode(to: string, subject: string, html: string): Promise<boolean> {
  console.log('\n' + '='.repeat(60));
  console.log('📧 [DEV MODE] 模拟发送邮件');
  console.log('='.repeat(60));
  console.log(`收件人: ${to}`);
  console.log(`主题: ${subject}`);
  
  // 提取验证链接
  const linkMatch = html.match(/href="([^"]*verify-email[^"]*)"/);
  if (linkMatch) {
    console.log(`\n🔗 验证链接（点击可直接验证）:`);
    console.log(linkMatch[1]);
  }
  
  console.log('='.repeat(60) + '\n');
  return true;
}

// 检查是否跳过真实邮件发送（开发模式 + 环境变量设置）
export function shouldSkipRealEmail(): boolean {
  // 如果设置了 DEV_SKIP_EMAIL=true，跳过真实发送
  if (process.env.DEV_SKIP_EMAIL === 'true') {
    return true;
  }
  // 如果没有配置SMTP账号，也跳过
  if (!config.smtp.user || !config.smtp.pass) {
    return true;
  }
  return false;
}

export const NOTIFICATION_EMAIL = config.notificationEmail;

// 发件人需与 SMTP 登录账号一致，见官方文档
export const FROM_EMAIL = config.smtp.from || config.smtp.user || 'noreply@mail.kptom.com';
