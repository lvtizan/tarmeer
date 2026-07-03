/**
 * Server-side fetch wrapper for Next.js SSG/ISR.
 * Uses process.env instead of import.meta.env (Vite).
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ??
  process.env.API_INTERNAL_URL?.trim() ?? // internal URL for SSR (faster, no round-trip)
  "http://localhost:3002/api"; // SSR 兜底：Node fetch 不支持相对 URL，生产与 Express 同机

export async function serverFetch<T>(
  path: string,
  options?: RequestInit & { revalidate?: number | false }
): Promise<T> {
  const { revalidate, ...fetchOptions } = options ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    next: revalidate !== undefined ? { revalidate } : { revalidate: 3600 }, // 1h default ISR
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}`);
  }

  return res.json() as Promise<T>;
}
