import test from "node:test";
import assert from "node:assert/strict";

const { AUDIT_EVENTS, createWriteAuditLog } = await import(
  "../server/lib/audit.ts"
);

test("writeAuditLog inserta payload y registra éxito", async () => {
  const createAuditLogCalls: unknown[] = [];
  const logInfoCalls: Array<{ message: string; data: unknown }> = [];
  const logErrorCalls: Array<{ message: string; data: unknown }> = [];
  const serializeErrorCalls: unknown[] = [];

  const writeAuditLog = createWriteAuditLog({
    createAuditLog: async (payload) => {
      createAuditLogCalls.push(payload);
    },
    logInfo: (message, data) => {
      logInfoCalls.push({ message, data });
    },
    logError: (message, data) => {
      logErrorCalls.push({ message, data });
    },
    serializeError: (error) => {
      serializeErrorCalls.push(error);
      return { serialized: true };
    },
  });

  const originalUrl =
    `/api/public/report-access/${"a".repeat(64)}?token=${"b".repeat(64)}`;

  await writeAuditLog(
    {
      method: "POST",
      originalUrl,
      ip: "127.0.0.1",
      headers: {
        "user-agent": "UnitTest",
      },
      requestId: "req-1",
      auth: {
        id: 9,
        clinicId: 7,
        username: "clinic-user",
        role: "clinic_owner",
      },
    } as any,
    {
      event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED,
      reportId: 22,
      targetReportAccessTokenId: 55,
      metadata: {
        when: new Date("2026-04-21T12:00:00.000Z"),
        nested: {
          ok: true,
          skip: undefined,
        },
      },
    },
  );

  assert.equal(createAuditLogCalls.length, 1);

  const payload = createAuditLogCalls[0] as any;

  assert.equal(payload.event, AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED);
  assert.equal(payload.actorType, "clinic_user");
  assert.equal(payload.actorClinicUserId, 9);
  assert.equal(payload.clinicId, 7);
  assert.equal(payload.reportId, 22);
  assert.equal(payload.targetReportAccessTokenId, 55);
  assert.equal(payload.requestId, "req-1");
  assert.equal(payload.requestMethod, "POST");
  assert.equal(payload.ipAddress, "127.0.0.1");
  assert.equal(payload.userAgent, "UnitTest");
  assert.equal(payload.requestPath === originalUrl, false);
  assert.match(payload.requestPath, /\/api\/public\/report-access\//);
  assert.deepEqual(payload.metadata, {
    when: "2026-04-21T12:00:00.000Z",
    nested: {
      ok: true,
    },
  });

  assert.deepEqual(logErrorCalls, []);
  assert.deepEqual(serializeErrorCalls, []);
  assert.deepEqual(logInfoCalls, [
    {
      message: "AUDIT_LOG_WRITTEN",
      data: {
        event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED,
        actorType: "clinic_user",
        clinicId: 7,
        reportId: 22,
        targetReportAccessTokenId: 55,
      },
    },
  ]);
});

test("writeAuditLog absorbe errores de escritura y registra error serializado", async () => {
  const expectedError = new Error("db down");
  const logInfoCalls: Array<{ message: string; data: unknown }> = [];
  const logErrorCalls: Array<{ message: string; data: unknown }> = [];
  const serializeErrorCalls: unknown[] = [];

  const writeAuditLog = createWriteAuditLog({
    createAuditLog: async () => {
      throw expectedError;
    },
    logInfo: (message, data) => {
      logInfoCalls.push({ message, data });
    },
    logError: (message, data) => {
      logErrorCalls.push({ message, data });
    },
    serializeError: (error) => {
      serializeErrorCalls.push(error);
      return {
        message: "db down",
      };
    },
  });

  await writeAuditLog(
    {
      method: "PATCH",
      originalUrl: "/api/reports/4/status",
      ip: "127.0.0.1",
      headers: {},
      requestId: "req-2",
      adminAuth: {
        id: 1,
        username: "VETNEB",
      },
    } as any,
    {
      event: AUDIT_EVENTS.REPORT_STATUS_CHANGED,
      clinicId: 3,
      reportId: 4,
      metadata: {
        from: "processing",
        to: "ready",
      },
    },
  );

  assert.deepEqual(logInfoCalls, []);
  assert.deepEqual(serializeErrorCalls, [expectedError]);
  assert.deepEqual(logErrorCalls, [
    {
      message: "AUDIT_LOG_WRITE_ERROR",
      data: {
        event: AUDIT_EVENTS.REPORT_STATUS_CHANGED,
        error: {
          message: "db down",
        },
      },
    },
  ]);
});
