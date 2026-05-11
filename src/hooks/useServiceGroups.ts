import { useState, useEffect } from 'react';
import { SERVICE_CATEGORIES } from '../lib/serviceCategories';

export interface ServiceGroup {
  name: string;
  subs: string[];
}

let cache: ServiceGroup[] | null = null;
let inflight: Promise<ServiceGroup[]> | null = null;

async function fetchServiceGroups(): Promise<ServiceGroup[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/auth/company/service-groups')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const groups: ServiceGroup[] = Array.isArray(d.categories) ? d.categories : SERVICE_CATEGORIES;
        cache = groups;
        inflight = null;
        return groups;
      })
      .catch(() => {
        inflight = null;
        return SERVICE_CATEGORIES;
      });
  }
  return inflight;
}

/** Invalidate the in-memory cache so next call re-fetches */
export function invalidateServiceGroupsCache() {
  cache = null;
}

/**
 * Returns service categories grouped by category name.
 * Initially returns the static SERVICE_CATEGORIES, then updates once the API responds.
 */
export function useServiceGroups(): ServiceGroup[] {
  const [groups, setGroups] = useState<ServiceGroup[]>(cache ?? SERVICE_CATEGORIES);

  useEffect(() => {
    if (cache) { setGroups(cache); return; }
    fetchServiceGroups().then(setGroups);
  }, []);

  return groups;
}
