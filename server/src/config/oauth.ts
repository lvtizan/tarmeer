// server/src/config/oauth.ts
import dotenv from 'dotenv';

dotenv.config();

export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL ||
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/auth/callback/google`,
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL ||
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/auth/callback/facebook`,
    profileFields: ['id', 'displayName', 'emails', 'photos'],
  },
};

export default oauthConfig;
