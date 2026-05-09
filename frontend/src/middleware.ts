import { NextResponse, type NextRequest } from "next/server";

const CLINIC_SESSION_COOKIE_NAME = "app_session_id";
const LOGIN_PATH = "/login";

export function middleware(request: NextRequest) {
  const hasClinicSession = Boolean(
    request.cookies.get(CLINIC_SESSION_COOKIE_NAME)?.value,
  );

  if (hasClinicSession) {
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
