import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRouteSource(relativeRoutePath: string) {
  return readFileSync(resolve(process.cwd(), relativeRoutePath), "utf8");
}

test("reports protege PATCH /:reportId/status con management permission", () => {
  const source = readRouteSource("server/routes/reports.routes.ts");

  assert.match(
    source,
    /const requireReportStatusWritePermission = asyncHandler\(/,
  );
  assert.match(
    source,
    /if \(!req\.auth\?\.canManageClinicUsers\)/,
  );
  assert.match(
    source,
    /error: "No autorizado para cambiar el estado de informes"/,
  );
  assert.match(
    source,
    /router\.patch\(\s*"\/:reportId\/status",\s*requireReportStatusWritePermission,/s,
  );

  assert.doesNotMatch(
    source,
    /router\.post\(\s*"\/upload",\s*requireReportStatusWritePermission,/s,
    "POST /upload no debe exigir permiso de management de clinica",
  );
});

test("reports expone POST /upload nativo con permiso de upload, no management", () => {
  const legacySource = readRouteSource("server/routes/reports.routes.ts");
  const nativeSource = readRouteSource("server/routes/reports.fastify.ts");

  assert.doesNotMatch(
    legacySource,
    /router\.post\(\s*"\/upload"/s,
    "POST /upload ya no debe existir en el router Express legacy",
  );

  assert.match(
    nativeSource,
    /app\.post\(\s*"\/upload"/s,
  );
  assert.match(
    nativeSource,
    /if \(!auth\.canUploadReports\)/,
  );
  assert.match(
    nativeSource,
    /error: "No autorizado para subir informes"/,
  );
  assert.doesNotMatch(
    nativeSource,
    /app\.post\(\s*"\/upload"[\s\S]*?canManageClinicUsers/s,
    "POST /upload no debe exigir permiso de management de clinica",
  );
});

test("report-access-tokens protege mutaciones con management permission", () => {
  const source = readRouteSource("server/routes/report-access-tokens.routes.ts");

  assert.match(
    source,
    /const requireReportAccessTokenManagementPermission = asyncHandler\(/,
  );
  assert.match(
    source,
    /if \(!req\.auth\?\.canManageClinicUsers\)/,
  );
  assert.match(
    source,
    /error: "No autorizado para administrar tokens p.blicos de informes"/,
  );

  assert.match(
    source,
    /router\.post\(\s*"\/",\s*requireTrustedOrigin,\s*reportAccessTokenMutationRateLimit,\s*requireReportAccessTokenManagementPermission,/s,
  );
  assert.match(
    source,
    /router\.patch\(\s*"\/:tokenId\/revoke",\s*requireTrustedOrigin,\s*reportAccessTokenMutationRateLimit,\s*requireReportAccessTokenManagementPermission,/s,
  );

  assert.doesNotMatch(
    source,
    /router\.get\(\s*"\/",\s*requireReportAccessTokenManagementPermission,/s,
    "GET / no debe exigir permiso de mutacion",
  );
  assert.doesNotMatch(
    source,
    /router\.get\(\s*"\/:tokenId",\s*requireReportAccessTokenManagementPermission,/s,
    "GET /:tokenId no debe exigir permiso de mutacion",
  );
});
