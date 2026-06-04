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
  const tr = siteTranslations[lang] as SiteTranslations;
  return (
    <SiteLocaleContext.Provider value={{ lang, tr }}>
      {children}
    </SiteLocaleContext.Provider>
  );
}

export function useSiteLocale() {
  return useContext(SiteLocaleContext);
}
