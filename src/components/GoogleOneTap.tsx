/**
 * Google One Tap 登录组件
 * 检测到用户已登录 Google 账号时，自动弹出快速登录弹窗
 * 如果用户已登录 Tarmeer，则不弹出
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

// 不弹 One Tap 的页面（公司注册/登录页通过 email 流程处理，无需 One Tap）
const EXCLUDED_PATHS = ['/auth', '/login', '/register', '/designer/', '/for-companies', '/join', '/admin', '/verify-email'];

// 模块级标志 — 跨组件 mount/unmount 保持，彻底防止重复初始化
let gsiInitialized = false;

export default function GoogleOneTap() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 已登录，不弹
    if (api.getToken()) return;

    // 排除的页面不弹
    if (EXCLUDED_PATHS.some((p) => location.pathname.startsWith(p))) return;

    // 没有 Client ID，不弹
    if (!GOOGLE_CLIENT_ID) return;

    // SDK 已加载过，只需重新 prompt（不重复 initialize）
    if (gsiInitialized) {
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // FedCM unavailable or user dismissed — silence the error
            return;
          }
        });
      }
      return;
    }

    gsiInitialized = true;

    // 加载 Google Identity Services SDK（只加载一次）
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!(window as any).google?.accounts?.id) return;

      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
        // use_fedcm_for_prompt 不设置 true：FedCM 被用户禁用时会 NetworkError 且无回退
        // 保持默认（false），GSI 自动选择最合适的弹窗机制
      });

      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // FedCM unavailable or user dismissed — silence the error
          return;
        }
      });
    };

    document.head.appendChild(script);

    return () => {
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.cancel();
      }
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
