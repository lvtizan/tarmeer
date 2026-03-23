// Admin API Client - separate token storage from designer auth
import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

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

const ADMIN_TOKEN_KEY = 'admin_token';

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: 'super_admin' | 'sub_admin';
  permissions: {
    can_approve?: boolean;
    can_sort?: boolean;
    can_view_stats?: boolean;
  } | null;
}

export interface Designer {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  style: string | null;
  expertise: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  is_approved: boolean;
  display_order: number;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by_admin_id?: number | null;
  delete_reason?: string | null;
  total_profile_views?: number;
  total_contact_clicks?: number;
  project_count?: number;
}

export interface AdminDesignerProject {
  id: number;
  title: string;
  description?: string | null;
  style: string | null;
  location: string | null;
  year?: string | null;
  images: string[];
  tags: string[];
  status: 'draft' | 'pending' | 'published' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminDesignerDetail {
  designer: Designer & {
    bio?: string | null;
    address?: string | null;
  };
  projects: AdminDesignerProject[];
  stats: {
    total_profile_views: number;
    total_project_views: number;
    total_contact_clicks: number;
    total_phone_clicks: number;
    total_whatsapp_clicks: number;
  };
  recentStats: Array<{
    stat_date: string;
    profile_views: number;
    project_views: number;
    contact_clicks: number;
    phone_clicks: number;
    whatsapp_clicks: number;
  }>;
}

export interface VisitorOverview {
  totalVisits: number;
  uniqueIpCount: number;
}

export interface VisitorRecord {
  ip: string;
  location: string;
  visitCount: number;
  lastVisitedAt: string;
  isPublicIp: boolean;
}

class AdminApiClient {
  private token: string | null = null;
  private static readonly AUTH_PUBLIC_ENDPOINTS = new Set([
    '/login',
    '/install',
    '/check-installation',
  ]);

  setToken(token: string) {
    this.token = token;
    safeSetItem(ADMIN_TOKEN_KEY, token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = safeGetItem(ADMIN_TOKEN_KEY);
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    safeRemoveItem(ADMIN_TOKEN_KEY);
  }

  private handleUnauthorized(endpoint: string, errorMessage: string) {
    const isPublicEndpoint = AdminApiClient.AUTH_PUBLIC_ENDPOINTS.has(endpoint);
    if (isPublicEndpoint) return;

    const tokenRelated401 = /authentication token|invalid authentication token|admin id not found|admin not found|not authenticated|token/i.test(
      errorMessage
    );
    if (!tokenRelated401) return;

    this.clearToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/admin/login') {
      window.location.assign('/admin/login?reason=session_expired');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const requestUrl = `${API_BASE}/admin${endpoint}`;
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        ...options,
        headers,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message || '';
        if (/fetch|network|failed|load/i.test(msg) || err.name === 'TypeError') {
          throw new Error(
            `无法连接后端接口 ${requestUrl}。请检查：1) 后端服务是否已启动（http://localhost:3002）；2) VITE_API_URL 是否配置正确；3) 是否被 CORS 或代理拦截。`
          );
        }
        throw err;
      }
      throw new Error(`请求 ${requestUrl} 时发生未知错误。`);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText || 'Request failed'}`;
      try {
        const body = await response.json();
        if (body.error) {
          errorMessage = `${body.error}（HTTP ${response.status}）`;
        }
      } catch {
        // Keep status-based message when response body is not JSON.
      }
      if (response.status === 401) {
        this.handleUnauthorized(endpoint, errorMessage);
      }
      throw new Error(`接口 /admin${endpoint} 请求失败：${errorMessage}`);
    }

    return response.json();
  }

  // Installation
  async checkInstallation() {
    return this.request('/check-installation');
  }

  async install(data: { email: string; password: string; fullName: string }) {
    const result = await this.request('/install', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result.token) {
      this.setToken(result.token);
    }
    return result;
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.token) {
      this.setToken(result.token);
    }
    return result;
  }

  async getProfile(): Promise<{ id: number; email: string; fullName: string; role: string; permissions: AdminUser['permissions'] | null }> {
    return this.request('/profile');
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async logout() {
    this.clearToken();
  }

  // Designers
  async getDesigners(params: {
    status?: string;
    search?: string;
    deleted?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.deleted) query.set('deleted', params.deleted);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    
    return this.request(`/designers?${query.toString()}`);
  }

  async getDesigner(id: number): Promise<AdminDesignerDetail> {
    return this.request(`/designers/${id}`);
  }

  async approveDesigner(id: number) {
    return this.request(`/designers/${id}/approve`, { method: 'PUT' });
  }

  async rejectDesigner(id: number, reason: string) {
    return this.request(`/designers/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async deleteDesigner(id: number, reason: string) {
    return this.request(`/designers/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  async restoreDesigner(id: number) {
    return this.request(`/designers/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async bulkApproveDesigners(designerIds: number[]) {
    return this.request('/designers/bulk-approve', {
      method: 'PUT',
      body: JSON.stringify({ designerIds }),
    });
  }

  async updateDesignerOrder(orders: { id: number; displayOrder: number }[]) {
    return this.request('/designers/order', {
      method: 'PUT',
      body: JSON.stringify({ orders }),
    });
  }

  async approveProject(projectId: number) {
    return this.request(`/projects/${projectId}/approve`, { method: 'PUT' });
  }

  async rejectProject(projectId: number, reason: string) {
    return this.request(`/projects/${projectId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  // Stats
  async getStatsOverview(startDate?: string, endDate?: string) {
    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    return this.request(`/stats/overview?${query.toString()}`);
  }

  async getActivityLogs(params: { page?: number; limit?: number; adminId?: number; action?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.adminId) query.set('adminId', String(params.adminId));
    if (params.action) query.set('action', params.action);
    return this.request(`/activity-logs?${query.toString()}`);
  }

  async getVisitorOverview(): Promise<VisitorOverview> {
    return this.request('/visitors/overview');
  }

  async getVisitors(params: { page?: number; limit?: number } = {}): Promise<{
    visitors: VisitorRecord[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return this.request(`/visitors?${query.toString()}`);
  }

  // Admin management (super admin only)
  async getAdmins() {
    return this.request('/admins');
  }

  async createSubAdmin(data: { email: string; password: string; fullName: string; permissions?: AdminUser['permissions'] }) {
    return this.request('/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdmin(id: number, data: { fullName?: string; permissions?: AdminUser['permissions']; isActive?: boolean }) {
    return this.request(`/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdmin(id: number) {
    return this.request(`/admins/${id}`, { method: 'DELETE' });
  }
}

export const adminApi = new AdminApiClient();
