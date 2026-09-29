import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const MIDDLEWARE_PATH = "frontend/src/proxy.ts";

test("frontend dashboard proxy exists and protects dashboard routes", () => {
  assert.equal(
    existsSync(resolve(process.cwd(), MIDDLEWARE_PATH)),
    true,
    "frontend dashboard proxy must exist",
  );

  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('from "next/server"'));
  assert.ok(source.includes('from "../../shared/session-cookie-names"'));
  assert.ok(source.includes("CLINIC_SESSION_COOKIE_NAME"));
  assert.ok(source.includes("ADMIN_SESSION_COOKIE_NAME"));
  assert.ok(source.includes('LOGIN_PATH = "/login"'));
  assert.ok(source.includes('ADMIN_DASHBOARD_PATH_PREFIX = "/dashboard/admin"'));
  assert.ok(source.includes("NextResponse.next()"));
  assert.ok(source.includes("NextResponse.redirect(loginUrl)"));
  assert.ok(source.includes('matcher: ["/dashboard/:path*"]'));
});

test("frontend dashboard proxy separates clinic and admin sessions", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes("function isAdminDashboardPath(pathname: string): boolean"));
  assert.ok(source.includes("pathname === ADMIN_DASHBOARD_PATH_PREFIX"));
  assert.ok(source.includes('pathname.startsWith(`${ADMIN_DASHBOARD_PATH_PREFIX}/`)'));
  assert.ok(source.includes("function getRequiredSessionCookieName(pathname: string): string"));
  assert.ok(source.includes("return isAdminDashboardPath(pathname)"));
  assert.ok(source.includes("? ADMIN_SESSION_COOKIE_NAME"));
  assert.ok(source.includes(": CLINIC_SESSION_COOKIE_NAME"));
  assert.ok(source.includes("const requiredCookieName = getRequiredSessionCookieName("));
  assert.ok(source.includes("request.nextUrl.pathname"));
  assert.ok(source.includes("request.cookies.get(requiredCookieName)"));
  assert.ok(source.includes("hasRequiredSession"));
  assert.equal(source.includes("hasClinicSession || hasAdminSession"), false);
});

test("frontend dashboard proxy redirects unauthenticated admin dashboard to login", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes("const pathname = request.nextUrl.pathname;"));
  assert.equal(
    source.includes('new NextResponse("Not Found", { status: 404 })'),
    false,
  );
  assert.ok(source.includes("loginUrl.pathname = LOGIN_PATH;"));
  assert.ok(source.includes('loginUrl.searchParams.set("next", nextPath);'));
});

test("frontend dashboard proxy preserves requested dashboard path on login redirect", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes("request.nextUrl.clone()"));
  assert.ok(
    source.includes(
      "`${request.nextUrl.pathname}${request.nextUrl.search}`",
    ),
  );
  assert.ok(source.includes('loginUrl.searchParams.set("next", nextPath)'));
});

test("frontend dashboard proxy stays scoped to frontend route protection", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("particular_session_id"), false);
  assert.equal(source.includes("process.env"), false);
});
