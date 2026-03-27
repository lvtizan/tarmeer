import crypto from 'crypto';
import config from '../config';

/**
 * JWT密钥管理器
 * 提供安全的密钥生成、验证和管理功能
 */
export class JWTManager {
  private static readonly MIN_SECRET_LENGTH = 32;
  private static readonly PRODUCTION_MIN_ENTROPY = 128;

  /**
   * 生成安全的随机密钥
   */
  static generateSecret(length: number = 64): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 验证密钥强度
   */
  static validateSecretStrength(secret: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (secret.length < this.MIN_SECRET_LENGTH) {
      issues.push(`Secret too short (minimum ${this.MIN_SECRET_LENGTH} characters)`);
    }

    if (config.nodeEnv === 'production') {
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
  private static calculateEntropy(str: string): number {
    const uniqueChars = new Set(str.split(''));
    const charsetSize = uniqueChars.size;
    return Math.floor(str.length * Math.log2(charsetSize));
  }

  /**
   * 获取当前JWT密钥
   */
  static getCurrentSecret(): string {
    const secret = config.jwt.secret;

    // 在开发环境发出警告
    if (config.nodeEnv === 'development') {
      const validation = this.validateSecretStrength(secret);
      if (!validation.valid) {
        console.warn('[JWT] Weak secret detected in development:', validation.issues);
      }
    }

    // 生产环境必须使用强密钥
    if (config.nodeEnv === 'production') {
      const validation = this.validateSecretStrength(secret);
      if (!validation.valid) {
        throw new Error(
          `JWT secret validation failed: ${validation.issues.join(', ')}. ` +
          'Please set a strong JWT_SECRET environment variable.'
        );
      }
    }

    return secret;
  }

  /**
   * 验证JWT配置
   */
  static validateConfiguration(): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const secret = config.jwt.secret;

    const validation = this.validateSecretStrength(secret);
    if (!validation.valid) {
      if (config.nodeEnv === 'production') {
        return { valid: false, warnings: validation.issues };
      } else {
        warnings.push(...validation.issues);
      }
    }

    return { valid: true, warnings };
  }
}

// 应用启动时验证JWT配置
export function validateJWTConfig(): void {
  try {
    const validation = JWTManager.validateConfiguration();
    if (!validation.valid) {
      throw new Error(`JWT configuration invalid: ${validation.warnings.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('[JWT] Configuration warnings:', validation.warnings);
    } else {
      console.log('[JWT] Configuration validated successfully');
    }
  } catch (error) {
    console.error('[JWT] Configuration validation failed:', error);
    throw error;
  }
}
