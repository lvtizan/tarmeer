// server/src/config/oauth.ts
import dotenv from 'dotenv';

dotenv.config();

const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || '3002'}`;

// In production, derive callback URL from FRONTEND_URL (same domain, /api prefix)
// e.g. FRONTEND_URL=https://www.tarmeer.com → callback=https://www.tarmeer.com/api/auth/callback/google
function deriveCallbackUrl(provider: string): string {
  const frontendUrl = process.env.FRONTEND_URL || '';
  // If FRONTEND_URL looks like a production URL (not localhost), use it to derive the callback
  if (frontendUrl && !frontendUrl.includes('localhost') && !frontendUrl.includes('127.0.0.1')) {
    const base = frontendUrl.replace(/\/+$/, '');
    return `${base}/api/auth/callback/${provider}`;
  }
  return `${backendUrl}/api/auth/callback/${provider}`;
}

export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || deriveCallbackUrl('google'),
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || deriveCallbackUrl('facebook'),
    profileFields: ['id', 'displayName', 'emails', 'photos'],
  },
};

export default oauthConfig;
