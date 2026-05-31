import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

// 请求去重存储
const pendingRequests = new Map<string, AbortController>();

/**
 * 生成请求唯一标识符
 */
function generateRequestKey(method: string, url: string, body?: any): string {
  let key = `${method}:${url}`;
  if (body) {
    const normalizedBody = typeof body === 'string' ? body : JSON.stringify(body);
    key += `:${normalizedBody}`;
  }
  return key;
}

/**
 * 清理过期的请求
 */
function cleanupExpiredRequests(): void {
  const now = Date.now();
  for (const [key, controller] of pendingRequests.entries()) {
    if (now - (controller as any).timestamp > 10000) { // 10秒过期
      controller.abort();
      pendingRequests.delete(key);
    }
  }
}

// 定期清理过期请求
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRequests, 30000); // 每30秒清理一次
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    safeSetItem('token', token);
  }

  getToken() {
    if (!this.token) {
      this.token = safeGetItem('token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    safeRemoveItem('token');
  }

  async request(endpoint: string, options: RequestInit = {}, deduplicate = true) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      // 使用类型断言来设置 Authorization header
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // 请求去重检查
    const method = options.method || 'GET';
    const url = `${API_BASE}${endpoint}`;
    const body = options.body;

    if (deduplicate && method !== 'GET') {
      const requestKey = generateRequestKey(method, endpoint, body);
      const existingController = pendingRequests.get(requestKey);

      if (existingController) {
        throw new Error('Please wait before submitting again.');
      }

      // 创建新的AbortController
      const controller = new AbortController();
      (controller as any).timestamp = Date.now();
      pendingRequests.set(requestKey, controller);

      // 添加abort信号到请求选项
      options.signal = controller.signal;

      // 设置超时清理
      setTimeout(() => {
        pendingRequests.delete(requestKey);
      }, 5000); // 5秒后自动清理
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message || '';
        if (/fetch|network|failed|load/i.test(msg) || err.name === 'TypeError') {
          throw new Error('Network error: the service is temporarily unavailable. Please try again in a moment.');
        }
        throw err;
      }
      throw new Error('An unexpected error occurred while making the request');
    } finally {
      // 清理请求记录
      if (deduplicate && method !== 'GET') {
        const requestKey = generateRequestKey(method, endpoint, body);
        setTimeout(() => {
          pendingRequests.delete(requestKey);
        }, 1000); // 1秒后清理，防止快速重复提交
      }
    }

    if (!response.ok) {
      let errorMessage = 'Request failed';
      if (response.status === 413) {
        errorMessage = 'Uploaded images are too large. Please reduce image size or image count and try again.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      }

      try {
        const body = await response.json();
        errorMessage = body.error || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async post(endpoint: string, data: unknown) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async get(endpoint: string) {
    return this.request(endpoint, {
      method: 'GET',
    });
  }

  async put(endpoint: string, data: unknown) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  async getMe() {
    return this.get('/auth/me');
  }

  async updateProfile(data: { fullName?: string; phone?: string; city?: string }) {
    return this.put('/auth/me', data);
  }
}

export const api = new ApiClient();

// Public (no auth) helper for submitting DMCA complaints
export async function submitComplaint(data: {
  name: string;
  email: string;
  phone?: string;
  infringing_url: string;
  original_work_url?: string;
  description: string;
}) {
  const res = await fetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to submit complaint');
  }

  return res.json();
}
