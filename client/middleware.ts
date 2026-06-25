import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REFRESH_COOKIE = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken';

const PUBLIC_PATHS = ['/login', '/register'];

const ADMIN_PATHS = ['/schedule_management', '/schedule-management', '/user-management'];

function getBackendUrl(): string {
  const target = process.env.API_PROXY_TARGET || process.env.BACKEND_URL || 'http://127.0.0.1:5000';
  return target.replace(/\/$/, '');
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function hasRefreshSession(request: NextRequest): boolean {
  return Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
}

async function fetchSessionRole(request: NextRequest): Promise<'USER' | 'ADMIN' | null> {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  try {
    const res = await fetch(`${getBackendUrl()}/api/auth/check`, {
      headers: { cookie, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: { Role?: string } };
    if (!json.success || !json.data?.Role) return null;
    return json.data.Role === 'ADMIN' ? 'ADMIN' : 'USER';
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const hasSession = hasRefreshSession(request);
  const isPublic = isPublicPath(pathname);

  if (!hasSession && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublic) {
    const calendarUrl = request.nextUrl.clone();
    calendarUrl.pathname = '/calendar';
    calendarUrl.search = '';
    return NextResponse.redirect(calendarUrl);
  }

  if (isAdminPath(pathname) && hasSession) {
    const role = await fetchSessionRole(request);
    if (role !== 'ADMIN') {
      const calendarUrl = request.nextUrl.clone();
      calendarUrl.pathname = '/calendar';
      calendarUrl.search = '';
      return NextResponse.redirect(calendarUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
