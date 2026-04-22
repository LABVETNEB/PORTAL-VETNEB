import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRouteSource(relativeRoutePath: string) {
  return readFileSync(resolve(process.cwd(), relativeRoutePath), "utf8");
}

function assertTrustedOriginRunsBeforeAuth(source: string, routePath: string) {
  const trustedOriginUseIndex = source.indexOf("router.use(requireTrustedOrigin);");
  const requireAuthUseIndex = source.indexOf("router.use(requireAuth);");

  assert.notEqual(
    trustedOriginUseIndex,
    -1,
    `${routePath} debe registrar requireTrustedOrigin a nivel router`,
  );
  assert.notEqual(
    requireAuthUseIndex,
    -1,
    `${routePath} debe registrar requireAuth a nivel router`,
  );
  assert.ok(
    trustedOriginUseIndex < requireAuthUseIndex,
    `${routePath} debe ejecutar requireTrustedOrigin antes de requireAuth`,
  );
}

test("clinic-public-profile usa trusted-origin antes de auth en politica de router", () => {
  const routePath = "server/routes/clinic-public-profile.routes.ts";
  const source = readRouteSource(routePath);

  assertTrustedOriginRunsBeforeAuth(source, routePath);
});

test("reports usa trusted-origin antes de auth y evita duplicacion por ruta", () => {
  const routePath = "server/routes/reports.routes.ts";
  const source = readRouteSource(routePath);

  assertTrustedOriginRunsBeforeAuth(source, routePath);
  assert.doesNotMatch(
    source,
    /router\.patch\(\s*"\/:reportId\/status"\s*,\s*requireTrustedOrigin/s,
    "reports.routes.ts no debe duplicar requireTrustedOrigin en PATCH /:reportId/status",
  );
});
