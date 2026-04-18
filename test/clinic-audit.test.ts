import test from "node:test";
import assert from "node:assert/strict";
import { buildClinicAuditListFilters } from "../server/lib/admin-audit.ts";

test("buildClinicAuditListFilters fuerza clinicId de sesion", () => {
  const { filters, errors } = buildClinicAuditListFilters(
    {
      clinicId: "999",
      reportId: "1",
      event: "report.public_accessed",
      limit: "20",
      offset: "0",
    },
    4,
  );

  assert.deepEqual(errors, []);
  assert.equal(filters.clinicId, 4);
  assert.equal(filters.reportId, 1);
  assert.equal(filters.event, "report.public_accessed");
  assert.equal(filters.limit, 20);
  assert.equal(filters.offset, 0);
});

test("buildClinicAuditListFilters limpia actorAdminUserId", () => {
  const { filters, errors } = buildClinicAuditListFilters(
    {
      actorAdminUserId: "1",
      actorType: "admin_user",
    },
    4,
  );

  assert.deepEqual(errors, []);
  assert.equal(filters.clinicId, 4);
  assert.equal(filters.actorAdminUserId, undefined);
  assert.equal(filters.actorType, "admin_user");
});

test("buildClinicAuditListFilters conserva errores base", () => {
  const { errors } = buildClinicAuditListFilters(
    {
      event: "evento-invalido",
    },
    4,
  );

  assert.deepEqual(errors, ["event invalido"]);
});