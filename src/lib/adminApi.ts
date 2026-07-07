'use client';
// Admin API Client - separate token storage from designer auth
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

const ADMIN_TOKEN_KEY = 'admin_token';

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: 'super_admin' | 'sub_admin' | 'field_staff';
  permissions: {
    can_approve?: boolean;
    can_sort?: boolean;
    can_view_stats?: boolean;
    can_view_interviews?: boolean;
    can_manage_field_staff?: boolean;
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
  visitsLast30d: number;
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
    if (process.env.NODE_ENV === 'development') {
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
          const devMessage = `无法连接后端接口 ${requestUrl}。请检查：1) 后端服务是否已启动；2) NEXT_PUBLIC_API_URL 是否配置正确；3) 是否被 CORS 或代理拦截。`;
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
      // 403 Forbidden: always show the actual server message (e.g. "Super admin privileges required")
      if (response.status === 403 && serverError) {
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

  async globalSearch(q: string): Promise<{
    homeownerLeads: Array<{ id: number; name: string; phone: string; city: string; source: string; crmStatus: string; type: 'homeowner'; createdAt: string }>;
    companyLeads: Array<{ id: number; name: string; phone: string; city: string; companyName: string; channel: string; companyType: string; crmStatus: string; type: 'company'; createdAt: string }>;
    users: Array<{ id: number; name: string; phone: string; email: string; role: string; status: string; source: string; createdAt: string }>;
    registeredCompanies: Array<{ id: number; name: string; phone: string; city: string; status: string; email: string; type: 'registered' }>;
    directoryCompanies: Array<{ id: number; name: string; phone: string; city: string; type: 'directory' }>;
    suppliers: Array<{ id: number; name: string; email: string; origin: string; status: string }>;
  }> {
    const params = new URLSearchParams({ q });
    return this.request(`/search?${params}`);
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

  async getRejectionTemplates(): Promise<{ templates: Array<{ id: number; text: string; use_count: number; last_used_at: string }> }> {
    return this.request('/rejection-templates');
  }

  // Stats
  async getRegistrationStats(days = 30) {
    return this.request(`/stats/registrations?days=${days}`);
  }

  async getDailyStats(days = 30, country?: string) {
    const query = new URLSearchParams({ days: String(days) });
    if (country) query.set('country', country);
    return this.request(`/stats/daily?${query.toString()}`);
  }

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

  async getVisitorOverview(country?: string): Promise<VisitorOverview> {
    const query = new URLSearchParams();
    if (country) query.set('country', country);
    const qs = query.toString();
    return this.request(`/visitors/overview${qs ? `?${qs}` : ''}`);
  }

  async getDailyRegistrations(params: { startDate?: string; endDate?: string } = {}): Promise<{
    dailyRegistrations: Array<{ stat_date: string; homeowner_count: number; company_count: number }>;
    dateRange: { start: string; end: string };
  }> {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    return this.request(`/analytics/daily-registrations?${query.toString()}`);
  }

  async getVisitors(params: { page?: number; limit?: number; country?: string } = {}): Promise<{
    visitors: VisitorRecord[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.country) query.set('country', params.country);
    return this.request(`/visitors?${query.toString()}`);
  }

  async getCompanyVisitors(params: { startDate?: string; endDate?: string; country?: string } = {}): Promise<{
    companies: Array<{
      page_path: string;
      company_name: string;
      slug: string;
      unique_visitors: number;
      total_views: number;
      cities: Array<{ city: string; visitors: number }>;
    }>;
    dateRange: { start: string; end: string };
  }> {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.country) query.set('country', params.country);
    return this.request(`/analytics/company-visitors?${query.toString()}`);
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

  async getDailyVisits(params: { startDate?: string; endDate?: string; country?: string } = {}): Promise<{
    dailyVisits: Array<{ stat_date: string; page_views: number; unique_visitors: number }>;
    dateRange: { start: string; end: string };
  }> {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.country) query.set('country', params.country);
    return this.request(`/analytics/daily-visits?${query.toString()}`);
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

  async getAnalyticsDashboard(period: '7d' | '30d' | '90d' = '30d') {
    return this.request(`/analytics/dashboard?period=${period}`);
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
  async getUsers(params?: { page?: number; limit?: number; role?: string; status?: string; search?: string; country?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.role) query.set('role', params.role);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.country) query.set('country', params.country);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  async getUserPermissions(id: number): Promise<{ permissions: string[]; available: string[] }> {
    return this.request(`/users/${id}/permissions`);
  }

  async updateUserPermissions(id: number, permissions: string[]): Promise<{ message: string; permissions: string[] }> {
    return this.request(`/users/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  // Inquiry management
  async getInquiries(params?: { page?: number; limit?: number; status?: string; search?: string; deleted?: boolean; type?: string; country?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.deleted) query.set('deleted', 'true');
    if (params?.type) query.set('type', params.type);
    if (params?.country) query.set('country', params.country);
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

  async resendInquiryCrm(id: number) {
    return this.request(`/inquiries/${id}/resend-crm`, {
      method: 'POST',
    });
  }

  getInquiriesExportUrl(params?: { status?: string; country?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.country) query.set('country', params.country);
    const token = this.getToken();
    if (token) query.set('token', token);
    return `${API_BASE}/admin/inquiries/export?${query.toString()}`;
  }

  // Company management
  async getCompanies(params?: { page?: number; limit?: number; claimed?: string; search?: string; sort_by?: string; sort_dir?: string; country?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.claimed) query.set('claimed', params.claimed);
    if (params?.search) query.set('search', params.search);
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.sort_dir) query.set('sort_dir', params.sort_dir);
    if (params?.country) query.set('country', params.country);
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

  async getRegisteredCompanies(params?: { page?: number; limit?: number; status?: string; company_type?: string; search?: string; sort_by?: string; sort_dir?: string; country?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.company_type) query.set('company_type', params.company_type);
    if (params?.search) query.set('search', params.search);
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.sort_dir) query.set('sort_dir', params.sort_dir);
    if (params?.country) query.set('country', params.country);
    return this.request(`/roles/companies?${query.toString()}`);
  }

  async getCompanyProfileDetail(id: number) {
    return this.request(`/roles/companies/${id}/full-detail`);
  }

  async bulkUnapproveCompanies(ids: number[]) {
    return this.request('/roles/companies/bulk-unapprove', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
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

  async setCompanyCoverImage(id: number, url: string | null) {
    return this.request(`/roles/companies/${id}/cover-image`, {
      method: 'PUT',
      body: JSON.stringify({ url }),
    });
  }

  async setDirectoryCompanyCoverImage(id: number, url: string | null) {
    return this.request(`/companies/${id}/cover-image`, {
      method: 'PUT',
      body: JSON.stringify({ url }),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAdminProject(companyId: string, projectId: string) {
    return this.request(`/roles/companies/${companyId}/projects/${projectId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateAdminProject(companyId: string, projectId: string, data: any) {
    return this.request(`/roles/companies/${companyId}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // UAE directory company project management (delegates to linked profile)
  async getUAECompanyProject(companyId: string, projectId: string) {
    return this.request(`/companies/${companyId}/projects/${projectId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateUAECompanyProject(companyId: string, projectId: string, data: any) {
    return this.request(`/companies/${companyId}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async deleteUAECompanyProject(companyId: string, projectId: string) {
    return this.request(`/companies/${companyId}/projects/${projectId}`, { method: 'DELETE' });
  }

  async getSignedCompanies(country?: string): Promise<{
    companies: Array<{
      id: number; slug: string; company_name: string; company_type: string;
      city: string | null; logo_url: string | null; weight_score: number;
      created_at: string; source: 'profile' | 'scraped';
    }>;
    total: number;
  }> {
    const query = new URLSearchParams();
    if (country) query.set('country', country);
    const qs = query.toString();
    return this.request(`/signed-companies${qs ? `?${qs}` : ''}`);
  }

  async setSupplierHomeOrder(id: number, displayOrder: number) {
    return this.request(`/suppliers/${id}/home-order`, {
      method: 'PUT',
      body: JSON.stringify({ home_display_order: displayOrder }),
    });
  }

  async setSupplierListOrder(id: number, displayOrder: number) {
    return this.request(`/suppliers/${id}/list-order`, {
      method: 'PUT',
      body: JSON.stringify({ list_display_order: displayOrder }),
    });
  }

  async replaceSupplierProductImage(supplierId: number | string, productId: number | string, file: File): Promise<{ id: number; image_url: string }> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const url = `${API_BASE}/admin/suppliers/${supplierId}/products/${productId}/image`;
    const token = this.getToken();
    const res = await fetch(url, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  }

  // Complaint management
  async getComplaints(params?: { page?: number; limit?: number; status?: string; search?: string; country?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.country) query.set('country', params.country);
    return this.request(`/complaints?${query}`);
  }

  async updateComplaintStatus(id: number, status: string, adminNotes?: string) {
    return this.request(`/complaints/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: adminNotes }),
    });
  }

  // Notification counts
  async getNotificationCounts(country?: string) {
    const qs = country ? `?country=${country}` : '';
    return this.request(`/notifications/counts${qs}`);
  }

  async markNotificationSeen(page: string) {
    return this.request(`/notifications/mark-seen?page=${page}`, { method: 'PUT' });
  }

  // Weight system
  async toggleCompanySigned(id: number, isSigned: boolean) {
    return this.request(`/roles/companies/${id}/toggle-signed`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_signed: isSigned }),
    });
  }

  async toggleDirectorySigned(id: number, isSigned: boolean) {
    return this.request(`/companies/${id}/toggle-signed`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_signed: isSigned }),
    });
  }

  // 普通认证（¥1000，与 VIP 并存）
  async toggleCompanyCertified(id: number, isCertified: boolean) {
    return this.request(`/roles/companies/${id}/toggle-certified`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_certified: isCertified }),
    });
  }

  async toggleDirectoryCertified(id: number, isCertified: boolean) {
    return this.request(`/companies/${id}/toggle-certified`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_certified: isCertified }),
    });
  }

  async getPhoneRevealStats(params: { country?: string; days?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.country) qs.set('country', params.country);
    if (params.days) qs.set('days', String(params.days));
    return this.request(`/analytics/phone-reveals?${qs.toString()}`);
  }

  // Unpublish toggles
  async toggleCompanyPublished(id: number, isPublished: boolean) {
    return this.request(`/roles/companies/${id}/toggle-published`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished }),
    });
  }

  async toggleDirectoryPublished(id: number, isPublished: boolean) {
    return this.request(`/companies/${id}/toggle-published`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished }),
    });
  }

  async toggleProjectPublished(companyId: number, projectId: number, isPublished: boolean) {
    return this.request(`/roles/companies/${companyId}/projects/${projectId}/toggle-published`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished }),
    });
  }

  async toggleSupplierPublished(id: number, isPublished: boolean) {
    return this.request(`/suppliers/${id}/toggle-published`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished }),
    });
  }

  async toggleSupplierProjectPublished(supplierId: number, projectId: number, isPublished: boolean) {
    return this.request(`/suppliers/${supplierId}/projects/${projectId}/toggle-published`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: isPublished }),
    });
  }

  async getWeightConfig(): Promise<{ configs: Array<{ key: string; value: number; updated_at: string }> }> {
    return this.request('/weight-config');
  }

  async updateWeightConfig(key: string, value: number) {
    return this.request(`/weight-config/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  }

  async triggerWeightRecalculation(): Promise<{ message: string; updated: number }> {
    return this.request('/weight-config/recalculate', { method: 'POST' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getActivityLog(params: { page?: number; limit?: number; role?: string; action?: string; search?: string; start_date?: string; end_date?: string } = {}): Promise<{ logs: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return this.request(`/activity-log?${qs.toString()}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getActivityLogStats(days?: number): Promise<{ today: any; action_distribution: any[]; daily_trend: any[] }> {
    return this.request(`/activity-log/stats${days ? `?days=${days}` : ''}`);
  }

  getActivityLogExportUrl(params: { role?: string; action?: string; start_date?: string; end_date?: string } = {}): string {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const base = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
    return `${base}/admin/activity-log/export?${qs.toString()}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTopActiveUsers(days?: number): Promise<{ users: any[] }> {
    return this.request(`/activity-log/top-users${days ? `?days=${days}` : ''}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getUserTimeline(userId: number, params: { role?: string; page?: number; limit?: number } = {}): Promise<{ logs: any[]; summary: any; pagination: any }> {
    const qs = new URLSearchParams();
    if (params.role) qs.set('role', params.role);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return this.request(`/activity-log/user/${userId}${query ? `?${query}` : ''}`);
  }

  async getRegistrationSources(country?: string): Promise<{ signup_sources: Array<{ source: string; count: number }>; company_types: Array<{ type: string; count: number }>; company_cities?: Array<{ city: string; count: number }>; inquiry_cities?: Array<{ city: string; count: number }>; visitor_cities?: Array<{ city: string; count: number }>; homeowner_cities?: Array<{ city: string; count: number }>; company_type_cities?: Array<{ type: string; count: number; topCities: Array<{ city: string; count: number }> }> }> {
    const query = new URLSearchParams();
    if (country) query.set('country', country);
    const qs = query.toString();
    return this.request(`/stats/registration-sources${qs ? `?${qs}` : ''}`);
  }

  // Partner sync review
  async getPartnerSyncProducts(country?: string) {
    const qs = new URLSearchParams({ status: 'pending' });
    if (country) qs.set('country', country);
    return this.request(`/partner-sync/products?${qs}`);
  }
  async getPartnerSyncCompanies(country?: string) {
    const qs = new URLSearchParams({ status: 'pending' });
    if (country) qs.set('country', country);
    return this.request(`/partner-sync/companies?${qs}`);
  }
  async approvePartnerProduct(id: number) {
    return this.request(`/partner-sync/products/${id}/approve`, { method: 'POST' });
  }
  async rejectPartnerProduct(id: number) {
    return this.request(`/partner-sync/products/${id}/reject`, { method: 'POST' });
  }
  async approvePartnerCompany(id: number) {
    return this.request(`/partner-sync/companies/${id}/approve`, { method: 'POST' });
  }
  async rejectPartnerCompany(id: number) {
    return this.request(`/partner-sync/companies/${id}/reject`, { method: 'POST' });
  }

  // Field interviews (admin view)
  async getInterviews(country?: string) {
    const qs = country ? `?country=${country}` : '';
    return this.request(`/interviews${qs}`);
  }
  async getInterview(id: number) {
    return this.request(`/interviews/${id}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateInterview(id: number, data: Record<string, any>) {
    return this.request(`/interviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteInterviews(ids: number[]) {
    return this.request('/interviews', { method: 'DELETE', body: JSON.stringify({ ids }) });
  }

  // Field staff management
  async getStaff(country?: string) {
    const qs = country ? `?country=${country}` : '';
    return this.request(`/staff${qs}`);
  }
  async createStaff(data: { email: string; password: string; fullName: string; country?: string }) {
    return this.request('/staff', { method: 'POST', body: JSON.stringify(data) });
  }
  async toggleStaff(id: number, is_active: boolean) {
    return this.request(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
  }
  async updateStaffPermissions(id: number, permissions: Record<string, boolean>) {
    return this.request(`/staff/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions }) });
  }

  // Expert management
  async getExperts(params: { country?: string; status?: string; search?: string } = {}): Promise<{
    experts: Array<{
      id: number; slug: string; full_name: string; avatar_url: string | null;
      services: string[]; city: string | null; phone: string | null;
      user_email: string | null; status: 'pending' | 'approved' | 'rejected';
      country: string; is_certified: boolean; is_signed: boolean;
      certificates: string[]; license_url: string | null;
      experience_years: number | null; created_at: string;
    }>;
  }> {
    const query = new URLSearchParams();
    if (params.country) query.set('country', params.country);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    return this.request(`/experts${qs ? `?${qs}` : ''}`);
  }

  async updateExpertStatus(id: number, status: 'approved' | 'rejected' | 'pending') {
    return this.request(`/experts/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async toggleExpertCertified(id: number, isCertified: boolean) {
    return this.request(`/experts/${id}/toggle-certified`, {
      method: 'PUT',
      body: JSON.stringify({ is_certified: isCertified }),
    });
  }

  async toggleExpertSigned(id: number, isSigned: boolean) {
    return this.request(`/experts/${id}/toggle-signed`, {
      method: 'PUT',
      body: JSON.stringify({ is_signed: isSigned }),
    });
  }
}

export const adminApi = new AdminApiClient();

const FIELD_API_BASE = '/api/field';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fieldRequest(path: string, options: RequestInit = {}): Promise<any> {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('field_token') || localStorage.getItem('admin_token'))
    : null;
  const res = await fetch(`${FIELD_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const fieldApi = {
  createDraft: () => fieldRequest('/interviews', { method: 'POST' }),
  getDraft: (id: number) => fieldRequest(`/interviews/draft?id=${id}`),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveDraft: (id: number, data: Record<string, any>) =>
    fieldRequest(`/interviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submit: (id: number) =>
    fieldRequest(`/interviews/${id}/submit`, { method: 'POST' }),
  searchCompanies: (q: string, country?: string) =>
    fieldRequest(`/companies/search?q=${encodeURIComponent(q)}${country ? `&country=${country}` : ''}`),
  getSurveySchema: () => fieldRequest('/survey-schema'),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('field_token');
      localStorage.removeItem('field_user');
    }
  },
  loadInterview: (id: number) => fieldRequest(`/interviews/${id}/load`),
  reSubmit: (id: number, data: Record<string, unknown>) =>
    fieldRequest(`/interviews/${id}/re-submit`, { method: 'POST', body: JSON.stringify(data) }),
  uploadPhoto: async (id: number, blob: Blob, meta?: { lat?: number; lng?: number; timestamp?: string; field_key?: string | null }): Promise<{ url: string }> => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('field_token') || localStorage.getItem('admin_token'))
      : null;
    const fd = new FormData();
    fd.append('photo', blob, `photo-${Date.now()}.jpg`);
    if (meta?.lat !== undefined) fd.append('lat', String(meta.lat));
    if (meta?.lng !== undefined) fd.append('lng', String(meta.lng));
    if (meta?.timestamp) fd.append('timestamp', meta.timestamp);
    if (meta?.field_key) fd.append('field_key', meta.field_key);
    const res = await fetch(`${FIELD_API_BASE}/interviews/${id}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
  uploadAttachment: async (id: number, file: File, fieldKey?: string | null): Promise<{ url: string; name: string; type: string; size: number }> => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('field_token') || localStorage.getItem('admin_token'))
      : null;
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (fieldKey) fd.append('field_key', fieldKey);
    const res = await fetch(`${FIELD_API_BASE}/interviews/${id}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
};
