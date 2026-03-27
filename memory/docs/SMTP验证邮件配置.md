# 验证邮件配置（阿里云邮件推送）

网站使用 **阿里云邮件推送（Direct Mail）** 发验证邮件，与官方 Node 示例一致。

**官方文档**：https://help.aliyun.com/zh/direct-mail/smtp-nodejs  

**SMTP 服务地址与端口**：https://help.aliyun.com/zh/direct-mail/smtp-endpoints  

---

## 一、当前使用的账号（公司提供）

| 项 | 值 |
|----|-----|
| 服务地址 | `smtpdm.aliyun.com` |
| 账号 | `noreply@mail.kptom.com` |
| 密码 | `KPbec9f642d822488b` |
| 端口 | **465**（SSL，ECS 推荐；25 在 ECS 上通常被禁用） |
| 发件人 | 需与登录账号一致，即 `noreply@mail.kptom.com` |

---

## 二、ECS 上 .env 配置

在服务器 **`/tarmeer/tarmeer_api/.env`** 中增加或确认：

```env
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@mail.kptom.com
SMTP_PASS=KPbec9f642d822488b
SMTP_FROM=noreply@mail.kptom.com
```

保存后重启：

```bash
pm2 restart tarmeer-api
```

也可在项目目录执行脚本自动追加并重启（需本机可 SSH 到 ECS）：

```bash
./scripts/set-ecs-env-smtp.sh
```

---

## 三、后端实现说明

- 使用 **nodemailer**，按官方 Node 示例对接；端口 **465** 时使用 SSL（`secure: true`），符合阿里云「勾选 SSL 时使用 465」的说明。
- 发件人 `from` 与 SMTP 登录账号一致，符合官方「mailfrom must be same with the user」要求。
- 配置逻辑见 `server/src/config/email.ts`、`server/src/config/index.ts`。

---

## 四、若仍收不到邮件

1. 在 ECS 执行 **`pm2 logs tarmeer-api`**，注册时查看是否有 `[SMTP] Verification email failed:` 或 `[SMTP] Not configured`，根据报错排查。
2. 在阿里云邮件推送控制台确认发信地址 **noreply@mail.kptom.com** 已验证、SMTP 密码已设置。
3. 检查收件箱垃圾邮件；或换一个邮箱测试。
