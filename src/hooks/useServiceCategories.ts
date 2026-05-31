'use client';

import { useState, useEffect } from 'react';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/lib/serviceCategories';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

let cache: ServiceCategory[] | null = null;
let inflight: Promise<ServiceCategory[]> | null = null;

const FALLBACK: ServiceCategory[] = SERVICE_CATEGORIES;

async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(`${API_BASE}/public/service-categories`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const categories = Array.isArray(d.categories) ? d.categories as ServiceCategory[] : FALLBACK;
        cache = categories;
        inflight = null;
        return categories;
      })
      .catch(() => {
        inflight = null;
        return FALLBACK;
      });
  }
  return inflight;
}

export function useServiceCategories(): ServiceCategory[] {
  const [categories, setCategories] = useState<ServiceCategory[]>(cache ?? FALLBACK);

  useEffect(() => {
    if (cache) { setCategories(cache); return; }
    fetchServiceCategories().then(setCategories);
  }, []);

  return categories;
}

/** Derive parent category name for a sub-service from a dynamic categories list */
export function getCategoryForSubDynamic(sub: string, categories: ServiceCategory[]): string | null {
  for (const cat of categories) {
    if (cat.subs.includes(sub)) return cat.name;
  }
  return null;
}

/** Get unique parent categories active in a list of subs, using dynamic data */
export function getActiveParentsDynamic(subs: string[], categories: ServiceCategory[]): string[] {
  const parents = new Set<string>();
  for (const sub of subs) {
    const parent = getCategoryForSubDynamic(sub, categories);
    if (parent) parents.add(parent);
  }
  return Array.from(parents);
}
