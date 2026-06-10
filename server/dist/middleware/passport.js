"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/src/middleware/passport.ts
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_facebook_1 = require("passport-facebook");
const config_1 = __importDefault(require("../config"));
const oauthHandler_1 = require("../lib/oauthHandler");
// OAuth 验证回调
async function verifyOAuthCallback(accessToken, refreshToken, profile, done) {
    try {
        const provider = profile.provider;
        const oauthId = profile.id;
        // 查找是否已有此 OAuth 账号
        const existingDesigner = await (0, oauthHandler_1.findDesignerByOAuthId)(provider, oauthId);
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
        const result = await (0, oauthHandler_1.createOAuthDesigner)({
            id: oauthId,
            email,
            displayName,
            photoUrl,
            provider,
        });
        return done(null, result.designer);
    }
    catch (error) {
        console.error('OAuth verification error:', error);
        return done(error, null);
    }
}
// 配置 Google 策略（仅在有配置时启用）
if (config_1.default.oauth.google.clientId && config_1.default.oauth.google.clientSecret) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: config_1.default.oauth.google.clientId,
        clientSecret: config_1.default.oauth.google.clientSecret,
        callbackURL: config_1.default.oauth.google.callbackURL,
    }, verifyOAuthCallback));
    console.log('[passport] Google OAuth enabled');
}
else {
    console.log('[passport] Google OAuth disabled (missing credentials)');
}
// 配置 Facebook 策略（仅在有配置时启用）
if (config_1.default.oauth.facebook.appId && config_1.default.oauth.facebook.appSecret) {
    passport_1.default.use(new passport_facebook_1.Strategy({
        clientID: config_1.default.oauth.facebook.appId,
        clientSecret: config_1.default.oauth.facebook.appSecret,
        callbackURL: config_1.default.oauth.facebook.callbackURL,
        profileFields: ['id', 'displayName', 'emails', 'photos'],
    }, verifyOAuthCallback));
    console.log('[passport] Facebook OAuth enabled');
}
else {
    console.log('[passport] Facebook OAuth disabled (missing credentials)');
}
// 序列化用户（存储到 session）
passport_1.default.serializeUser((user, done) => {
    done(null, { id: user.id, email: user.email });
});
// 反序列化用户（从 session 读取）
passport_1.default.deserializeUser((user, done) => {
    done(null, user);
});
exports.default = passport_1.default;
