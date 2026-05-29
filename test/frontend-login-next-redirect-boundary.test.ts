import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("login next redirect helper keeps strict dashboard boundary checks", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("function getSafeNextPath(nextPath: string | null): string"));
  assert.ok(source.includes('const SAFE_LOGIN_REDIRECT_ORIGIN = "https://portal.vetneb.local";'));
  assert.ok(source.includes("new URL(candidate, SAFE_LOGIN_REDIRECT_ORIGIN)"));
  assert.ok(source.includes("parsedNextPath.origin !== SAFE_LOGIN_REDIRECT_ORIGIN"));
  assert.ok(source.includes('candidate.startsWith("//")'));
  assert.ok(source.includes("const pathname = parsedNextPath.pathname;"));
  assert.ok(source.includes("parsedNextPath.pathname === ROUTES.dashboardAdmin"));
  assert.ok(source.includes("parsedNextPath.pathname.startsWith(`${ROUTES.dashboardAdmin}/`)"));
  assert.ok(source.includes("parsedNextPath.search"));
  assert.equal(source.includes("return candidate;"), false);
  assert.ok(source.includes("return ROUTES.dashboard;"));
  assert.ok(source.includes("pathname === ROUTES.dashboard"));
  assert.ok(source.includes("pathname.startsWith(`${ROUTES.dashboard}/`)"));
  assert.ok(source.includes("return `${pathname}${parsedNextPath.search}`;"));
  assert.equal(source.includes("safePath === ROUTES.dashboardAdmin"), false);
  assert.equal(source.includes("safePath.startsWith(`${ROUTES.dashboardAdmin}/`)"), false);
  assert.equal(source.includes('if (!nextPath?.startsWith("/dashboard"))'), false);
  assert.ok(source.includes("const destination ="));
  assert.ok(source.includes("response.redirectTo"));
  assert.ok(source.includes("router.replace(destination);"));
  assert.ok(source.includes('requestedSurface === "particular"'));
  assert.ok(source.includes("router.replace(ROUTES.particulares);"));
});
