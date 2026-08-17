import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_SESSION_COOKIE_NAME,
  CLINIC_SESSION_COOKIE_NAME,
} from "../../shared/session-cookie-names";

const LOGIN_PATH = "/login";
const ADMIN_DASHBOARD_PATH_PREFIX = "/dashboard/admin";

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
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
