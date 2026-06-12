'use client';

import { createContext, useContext } from 'react';
import type { SiteLang, SiteTranslations } from '@/i18n/site-translations';
import { siteTranslations } from '@/i18n/site-translations';

interface SiteLocaleContextValue {
  lang: SiteLang;
  tr: SiteTranslations;
}

const SiteLocaleContext = createContext<SiteLocaleContextValue>({
  lang: 'en',
  tr: siteTranslations.en as SiteTranslations,
});

export function SiteLocaleProvider({
  lang,
  children,
}: {
  lang: SiteLang;
  children: React.ReactNode;
}) {
  // 内容表可能尚未覆盖某语言（如 'ar' 待补），缺失时回退到 'en'，避免 tr 为 undefined 致组件崩溃。
  const tr = ((siteTranslations as Record<string, unknown>)[lang]
    ?? siteTranslations.en) as SiteTranslations;
  return (
    <SiteLocaleContext.Provider value={{ lang, tr }}>
      {children}
    </SiteLocaleContext.Provider>
  );
}

export function useSiteLocale() {
  return useContext(SiteLocaleContext);
}
