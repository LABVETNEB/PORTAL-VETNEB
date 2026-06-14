import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  ApiResponseError,
  isUnauthorizedApiError,
} from "../frontend/src/lib/api-error.ts";

const SERVER_AUTH_PATH = "frontend/src/lib/dashboard-server-auth.ts";
const PROXY_PATH = "frontend/src/proxy.ts";
const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const DASHBOARD_SERVER_PAGES = [
  "frontend/src/app/dashboard/page.tsx",
  "frontend/src/app/dashboard/admin/page.tsx",
  "frontend/src/app/dashboard/informes/page.tsx",
  "frontend/src/app/dashboard/logistica/page.tsx",
  "frontend/src/app/dashboard/logistica/visitas/page.tsx",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  "frontend/src/app/dashboard/logistica/metricas/page.tsx",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard API error policy classifies only HTTP 401 as unauthenticated", () => {
  assert.equal(
    isUnauthorizedApiError(new ApiResponseError(401, "session expired")),
    true,
  );
  assert.equal(
    isUnauthorizedApiError(new ApiResponseError(403, "forbidden")),
    false,
  );
  assert.equal(
    isUnauthorizedApiError(new ApiResponseError(500, "backend unavailable")),
    false,
  );
  assert.equal(isUnauthorizedApiError(new Error("HTTP 401")), false);
});

test("dashboard server auth redirects classified 401 errors to the fixed login route", () => {
  const source = read(SERVER_AUTH_PATH);

  assert.ok(source.includes('import "server-only";'));
  assert.ok(source.includes('import { redirect } from "next/navigation";'));
  assert.ok(source.includes("isUnauthorizedApiError(error)"));
  assert.ok(source.includes("redirect(ROUTES.login);"));
  assert.equal(source.includes("error.message"), false);
  assert.equal(source.includes("?next="), false);
  assert.equal(source.includes("searchParams"), false);
});

test("all dashboard server pages apply the unauthorized redirect before fallback UI", () => {
  for (const pagePath of DASHBOARD_SERVER_PAGES) {
    const source = read(pagePath);

    assert.ok(
      source.includes(
        'import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";',
      ),
      `${pagePath} must import the server unauthorized handler`,
    );
    assert.ok(
      source.includes("redirectToLoginOnUnauthorized(error);"),
      `${pagePath} must handle server-side 401 errors`,
    );
  }
});

test("dashboard proxy redirects missing clinic and admin sessions without a login loop", () => {
  const source = read(PROXY_PATH);

  assert.ok(source.includes('matcher: ["/dashboard/:path*"]'));
  assert.ok(source.includes("loginUrl.pathname = LOGIN_PATH;"));
  assert.ok(source.includes('loginUrl.searchParams.set("next", nextPath);'));
  assert.equal(source.includes('matcher: ["/login'), false);
  assert.equal(
    source.includes('new NextResponse("Not Found", { status: 404 })'),
    false,
  );
});

test("login next handling rejects external and admin paths for clinic sessions", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('candidate.startsWith("//")'));
  assert.ok(source.includes("parsedNextPath.origin !== SAFE_LOGIN_REDIRECT_ORIGIN"));
  assert.ok(source.includes("parsedNextPath.pathname === ROUTES.dashboardAdmin"));
  assert.ok(
    source.includes(
      "parsedNextPath.pathname.startsWith(`${ROUTES.dashboardAdmin}/`)",
    ),
  );
  assert.equal(source.includes("return candidate;"), false);
});
