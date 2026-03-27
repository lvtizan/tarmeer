# Tarmeer 4.0 后台系统实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现完整的后台系统，包括表单收集、设计师注册、项目资料提交，并通过邮件通知

**Architecture:** 
- 前端：React 19 + TypeScript + Vite（现有）
- 后端：Node.js + Express + TypeScript
- 数据库：MySQL
- 邮件：Nodemailer + SMTP

**Tech Stack:** 
- 后端框架：Express.js
- 数据库：MySQL + mysql2
- 邮件：Nodemailer
- 验证：express-validator
- 安全：cors, helmet, bcryptjs, jsonwebtoken

---

## 项目结构

```
tarmeer-4.0/
├── server/                    # 后端代码
│   ├── src/
│   │   ├── config/           # 配置文件
│   │   │   ├── database.ts   # 数据库配置
│   │   │   ├── email.ts      # 邮件配置
│   │   │   └── index.ts      # 主配置
│   │   ├── controllers/      # 控制器
│   │   │   ├── authController.ts
│   │   │   ├── designerController.ts
│   │   │   ├── projectController.ts
│   │   │   └── contactController.ts
│   │   ├── middleware/       # 中间件
│   │   │   ├── auth.ts
│   │   │   ├── validation.ts
│   │   │   └── errorHandler.ts
│   │   ├── models/           # 数据模型
│   │   │   ├── Designer.ts
│   │   │   ├── Project.ts
│   │   │   └── Contact.ts
│   │   ├── routes/           # 路由
│   │   │   ├── auth.ts
│   │   │   ├── designers.ts
│   │   │   ├── projects.ts
│   │   │   └── contact.ts
│   │   ├── services/         # 业务逻辑
│   │   │   ├── emailService.ts
│   │   │   ├── designerService.ts
│   │   │   └── projectService.ts
│   │   ├── types/            # TypeScript 类型
│   │   │   └── index.ts
│   │   └── app.ts            # 应用入口
│   ├── package.json
│   └── tsconfig.json
├── database/                  # 数据库脚本
│   ├── schema.sql            # 数据库结构
│   └── seed.sql              # 初始数据
└── docs/
    └── API.md                # API 文档
```

---

## 数据库设计

### 1. designers 表（设计师）

```sql
CREATE TABLE designers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  city VARCHAR(100),
  address TEXT,
  bio TEXT,
  avatar_url VARCHAR(500),
  style VARCHAR(255),
  expertise JSON,
  is_approved BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. projects 表（项目）

```sql
CREATE TABLE projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  designer_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  style VARCHAR(100),
  location VARCHAR(255),
  area VARCHAR(50),
  year INT,
  cost VARCHAR(100),
  images JSON,
  tags JSON,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);
```

### 3. contacts 表（表单提交）

```sql
CREATE TABLE contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  type ENUM('inquiry', 'quote', 'partnership') NOT NULL,
  message TEXT,
  designer_id INT,
  project_id INT,
  status ENUM('new', 'read', 'replied') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (designer_id) REFERENCES designers(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

---

## API 接口设计

### 认证接口

#### POST /api/auth/register
- 功能：设计师注册
- 参数：email, password, full_name, phone, city
- 响应：success message（需要验证邮箱）
- 流程：
  1. 创建设计师账号（email_verified = false）
  2. 生成验证令牌（24小时有效）
  3. 发送验证邮件到设计师邮箱
  4. 发送注册通知到 lvyiming@kp99.cn

#### POST /api/auth/verify-email
- 功能：验证邮箱
- 参数：token
- 响应：验证成功，可以登录

#### POST /api/auth/resend-verification
- 功能：重新发送验证邮件
- 参数：email
- 响应：验证邮件已发送

#### POST /api/auth/login
- 功能：设计师登录
- 参数：email, password
- 响应：token, designer info
- 验证：必须先验证邮箱才能登录

---

## 防垃圾注册机制

### 1. 邮箱验证
- 注册后必须验证邮箱才能登录
- 验证链接 24 小时有效
- 可重新发送验证邮件（限制频率）

### 2. 速率限制
```typescript
import rateLimit from 'express-rate-limit';

// 注册限制：每个 IP 每小时最多 5 次
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 5,
  message: '注册请求过于频繁，请稍后再试'
});

// 验证邮件限制：每个邮箱每小时最多 3 次
const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: '验证邮件发送过于频繁，请稍后再试'
});
```

### 3. 临时邮箱黑名单
```typescript
const TEMP_EMAIL_DOMAINS = [
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'throwaway.email',
  // ... 更多临时邮箱域名
];

function isTempEmail(email: string): boolean {
  const domain = email.split('@')[1];
  return TEMP_EMAIL_DOMAINS.includes(domain);
}
```

### 4. 验证码（可选）
- 使用 Google reCAPTCHA v3
- 前端获取 token，后端验证

### 5. IP 黑名单
- 记录可疑 IP
- 自动封禁频繁注册的 IP

### 设计师接口

#### GET /api/designers
- 功能：获取设计师列表
- 参数：page, limit, approved
- 响应：designers array, total count

#### GET /api/designers/:id
- 功能：获取设计师详情
- 响应：designer info, projects

#### PUT /api/designers/:id
- 功能：更新设计师信息
- 参数：full_name, phone, city, address, bio, avatar_url
- 响应：updated designer

### 项目接口

#### POST /api/projects
- 功能：提交新项目
- 参数：title, description, style, location, area, year, cost, images, tags
- 响应：project info
- 邮件：发送项目提交通知到 lvyiming@kp99.cn

#### GET /api/projects
- 功能：获取项目列表
- 参数：designer_id, page, limit, status
- 响应：projects array, total count

#### GET /api/projects/:id
- 功能：获取项目详情
- 响应：project info, designer info

#### PUT /api/projects/:id
- 功能：更新项目信息
- 参数：title, description, style, location, area, year, cost, images, tags, status
- 响应：updated project

### 联系表单接口

#### POST /api/contact
- 功能：提交联系表单
- 参数：name, email, phone, type, message, designer_id, project_id
- 响应：success message
- 邮件：发送联系表单通知到 lvyiming@kp99.cn

---

## 邮件通知模板

### 1. 邮箱验证邮件（发送给设计师）

```
主题：【Tarmeer】验证您的邮箱地址

内容：
亲爱的 {full_name}，

感谢您注册 Tarmeer 设计师平台！

请点击以下链接验证您的邮箱地址：
{verification_link}

此链接 24 小时内有效。

如果您没有注册 Tarmeer 账号，请忽略此邮件。

Tarmeer 团队
```

### 2. 设计师注册通知（发送到 lvyiming@kp99.cn）

```
主题：【Tarmeer】新设计师注册

内容：
有新的设计师注册：

姓名：{full_name}
邮箱：{email}
电话：{phone}
城市：{city}
邮箱验证状态：{email_verified}
注册时间：{created_at}

请登录后台审核。
```

### 3. 项目提交通知（发送到 lvyiming@kp99.cn）

```
主题：【Tarmeer】新项目提交

内容：
设计师 {designer_name} 提交了新项目：

项目名称：{title}
风格：{style}
位置：{location}
面积：{area}
预算：{cost}
提交时间：{created_at}

请登录后台审核。
```

### 3. 联系表单通知

```
主题：【Tarmeer】新的客户咨询

内容：
有新的客户咨询：

姓名：{name}
邮箱：{email}
电话：{phone}
类型：{type}
消息：{message}
时间：{created_at}

请及时回复客户。
```

---

## 实施步骤

### 阶段 1：环境准备（1-2小时）

#### Task 1.1: 创建后端项目结构
**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/app.ts`

**Step 1: 初始化后端项目**
```bash
mkdir -p server/src/{config,controllers,middleware,models,routes,services,types}
cd server
npm init -y
```

**Step 2: 安装依赖**
```bash
npm install express cors helmet bcryptjs jsonwebtoken mysql2 nodemailer express-validator dotenv
npm install -D typescript @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/nodemailer ts-node nodemon
```

**Step 3: 配置 TypeScript**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: 创建基础 Express 应用**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

**Step 5: Commit**
```bash
git add server/
git commit -m "feat: initialize backend server"
```

---

### 阶段 2：数据库设计与配置（1小时）

#### Task 2.1: 创建数据库脚本
**Files:**
- Create: `database/schema.sql`
- Create: `database/seed.sql`

**Step 1: 编写数据库结构**
```sql
-- database/schema.sql
CREATE DATABASE IF NOT EXISTS tarmeer;
USE tarmeer;

CREATE TABLE designers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  city VARCHAR(100),
  address TEXT,
  bio TEXT,
  avatar_url VARCHAR(500),
  style VARCHAR(255),
  expertise JSON,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  designer_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  style VARCHAR(100),
  location VARCHAR(255),
  area VARCHAR(50),
  year INT,
  cost VARCHAR(100),
  images JSON,
  tags JSON,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (designer_id) REFERENCES designers(id)
);

CREATE TABLE contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  type ENUM('inquiry', 'quote', 'partnership') NOT NULL,
  message TEXT,
  designer_id INT,
  project_id INT,
  status ENUM('new', 'read', 'replied') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (designer_id) REFERENCES designers(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

**Step 2: 编写初始数据**
```sql
-- database/seed.sql
USE tarmeer;

-- 插入测试设计师
INSERT INTO designers (email, password, full_name, phone, city, bio, is_approved) VALUES
('test@example.com', '$2b$10$dummy', 'Test Designer', '+971501234567', 'Dubai', 'Test designer for development', TRUE);
```

**Step 3: Commit**
```bash
git add database/
git commit -m "feat: add database schema and seed data"
```

---

### 阶段 3：核心功能实现（4-6小时）

#### Task 3.1: 实现数据库连接
**Files:**
- Create: `server/src/config/database.ts`

**Step 1: 配置数据库连接**
```typescript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tarmeer',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

**Step 2: Commit**
```bash
git add server/src/config/database.ts
git commit -m "feat: add database connection"
```

---

#### Task 3.2: 实现邮件服务
**Files:**
- Create: `server/src/services/emailService.ts`
- Create: `server/src/config/email.ts`

**Step 1: 配置邮件**
```typescript
import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const NOTIFICATION_EMAIL = 'lvyiming@kp99.cn';
```

**Step 2: 实现邮件发送服务**
```typescript
import { transporter, NOTIFICATION_EMAIL } from '../config/email';
import crypto from 'crypto';

export async function sendVerificationEmail(email: string, fullName: string, token: string) {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: '【Tarmeer】验证您的邮箱地址',
    html: `
      <h2>亲爱的 ${fullName}，</h2>
      <p>感谢您注册 Tarmeer 设计师平台！</p>
      <p>请点击以下链接验证您的邮箱地址：</p>
      <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #b8864a; color: white; text-decoration: none; border-radius: 8px;">验证邮箱</a>
      <p>此链接 24 小时内有效。</p>
      <p>如果您没有注册 Tarmeer 账号，请忽略此邮件。</p>
      <br>
      <p>Tarmeer 团队</p>
    `
  });
}

export async function sendDesignerRegistrationEmail(designer: any) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: NOTIFICATION_EMAIL,
    subject: '【Tarmeer】新设计师注册',
    html: `
      <h2>有新的设计师注册</h2>
      <p><strong>姓名：</strong>${designer.full_name}</p>
      <p><strong>邮箱：</strong>${designer.email}</p>
      <p><strong>电话：</strong>${designer.phone}</p>
      <p><strong>城市：</strong>${designer.city}</p>
      <p><strong>邮箱验证状态：</strong>${designer.email_verified ? '已验证' : '未验证'}</p>
      <p><strong>注册时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
    `
  });
}

export function generateVerificationToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 小时
  return { token, expires };
}

export async function sendProjectSubmissionEmail(project: any, designer: any) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: NOTIFICATION_EMAIL,
    subject: '【Tarmeer】新项目提交',
    html: `
      <h2>设计师 ${designer.full_name} 提交了新项目</h2>
      <p><strong>项目名称：</strong>${project.title}</p>
      <p><strong>风格：</strong>${project.style}</p>
      <p><strong>位置：</strong>${project.location}</p>
      <p><strong>面积：</strong>${project.area}</p>
      <p><strong>预算：</strong>${project.cost}</p>
      <p><strong>提交时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
    `
  });
}

export async function sendContactFormEmail(contact: any) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: NOTIFICATION_EMAIL,
    subject: '【Tarmeer】新的客户咨询',
    html: `
      <h2>有新的客户咨询</h2>
      <p><strong>姓名：</strong>${contact.name}</p>
      <p><strong>邮箱：</strong>${contact.email}</p>
      <p><strong>电话：</strong>${contact.phone}</p>
      <p><strong>类型：</strong>${contact.type}</p>
      <p><strong>消息：</strong>${contact.message}</p>
      <p><strong>时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
    `
  });
}
```

**Step 3: Commit**
```bash
git add server/src/services/emailService.ts server/src/config/email.ts
git commit -m "feat: add email notification service"
```

---

#### Task 3.3: 实现认证功能
**Files:**
- Create: `server/src/controllers/authController.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/src/middleware/auth.ts`

**Step 1: 实现注册控制器**
```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { sendDesignerRegistrationEmail, sendVerificationEmail, generateVerificationToken } from '../services/emailService';

// 临时邮箱黑名单
const TEMP_EMAIL_DOMAINS = [
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'throwaway.email',
  'mailinator.com',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'pokemail.net',
  'spam4.me'
];

function isTempEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return TEMP_EMAIL_DOMAINS.includes(domain);
}

export async function register(req: any, res: any) {
  try {
    const { email, password, full_name, phone, city } = req.body;
    
    // 检查是否为临时邮箱
    if (isTempEmail(email)) {
      return res.status(400).json({ error: '不支持临时邮箱注册，请使用正规邮箱' });
    }
    
    // 检查邮箱是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM designers WHERE email = ?',
      [email]
    );
    
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 生成验证令牌
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();
    
    // 插入设计师（未验证状态）
    const [result] = await pool.execute(
      'INSERT INTO designers (email, password, full_name, phone, city, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, full_name, phone, city, verificationToken, verificationExpires]
    );
    
    const designerId = (result as any).insertId;
    
    // 获取新创建的设计师
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE id = ?',
      [designerId]
    );
    
    const newDesigner = (designer as any[])[0];
    
    // 发送验证邮件给设计师
    await sendVerificationEmail(email, full_name, verificationToken);
    
    // 发送注册通知到管理员
    await sendDesignerRegistrationEmail(newDesigner);
    
    res.status(201).json({
      message: '注册成功！请检查您的邮箱并验证邮箱地址',
      email: email
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '注册失败' });
  }
}

export async function verifyEmail(req: any, res: any) {
  try {
    const { token } = req.body;
    
    // 查找有效的验证令牌
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE verification_token = ? AND verification_expires > NOW()',
      [token]
    );
    
    if ((designer as any[]).length === 0) {
      return res.status(400).json({ error: '验证链接无效或已过期' });
    }
    
    const user = (designer as any[])[0];
    
    // 更新验证状态
    await pool.execute(
      'UPDATE designers SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [user.id]
    );
    
    // 生成登录 token
    const loginToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      message: '邮箱验证成功！',
      token: loginToken,
      designer: {
        ...user,
        email_verified: true,
        verification_token: null,
        verification_expires: null
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: '验证失败' });
  }
}

export async function resendVerification(req: any, res: any) {
  try {
    const { email } = req.body;
    
    // 查找未验证的设计师
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE email = ? AND email_verified = FALSE',
      [email]
    );
    
    if ((designer as any[]).length === 0) {
      return res.status(400).json({ error: '邮箱不存在或已验证' });
    }
    
    const user = (designer as any[])[0];
    
    // 生成新的验证令牌
    const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();
    
    // 更新验证令牌
    await pool.execute(
      'UPDATE designers SET verification_token = ?, verification_expires = ? WHERE id = ?',
      [verificationToken, verificationExpires, user.id]
    );
    
    // 发送验证邮件
    await sendVerificationEmail(email, user.full_name, verificationToken);
    
    res.json({ message: '验证邮件已发送，请检查您的邮箱' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: '发送失败' });
  }
}

export async function login(req: any, res: any) {
  try {
    const { email, password } = req.body;
    
    // 查找设计师
    const [designer] = await pool.execute(
      'SELECT * FROM designers WHERE email = ?',
      [email]
    );
    
    if ((designer as any[]).length === 0) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    const user = (designer as any[])[0];
    
    // 检查邮箱是否已验证
    if (!user.email_verified) {
      return res.status(401).json({ 
        error: '请先验证您的邮箱地址',
        needVerification: true,
        email: user.email
      });
    }
    
    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    // 生成 token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      designer: user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
}
```

**Step 2: 创建认证路由**
```typescript
import { Router } from 'express';
import { body } from 'express-validator';
import { register, login } from '../controllers/authController';

const router = Router();

router.post('/register',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('full_name').notEmpty()
  ],
  register
);

router.post('/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  login
);

export default router;
```

**Step 3: 创建认证中间件**
```typescript
import jwt from 'jsonwebtoken';

export function authenticate(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: '无效的认证令牌' });
  }
}
```

**Step 4: Commit**
```bash
git add server/src/controllers/authController.ts server/src/routes/auth.ts server/src/middleware/auth.ts
git commit -m "feat: add authentication system"
```

---

### 阶段 4：前端对接（2-3小时）

#### Task 4.1: 创建 API 客户端
**Files:**
- Create: `src/lib/api.ts`

**Step 1: 创建 API 客户端**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as any)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '请求失败');
    }

    return response.json();
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async get(endpoint: string) {
    return this.request(endpoint, {
      method: 'GET',
    });
  }

  async put(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
```

**Step 2: Commit**
```bash
git add src/lib/api.ts
git commit -m "feat: add API client"
```

---

### 阶段 5：部署与测试（1-2小时）

#### Task 5.1: 配置环境变量
**Files:**
- Create: `server/.env.example`
- Create: `server/.env` (不提交到 Git)

**Step 1: 创建环境变量模板**
```env
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=tarmeer

# JWT 配置
JWT_SECRET=your_jwt_secret_here

# SMTP 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# 服务器配置
PORT=3001
NODE_ENV=production
```

**Step 2: 更新 .gitignore**
```
server/.env
```

**Step 3: Commit**
```bash
git add server/.env.example .gitignore
git commit -m "feat: add environment configuration"
```

---

## 总结

### 预计总时间：8-12 小时

### 主要功能：
1. ✅ 设计师注册与登录
2. ✅ 项目提交与管理
3. ✅ 联系表单收集
4. ✅ 邮件通知（lvyiming@kp99.cn）
5. ✅ 数据持久化（MySQL）
6. ✅ API 接口（RESTful）

### 技术栈：
- 后端：Node.js + Express + TypeScript
- 数据库：MySQL
- 邮件：Nodemailer
- 认证：JWT
- 安全：bcryptjs, helmet, cors

### 下一步：
1. 选择执行方式（Subagent-Driven 或 Parallel Session）
2. 开始实施第一阶段：环境准备
3. 逐步完成所有功能模块

---

**计划完成并保存到 `docs/plans/2026-03-06-backend-system.md`**

**两种执行方式：**

**1. Subagent-Driven (当前会话)** - 我在每个任务中派遣新的子代理，在任务之间进行审查，快速迭代

**2. Parallel Session (单独会话)** - 在新会话中打开 executing-plans，批量执行并设置检查点

**你选择哪种方式？**
