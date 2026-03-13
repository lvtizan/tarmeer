// Admin API Client - separate token storage from designer auth
const API_BASE = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? `${window.location.origin}/api`
    : 'http://localhost:3002/api'
);

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

class AdminApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem(ADMIN_TOKEN_KEY);
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as any)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/admin${endpoint}`, {
      ...options,
      headers,
    });

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

  async getProfile(): Promise<{ id: number; email: string; fullName: string; role: string; permissions: any }> {
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
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
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

  // Admin management (super admin only)
  async getAdmins() {
    return this.request('/admins');
  }

  async createSubAdmin(data: { email: string; password: string; fullName: string; permissions?: any }) {
    return this.request('/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdmin(id: number, data: { fullName?: string; permissions?: any; isActive?: boolean }) {
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
