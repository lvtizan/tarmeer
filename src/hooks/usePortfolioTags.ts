import { useState, useEffect } from 'react';

const API_BASE = (import.meta as any).env?.VITE_API_URL?.trim() || '/api';
const CACHE_KEY = 'portfolio-tags-v1';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface PortfolioTags {
  style: string[];
  room: string[];
}

const EMPTY: PortfolioTags = { style: [], room: [] };

let inFlight: Promise<PortfolioTags> | null = null;

function readCache(): PortfolioTags | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_TTL) return null;
    return data as PortfolioTags;
  } catch { return null; }
}

async function fetchTags(): Promise<PortfolioTags> {
  const res = await fetch(`${API_BASE}/companies/portfolio/tags`);
  if (!res.ok) throw new Error('Failed to fetch portfolio tags');
  return res.json();
}

export function usePortfolioTags(): PortfolioTags {
  const [tags, setTags] = useState<PortfolioTags>(() => readCache() ?? EMPTY);

  useEffect(() => {
    const cached = readCache();
    if (cached) { setTags(cached); return; }
    if (!inFlight) {
      inFlight = fetchTags()
        .then(data => {
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
          } catch { /* ignore */ }
          inFlight = null;
          return data;
        })
        .catch(() => { inFlight = null; return EMPTY; });
    }
    inFlight.then(data => setTags(data));
  }, []);

  return tags;
}
