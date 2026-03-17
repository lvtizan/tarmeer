function resolveApiBase() {
  const envBase = import.meta.env.VITE_API_URL?.trim();
  if (envBase) {
    return envBase;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3002/api';
  }

  if (import.meta.env.PROD) {
    return `${window.location.origin}/api`;
  }

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${window.location.protocol}//${host}:3002/api`;
  }

  return `${window.location.origin}/api`;
}

const API_BASE = resolveApiBase();

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
        throw new Error('Network error: the service is temporarily unavailable. Please try again in a moment.');
      }
      throw err;
    }

    if (!response.ok) {
      let errorMessage = 'Request failed';
      if (response.status === 413) {
        errorMessage = 'Uploaded images are too large. Please reduce image size or image count and try again.';
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
