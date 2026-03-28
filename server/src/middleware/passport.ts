// server/src/middleware/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import jwt from 'jsonwebtoken';
import config from '../config';
import {
  createOAuthDesigner,
  findDesignerByOAuthId,
} from '../lib/oauthHandler';

// 扩展 Passport 类型
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
    }
  }
}

// OAuth 验证回调
async function verifyOAuthCallback(
  accessToken: string,
  refreshToken: string,
  profile: any,
  done: any
) {
  try {
    const provider = profile.provider as 'google' | 'facebook';
    const oauthId = profile.id;

    // 查找是否已有此 OAuth 账号
    const existingDesigner = await findDesignerByOAuthId(provider, oauthId);

    if (existingDesigner) {
      return done(null, existingDesigner);
    }

    // 提取用户信息
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email provided by OAuth provider'), null);
    }

    const photoUrl = profile.photos?.[0]?.value;
    const displayName = profile.displayName || email.split('@')[0];

    // 创建或关联账号
    const result = await createOAuthDesigner({
      id: oauthId,
      email,
      displayName,
      photoUrl,
      provider,
    });

    return done(null, result.designer);
  } catch (error) {
    console.error('OAuth verification error:', error);
    return done(error, null);
  }
}

// 配置 Google 策略（仅在有配置时启用）
if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.oauth.google.clientId,
        clientSecret: config.oauth.google.clientSecret,
        callbackURL: config.oauth.google.callbackURL,
      },
      verifyOAuthCallback
    )
  );
  console.log('[passport] Google OAuth enabled');
} else {
  console.log('[passport] Google OAuth disabled (missing credentials)');
}

// 配置 Facebook 策略（仅在有配置时启用）
if (config.oauth.facebook.appId && config.oauth.facebook.appSecret) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: config.oauth.facebook.appId,
        clientSecret: config.oauth.facebook.appSecret,
        callbackURL: config.oauth.facebook.callbackURL,
        profileFields: ['id', 'displayName', 'emails', 'photos'],
      },
      verifyOAuthCallback
    )
  );
  console.log('[passport] Facebook OAuth enabled');
} else {
  console.log('[passport] Facebook OAuth disabled (missing credentials)');
}

// 序列化用户（存储到 session）
passport.serializeUser((user: any, done) => {
  done(null, { id: user.id, email: user.email });
});

// 反序列化用户（从 session 读取）
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
