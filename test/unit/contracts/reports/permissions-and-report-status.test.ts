import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getClinicPermissions,
  isClinicUserRole,
  normalizeClinicUserRole,
} from "../../../../server/lib/permissions.ts";
import {
  REPORT_STATUSES,
  canTransitionReportStatus,
  isReportStatus,
  normalizeReportStatus,
} from "../../../../server/features/reports/domain/index.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("isClinicUserRole reconoce únicamente roles válidos", () => {
  assert.equal(isClinicUserRole("clinic_owner"), true);
  assert.equal(isClinicUserRole("clinic_staff"), true);
  assert.equal(isClinicUserRole("admin"), false);
  assert.equal(isClinicUserRole(null), false);
});

test("normalizeClinicUserRole normaliza strings y aplica fallback", () => {
  assert.equal(normalizeClinicUserRole(" clinic_owner "), "clinic_owner");
  assert.equal(normalizeClinicUserRole("CLINIC_STAFF"), "clinic_staff");
  assert.equal(normalizeClinicUserRole("otro"), "clinic_staff");
  assert.equal(normalizeClinicUserRole(undefined, "clinic_owner"), "clinic_owner");
});

test("getClinicPermissions devuelve permisos consistentes por rol", () => {
  // WBR-13 (VET-13): canUploadReports fue retirado del contrato. Subir
  // informes es exclusivo de admin (POST /api/admin/reports/upload); ningun
  // rol de clinica lo evaluaba nunca.
  assert.deepEqual(getClinicPermissions("clinic_owner"), {
    canManageClinicUsers: true,
    canViewLogistics: true,
    canManageLogisticsFieldVisits: true,
    canManageLogisticsRoutePlans: true,
    canManageLogisticsRouteEvents: true,
    canViewLogisticsSla: true,
  });

  assert.deepEqual(getClinicPermissions("clinic_staff"), {
    canManageClinicUsers: false,
    canViewLogistics: true,
    canManageLogisticsFieldVisits: false,
    canManageLogisticsRoutePlans: false,
    canManageLogisticsRouteEvents: false,
    canViewLogisticsSla: true,
  });
});

// WBR-13 (VET-13): canUploadReports era un dead capability contract (siempre
// false para ambos roles, cero consumidores de autorizacion en server/**,
// cero consumidores en frontend). Este guard evita que el campo, o su
// propagacion hacia los 8 archivos que antes lo serializaban, reaparezca.
test("canUploadReports no reaparece en el kernel de permisos ni en sus consumidores conocidos", () => {
  const permissionsSource = read("server/lib/permissions.ts");

  assert.doesNotMatch(
    permissionsSource,
    /canUploadReports/,
    "server/lib/permissions.ts no debe reintroducir el campo retirado",
  );

  const formerConsumers = [
    "server/routes/auth.fastify.ts",
    "server/routes/clinic-audit.fastify.ts",
    "server/routes/clinic-public-profile.fastify.ts",
    "server/routes/particular-tokens.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/reports-status.fastify.ts",
    "server/routes/study-tracking.fastify.ts",
  ];

  for (const file of formerConsumers) {
    assert.doesNotMatch(
      read(file),
      /canUploadReports/,
      `${file} no debe reintroducir canUploadReports`,
    );
  }
});

test("REPORT_STATUSES conserva el orden público esperado", () => {
  assert.deepEqual(REPORT_STATUSES, [
    "uploaded",
    "processing",
    "ready",
    "delivered",
  ]);
});

test("isReportStatus reconoce únicamente estados válidos", () => {
  assert.equal(isReportStatus("uploaded"), true);
  assert.equal(isReportStatus("processing"), true);
  assert.equal(isReportStatus("ready"), true);
  assert.equal(isReportStatus("delivered"), true);
  assert.equal(isReportStatus("draft"), false);
  assert.equal(isReportStatus(null), false);
});

test("normalizeReportStatus normaliza y aplica fallback", () => {
  assert.equal(normalizeReportStatus(" READY "), "ready");
  assert.equal(normalizeReportStatus("Delivered"), "delivered");
  assert.equal(normalizeReportStatus("desconocido"), undefined);
  assert.equal(normalizeReportStatus("desconocido", "processing"), "processing");
  assert.equal(normalizeReportStatus(undefined, "uploaded"), "uploaded");
});

test("canTransitionReportStatus permite transiciones válidas y bloquea inválidas", () => {
  assert.equal(canTransitionReportStatus("uploaded", "processing"), true);
  assert.equal(canTransitionReportStatus("uploaded", "ready"), true);
  assert.equal(canTransitionReportStatus("uploaded", "delivered"), true);

  assert.equal(canTransitionReportStatus("processing", "ready"), true);
  assert.equal(canTransitionReportStatus("processing", "delivered"), true);
  assert.equal(canTransitionReportStatus("ready", "delivered"), true);

  assert.equal(canTransitionReportStatus("uploaded", "uploaded"), false);
  assert.equal(canTransitionReportStatus("processing", "uploaded"), false);
  assert.equal(canTransitionReportStatus("ready", "processing"), false);
  assert.equal(canTransitionReportStatus("delivered", "ready"), false);
  assert.equal(canTransitionReportStatus("delivered", "delivered"), false);
});
