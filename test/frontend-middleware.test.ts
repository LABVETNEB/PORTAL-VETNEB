import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const MIDDLEWARE_PATH = "frontend/src/middleware.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend middleware imports Next response and request types", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('import { NextResponse, type NextRequest } from "next/server";'));
  assert.ok(source.includes("export function middleware(request: NextRequest)"));
});

test("frontend middleware checks clinic and admin session cookies before allowing dashboard access", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('const CLINIC_SESSION_COOKIE_NAME = "app_session_id";'));
  assert.ok(source.includes('const ADMIN_SESSION_COOKIE_NAME = "admin_session_id";'));
  assert.ok(source.includes("const hasClinicSession = Boolean("));
  assert.ok(source.includes("const hasAdminSession = Boolean("));
  assert.ok(source.includes("request.cookies.get(CLINIC_SESSION_COOKIE_NAME)?.value"));
  assert.ok(source.includes("request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value"));
  assert.ok(source.includes("if (hasClinicSession || hasAdminSession) {"));
  assert.ok(source.includes("return NextResponse.next();"));
});

test("frontend middleware redirects unauthenticated dashboard requests to login with next path", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('const LOGIN_PATH = "/login";'));
  assert.ok(source.includes("const loginUrl = request.nextUrl.clone();"));
  assert.ok(source.includes("const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;"));
  assert.ok(source.includes("loginUrl.pathname = LOGIN_PATH;"));
  assert.ok(source.includes('loginUrl.searchParams.set("next", nextPath);'));
  assert.ok(source.includes("return NextResponse.redirect(loginUrl);"));
});

test("frontend middleware remains scoped to dashboard routes only", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes("export const config = {"));
  assert.ok(source.includes('matcher: ["/dashboard/:path*"]'));
  assert.equal(source.includes('"/api/:path*"'), false);
  assert.equal(source.includes('"/login/:path*"'), false);
  assert.equal(source.includes('"/contacto/:path*"'), false);
});