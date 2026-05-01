import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_EVENTS,
  buildAuditLogInsert,
  buildPublicReportAccessTokenActor,
  normalizeAuditMetadata,
  resolveAuditActorFromRequest,
} from "../server/lib/audit.ts";

test("AUDIT_EVENTS conserva los eventos públicos esperados", () => {
  assert.deepEqual(AUDIT_EVENTS, {
    ADMIN_LOGIN_SUCCEEDED: "auth.admin.login.succeeded",
    CLINIC_LOGIN_SUCCEEDED: "auth.clinic.login.succeeded",
    REPORT_STATUS_CHANGED: "report.status.changed",
    REPORT_UPLOADED: "report.uploaded",
    REPORT_ACCESS_TOKEN_CREATED: "report_access_token.created",
    REPORT_ACCESS_TOKEN_REVOKED: "report_access_token.revoked",
    REPORT_PUBLIC_ACCESSED: "report.public_accessed",
  });
});

test("normalizeAuditMetadata normaliza fechas, arrays y remueve undefined", () => {
  const result = normalizeAuditMetadata({
    reportId: 12,
    ok: true,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    tags: ["uno", 2, false, new Date("2026-04-21T00:00:00.000Z")],
    nested: {
      note: "hola",
      empty: undefined,
      executedAt: new Date("2026-04-22T09:30:00.000Z"),
    },
    skipped: undefined,
  });

  assert.deepEqual(result, {
    reportId: 12,
    ok: true,
    createdAt: "2026-04-20T12:00:00.000Z",
    tags: ["uno", 2, false, "2026-04-21T00:00:00.000Z"],
    nested: {
      note: "hola",
      executedAt: "2026-04-22T09:30:00.000Z",
    },
  });
});

test("normalizeAuditMetadata devuelve null para valores ausentes o raíz inválida", () => {
  assert.equal(normalizeAuditMetadata(undefined), null);
  assert.equal(normalizeAuditMetadata(null as any), null);
  assert.equal(normalizeAuditMetadata(["a", "b"] as any), null);
  assert.equal(normalizeAuditMetadata("texto" as any), null);
});

test("resolveAuditActorFromRequest prioriza override explícito", () => {
  const actor = resolveAuditActorFromRequest(
    {
      adminAuth: { id: 1, username: "admin" },
      auth: { id: 8, clinicId: 3, username: "clinic" },
    },
    {
      type: "public_report_access_token",
      adminUserId: 99,
      clinicUserId: 88,
      reportAccessTokenId: 77,
    },
  );

  assert.deepEqual(actor, {
    type: "public_report_access_token",
    adminUserId: 99,
    clinicUserId: 88,
    reportAccessTokenId: 77,
  });
});

test("resolveAuditActorFromRequest usa adminAuth antes que auth", () => {
  const actor = resolveAuditActorFromRequest({
    adminAuth: { id: 5, username: "VETNEB" },
    auth: { id: 9, clinicId: 2, username: "lab" },
  });

  assert.deepEqual(actor, {
    type: "admin_user",
    adminUserId: 5,
    clinicUserId: null,
    reportAccessTokenId: null,
  });
});

test("resolveAuditActorFromRequest usa clinic auth cuando no hay adminAuth", () => {
  const actor = resolveAuditActorFromRequest({
    auth: { id: 9, clinicId: 2, username: "lab" },
    adminAuth: undefined,
  });

  assert.deepEqual(actor, {
    type: "clinic_user",
    adminUserId: null,
    clinicUserId: 9,
    reportAccessTokenId: null,
  });
});

test("resolveAuditActorFromRequest devuelve system cuando no hay autenticación", () => {
  const actor = resolveAuditActorFromRequest({
    auth: undefined,
    adminAuth: undefined,
  });

  assert.deepEqual(actor, {
    type: "system",
    adminUserId: null,
    clinicUserId: null,
    reportAccessTokenId: null,
  });
});

test("buildPublicReportAccessTokenActor construye actor público esperado", () => {
  assert.deepEqual(buildPublicReportAccessTokenActor(44), {
    type: "public_report_access_token",
    adminUserId: null,
    clinicUserId: null,
    reportAccessTokenId: 44,
  });
});

test("buildAuditLogInsert hereda clinicId desde auth y sanitiza requestPath", () => {
  const payload = buildAuditLogInsert(
    {
      method: "GET",
      originalUrl: "/api/public/report-access/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef?token=abcdef",
      ip: "127.0.0.1",
      headers: {
        "user-agent": "Mozilla/5.0",
      },
      requestId: "req-123",
      auth: {
        id: 10,
        clinicId: 4,
        username: "clinic-user",
      },
      adminAuth: undefined,
    } as any,
    {
      event: AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED,
      reportId: 15,
      metadata: {
        tokenPreview: "abcd",
        when: new Date("2026-04-20T15:00:00.000Z"),
      },
    },
  );

  assert.equal(payload.event, "report.public_accessed");
  assert.equal(payload.actorType, "clinic_user");
  assert.equal(payload.actorClinicUserId, 10);
  assert.equal(payload.actorAdminUserId, null);
  assert.equal(payload.clinicId, 4);
  assert.equal(payload.reportId, 15);
  assert.equal(payload.requestId, "req-123");
  assert.equal(payload.requestMethod, "GET");
  assert.equal(payload.ipAddress, "127.0.0.1");
  assert.equal(payload.userAgent, "Mozilla/5.0");
  assert.equal(
    payload.requestPath,
    "/api/public/report-access/[REDACTED]?token=[REDACTED]",
  );
  assert.deepEqual(payload.metadata, {
    tokenPreview: "abcd",
    when: "2026-04-20T15:00:00.000Z",
  });
});

test("buildAuditLogInsert respeta actor override e input.clinicId explícito", () => {
  const payload = buildAuditLogInsert(
    {
      method: "POST",
      originalUrl: "/api/admin/reports/22/status",
      ip: null,
      headers: {},
      requestId: undefined,
      auth: {
        id: 5,
        clinicId: 3,
        username: "clinic-user",
      },
      adminAuth: {
        id: 1,
        username: "admin",
      },
    } as any,
    {
      event: AUDIT_EVENTS.REPORT_STATUS_CHANGED,
      clinicId: 99,
      reportId: 22,
      targetClinicUserId: 7,
      actor: {
        type: "public_report_access_token",
        reportAccessTokenId: 50,
      },
      metadata: {
        from: "processing",
        to: "ready",
        ignored: undefined,
      },
    },
  );

  assert.equal(payload.actorType, "public_report_access_token");
  assert.equal(payload.actorReportAccessTokenId, 50);
  assert.equal(payload.actorAdminUserId, null);
  assert.equal(payload.actorClinicUserId, null);
  assert.equal(payload.clinicId, 99);
  assert.equal(payload.targetClinicUserId, 7);
  assert.equal(payload.requestPath, "/api/admin/reports/22/status");
  assert.equal(payload.userAgent, null);
  assert.deepEqual(payload.metadata, {
    from: "processing",
    to: "ready",
  });
});
