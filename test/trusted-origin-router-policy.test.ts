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

test("reports nativos validan origin antes de auth en mutaciones", () => {
  const reportsSource = readRouteSource("server/routes/reports.fastify.ts");
  const reportsStatusSource = readRouteSource(
    "server/routes/reports-status.fastify.ts",
  );

  assert.match(
    reportsSource,
    /app\.post\(\s*"\/upload"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?authenticateClinicUser/s,
  );
  assert.match(
    reportsStatusSource,
    /app\.patch<[\s\S]*?>\(\s*"\/:reportId\/status"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?authenticateClinicUser/s,
  );
});
