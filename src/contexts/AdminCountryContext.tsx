'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type AdminCountry = 'ae' | 'vn';

interface AdminCountryCtx {
  country: AdminCountry;
  setCountry: (c: AdminCountry) => void;
}

const Ctx = createContext<AdminCountryCtx>({ country: 'ae', setCountry: () => {} });

const STORAGE_KEY = 'admin_country';

export function AdminCountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<AdminCountry>('ae');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vn' || saved === 'ae') setCountryState(saved);
  }, []);

  const setCountry = (c: AdminCountry) => {
    setCountryState(c);
    localStorage.setItem(STORAGE_KEY, c);
  };

  return <Ctx.Provider value={{ country, setCountry }}>{children}</Ctx.Provider>;
}

export function useAdminCountry() {
  return useContext(Ctx);
}
