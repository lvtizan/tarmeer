'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type AdminCountry = 'ae';

interface AdminCountryCtx {
  country: AdminCountry;
  setCountry: (c: AdminCountry) => void;
}

const Ctx = createContext<AdminCountryCtx>({ country: 'ae', setCountry: () => {} });

const STORAGE_KEY = 'admin_country';

export function AdminCountryProvider({ children }: { children: ReactNode }) {
  const [country] = useState<AdminCountry>('ae');

  useEffect(() => {
    // If previously saved country was 'vn' or invalid, normalize to 'ae'
    if (localStorage.getItem(STORAGE_KEY) !== 'ae') {
      localStorage.setItem(STORAGE_KEY, 'ae');
    }
  }, []);

  const setCountry = (_c: AdminCountry) => {
    localStorage.setItem(STORAGE_KEY, 'ae');
  };

  return <Ctx.Provider value={{ country, setCountry }}>{children}</Ctx.Provider>;
}

export function useAdminCountry() {
  return useContext(Ctx);
}
