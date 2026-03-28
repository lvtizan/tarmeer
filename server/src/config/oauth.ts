// server/src/config/oauth.ts
import dotenv from 'dotenv';

dotenv.config();

const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || '3002'}`;

export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL ||
      `${backendUrl}/api/auth/callback/google`,
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL ||
      `${backendUrl}/api/auth/callback/facebook`,
    profileFields: ['id', 'displayName', 'emails', 'photos'],
  },
};

export default oauthConfig;
