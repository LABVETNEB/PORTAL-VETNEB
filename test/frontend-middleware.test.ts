import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const MIDDLEWARE_PATH = "frontend/src/proxy.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend proxy imports Next response and request types", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('import { NextResponse, type NextRequest } from "next/server";'));
  assert.ok(source.includes("export function proxy(request: NextRequest)"));
});

test("frontend proxy separates clinic and admin dashboard session cookies", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('const CLINIC_SESSION_COOKIE_NAME = "app_session_id";'));
  assert.ok(source.includes('const ADMIN_SESSION_COOKIE_NAME = "admin_session_id";'));
  assert.ok(source.includes('const ADMIN_DASHBOARD_PATH_PREFIX = "/dashboard/admin";'));
  assert.ok(source.includes("function isAdminDashboardPath(pathname: string): boolean"));
  assert.ok(source.includes("pathname === ADMIN_DASHBOARD_PATH_PREFIX"));
  assert.ok(source.includes('pathname.startsWith(`${ADMIN_DASHBOARD_PATH_PREFIX}/`)'));
  assert.ok(source.includes("function getRequiredSessionCookieName(pathname: string): string"));
  assert.ok(source.includes("? ADMIN_SESSION_COOKIE_NAME"));
  assert.ok(source.includes(": CLINIC_SESSION_COOKIE_NAME"));
  assert.ok(source.includes("request.cookies.get(requiredCookieName)?.value"));
  assert.ok(source.includes("if (hasRequiredSession) {"));
  assert.ok(source.includes("return NextResponse.next();"));
  assert.equal(source.includes("hasClinicSession || hasAdminSession"), false);
});

test("frontend proxy blocks unauthenticated admin dashboard without public login redirect", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes("if (isAdminDashboardPath(pathname)) {"));
  assert.ok(source.includes('return new NextResponse("Not Found", { status: 404 });'));
  assert.equal(source.includes("notFoundUrl"), false);
  assert.equal(source.includes("NOT_FOUND_PATH"), false);
  assert.equal(source.includes('loginUrl.searchParams.set("next", nextPath);\\n\\n  return NextResponse.redirect(loginUrl);\\n}'), false);
});

test("frontend proxy redirects unauthenticated clinic dashboard requests to login with next path", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('const LOGIN_PATH = "/login";'));
  assert.ok(source.includes("const loginUrl = request.nextUrl.clone();"));
  assert.ok(source.includes("const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;"));
  assert.ok(source.includes("loginUrl.pathname = LOGIN_PATH;"));
  assert.ok(source.includes('loginUrl.searchParams.set("next", nextPath);'));
  assert.ok(source.includes("return NextResponse.redirect(loginUrl);"));
});

test("frontend proxy remains scoped to dashboard routes only", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes("export const config = {"));
  assert.ok(source.includes('matcher: ["/dashboard/:path*"]'));
  assert.equal(source.includes('"/api/:path*"'), false);
  assert.equal(source.includes('"/login/:path*"'), false);
  assert.equal(source.includes('"/contacto/:path*"'), false);
});
