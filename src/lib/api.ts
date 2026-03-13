// 动态 API 地址：本地开发用 localhost，生产环境用当前域名
const API_BASE = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? `${window.location.origin}/api`  // 生产环境：使用当前页面域名
    : 'http://localhost:3002/api'       // 本地开发：用后端端口
);

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as any)['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err: any) {
      const msg = err?.message || '';
      if (/fetch|network|failed|load/i.test(msg) || err?.name === 'TypeError') {
        throw new Error('Network error: registration service is unavailable. Please try again later or contact support.');
      }
      throw err;
    }

    if (!response.ok) {
      let errorMessage = 'Request failed';
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

  async post(endpoint: string, data: any) {
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

  async put(endpoint: string, data: any) {
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
}

export const api = new ApiClient();
