import { NextResponse, type NextRequest } from "next/server";

const CLINIC_SESSION_COOKIE_NAME = "app_session_id";
const ADMIN_SESSION_COOKIE_NAME = "admin_session_id";
const LOGIN_PATH = "/login";

export function middleware(request: NextRequest) {
  const hasClinicSession = Boolean(
    request.cookies.get(CLINIC_SESSION_COOKIE_NAME)?.value,
  );
  const hasAdminSession = Boolean(
    request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value,
  );

  if (hasClinicSession || hasAdminSession) {
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