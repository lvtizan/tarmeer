'use client';

import { createContext, useContext } from 'react';

export type AdminLang = 'en' | 'zh' | 'vi';

interface AdminLangContextValue {
  lang: AdminLang;
  t: (en: string, zh: string, vi?: string) => string;
}

export const AdminLangContext = createContext<AdminLangContextValue>({
  lang: 'en',
  t: (en) => en,
});

export function useAdminT() {
  return useContext(AdminLangContext);
}
