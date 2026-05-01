import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRouteSource(relativeRoutePath: string) {
  return readFileSync(resolve(process.cwd(), relativeRoutePath), "utf8");
}

function routeExists(relativeRoutePath: string) {
  return existsSync(resolve(process.cwd(), relativeRoutePath));
}

test("reports protege PATCH /:reportId/status con management permission", () => {
  const source = readRouteSource("server/routes/reports-status.fastify.ts");

  assert.match(
    source,
    /function requireReportStatusWritePermission\(/,
  );
  assert.match(
    source,
    /if \(auth\.canManageClinicUsers\) \{\s*return true;/s,
  );
  assert.match(
    source,
    /error: "No autorizado para cambiar el estado de informes"/,
  );
  assert.match(
    source,
    /app\.patch<[\s\S]*?>\(\s*"\/:reportId\/status"/s,
  );
});

test("reports clinic read-only no registra POST /upload nativo", () => {
  const nativeSource = readRouteSource("server/routes/reports.fastify.ts");

  assert.equal(
    routeExists("server/routes/reports.routes.ts"),
    false,
    "server/routes/reports.routes.ts ya no debe existir",
  );

  assert.doesNotMatch(
    nativeSource,
    /app\.post\(\s*"\/upload"/s,
    "reports clinic no debe registrar POST /upload",
  );
  assert.doesNotMatch(nativeSource, /runReportUpload|multer|deps\.uploadReport|deps\.upsertReport/);
  assert.doesNotMatch(nativeSource, /createdByClinicUserId:\s*auth\.id/);
});

test("reports clinic read-only conserva permisos persistentes sin allowlist ENV legacy", () => {
  const nativeSource = readRouteSource("server/routes/reports.fastify.ts");
  const permissionsSource = readRouteSource("server/lib/permissions.ts");

  assert.match(
    nativeSource,
    /const role = normalizeClinicUserRole\(clinicUser\.role, "clinic_staff"\);/s,
    "La autenticacion de reports debe conservar normalizacion del role persistente",
  );

  assert.match(
    permissionsSource,
    /export function getClinicPermissions\(role: ClinicUserRole\): ClinicPermissions/,
    "Debe existir un resolver central de permisos por role persistente",
  );

  assert.match(
    permissionsSource,
    /case "clinic_owner":[\s\S]*canUploadReports: false,[\s\S]*canManageClinicUsers: true,/s,
    "clinic_owner debe conservar management sin permiso de upload",
  );

  assert.match(
    permissionsSource,
    /case "clinic_staff":[\s\S]*canUploadReports: false,[\s\S]*canManageClinicUsers: false,/s,
    "clinic_staff debe permanecer read-only sin upload ni management",
  );

  assert.doesNotMatch(
    nativeSource,
    /LAB_UPLOAD_USERNAMES|labUploadUsernames|ENV\.labUploadUsernames/,
    "reports clinic no debe depender de allowlists ENV legacy para autorizar uploads",
  );
});

test("report-access-tokens protege mutaciones nativas con management permission", () => {
  const source = readRouteSource("server/routes/report-access-tokens.fastify.ts");

  assert.equal(
    routeExists("server/routes/report-access-tokens.routes.ts"),
    false,
    "server/routes/report-access-tokens.routes.ts ya no debe existir",
  );

  assert.match(
    source,
    /function requireReportAccessTokenManagementPermission\(/,
  );
  assert.match(
    source,
    /if \(auth\.canManageClinicUsers\) \{\s*return true;/s,
  );
  assert.match(
    source,
    /error: "No autorizado para administrar tokens públicos de informes"/,
  );

  assert.match(
    source,
    /app\.post<[\s\S]*?>\(\s*"\/"[\s\S]*?requireReportAccessTokenManagementPermission\(auth, reply\)/s,
  );
  assert.match(
    source,
    /app\.patch<[\s\S]*?>\(\s*"\/:tokenId\/revoke"[\s\S]*?requireReportAccessTokenManagementPermission\(auth, reply\)/s,
  );

  const listRouteStart = source.indexOf('app.get<{');
  const detailRouteStart = source.indexOf('app.get<{', listRouteStart + 1);
  const revokeRouteStart = source.indexOf('app.patch<{');

  assert.notEqual(listRouteStart, -1, "GET / debe existir en el router nativo");
  assert.notEqual(
    detailRouteStart,
    -1,
    "GET /:tokenId debe existir en el router nativo",
  );
  assert.notEqual(
    revokeRouteStart,
    -1,
    "PATCH /:tokenId/revoke debe existir en el router nativo",
  );

  assert.equal(
    source
      .slice(listRouteStart, detailRouteStart)
      .includes("requireReportAccessTokenManagementPermission"),
    false,
    "GET / no debe exigir permiso de mutacion",
  );
  assert.equal(
    source
      .slice(detailRouteStart, revokeRouteStart)
      .includes("requireReportAccessTokenManagementPermission"),
    false,
    "GET /:tokenId no debe exigir permiso de mutacion",
  );
});
