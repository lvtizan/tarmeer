import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';

  // Determine country from subdomain or Cloudflare header
  let country = 'ae';
  if (host.startsWith('vn.')) {
    country = 'vn';
  } else {
    const cfCountry = req.headers.get('cf-ipcountry');
    if (cfCountry === 'VN') country = 'vn';
  }

  // On main domain: redirect VN visitors to vn subdomain
  if (!host.startsWith('vn.') && country === 'vn') {
    const url = req.nextUrl.clone();
    url.host = 'vn.' + host;
    return NextResponse.redirect(url, 302);
  }

  // Inject x-country header for API proxying
  const headers = new Headers(req.headers);
  headers.set('x-country', country);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|icons/).*)'],
};
