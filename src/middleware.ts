import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY } from '@/lib/country';

// 非默认国家（ae 走主域名），各自拥有子域名 + Cloudflare ip 国家码。
// 加新国家只需在 country.ts 的 COUNTRY 里加一项，本文件零改动。
const SUBDOMAIN_COUNTRIES = Object.values(COUNTRY).filter((c) => c.code !== 'ae');

function detectCountry(host: string, cfCountry: string | null): string {
  // 1) 子域名优先（vn. / sa. …）
  for (const c of SUBDOMAIN_COUNTRIES) {
    if (host.startsWith(c.code + '.')) return c.code;
  }
  // 2) Cloudflare IP 国家码（VN / SA …）
  if (cfCountry) {
    for (const c of SUBDOMAIN_COUNTRIES) {
      if (cfCountry === c.isoCode) return c.code;
    }
  }
  return 'ae';
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const onSubdomain = SUBDOMAIN_COUNTRIES.some((c) => host.startsWith(c.code + '.'));
  const country = detectCountry(host, req.headers.get('cf-ipcountry'));

  // 主域名上：把非 ae 访客 302 重定向到对应国家子域名
  if (!onSubdomain && country !== 'ae') {
    const url = req.nextUrl.clone();
    url.host = country + '.' + host;
    return NextResponse.redirect(url, 302);
  }

  // 注入 x-country header 供 API 代理 / SSR 取国家配置
  const headers = new Headers(req.headers);
  headers.set('x-country', country);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|icons/).*)'],
};
