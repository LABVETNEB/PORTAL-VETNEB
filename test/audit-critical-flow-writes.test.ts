import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertContainsAll(
  source: string,
  markers: readonly string[],
  context: string,
): void {
  for (const marker of markers) {
    assert.ok(source.includes(marker), `${context} debe contener: ${marker}`);
  }
}

function assertContainsInOrder(
  source: string,
  markers: readonly string[],
  context: string,
): void {
  let lastIndex = -1;

  for (const marker of markers) {
    const index = source.indexOf(marker, lastIndex + 1);

    assert.notEqual(index, -1, `${context} debe contener: ${marker}`);
    assert.ok(
      index > lastIndex,
      `${context} debe conservar orden antes/después para: ${marker}`,
    );

    lastIndex = index;
  }
}

test("audit event registry conserva eventos críticos con nombres públicos estables", () => {
  const source = readSource("server/lib/audit.ts");

  assertContainsAll(
    source,
    [
      'ADMIN_LOGIN_SUCCEEDED: "auth.admin.login.succeeded"',
      'CLINIC_LOGIN_SUCCEEDED: "auth.clinic.login.succeeded"',
      'REPORT_STATUS_CHANGED: "report.status.changed"',
      'REPORT_ACCESS_TOKEN_CREATED: "report_access_token.created"',
      'REPORT_ACCESS_TOKEN_REVOKED: "report_access_token.revoked"',
      'REPORT_PUBLIC_ACCESSED: "report.public_accessed"',
    ],
    "AUDIT_EVENTS",
  );
});

test("auth login crítico escribe audit log con actor y target correctos", () => {
  const adminAuth = readSource("server/routes/admin-auth.fastify.ts");
  const clinicAuth = readSource("server/routes/auth.fastify.ts");

  assertContainsAll(
    adminAuth,
    [
      "writeAuditLog?:",
      "writeAuditLog: audit.writeAuditLog",
      "await deps.writeAuditLog(createAuditRequestLike(request), {",
      "event: AUDIT_EVENTS.ADMIN_LOGIN_SUCCEEDED",
      "targetAdminUserId: admin.id",
      "username: admin.username",
      "sessionExpiresAt: expiresAt",
      'type: "admin_user"',
      "adminUserId: admin.id",
    ],
    "admin auth login audit",
  );

  assertContainsAll(
    clinicAuth,
    [
      "writeAuditLog?:",
      "writeAuditLog: audit.writeAuditLog",
      "await deps.writeAuditLog(createAuditRequestLike(request), {",
      "event: AUDIT_EVENTS.CLINIC_LOGIN_SUCCEEDED",
      "clinicId: clinicUser.clinicId",
      "targetClinicUserId: clinicUser.id",
      "username: clinicUser.username",
      "role,",
      "sessionExpiresAt: expiresAt",
      'type: "clinic_user"',
      "clinicUserId: clinicUser.id",
    ],
    "clinic auth login audit",
  );
});

test("report status crítico audita después de mutar estado exitosamente", () => {
  const source = readSource("server/routes/reports-status.fastify.ts");

  assertContainsInOrder(
    source,
    [
      "const updated = await deps.updateReportStatus({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "event: AUDIT_EVENTS.REPORT_STATUS_CHANGED",
    ],
    "reports status audit order",
  );

  assertContainsAll(
    source,
    [
      "clinicId: updated.clinicId",
      "reportId: updated.id",
      "fromStatus: reportResult.report.currentStatus",
      "toStatus: nextStatus",
      "note,",
    ],
    "reports status audit payload",
  );
});

test("clinic report access token create y revoke escriben audit log con target token", () => {
  const source = readSource("server/routes/report-access-tokens.fastify.ts");

  assertContainsInOrder(
    source,
    [
      "const reportAccessToken = await deps.createReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
    ],
    "clinic report access token create audit order",
  );

  assertContainsAll(
    source,
    [
      "clinicId: reportAccessToken.clinicId",
      "reportId: reportAccessToken.reportId",
      "targetReportAccessTokenId: reportAccessToken.id",
      "tokenLast4: reportAccessToken.tokenLast4",
      'createdVia: "clinic"',
    ],
    "clinic report access token create audit payload",
  );

  assertContainsInOrder(
    source,
    [
      "const revoked = await deps.revokeReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
    ],
    "clinic report access token revoke audit order",
  );

  assertContainsAll(
    source,
    [
      "clinicId: revoked.clinicId",
      "reportId: revoked.reportId",
      "targetReportAccessTokenId: revoked.id",
      "tokenLast4: revoked.tokenLast4",
      "revokedAt: revoked.revokedAt",
      'revokedVia: "clinic"',
    ],
    "clinic report access token revoke audit payload",
  );
});

test("admin report access token create y revoke escriben audit log con target token", () => {
  const source = readSource("server/routes/admin-report-access-tokens.fastify.ts");

  assertContainsInOrder(
    source,
    [
      "const reportAccessToken = await deps.createReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
    ],
    "admin report access token create audit order",
  );

  assertContainsAll(
    source,
    [
      "clinicId: reportAccessToken.clinicId",
      "reportId: reportAccessToken.reportId",
      "targetReportAccessTokenId: reportAccessToken.id",
      "tokenLast4: reportAccessToken.tokenLast4",
      'createdVia: "admin"',
    ],
    "admin report access token create audit payload",
  );

  assertContainsInOrder(
    source,
    [
      "const revoked = await deps.revokeReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
    ],
    "admin report access token revoke audit order",
  );

  assertContainsAll(
    source,
    [
      "clinicId: revoked.clinicId",
      "reportId: revoked.reportId",
      "targetReportAccessTokenId: revoked.id",
      "tokenLast4: revoked.tokenLast4",
      "revokedAt: revoked.revokedAt",
      'revokedVia: "admin"',
    ],
    "admin report access token revoke audit payload",
  );
});

test("public report access audita acceso exitoso con actor de token público", () => {
  const source = readSource("server/routes/public-report-access.fastify.ts");

  assertContainsInOrder(
    source,
    [
      "const updatedToken = await deps.recordReportAccessTokenAccess(record.token.id);",
      "await deps.writeAuditLog(request, {",
      "event: AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED",
    ],
    "public report access audit order",
  );

  assertContainsAll(
    source,
    [
      "clinicId: record.token.clinicId",
      "reportId: record.token.reportId",
      "targetReportAccessTokenId: record.token.id",
      "actor: buildPublicReportAccessTokenActor(record.token.id)",
      "tokenLast4: record.token.tokenLast4",
      "accessCount: updatedToken?.accessCount ?? record.token.accessCount + 1",
      "lastAccessAt: updatedToken?.lastAccessAt ?? new Date(currentTime)",
    ],
    "public report access audit payload",
  );
});

test("rutas críticas auditadas mantienen writeAuditLog inyectable y default real", () => {
  const files = [
    "server/routes/admin-auth.fastify.ts",
    "server/routes/auth.fastify.ts",
    "server/routes/reports-status.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/admin-report-access-tokens.fastify.ts",
    "server/routes/public-report-access.fastify.ts",
  ] as const;

  for (const file of files) {
    const source = readSource(file);

    assert.match(source, /writeAuditLog\?:/);
    assert.match(source, /writeAuditLog: audit\.writeAuditLog/);
    assert.match(source, /options\.writeAuditLog \?\? defaultDeps!\.writeAuditLog|writeAuditLog: options\.writeAuditLog \?\? defaultDeps!\.writeAuditLog/);
  }
});

test("admin report upload audita creación exitosa de informe por admin", () => {
  const source = readSource("server/routes/admin-reports.fastify.ts");

  assertContainsAll(
    source,
    [
      "writeAuditLog?:",
      "writeAuditLog: audit.writeAuditLog",
      "createdByAdminUserId: admin.id",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.REPORT_UPLOADED",
      "clinicId: report.clinicId",
      "reportId: report.id",
      "fileName: file.originalname",
      "mimeType: file.mimetype",
      "storagePath,",
      "uploadedVia: \"admin\"",
    ],
    "admin report upload audit payload",
  );

  assertContainsInOrder(
    source,
    [
      "const storagePath = await deps.uploadReport({",
      "const report = await deps.upsertReport({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "return reply.code(201).send({",
    ],
    "admin report upload audit order",
  );
});
