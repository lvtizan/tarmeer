/**
 * Google One Tap 登录组件
 * 检测到用户已登录 Google 账号时，自动弹出快速登录弹窗
 * 如果用户已登录 Tarmeer，则不弹出
 */
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

// 不弹 One Tap 的页面
const EXCLUDED_PATHS = ['/auth', '/login', '/register', '/designer/'];

export default function GoogleOneTap() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    // 已登录，不弹
    if (api.getToken()) return;

    // 排除的页面不弹
    if (EXCLUDED_PATHS.some((p) => location.pathname.startsWith(p))) return;

    // 没有 Client ID，不弹
    if (!GOOGLE_CLIENT_ID) return;

    // 避免重复初始化
    if (initialized.current) return;
    initialized.current = true;

    // 加载 Google Identity Services SDK
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!(window as any).google?.accounts?.id) return;

      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,       // 自动选择已登录的账号
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
      });

      (window as any).google.accounts.id.prompt();
    };

    document.head.appendChild(script);

    return () => {
      // 清理：取消 One Tap 弹窗
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.cancel();
      }
      initialized.current = false;
    };
  }, [location.pathname]);

  async function handleCredentialResponse(response: { credential: string }) {
    try {
      // 把 Google ID Token 发给后端验证
      const result = await fetch(`${API_BASE}/auth/google/one-tap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await result.json();

      if (data.token) {
        // 登录成功
        api.setToken(data.token);

        // 获取用户信息
        const meResult = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        const meData = await meResult.json();

        if (meData.user) {
          localStorage.setItem('user', JSON.stringify(meData.user));
          localStorage.setItem('active_role', meData.user.active_role || '');
        }

        const activeRole = meData.user?.active_role;
        if (!activeRole) {
          navigate('/onboarding');
        } else if (activeRole === 'company') {
          navigate('/company');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('[GoogleOneTap] Login failed:', error);
    }
  }

  // 这个组件不渲染任何 UI，One Tap 弹窗由 Google SDK 控制
  return null;
}
