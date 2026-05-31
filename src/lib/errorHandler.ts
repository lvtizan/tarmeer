/**
 * 统一错误处理系统
 * 标准化前后端错误处理和错误码
 */
import { useState, useCallback } from 'react';

// 错误码定义
export enum ErrorCode {
  // 认证相关 (1xxx)
  UNAUTHORIZED = 1001,
  TOKEN_EXPIRED = 1002,
  TOKEN_INVALID = 1003,
  ACCOUNT_LOCKED = 1004,
  TOO_MANY_ATTEMPTS = 1005,

  // 验证相关 (2xxx)
  VALIDATION_ERROR = 2001,
  INVALID_EMAIL = 2002,
  INVALID_PASSWORD = 2003,
  MISSING_FIELD = 2004,

  // 资源相关 (3xxx)
  NOT_FOUND = 3001,
  ALREADY_EXISTS = 3002,
  CONFLICT = 3003,

  // 权限相关 (4xxx)
  FORBIDDEN = 4001,
  INSUFFICIENT_PERMISSIONS = 4002,

  // 服务器错误 (5xxx)
  INTERNAL_ERROR = 5001,
  SERVICE_UNAVAILABLE = 5002,
  DATABASE_ERROR = 5003,
  NETWORK_ERROR = 5004,

  // 业务逻辑错误 (6xxx)
  BUSINESS_LOGIC_ERROR = 6001,
  OPERATION_FAILED = 6002,
}

// 错误类
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 具体错误类型
export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.UNAUTHORIZED, message, 401, details);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.NOT_FOUND, message, 404, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.CONFLICT, message, 409, details);
    this.name = 'ConflictError';
  }
}

// 错误响应格式
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  statusCode: number;
  details?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * 创建标准错误响应
 */
export function createErrorResponse(error: AppError | Error, requestId?: string): ErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      timestamp,
      requestId,
    };
  }

  // 通用错误
  return {
    error: error.message || 'An unexpected error occurred',
    code: ErrorCode.INTERNAL_ERROR,
    statusCode: 500,
    timestamp,
    requestId,
  };
}

/**
 * 前端错误处理器
 */
export class ClientErrorHandler {
  /**
   * 处理API错误
   */
  static handleApiError(error: any): string {
    if (error instanceof AppError) {
      return error.message;
    }

    // 尝试解析错误响应
    if (error.response?.data) {
      const { error: message } = error.response.data;
      return message || 'An error occurred';
    }

    // 网络错误
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return 'Network error: the service is temporarily unavailable.';
    }

    // 超时错误
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Request timeout: the server took too long to respond.';
    }

    // 默认错误消息
    return error.message || 'An unexpected error occurred. Please try again.';
  }

  /**
   * 显示用户友好的错误消息
   */
  static showError(error: any, context?: string): void {
    const message = this.handleApiError(error);
    const contextMsg = context ? `[${context}] ` : '';
    console.error(`${contextMsg}${message}`, error);

    // 在生产环境中，可以发送错误到监控服务
    if (process.env.NODE_ENV === 'production') {
      // 发送到错误监控服务（如Sentry）
      // this.sendToMonitoring(error, context);
    }
  }

  /**
   * 重试逻辑
   */
  static async retryWithErrorHandling<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // 不重试的错误类型
        if (error instanceof AppError && error.statusCode < 500) {
          throw error;
        }

        // 最后一次尝试失败，抛出错误
        if (attempt === maxRetries) {
          throw error;
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }

    throw lastError;
  }
}

/**
 * React Hook：错误处理
 */
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const executeWithErrorHandling = useCallback(async <T>(
    fn: () => Promise<T>
  ): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const result = await fn();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setError(error);
      ClientErrorHandler.showError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    loading,
    executeWithErrorHandling,
    clearError,
  };
}

// 导出React类型（如果需要React支持）
declare const React: any;
