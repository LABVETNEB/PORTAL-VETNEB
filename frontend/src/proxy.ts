// WBR-17 (VET-18) — navigation gating, not an authorization boundary.
//
// This proxy exists to improve navigation UX: it redirects early, before a
// protected page renders, when the browser did not send the session cookie
// expected for the requested area. The check below only confirms that a
// non-empty cookie with the right name is present — it does not verify a
// signature, decode a token, check expiry, look up a user, or evaluate a
// role or permission. A cookie with the right name can be sent by a client
// that fabricated it, and this proxy would still let the navigation through.
//
// The authoritative boundary is the Fastify backend: every protected API
// route validates the session against the database on each request and
// returns 401 for anything invalid, missing, or expired. On the dashboard,
// that 401 is what actually forces a login redirect for a page whose data
// load failed (see `redirectToLoginOnUnauthorized` in
// `frontend/src/lib/dashboard-server-auth.ts`), independently of whatever
// this proxy decided. No operation that reads or writes protected data may
// ever rely on this proxy's redirect as its only protection — that
// protection must exist in the backend route itself.
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
