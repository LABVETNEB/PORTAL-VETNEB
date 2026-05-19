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
  assert.ok(source.includes("return ROUTES.dashboard;"));
  assert.ok(source.includes("candidate === ROUTES.dashboard"));
  assert.ok(source.includes("candidate.startsWith(`${ROUTES.dashboard}/`)"));
  assert.ok(source.includes("candidate.startsWith(`${ROUTES.dashboard}?`)"));
  assert.ok(source.includes("candidate === ROUTES.dashboardAdmin"));
  assert.ok(source.includes("candidate.startsWith(`${ROUTES.dashboardAdmin}/`)"));
  assert.equal(source.includes('if (!nextPath?.startsWith("/dashboard"))'), false);
  assert.ok(source.includes('router.replace(getSafeNextPath(searchParams.get("next")))'));
  assert.ok(source.includes('requestedSurface === "particular"'));
  assert.ok(source.includes("router.replace(ROUTES.particulares);"));
});
