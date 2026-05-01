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

function assertNotContainsAny(
  source: string,
  markers: readonly string[],
  context: string,
): void {
  for (const marker of markers) {
    assert.equal(
      source.includes(marker),
      false,
      `${context} no debe contener todavía: ${marker}`,
    );
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
      `${context} debe conservar orden para: ${marker}`,
    );

    lastIndex = index;
  }
}

test("audit registry aún no declara eventos dedicados para study tracking", () => {
  const auditSource = readSource("server/lib/audit.ts");
  const auditLogSource = readSource("server/lib/audit-log.ts");
  const schemaSource = readSource("drizzle/schema.ts");

  for (const source of [auditSource, auditLogSource, schemaSource]) {
    assertNotContainsAny(
      source,
      [
        "STUDY_TRACKING_CASE_CREATED",
        "STUDY_TRACKING_CASE_UPDATED",
        "STUDY_TRACKING_NOTIFICATION_CREATED",
        "study_tracking.case.created",
        "study_tracking.case.updated",
        "study_tracking.notification.created",
      ],
      "audit event registry",
    );
  }
});

test("clinic study tracking crea actividad operativa sin auditoría dedicada", () => {
  const source = readSource("server/routes/study-tracking.fastify.ts");

  assertContainsAll(
    source,
    [
      "export const studyTrackingNativeRoutes",
      "createStudyTrackingCase?:",
      "updateStudyTrackingCase?:",
      "createStudyTrackingNotification?:",
      "updateParticularTokenReport?:",
      "createdByAdminId: null",
      "createdByClinicUserId: auth.id",
      "await deps.createStudyTrackingCase({",
      "await deps.updateParticularTokenReport(",
      "await deps.createStudyTrackingNotification({",
      "specialStainNotifiedAt: notifiedAt",
    ],
    "clinic study tracking operational writes",
  );

  assertContainsInOrder(
    source,
    [
      "if (!enforceTrustedOrigin(request, reply, allowedOrigins))",
      "const auth = await authenticateClinicUser(request, reply, deps, now);",
      "if (!requireStudyTrackingManagementPermission(auth, reply))",
      "const created = await deps.createStudyTrackingCase({",
    ],
    "clinic study tracking create protection order",
  );

  assertNotContainsAny(
    source,
    [
      "AUDIT_EVENTS",
      "writeAuditLog",
      "createAuditRequestLike",
      "REPORT_UPLOADED",
      "STUDY_TRACKING_CASE_CREATED",
      "study_tracking.case.created",
    ],
    "clinic study tracking audit gap",
  );
});

test("admin study tracking crea y actualiza actividad operativa sin auditoría dedicada", () => {
  const source = readSource("server/routes/admin-study-tracking.fastify.ts");

  assertContainsAll(
    source,
    [
      "export const adminStudyTrackingNativeRoutes",
      "createStudyTrackingCase?:",
      "updateStudyTrackingCase?:",
      "getStudyTrackingCaseById?:",
      "createStudyTrackingNotification?:",
      "updateParticularTokenReport?:",
      "createdByAdminId: admin.id",
      "createdByClinicUserId: null",
      "await deps.createStudyTrackingCase({",
      "await deps.updateParticularTokenReport(",
      "await deps.createStudyTrackingNotification({",
      "app.patch<",
      "await deps.updateStudyTrackingCase(",
    ],
    "admin study tracking operational writes",
  );

  assertContainsInOrder(
    source,
    [
      "if (!enforceTrustedOrigin(request, reply, allowedOrigins))",
      "const admin = await authenticateAdminUser(request, reply, deps, now);",
      "const created = await deps.createStudyTrackingCase({",
      "return reply.code(201).send({",
    ],
    "admin study tracking create protection order",
  );

  assertContainsInOrder(
    source,
    [
      'app.patch<',
      "if (!enforceTrustedOrigin(request, reply, allowedOrigins))",
      "const admin = await authenticateAdminUser(request, reply, deps, now);",
      "const current =",
      "const parsed = updateStudyTrackingSchema.safeParse(body);",
    ],
    "admin study tracking update protection order",
  );

  assertNotContainsAny(
    source,
    [
      "AUDIT_EVENTS",
      "writeAuditLog",
      "createAuditRequestLike",
      "STUDY_TRACKING_CASE_CREATED",
      "STUDY_TRACKING_CASE_UPDATED",
      "study_tracking.case.created",
      "study_tracking.case.updated",
    ],
    "admin study tracking audit gap",
  );
});

test("study tracking gap queda separado de los flujos críticos ya auditados", () => {
  const criticalSource = readSource("test/audit-critical-flow-writes.test.ts");

  assertContainsAll(
    criticalSource,
    [
      "REPORT_UPLOADED",
      "REPORT_STATUS_CHANGED",
      "REPORT_ACCESS_TOKEN_CREATED",
      "REPORT_ACCESS_TOKEN_REVOKED",
      "REPORT_PUBLIC_ACCESSED",
    ],
    "critical audited flows guardrail",
  );

  assertNotContainsAny(
    criticalSource,
    [
      "STUDY_TRACKING_CASE_CREATED",
      "STUDY_TRACKING_CASE_UPDATED",
      "study_tracking.case.created",
      "study_tracking.case.updated",
    ],
    "study tracking gap should remain explicit",
  );
});
