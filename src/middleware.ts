import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';

  // 越南业务已下线：旧 vn.tarmeer.com 统一 301 永久重定向到主站 www.tarmeer.com
  if (host.startsWith('vn.')) {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    url.host = 'www.tarmeer.com';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // 注入 x-country header（固定阿联酋 ae）供 API 代理 / SSR 取国家配置
  const headers = new Headers(req.headers);
  headers.set('x-country', 'ae');
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|icons/).*)'],
};
