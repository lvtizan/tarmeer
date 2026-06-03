"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTManager = void 0;
exports.validateJWTConfig = validateJWTConfig;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../config"));
/**
 * JWT密钥管理器
 * 提供安全的密钥生成、验证和管理功能
 */
class JWTManager {
    /**
     * 生成安全的随机密钥
     */
    static generateSecret(length = 64) {
        return crypto_1.default.randomBytes(length).toString('hex');
    }
    /**
     * 验证密钥强度
     */
    static validateSecretStrength(secret) {
        const issues = [];
        if (secret.length < this.MIN_SECRET_LENGTH) {
            issues.push(`Secret too short (minimum ${this.MIN_SECRET_LENGTH} characters)`);
        }
        if (config_1.default.nodeEnv === 'production') {
            // 生产环境需要更高的熵值
            const entropy = this.calculateEntropy(secret);
            if (entropy < this.PRODUCTION_MIN_ENTROPY) {
                issues.push(`Insufficient entropy for production (minimum ${this.PRODUCTION_MIN_ENTROPY} bits)`);
            }
        }
        // 检查是否使用了默认/弱密钥
        const weakPatterns = [
            'dev_secret',
            'change_in_production',
            'secret_key',
            'password',
            '123456',
            'admin',
        ];
        const lowerSecret = secret.toLowerCase();
        for (const pattern of weakPatterns) {
            if (lowerSecret.includes(pattern)) {
                issues.push(`Secret contains weak pattern: ${pattern}`);
                break;
            }
        }
        return {
            valid: issues.length === 0,
            issues,
        };
    }
    /**
     * 计算字符串的熵值（位数）
     */
    static calculateEntropy(str) {
        const uniqueChars = new Set(str.split(''));
        const charsetSize = uniqueChars.size;
        return Math.floor(str.length * Math.log2(charsetSize));
    }
    /**
     * 获取当前JWT密钥
     */
    static getCurrentSecret() {
        const secret = config_1.default.jwt.secret;
        // 在开发环境发出警告
        if (config_1.default.nodeEnv === 'development') {
            const validation = this.validateSecretStrength(secret);
            if (!validation.valid) {
                console.warn('[JWT] Weak secret detected in development:', validation.issues);
            }
        }
        // 生产环境必须使用强密钥
        if (config_1.default.nodeEnv === 'production') {
            const validation = this.validateSecretStrength(secret);
            if (!validation.valid) {
                throw new Error(`JWT secret validation failed: ${validation.issues.join(', ')}. ` +
                    'Please set a strong JWT_SECRET environment variable.');
            }
        }
        return secret;
    }
    /**
     * 验证JWT配置
     */
    static validateConfiguration() {
        const warnings = [];
        const secret = config_1.default.jwt.secret;
        const validation = this.validateSecretStrength(secret);
        if (!validation.valid) {
            if (config_1.default.nodeEnv === 'production') {
                return { valid: false, warnings: validation.issues };
            }
            else {
                warnings.push(...validation.issues);
            }
        }
        return { valid: true, warnings };
    }
}
exports.JWTManager = JWTManager;
JWTManager.MIN_SECRET_LENGTH = 32;
JWTManager.PRODUCTION_MIN_ENTROPY = 128;
// 应用启动时验证JWT配置
function validateJWTConfig() {
    try {
        const validation = JWTManager.validateConfiguration();
        if (!validation.valid) {
            throw new Error(`JWT configuration invalid: ${validation.warnings.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
            console.warn('[JWT] Configuration warnings:', validation.warnings);
        }
        else {
            console.log('[JWT] Configuration validated successfully');
        }
    }
    catch (error) {
        console.error('[JWT] Configuration validation failed:', error);
        throw error;
    }
}
