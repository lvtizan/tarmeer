import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import designerRoutes from './routes/designers';
import projectRoutes from './routes/projects';
import contactRoutes from './routes/contact';
import adminRoutes from './routes/admin';
import statsRoutes from './routes/stats';
import config from './config';
import {
  isPayloadTooLargeError,
  PAYLOAD_TOO_LARGE_MESSAGE,
  UPLOAD_REQUEST_BODY_LIMIT,
} from './lib/requestLimits';
import { buildCorsOrigins } from './lib/corsOrigins';
import { shouldSkipApiRateLimit } from './lib/rateLimitPolicy';

dotenv.config();

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
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
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
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => shouldSkipApiRateLimit({
    nodeEnv: config.nodeEnv,
    method: req.method,
    path: req.path,
    ip: req.ip,
  }),
});
app.use('/api/', limiter);

const corsOrigins = buildCorsOrigins(config.frontendUrl);
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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

app.use('/api/auth', authRoutes);
app.use('/api/designers', designerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);

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
      stack: err.stack
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔒 Security: Helmet enabled, Rate limiting active`);
});

export default app;
