import dotenv from 'dotenv';

dotenv.config();

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} must be set`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3002'),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5179',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'tarmeer',
  },
  
  jwt: {
    secret: process.env.NODE_ENV === 'production' 
      ? getEnvVar('JWT_SECRET')
      : process.env.JWT_SECRET || 'dev_secret_key_change_in_production_min_32_chars',
    expiresIn: '7d' as string,
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtpdm.aliyun.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@mail.kptom.com',
  },
  
  notificationEmail: 'lvyiming@kp99.cn',
};

export default config;
