// src/pages/AuthCallbackPage.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      // 存储 token
      api.setToken(token);

      // 获取用户信息
      fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.designer) {
            localStorage.setItem('designer', JSON.stringify(data.designer));
          }
          navigate('/designer/dashboard');
        })
        .catch(() => {
          navigate('/designer/dashboard');
        });
    } else if (error) {
      // 错误处理
      navigate(`/auth?error=${encodeURIComponent(error)}`);
    } else {
      navigate('/auth');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#B8864A] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-stone-600">Completing sign in...</p>
      </div>
    </div>
  );
}
