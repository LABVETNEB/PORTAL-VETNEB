import test from "node:test";
import assert from "node:assert/strict";
import {
  getClinicPermissions,
  isClinicUserRole,
  normalizeClinicUserRole,
} from "../server/lib/permissions.ts";
import {
  REPORT_STATUSES,
  canTransitionReportStatus,
  isReportStatus,
  normalizeReportStatus,
} from "../server/lib/report-status.ts";

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
  assert.deepEqual(getClinicPermissions("clinic_owner"), {
    canUploadReports: false,
    canManageClinicUsers: true,
  });

  assert.deepEqual(getClinicPermissions("clinic_staff"), {
    canUploadReports: false,
    canManageClinicUsers: false,
  });
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
