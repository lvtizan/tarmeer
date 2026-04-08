import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import designerRoutes from './routes/designers';
import projectRoutes from './routes/projects';
import contactRoutes from './routes/contact';
import adminRoutes from './routes/admin';
import statsRoutes from './routes/stats';
import companyRoutes from './routes/companies';
import publicCompaniesRouter from './routes/publicCompanies';
import companyApplicationRoutes from './routes/companyApplications';
import inquiryRoutes from './routes/inquiries';
import notificationRoutes from './routes/notifications';
import complaintRoutes from './routes/complaints';
import config from './config';
import {
  isPayloadTooLargeError,
  PAYLOAD_TOO_LARGE_MESSAGE,
  UPLOAD_REQUEST_BODY_LIMIT,
} from './lib/requestLimits';
import { getCorsConfig, logCorsViolation } from './lib/corsOrigins';
import { shouldSkipApiRateLimit } from './lib/rateLimitPolicy';
import { validateJWTConfig } from './lib/jwtManager';
import { runAutoMigrate } from './lib/autoMigrate';
import { calculateAllWeights } from './lib/weightCalculator';
import passport from './middleware/passport';

dotenv.config();

// 验证JWT配置
validateJWTConfig();

const app = express();
const PORT = config.port;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://www.facebook.com'],
      formAction: ["'self'", 'https://accounts.google.com', 'https://www.facebook.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // OAuth 重定向需要
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => shouldSkipApiRateLimit({
    nodeEnv: config.nodeEnv,
    method: req.method,
    path: req.path,
    ip: req.ip,
  }),
});
app.use('/api/', limiter);

// 使用新的CORS配置
const corsConfig = getCorsConfig(config.frontendUrl);
app.use(cors(corsConfig));

// Session（Passport OAuth 需要）
app.use(session({
  secret: config.jwt.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    maxAge: 10 * 60 * 1000, // 10 分钟，仅用于 OAuth 流程
  },
}));

// Passport 初始化
app.use(passport.initialize());
app.use(passport.session());

// 添加CORS违规日志记录
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !corsConfig.origin.includes(origin)) {
    logCorsViolation(origin, req.path);
  }
  next();
});

app.use(express.json({ limit: UPLOAD_REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: UPLOAD_REQUEST_BODY_LIMIT }));

app.get('/', (req, res) => {
  res.json({
    name: 'Tarmeer API',
    version: '1.0.0',
    description: 'Tarmeer 4.0 Backend API',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        verifyEmail: 'POST /api/auth/verify-email',
        resendVerification: 'POST /api/auth/resend-verification'
      },
      designers: {
        list: 'GET /api/designers',
        detail: 'GET /api/designers/:id',
        update: 'PUT /api/designers/:id'
      },
      projects: {
        list: 'GET /api/projects',
        detail: 'GET /api/projects/:id',
        create: 'POST /api/projects',
        update: 'PUT /api/projects/:id',
        delete: 'DELETE /api/projects/:id'
      },
      contact: {
        submit: 'POST /api/contact',
        list: 'GET /api/contact'
      },
      health: 'GET /api/health'
      ,
      companies: {
        list: 'GET /api/companies',
        detail: 'GET /api/companies/:slug'
      }
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

import path from 'path';
import fs from 'fs';

const PRIMARY_UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const SHARED_UPLOADS_DIR = '/tarmeer/tarmeer_web_crm/server/uploads';

// Keep primary uploads first, then fallback to shared CRM uploads path.
app.use('/uploads', express.static(PRIMARY_UPLOADS_DIR));
app.use('/api/uploads', express.static(PRIMARY_UPLOADS_DIR));
if (fs.existsSync(SHARED_UPLOADS_DIR)) {
  app.use('/uploads', express.static(SHARED_UPLOADS_DIR));
  app.use('/api/uploads', express.static(SHARED_UPLOADS_DIR));
}

import { antiScraping } from './middleware/antiScraping';

// Anti-scraping protection on public data endpoints
app.use('/api/designers', antiScraping);
app.use('/api/projects', antiScraping);
app.use('/api/public/companies', antiScraping);

app.use('/api/auth', authRoutes);
app.use('/api/designers', designerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/public/companies', publicCompaniesRouter);
app.use('/api/company-applications', companyApplicationRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);

  if (isPayloadTooLargeError(err)) {
    res.status(413).json({ error: PAYLOAD_TOO_LARGE_MESSAGE });
    return;
  }
  
  if (config.nodeEnv === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({
      error: err.message || 'Internal server error',
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Schedule weight calculation at 01:00 UTC (09:00 China time) daily
function scheduleWeightCalculation() {
  function getNextRun(): number {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(1, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function run() {
    calculateAllWeights().catch(err => console.error('[Weight] Calculation error:', err));
    setTimeout(run, 24 * 60 * 60 * 1000);
  }

  // Run once on startup
  calculateAllWeights().catch(err => console.error('[Weight] Initial calculation error:', err));
  // Schedule next run
  setTimeout(run, getNextRun());
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔒 Security: Helmet enabled, Rate limiting active`);

  // 启动后自动检查并补齐数据库结构
  await runAutoMigrate();

  // Weight calculation scheduler
  scheduleWeightCalculation();
});

export default app;
