import { NextResponse, type NextRequest } from "next/server";

const CLINIC_SESSION_COOKIE_NAME = "app_session_id";
const ADMIN_SESSION_COOKIE_NAME = "admin_session_id";
const LOGIN_PATH = "/login";
const ADMIN_DASHBOARD_PATH_PREFIX = "/dashboard/admin";

// Private surfaces must never be cached by the browser, shared caches or the
// back/forward cache. `no-store` also makes these pages ineligible for bfcache
// in Chromium/Firefox, so Back + reload after logout hit the proxy instead of a
// stale private snapshot.
const PRIVATE_CACHE_CONTROL = "no-store, no-cache, must-revalidate";

function applyPrivateCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  response.headers.set("Pragma", "no-cache");
  return response;
}

function isAdminDashboardPath(pathname: string): boolean {
  return (
    pathname === ADMIN_DASHBOARD_PATH_PREFIX ||
    pathname.startsWith(`${ADMIN_DASHBOARD_PATH_PREFIX}/`)
  );
}

function getRequiredSessionCookieName(pathname: string): string {
  return isAdminDashboardPath(pathname)
    ? ADMIN_SESSION_COOKIE_NAME
    : CLINIC_SESSION_COOKIE_NAME;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requiredCookieName = getRequiredSessionCookieName(pathname);
  const hasRequiredSession = Boolean(
    request.cookies.get(requiredCookieName)?.value,
  );

  if (hasRequiredSession) {
    return applyPrivateCacheHeaders(NextResponse.next());
  }

  const loginUrl = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("next", nextPath);

  return applyPrivateCacheHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
