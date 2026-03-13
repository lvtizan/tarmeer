import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { api } from '../lib/api';

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
  status: 'draft' | 'pending' | 'published' | 'rejected';
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

function mapProject(project: any): DesignerProjectItem {
  return {
    id: String(project.id),
    title: project.title || '',
    description: project.description || '',
    style: project.style || '',
    location: project.location || '',
    area: project.area || '',
    year: project.year || '',
    imageUrls: safelyParseMaybeJSON(project.images),
    productIds: safelyParseMaybeJSON(project.tags).map((tag: any) => String(tag)),
    status: project.status || 'draft',
    rejectionReason: project.rejection_reason || null,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
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

function persistDesigner(updated: Record<string, any>) {
  localStorage.setItem('designer', JSON.stringify(updated));
}

export function DesignerProvider({ children }: { children: ReactNode }) {
  // 从 localStorage 读取初始用户数据
  const getInitialProfile = (): DesignerProfile => {
    if (typeof window === 'undefined') return emptyProfile;
    try {
      const stored = localStorage.getItem('designer');
      if (stored) {
        const data = JSON.parse(stored);
        return {
          fullName: data.full_name || data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          city: data.city || '',
          address: data.address || '',
          bio: data.bio || '',
          avatarUrl: data.avatar_url || data.avatarUrl || '',
          title: data.title || '',
        };
      }
    } catch (e) {
      console.error('Failed to parse designer from localStorage', e);
    }
    return emptyProfile;
  };

  const [profile, setProfileState] = useState<DesignerProfile>(getInitialProfile);
  const [projects, setProjects] = useState<DesignerProjectItem[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // 监听 localStorage 变化（比如邮件验证后更新）
  useEffect(() => {
    const handleStorageChange = () => {
      const newProfile = getInitialProfile();
      if (newProfile.email && newProfile.email !== profile.email) {
        setProfileState(newProfile);
        setProjects([]); // 新用户，清空项目
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // 也检查当前页面内的变化
    const interval = setInterval(() => {
      const stored = localStorage.getItem('designer');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (data.email && data.email !== profile.email) {
            setProfileState(getInitialProfile());
            setProjects([]);
          }
        } catch {}
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
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
      try {
        const stored = localStorage.getItem('designer');
        const data = stored ? JSON.parse(stored) : {};
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
      } catch {}
      return updated;
    });
  }, []);

  const setAvatar = useCallback((url: string) => {
    setProfileState((prev) => {
      const updated = { ...prev, avatarUrl: url };
      try {
        const stored = localStorage.getItem('designer');
        const data = stored ? JSON.parse(stored) : {};
        persistDesigner({
          ...data,
          avatar_url: url,
        });
      } catch {}
      return updated;
    });
  }, []);

  const saveProfile = useCallback(async (payload: ProfilePayload) => {
    const stored = localStorage.getItem('designer');
    const data = stored ? JSON.parse(stored) : {};
    const id = data.id;

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
      avatar_url: profile.avatarUrl,
    });

    const nextDesigner = {
      ...data,
      ...result.designer,
    };
    persistDesigner(nextDesigner);
    setProfileState(getInitialProfile());
  }, [profile.avatarUrl, profile.title]);

  const logout = useCallback(() => {
    api.clearToken();
    localStorage.removeItem('designer');
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
