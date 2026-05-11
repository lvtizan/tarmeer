import { useState, useEffect } from 'react';

let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

const FALLBACK: string[] = [
  'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
  'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance',
];

async function fetchServices(): Promise<string[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/auth/company/services')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const services = Array.isArray(d.services) ? d.services as string[] : FALLBACK;
        cache = services;
        inflight = null;
        return services;
      })
      .catch(() => {
        inflight = null;
        return FALLBACK;
      });
  }
  return inflight;
}

export function useServices(): string[] {
  const [services, setServices] = useState<string[]>(cache ?? FALLBACK);

  useEffect(() => {
    if (cache) { setServices(cache); return; }
    fetchServices().then(setServices);
  }, []);

  return services;
}
