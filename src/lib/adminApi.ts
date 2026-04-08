// Admin API Client - separate token storage from designer auth
import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

function resolveApiBase() {
  return import.meta.env.VITE_API_URL?.trim() || '/api';
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

export interface AnalyticsOverview {
  total_events: number;
  unique_visitors: number;
  page_views: number;
  apply_clicks: number;
  whatsapp_clicks: number;
  contact_submits: number;
}

export interface AnalyticsEventRecord {
  id: number;
  event_name: string;
  page_path: string | null;
  viewer_ip: string | null;
  location_label: string | null;
  referrer: string | null;
  user_agent: string | null;
  payload: string | null;
  created_at: string;
}

class AdminApiClient {
  private token: string | null = null;
  private static readonly AUTH_PUBLIC_ENDPOINTS = new Set([
    '/login',
    '/install',
    '/check-installation',
    '/forgot-password',
    '/reset-password',
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

  private getDevelopmentErrorMessage(originalError: string, _requestUrl: string): string {
    if (import.meta.env.DEV) {
      return originalError;
    }
    // Production-friendly generic error message
    return 'Unable to connect to the server. Please try again later or contact support if the problem persists.';
  }

  async request(endpoint: string, options: RequestInit = {}) {
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
          const devMessage = `无法连接后端接口 ${requestUrl}。请检查：1) 后端服务是否已启动（http://localhost:3002）；2) VITE_API_URL 是否配置正确；3) 是否被 CORS 或代理拦截。`;
          throw new Error(this.getDevelopmentErrorMessage(devMessage, requestUrl));
        }
        throw err;
      }
      const devMessage = `请求 ${requestUrl} 时发生未知错误。`;
      throw new Error(this.getDevelopmentErrorMessage(devMessage, requestUrl));
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText || 'Request failed'}`;
      let serverError = '';
      try {
        const body = await response.json();
        if (body.error) {
          serverError = body.error;
          errorMessage = `${body.error}（HTTP ${response.status}）`;
        }
      } catch {
        // Keep status-based message when response body is not JSON.
      }
      if (response.status === 401) {
        this.handleUnauthorized(endpoint, errorMessage);
      }
      // For auth endpoints, show the server's actual error (e.g. "Invalid email or password")
      const isPublicEndpoint = AdminApiClient.AUTH_PUBLIC_ENDPOINTS.has(endpoint);
      if (isPublicEndpoint && serverError) {
        throw new Error(serverError);
      }
      if (response.status === 409 && serverError) {
        throw new Error(serverError);
      }
      const devMessage = `接口 /admin${endpoint} 请求失败：${errorMessage}`;
      throw new Error(this.getDevelopmentErrorMessage(devMessage, requestUrl));
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

  async forgotPassword(email: string) {
    return this.request('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
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

  async bulkDeleteDesigners(designerIds: number[], reason: string) {
    return this.request('/designers/bulk-delete', {
      method: 'PUT',
      body: JSON.stringify({ designerIds, reason }),
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

  async getAnalyticsOverview(params: { startDate?: string; endDate?: string } = {}): Promise<{
    overview: AnalyticsOverview;
    topPages: Array<{ page_path: string; page_views: number; visitors: number }>;
    dateRange: { start: string; end: string };
  }> {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    return this.request(`/analytics/overview?${query.toString()}`);
  }

  async getAnalyticsEvents(params: {
    page?: number;
    limit?: number;
    eventName?: string;
    pagePath?: string;
  } = {}): Promise<{
    events: AnalyticsEventRecord[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.eventName) query.set('eventName', params.eventName);
    if (params.pagePath) query.set('pagePath', params.pagePath);
    return this.request(`/analytics/events?${query.toString()}`);
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

  // User management
  async getUsers(params?: { page?: number; limit?: number; role?: string; status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.role) query.set('role', params.role);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return this.request(`/users?${query.toString()}`);
  }

  async getUserDetail(id: number) {
    return this.request(`/users/${id}`);
  }

  async updateUserStatus(id: number, status: 'active' | 'suspended') {
    return this.request(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  }

  async updateUserRole(id: number, role: 'user' | 'designer' | 'company') {
    return this.request(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
  }

  async editUser(id: number, data: Record<string, any>) {
    return this.request(`/users/${id}/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: number, reason: string) {
    return this.request(`/users/${id}/delete`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async restoreUser(id: number) {
    return this.request(`/users/${id}/restore`, {
      method: 'POST',
    });
  }

  // Inquiry management
  async getInquiries(params?: { page?: number; limit?: number; status?: string; search?: string; deleted?: boolean }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.deleted) query.set('deleted', 'true');
    return this.request(`/inquiries?${query.toString()}`);
  }

  async batchDeleteInquiries(ids: number[], reason: string) {
    return this.request('/inquiries/batch-delete', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, reason }),
    });
  }

  async batchRestoreInquiries(ids: number[]) {
    return this.request('/inquiries/batch-restore', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  }

  async updateInquiryStatus(id: number, status: string, adminNotes?: string) {
    return this.request(`/inquiries/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: adminNotes }),
    });
  }

  getInquiriesExportUrl(params?: { status?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    const token = this.getToken();
    if (token) query.set('token', token);
    return `${API_BASE}/admin/inquiries/export?${query.toString()}`;
  }

  // Company management
  async getCompanies(params?: { page?: number; limit?: number; claimed?: string; search?: string; sort_by?: string; sort_dir?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.claimed) query.set('claimed', params.claimed);
    if (params?.search) query.set('search', params.search);
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.sort_dir) query.set('sort_dir', params.sort_dir);
    return this.request(`/companies?${query.toString()}`);
  }

  async updateDirectoryHomeDisplayOrder(companyId: number, displayOrder: number) {
    return this.request(`/companies/${companyId}/home-display-order`, {
      method: 'PUT',
      body: JSON.stringify({ home_display_order: displayOrder }),
    });
  }

  async updateDirectoryListDisplayOrder(companyId: number, displayOrder: number) {
    return this.request(`/companies/${companyId}/list-display-order`, {
      method: 'PUT',
      body: JSON.stringify({ list_display_order: displayOrder }),
    });
  }

  async getRegisteredCompanies(params?: { page?: number; limit?: number; status?: string; company_type?: string; search?: string; sort_by?: string; sort_dir?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.company_type) query.set('company_type', params.company_type);
    if (params?.search) query.set('search', params.search);
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.sort_dir) query.set('sort_dir', params.sort_dir);
    return this.request(`/roles/companies?${query.toString()}`);
  }

  async getCompanyProfileDetail(id: number) {
    return this.request(`/roles/companies/${id}/full-detail`);
  }

  async approveCompanyProfile(id: number) {
    return this.request(`/roles/companies/${id}/approve`, { method: 'POST' });
  }

  async rejectCompanyProfile(id: number, reason: string) {
    return this.request(`/roles/companies/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  async updateCompanyProfileDisplayOrder(id: number, displayOrder: number) {
    return this.request(`/roles/companies/${id}/display-order`, {
      method: 'PUT',
      body: JSON.stringify({ display_order: displayOrder }),
    });
  }

  async updateCompanyProfileHomeDisplayOrder(id: number, displayOrder: number) {
    return this.request(`/roles/companies/${id}/home-display-order`, {
      method: 'PUT',
      body: JSON.stringify({ home_display_order: displayOrder }),
    });
  }

  async updateCompanyProfileListDisplayOrder(id: number, displayOrder: number) {
    return this.request(`/roles/companies/${id}/list-display-order`, {
      method: 'PUT',
      body: JSON.stringify({ list_display_order: displayOrder }),
    });
  }

  async deleteCompanyProfile(id: number, reason: string) {
    return this.request(`/roles/companies/${id}/delete`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async restoreCompanyProfile(id: number) {
    return this.request(`/roles/companies/${id}/restore`, {
      method: 'POST',
    });
  }

  async getHomeOrderCount(): Promise<{ count: number; max: number }> {
    return this.request('/home-order-count');
  }

  async getCompanyApplications(params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    return this.request(`/company-applications?${query.toString()}`);
  }

  async reviewCompanyApplication(id: number, data: { status: 'approved' | 'rejected'; admin_notes?: string }) {
    return this.request(`/company-applications/${id}/review`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async bindUserToCompany(companyId: number, userId: number) {
    return this.request(`/companies/${companyId}/bind`, { method: 'POST', body: JSON.stringify({ userId }) });
  }

  async unbindCompany(companyId: number) {
    return this.request(`/companies/${companyId}/bind`, { method: 'DELETE' });
  }

  async getCompanyFullDetail(companyId: number) {
    return this.request(`/companies/${companyId}/full-detail`);
  }

  // Project management (registered companies)
  async getAdminProject(companyId: string, projectId: string) {
    return this.request(`/roles/companies/${companyId}/projects/${projectId}`);
  }

  async updateAdminProject(companyId: string, projectId: string, data: any) {
    return this.request(`/roles/companies/${companyId}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async createAdminProject(companyId: string, data: any) {
    return this.request(`/roles/companies/${companyId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async deleteAdminProject(companyId: string, projectId: string) {
    return this.request(`/roles/companies/${companyId}/projects/${projectId}`, { method: 'DELETE' });
  }

  async restoreAdminProject(companyId: string, projectId: string) {
    return this.request(`/roles/companies/${companyId}/projects/${projectId}/restore`, { method: 'PUT' });
  }

  // Complaint management
  async getComplaints(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return this.request(`/complaints?${query}`);
  }

  async updateComplaintStatus(id: number, status: string, adminNotes?: string) {
    return this.request(`/complaints/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: adminNotes }),
    });
  }

  // Notification counts
  async getNotificationCounts() {
    return this.request('/notifications/counts');
  }

  async markNotificationSeen(page: string) {
    return this.request(`/notifications/mark-seen?page=${page}`, { method: 'PUT' });
  }
}

export const adminApi = new AdminApiClient();
