import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminAuditCsv,
  buildAdminAuditListFilters,
  buildClinicAuditListFilters,
  normalizeAuditListMetadata,
  serializeAuditLogListItem,
} from "../server/lib/admin-audit.ts";

test("buildAdminAuditListFilters acumula errores para filtros invalidos y limita paginacion maxima", () => {
  const { filters, errors } = buildAdminAuditListFilters({
    event: "evento-invalido",
    actorType: "actor-invalido",
    clinicId: "0",
    reportId: "-2",
    actorAdminUserId: "abc",
    actorClinicUserId: "1.5",
    actorReportAccessTokenId: "-7",
    targetReportAccessTokenId: "zzz",
    from: "no-fecha",
    to: "2026-99-99",
    limit: "500",
    offset: "-3",
  });

  assert.deepEqual(errors, [
    "event invalido",
    "actorType invalido",
    "clinicId invalido",
    "reportId invalido",
    "actorAdminUserId invalido",
    "actorClinicUserId invalido",
    "actorReportAccessTokenId invalido",
    "targetReportAccessTokenId invalido",
    "from invalido",
    "to invalido",
  ]);

  assert.equal(filters.event, undefined);
  assert.equal(filters.actorType, undefined);
  assert.equal(filters.clinicId, undefined);
  assert.equal(filters.reportId, undefined);
  assert.equal(filters.actorAdminUserId, undefined);
  assert.equal(filters.actorClinicUserId, undefined);
  assert.equal(filters.actorReportAccessTokenId, undefined);
  assert.equal(filters.targetReportAccessTokenId, undefined);
  assert.equal(filters.from, undefined);
  assert.equal(filters.to, undefined);
  assert.equal(filters.limit, 100);
  assert.equal(filters.offset, 0);
});

test("buildAdminAuditListFilters ignora blanks y aplica defaults seguros para limit y offset", () => {
  const { filters, errors } = buildAdminAuditListFilters({
    event: "   ",
    actorType: " ",
    clinicId: "   ",
    reportId: "",
    limit: "abc",
    offset: "NaN",
  });

  assert.deepEqual(errors, []);
  assert.equal(filters.event, undefined);
  assert.equal(filters.actorType, undefined);
  assert.equal(filters.clinicId, undefined);
  assert.equal(filters.reportId, undefined);
  assert.equal(filters.limit, 50);
  assert.equal(filters.offset, 0);
});

test("normalizeAuditListMetadata rechaza roots invalidas y conserva objetos directos", () => {
  const directObject = {
    ok: true,
    nested: {
      count: 2,
    },
  };

  assert.equal(normalizeAuditListMetadata("no-es-json"), null);
  assert.equal(normalizeAuditListMetadata("[1,2,3]"), null);
  assert.equal(normalizeAuditListMetadata(["x", "y"] as any), null);
  assert.deepEqual(normalizeAuditListMetadata(directObject), directObject);
});

test("serializeAuditLogListItem convierte campos numericos y limpia metadata o strings invalidos", () => {
  const createdAt = new Date("2026-04-22T12:34:56.789Z");

  const item = serializeAuditLogListItem({
    id: "16",
    event: "report.public_accessed",
    action: 99,
    entity: "report_access_token",
    entity_id: "1",
    actor_type: "public_report_access_token",
    actor_admin_user_id: "",
    actor_clinic_user_id: "4",
    actor_report_access_token_id: "5",
    clinic_id: "2",
    report_id: "3",
    target_admin_user_id: null,
    target_clinic_user_id: "7",
    target_report_access_token_id: "8",
    request_id: 100,
    request_method: ["GET"],
    request_path: "/api/admin/audit-log",
    ip_address: "127.0.0.1",
    user_agent: null,
    metadata: "json-invalido",
    created_at: createdAt,
  });

  assert.equal(item.id, 16);
  assert.equal(item.event, "report.public_accessed");
  assert.equal(item.action, null);
  assert.equal(item.entity, "report_access_token");
  assert.equal(item.entityId, 1);
  assert.equal(item.actorType, "public_report_access_token");
  assert.equal(item.actorAdminUserId, null);
  assert.equal(item.actorClinicUserId, 4);
  assert.equal(item.actorReportAccessTokenId, 5);
  assert.equal(item.clinicId, 2);
  assert.equal(item.reportId, 3);
  assert.equal(item.targetAdminUserId, null);
  assert.equal(item.targetClinicUserId, 7);
  assert.equal(item.targetReportAccessTokenId, 8);
  assert.equal(item.requestId, null);
  assert.equal(item.requestMethod, null);
  assert.equal(item.requestPath, "/api/admin/audit-log");
  assert.equal(item.ipAddress, "127.0.0.1");
  assert.equal(item.userAgent, null);
  assert.equal(item.metadata, null);
  const createdAtValue = item.createdAt;
  assert.ok(createdAtValue instanceof Date);
  assert.equal(createdAtValue.toISOString(), "2026-04-22T12:34:56.789Z");
});

test("buildAdminAuditCsv escapa comas y comillas y maneja createdAt vacio o invalido", () => {
  const csv = buildAdminAuditCsv([
    {
      id: 1,
      event: "report.public_accessed",
      action: "report.public_accessed",
      entity: "report_access_token",
      entityId: 10,
      actorType: "public_report_access_token",
      actorAdminUserId: null,
      actorClinicUserId: null,
      actorReportAccessTokenId: 5,
      clinicId: 4,
      reportId: 20,
      targetAdminUserId: null,
      targetClinicUserId: null,
      targetReportAccessTokenId: 5,
      requestId: "req-1",
      requestMethod: "GET",
      requestPath: "/api/admin/audit-log/export.csv",
      ipAddress: "127.0.0.1",
      userAgent: 'Agent, "Quoted"',
      metadata: {
        scope: "all",
      },
      createdAt: "",
    },
    {
      id: 2,
      event: "report.status.changed",
      action: "report.status.changed",
      entity: "report",
      entityId: 21,
      actorType: "admin_user",
      actorAdminUserId: 1,
      actorClinicUserId: null,
      actorReportAccessTokenId: null,
      clinicId: 4,
      reportId: 21,
      targetAdminUserId: null,
      targetClinicUserId: null,
      targetReportAccessTokenId: null,
      requestId: "req-2",
      requestMethod: "POST",
      requestPath: "/api/admin/reports/21/status",
      ipAddress: "127.0.0.2",
      userAgent: "test-agent",
      metadata: {
        reason: "invalid-date",
      },
      createdAt: "texto-no-fecha",
    },
  ]);

  const lines = csv.split("\n");

  assert.match(lines[0], /^\uFEFFid,event,action,entity,entityId,/);
  assert.match(lines[1], /"Agent, ""Quoted"""/);
  assert.match(lines[1], /"{"".*scope.*}"/);
  assert.match(lines[1], /,$/);
  assert.match(lines[2], /texto-no-fecha$/);
});

test("buildClinicAuditListFilters fuerza clinicId de sesion y limpia actorAdminUserId aun en bordes de paginacion", () => {
  const { filters, errors } = buildClinicAuditListFilters(
    {
      clinicId: "999",
      actorAdminUserId: "12",
      actorType: "clinic_user",
      limit: "999",
      offset: "-10",
    },
    4,
  );

  assert.deepEqual(errors, []);
  assert.equal(filters.clinicId, 4);
  assert.equal(filters.actorAdminUserId, undefined);
  assert.equal(filters.actorType, "clinic_user");
  assert.equal(filters.limit, 100);
  assert.equal(filters.offset, 0);
});
