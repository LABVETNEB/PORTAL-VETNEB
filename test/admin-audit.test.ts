import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminAuditCsv,
  buildAdminAuditCsvFilename,
  buildAdminAuditListFilters,
  normalizeAuditListMetadata,
  serializeAuditLogListItem,
} from "../server/lib/admin-audit.ts";

test("buildAdminAuditListFilters parsea filtros validos", () => {
  const { filters, errors } = buildAdminAuditListFilters({
    event: "report.public_accessed",
    actorType: "public_report_access_token",
    clinicId: "4",
    reportId: "1",
    actorReportAccessTokenId: "5",
    targetReportAccessTokenId: "5",
    from: "2026-04-17T00:00:00.000Z",
    to: "2026-04-18T00:00:00.000Z",
    limit: "20",
    offset: "5",
  });

  assert.deepEqual(errors, []);
  assert.equal(filters.event, "report.public_accessed");
  assert.equal(filters.actorType, "public_report_access_token");
  assert.equal(filters.clinicId, 4);
  assert.equal(filters.reportId, 1);
  assert.equal(filters.actorReportAccessTokenId, 5);
  assert.equal(filters.targetReportAccessTokenId, 5);
  assert.equal(filters.limit, 20);
  assert.equal(filters.offset, 5);
  assert.equal(filters.from?.toISOString(), "2026-04-17T00:00:00.000Z");
  assert.equal(filters.to?.toISOString(), "2026-04-18T00:00:00.000Z");
});

test("buildAdminAuditListFilters informa error para event invalido", () => {
  const { errors } = buildAdminAuditListFilters({
    event: "cualquier-cosa",
  });

  assert.deepEqual(errors, ["event invalido"]);
});

test("buildAdminAuditListFilters aplica defaults seguros", () => {
  const { filters, errors } = buildAdminAuditListFilters({});

  assert.deepEqual(errors, []);
  assert.equal(filters.limit, 50);
  assert.equal(filters.offset, 0);
});

test("normalizeAuditListMetadata parsea JSON string", () => {
  const metadata = normalizeAuditListMetadata(
    '{"tokenLast4":"43de","accessCount":2}',
  );

  assert.deepEqual(metadata, {
    tokenLast4: "43de",
    accessCount: 2,
  });
});

test("serializeAuditLogListItem mapea snake_case y metadata", () => {
  const item = serializeAuditLogListItem({
    id: 16,
    event: "report.public_accessed",
    action: "report.public_accessed",
    entity: "report_access_token",
    entity_id: 1,
    actor_type: "public_report_access_token",
    actor_admin_user_id: null,
    actor_clinic_user_id: null,
    actor_report_access_token_id: 5,
    clinic_id: 4,
    report_id: 1,
    target_admin_user_id: null,
    target_clinic_user_id: null,
    target_report_access_token_id: 5,
    request_id: null,
    request_method: "GET",
    request_path: "/api/public/report-access/[REDACTED]",
    ip_address: "127.0.0.1",
    user_agent: "test-agent",
    metadata: '{"tokenLast4":"43de","accessCount":2}',
    created_at: "2026-04-17 17:10:58.921445",
  });

  assert.equal(item.actorType, "public_report_access_token");
  assert.equal(item.actorReportAccessTokenId, 5);
  assert.deepEqual(item.metadata, {
    tokenLast4: "43de",
    accessCount: 2,
  });
  assert.equal(item.requestPath, "/api/public/report-access/[REDACTED]");
});

test("buildAdminAuditCsv genera cabecera, escapa valores y serializa metadata", () => {
  const csv = buildAdminAuditCsv([
    {
      id: 16,
      event: "report.public_accessed",
      action: "report.public_accessed",
      entity: "report_access_token",
      entityId: 1,
      actorType: "public_report_access_token",
      actorAdminUserId: null,
      actorClinicUserId: null,
      actorReportAccessTokenId: 5,
      clinicId: 4,
      reportId: 1,
      targetAdminUserId: null,
      targetClinicUserId: null,
      targetReportAccessTokenId: 5,
      requestId: "req-123",
      requestMethod: "GET",
      requestPath: "/api/admin/audit-log/export.csv?event=report.public_accessed",
      ipAddress: "127.0.0.1",
      userAgent: 'Mozilla/5.0 "Windows"',
      metadata: {
        tokenLast4: "43de",
        note: "linea 1\nlinea 2",
      },
      createdAt: "2026-04-17 17:10:58.921445",
    },
  ]);

  const lines = csv.split("\n");

  assert.match(lines[0], /^\uFEFFid,event,action,entity,entityId,/);
  assert.match(lines[1], /report\.public_accessed/);
  assert.match(lines[1], /"Mozilla\/5\.0 ""Windows"""/);
  assert.match(lines[1], /"\{""tokenLast4"":""43de"",""note"":""linea 1\\nlinea 2""\}"/);
  assert.match(lines[1], /2026-04-17T17:10:58\.921Z$/);
});

test("buildAdminAuditCsvFilename genera nombre estable y seguro", () => {
  const filename = buildAdminAuditCsvFilename(
    new Date("2026-04-18T13:22:33.456Z"),
  );

  assert.equal(filename, "admin-audit-log-2026-04-18T13-22-33-456Z.csv");
});
