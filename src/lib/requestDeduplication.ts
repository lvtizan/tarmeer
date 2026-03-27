/**
 * 请求去重和表单提交保护
 * 防止用户重复提交表单和重复请求
 */
import { useState, useCallback, useMemo } from 'react';

interface PendingRequest {
  timestamp: number;
  controller: AbortController;
}

interface RequestOptions {
  key: string;
  ttl?: number; // Time to live in milliseconds
  deduplicate?: boolean; // Whether to deduplicate identical requests
}

// 存储待处理的请求
const pendingRequests = new Map<string, PendingRequest>();

// 默认配置
const DEFAULT_TTL = 5000; // 5秒
const CLEANUP_INTERVAL = 60000; // 1分钟清理一次过期请求

/**
 * 生成请求唯一标识符
 * Exported for external use
 */
export function generateRequestKey(method: string, url: string, body?: any): string {
  let key = `${method}:${url}`;

  if (body) {
    // 对请求体进行标准化处理
    const normalizedBody = typeof body === 'string' ? body : JSON.stringify(body);
    key += `:${normalizedBody}`;
  }

  // 简单哈希函数
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * 清理过期的请求记录
 */
function cleanupExpiredRequests(): void {
  const now = Date.now();

  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > DEFAULT_TTL * 2) {
      request.controller.abort();
      pendingRequests.delete(key);
    }
  }
}

// 定期清理过期请求
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRequests, CLEANUP_INTERVAL);
}

/**
 * 检查是否为重复请求
 */
function isDuplicateRequest(key: string): boolean {
  const request = pendingRequests.get(key);
  if (!request) {
    return false;
  }

  const now = Date.now();
  return (now - request.timestamp) < DEFAULT_TTL;
}

/**
 * 请求去重包装器
 */
export class RequestDeduplicator {
  /**
   * 执行去重请求
   */
  async execute<T>(
    fetchFn: () => Promise<T>,
    options: RequestOptions
  ): Promise<T> {
    const { key, ttl = DEFAULT_TTL, deduplicate = true } = options;

    if (deduplicate && isDuplicateRequest(key)) {
      throw new Error('Duplicate request detected. Please wait before submitting again.');
    }

    // 创建AbortController用于取消请求
    const controller = new AbortController();

    // 存储请求信息
    pendingRequests.set(key, {
      timestamp: Date.now(),
      controller,
    });

    try {
      // 执行请求
      const result = await fetchFn();
      return result;
    } finally {
      // 清理请求记录
      setTimeout(() => {
        pendingRequests.delete(key);
      }, ttl);
    }
  }

  /**
   * 取消特定请求
   */
  cancelRequest(key: string): void {
    const request = pendingRequests.get(key);
    if (request) {
      request.controller.abort();
      pendingRequests.delete(key);
    }
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {
    for (const request of pendingRequests.values()) {
      request.controller.abort();
    }
    pendingRequests.clear();
  }

  /**
   * 获取待处理的请求数量
   */
  getPendingCount(): number {
    return pendingRequests.size;
  }

  /**
   * 检查请求是否正在处理
   */
  isPending(key: string): boolean {
    return pendingRequests.has(key);
  }
}

// 全局请求去重器实例
export const requestDeduplicator = new RequestDeduplicator();

/**
 * 表单提交保护混入
 */
export function useFormSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitTime, setSubmitTime] = useState<number | null>(null);

  const submitForm = async <T>(
    submitFn: () => Promise<T>,
    options: { minInterval?: number } = {}
  ): Promise<T> => {
    const { minInterval = 1000 } = options; // 默认最小间隔1秒

    // 检查是否在提交中
    if (isSubmitting) {
      throw new Error('Form submission is already in progress.');
    }

    // 检查提交间隔
    if (submitTime && Date.now() - submitTime < minInterval) {
      const remainingTime = Math.ceil((minInterval - (Date.now() - submitTime)) / 1000);
      throw new Error(`Please wait ${remainingTime} second(s) before submitting again.`);
    }

    setIsSubmitting(true);
    setSubmitTime(Date.now());

    try {
      const result = await submitFn();
      return result;
    } finally {
      // 延迟重置状态，防止快速重复提交
      setTimeout(() => {
        setIsSubmitting(false);
      }, minInterval);
    }
  };

  const resetSubmission = () => {
    setIsSubmitting(false);
    setSubmitTime(null);
  };

  return {
    isSubmitting,
    submitTime,
    submitForm,
    resetSubmission,
  };
}

/**
 * React Hook：防抖请求
 */
export function useDebouncedRequest<T = any>(
  requestFn: () => Promise<T>,
  delay: number = 300
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestFn();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Request failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [requestFn]);

  const debouncedExecute = useMemo(
    () => debounce(execute, delay),
    [execute, delay]
  );

  return {
    data,
    loading,
    error,
    execute: debouncedExecute,
  };
}

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
