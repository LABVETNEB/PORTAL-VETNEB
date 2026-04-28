import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRouteSource(relativeRoutePath: string) {
  return readFileSync(resolve(process.cwd(), relativeRoutePath), "utf8");
}

test("clinic-public-profile nativo valida origin antes de auth en mutaciones", () => {
  const source = readRouteSource("server/routes/clinic-public-profile.fastify.ts");

  assert.match(
    source,
    /app\.patch<[\s\S]*?>\(\s*"\/"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?authenticateClinicUser\(request, reply, deps, now\)/s,
  );
  assert.match(
    source,
    /app\.post\(\s*"\/avatar"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?authenticateClinicUser\(request, reply, deps, now\)/s,
  );
  assert.match(
    source,
    /app\.delete\(\s*"\/avatar"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?authenticateClinicUser\(request, reply, deps, now\)/s,
  );
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

