"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETURN_PATH_EMAIL = exports.REPLY_TO_EMAIL = exports.FROM_NAME = exports.FROM_EMAIL = exports.NOTIFICATION_EMAIL = exports.transporter = void 0;
exports.sendMailDevMode = sendMailDevMode;
exports.shouldSkipRealEmail = shouldSkipRealEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const index_1 = __importDefault(require("./index"));
// 阿里云邮件推送 Node 示例: https://help.aliyun.com/zh/direct-mail/smtp-nodejs
// ECS 建议用 465(SSL)，25 端口通常被禁用
exports.transporter = nodemailer_1.default.createTransport({
    host: index_1.default.smtp.host,
    port: index_1.default.smtp.port,
    secure: index_1.default.smtp.port === 465 || index_1.default.smtp.secure,
    auth: {
        user: index_1.default.smtp.user,
        pass: index_1.default.smtp.pass
    },
    // 连接超时设置（毫秒）
    connectionTimeout: 10000, // 10秒连接超时
    socketTimeout: 30000, // 30秒socket超时
    // 连接池设置
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
});
// 开发环境邮件发送模拟
async function sendMailDevMode(to, subject, html) {
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
function shouldSkipRealEmail() {
    // 如果设置了 DEV_SKIP_EMAIL=true，跳过真实发送
    if (process.env.DEV_SKIP_EMAIL === 'true') {
        return true;
    }
    // 如果没有配置SMTP账号，也跳过
    if (!index_1.default.smtp.user || !index_1.default.smtp.pass) {
        return true;
    }
    return false;
}
exports.NOTIFICATION_EMAIL = index_1.default.notificationEmail;
// 发件人需与 SMTP 登录账号一致，见官方文档
exports.FROM_EMAIL = index_1.default.smtp.from || index_1.default.smtp.user || 'noreply@mail.kptom.com';
exports.FROM_NAME = index_1.default.smtp.fromName || 'Tarmeer';
exports.REPLY_TO_EMAIL = index_1.default.smtp.replyTo || exports.FROM_EMAIL;
exports.RETURN_PATH_EMAIL = index_1.default.smtp.returnPath || exports.FROM_EMAIL;
