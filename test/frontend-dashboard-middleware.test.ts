import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const MIDDLEWARE_PATH = "frontend/src/middleware.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend dashboard middleware exists and protects dashboard routes", () => {
  assert.equal(
    existsSync(resolve(process.cwd(), MIDDLEWARE_PATH)),
    true,
    "frontend dashboard middleware must exist",
  );

  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes('from "next/server"'));
  assert.ok(source.includes('CLINIC_SESSION_COOKIE_NAME = "app_session_id"'));
  assert.ok(source.includes('LOGIN_PATH = "/login"'));
  assert.ok(source.includes('request.cookies.get(CLINIC_SESSION_COOKIE_NAME)'));
  assert.ok(source.includes("NextResponse.next()"));
  assert.ok(source.includes("NextResponse.redirect(loginUrl)"));
  assert.ok(source.includes('matcher: ["/dashboard/:path*"]'));
});

test("frontend dashboard middleware preserves requested dashboard path", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(source.includes("request.nextUrl.clone()"));
  assert.ok(
    source.includes(
      "`${request.nextUrl.pathname}${request.nextUrl.search}`",
    ),
  );
  assert.ok(source.includes('loginUrl.searchParams.set("next", nextPath)'));
});

test("frontend dashboard middleware stays scoped to frontend route protection", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("admin_session_id"), false);
  assert.equal(source.includes("particular_session_id"), false);
  assert.equal(source.includes("process.env"), false);
});
