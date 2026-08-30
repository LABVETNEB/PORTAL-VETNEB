import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertIncludes(source: string, expected: string, context: string): void {
  assert.ok(source.includes(expected), `${context} missing ${expected}`);
}

function assertNotIncludes(
  source: string,
  unexpected: string,
  context: string,
): void {
  assert.ok(
    !source.includes(unexpected),
    `${context} must not include ${unexpected}`,
  );
}

const permissionsPath = "server/lib/permissions.ts";

const logisticsRouteFiles = [
  {
    path: "server/routes/logistics-field-visits.fastify.ts",
    managePermission: "canManageLogisticsFieldVisits",
  },
  {
    path: "server/routes/logistics-route-plans.fastify.ts",
    managePermission: "canManageLogisticsRoutePlans",
  },
  {
    path: "server/routes/logistics-route-events.fastify.ts",
    managePermission: "canManageLogisticsRouteEvents",
  },
] as const;

test("clinic permissions expose explicit logistics RBAC actions", () => {
  const source = read(permissionsPath);

  for (const permission of [
    "canViewLogistics",
    "canManageLogisticsFieldVisits",
    "canManageLogisticsRoutePlans",
    "canManageLogisticsRouteEvents",
    "canViewLogisticsSla",
  ]) {
    assertIncludes(source, permission, permissionsPath);
  }

  assertIncludes(source, 'case "clinic_owner":', permissionsPath);
  assertIncludes(source, "canManageLogisticsFieldVisits: true", permissionsPath);
  assertIncludes(source, "canManageLogisticsRoutePlans: true", permissionsPath);
  assertIncludes(source, "canManageLogisticsRouteEvents: true", permissionsPath);

  assertIncludes(source, 'case "clinic_staff":', permissionsPath);
  assertIncludes(source, "canManageLogisticsFieldVisits: false", permissionsPath);
  assertIncludes(source, "canManageLogisticsRoutePlans: false", permissionsPath);
  assertIncludes(source, "canManageLogisticsRouteEvents: false", permissionsPath);
});

test("logistics route modules enforce RBAC before unsafe mutations", () => {
  for (const routeFile of logisticsRouteFiles) {
    const source = read(routeFile.path);

    assertIncludes(source, 'from "../lib/permissions.ts"', routeFile.path);
    assertIncludes(source, "getClinicPermissions", routeFile.path);
    assertIncludes(source, "fastify-clinic-auth.ts", routeFile.path);
    assertIncludes(source, "function enforceLogisticsPermission", routeFile.path);
    assertIncludes(source, "UNSAFE_METHODS", routeFile.path);
    assertIncludes(source, routeFile.managePermission, routeFile.path);
    assertIncludes(
      source,
      `getClinicPermissions(auth.role).${routeFile.managePermission}`,
      routeFile.path,
    );
    assertIncludes(source, "Permisos insuficientes para logistica", routeFile.path);
  }
});

test("logistics RBAC does not reuse report upload or clinic user management permissions", () => {
  for (const routeFile of logisticsRouteFiles) {
    const source = read(routeFile.path);

    assertNotIncludes(source, "canUploadReports", routeFile.path);
    assertNotIncludes(source, "canManageClinicUsers", routeFile.path);
  }
});
