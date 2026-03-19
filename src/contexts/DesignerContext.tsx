import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { api } from '../lib/api';
import { safeGetJSON, safeSetJSON, safeRemoveItem } from '../lib/storage';
import { UPLOAD_MAX_RETRY_ATTEMPTS, IMAGE_ERROR_RETRY_DELAY_BASE_MS, IMAGE_ERROR_RETRY_MAX_DELAY_MS } from '../lib/constants';

export interface DesignerProfile {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  bio: string;
  avatarUrl: string;
  title: string;
}

export interface DesignerProjectItem {
  id: string;
  title: string;
  description: string;
  style: string;
  location: string;
  area: string;
  year: string;
  imageUrls: string[];
  productIds: string[];
  status: 'draft' | 'pending' | 'published' | 'rejected' | 'uploading' | 'upload_failed';
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type ProjectPayload = Omit<DesignerProjectItem, 'id' | 'rejectionReason' | 'createdAt' | 'updatedAt'>;

type ProfilePayload = DesignerProfile;

// 空的默认值，新用户使用
const emptyProfile: DesignerProfile = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  bio: '',
  avatarUrl: '',
  title: '',
};

type DesignerContextValue = {
  profile: DesignerProfile;
  setProfile: (p: Partial<DesignerProfile>) => void;
  setAvatar: (url: string) => void;
  saveProfile: (p: ProfilePayload) => Promise<void>;
  logout: () => void;
  projects: DesignerProjectItem[];
  isProjectsLoading: boolean;
  projectsError: string | null;
  loadProjects: () => Promise<void>;
  addProject: (p: ProjectPayload) => Promise<DesignerProjectItem>;
  addProjectWithUploadTransition: (p: ProjectPayload, options?: { maxRetries?: number }) => Promise<DesignerProjectItem>;
  updateProject: (id: string, p: ProjectPayload) => Promise<DesignerProjectItem>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => DesignerProjectItem | undefined;
};

const DesignerContext = createContext<DesignerContextValue | null>(null);

function safelyParseMaybeJSON(value: any) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapProject(project: unknown): DesignerProjectItem {
  if (!project || typeof project !== 'object') {
    throw new Error('Invalid project data');
  }

  const p = project as Record<string, unknown>;
  return {
    id: String(p.id ?? ''),
    title: (p.title as string) || '',
    description: (p.description as string) || '',
    style: (p.style as string) || '',
    location: (p.location as string) || '',
    area: (p.area as string) || '',
    year: (p.year as string) || '',
    imageUrls: safelyParseMaybeJSON(p.images),
    productIds: safelyParseMaybeJSON(p.tags).map((tag: unknown) => String(tag)),
    status: ((p.status as string) || 'draft') as DesignerProjectItem['status'],
    rejectionReason: (p.rejection_reason as string | null) || null,
    createdAt: p.created_at as string | undefined,
    updatedAt: p.updated_at as string | undefined,
  };
}

function toApiProjectPayload(project: ProjectPayload) {
  return {
    title: project.title,
    description: project.description,
    style: project.style,
    location: project.location,
    area: project.area,
    year: project.year,
    images: project.imageUrls,
    tags: project.productIds,
    status: project.status,
  };
}

function persistDesigner(updated: Record<string, unknown>) {
  safeSetJSON('designer', updated);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function DesignerProvider({ children }: { children: ReactNode }) {
  // 从 localStorage 读取初始用户数据
  const getInitialProfile = (): DesignerProfile => {
    if (typeof window === 'undefined') return emptyProfile;

    const data = safeGetJSON<Record<string, unknown>>('designer');
    if (!data) return emptyProfile;

    return {
      fullName: (data.full_name as string) || (data.fullName as string) || '',
      email: (data.email as string) || '',
      phone: (data.phone as string) || '',
      city: (data.city as string) || '',
      address: (data.address as string) || '',
      bio: (data.bio as string) || '',
      avatarUrl: (data.avatar_url as string) || (data.avatarUrl as string) || '',
      title: (data.title as string) || '',
    };
  };

  const [profile, setProfileState] = useState<DesignerProfile>(getInitialProfile);
  const [projects, setProjects] = useState<DesignerProjectItem[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // 监听 localStorage 变化（比如邮件验证后更新）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'designer') {
        const newProfile = getInitialProfile();
        if (newProfile.email && newProfile.email !== profile.email) {
          setProfileState(newProfile);
          setProjects([]); // 新用户，清空项目
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [profile.email]);

  const loadProjects = useCallback(async () => {
    if (!api.getToken()) {
      setProjects([]);
      setProjectsError(null);
      return;
    }

    setIsProjectsLoading(true);
    setProjectsError(null);
    try {
      const result = await api.get('/projects/my');
      setProjects((result.projects || []).map(mapProject));
    } catch (error: any) {
      setProjects([]);
      setProjectsError(error.message || 'Failed to load projects');
    } finally {
      setIsProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects, profile.email]);

  const setProfile = useCallback((patch: Partial<DesignerProfile>) => {
    setProfileState((prev) => {
      const updated = { ...prev, ...patch };
      const data = safeGetJSON<Record<string, unknown>>('designer') || {};
      persistDesigner({
        ...data,
        full_name: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        city: updated.city,
        address: updated.address,
        bio: updated.bio,
        avatar_url: updated.avatarUrl,
        title: updated.title,
      });
      return updated;
    });
  }, []);

  const setAvatar = useCallback((url: string) => {
    setProfileState((prev) => {
      const updated = { ...prev, avatarUrl: url };
      const data = safeGetJSON<Record<string, unknown>>('designer') || {};
      persistDesigner({
        ...data,
        avatar_url: url,
      });
      return updated;
    });
  }, []);

  const saveProfile = useCallback(async (payload: ProfilePayload) => {
    const data = safeGetJSON<Record<string, unknown>>('designer');
    const id = data?.id as string | undefined;

    if (!id) {
      throw new Error('Designer session not found. Please log in again.');
    }

    const result = await api.put(`/designers/${id}`, {
      full_name: payload.fullName,
      title: payload.title,
      phone: payload.phone,
      city: payload.city,
      address: payload.address,
      bio: payload.bio,
      avatar_url: payload.avatarUrl,
      style: (data?.style as string) || null,
      expertise: (data?.expertise as string[]) || [],
    });

    const nextDesigner = {
      ...data,
      ...result.designer,
    };
    persistDesigner(nextDesigner);

    // 直接更新状态而不是重新计算
    setProfileState((prev) => ({
      ...prev,
      fullName: (result.designer?.full_name as string) || prev.fullName,
      title: (result.designer?.title as string) || prev.title,
      phone: (result.designer?.phone as string) || prev.phone,
      city: (result.designer?.city as string) || prev.city,
      address: (result.designer?.address as string) || prev.address,
      bio: (result.designer?.bio as string) || prev.bio,
      avatarUrl: (result.designer?.avatar_url as string) || payload.avatarUrl,
    }));
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    safeRemoveItem('designer');
    setProfileState(emptyProfile);
    setProjects([]);
    setProjectsError(null);
  }, []);

  const addProject = useCallback(async (p: ProjectPayload) => {
    const result = await api.post('/projects', toApiProjectPayload(p));
    const nextProject = mapProject(result.project);
    setProjects((prev) => [nextProject, ...prev]);
    return nextProject;
  }, []);

  const addProjectWithUploadTransition = useCallback(async (p: ProjectPayload, options?: { maxRetries?: number }) => {
    const tempId = `temp-upload-${Date.now()}`;
    const optimistic: DesignerProjectItem = {
      id: tempId,
      title: p.title,
      description: p.description,
      style: p.style,
      location: p.location,
      area: p.area,
      year: p.year,
      imageUrls: p.imageUrls,
      productIds: p.productIds,
      status: 'uploading',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects((prev) => [optimistic, ...prev]);

    const maxRetries = Math.max(1, options?.maxRetries ?? UPLOAD_MAX_RETRY_ATTEMPTS);
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await api.post('/projects', toApiProjectPayload(p));
        const nextProject = mapProject(result.project);
        setProjects((prev) => prev.map((project) => (project.id === tempId ? nextProject : project)));
        return nextProject;
      } catch (error) {
        lastError = error;
        // 413（文件过大）或明确的客户端错误无法通过重试解决，立即停止
        const msg = error instanceof Error ? error.message : '';
        const isNonRetryable = msg.includes('too large') || msg.includes('413');
        if (isNonRetryable || attempt >= maxRetries) {
          break;
        }
        const backoffMs = Math.min(IMAGE_ERROR_RETRY_MAX_DELAY_MS, IMAGE_ERROR_RETRY_DELAY_BASE_MS * attempt * attempt);
        await wait(backoffMs);
      }
    }

    setProjects((prev) =>
      prev.map((project) =>
        project.id === tempId
          ? { ...project, status: 'upload_failed', rejectionReason: (lastError instanceof Error ? lastError.message : 'Upload failed.') }
          : project,
      ),
    );
    throw lastError instanceof Error ? lastError : new Error('Upload failed.');
  }, []);

  const updateProject = useCallback(async (id: string, patch: ProjectPayload) => {
    const result = await api.put(`/projects/${id}`, toApiProjectPayload(patch));
    const nextProject = mapProject(result.project);
    setProjects((prev) => prev.map((x) => (x.id === id ? nextProject : x)));
    return nextProject;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await api.delete(`/projects/${id}`);
    setProjects((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const getProject = useCallback(
    (id: string) => projects.find((x) => x.id === id),
    [projects]
  );

  const value: DesignerContextValue = {
    profile,
    setProfile,
    setAvatar,
    saveProfile,
    logout,
    projects,
    isProjectsLoading,
    projectsError,
    loadProjects,
    addProject,
    addProjectWithUploadTransition,
    updateProject,
    deleteProject,
    getProject,
  };

  return (
    <DesignerContext.Provider value={value}>
      {children}
    </DesignerContext.Provider>
  );
}

export function useDesigner() {
  const ctx = useContext(DesignerContext);
  if (!ctx) throw new Error('useDesigner must be used within DesignerProvider');
  return ctx;
}
