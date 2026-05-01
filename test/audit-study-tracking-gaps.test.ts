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
    assert.ok(index > lastIndex, `${context} debe conservar orden para: ${marker}`);

    lastIndex = index;
  }
}

test("audit registry declara eventos dedicados para study tracking", () => {
  const auditSource = readSource("server/lib/audit.ts");
  const auditLogSource = readSource("server/lib/audit-log.ts");
  const schemaSource = readSource("drizzle/schema.ts");

  for (const source of [auditSource, auditLogSource, schemaSource]) {
    assertContainsAll(
      source,
      [
        "study_tracking.case.created",
        "study_tracking.case.updated",
        "study_tracking.notification.created",
      ],
      "audit event registry",
    );
  }

  assertContainsAll(
    auditSource,
    [
      "STUDY_TRACKING_CASE_CREATED",
      "STUDY_TRACKING_CASE_UPDATED",
      "STUDY_TRACKING_NOTIFICATION_CREATED",
    ],
    "AUDIT_EVENTS study tracking",
  );
});

test("clinic study tracking audita creación de caso y notificación especial", () => {
  const source = readSource("server/routes/study-tracking.fastify.ts");

  assertContainsAll(
    source,
    [
      "writeAuditLog?:",
      "writeAuditLog: audit.writeAuditLog",
      "createAuditRequestLike",
      "event: AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
      "event: AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
      "createdVia: \"clinic\"",
      "trackingCaseId: finalCase.id",
      "notificationId: studyTrackingNotification.id",
    ],
    "clinic study tracking audit",
  );

  assertContainsInOrder(
    source,
    [
      "const created = await deps.createStudyTrackingCase({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "event: AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
    ],
    "clinic case created audit order",
  );
});

test("admin study tracking audita creación, actualización y notificación especial", () => {
  const source = readSource("server/routes/admin-study-tracking.fastify.ts");

  assertContainsAll(
    source,
    [
      "writeAuditLog?:",
      "writeAuditLog: audit.writeAuditLog",
      "createAuditRequestLike",
      "event: AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
      "event: AUDIT_EVENTS.STUDY_TRACKING_CASE_UPDATED",
      "event: AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
      "createdVia: \"admin\"",
      "updatedVia: \"admin\"",
    ],
    "admin study tracking audit",
  );

  assertContainsInOrder(
    source,
    [
      "const created = await deps.createStudyTrackingCase({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
    ],
    "admin case created audit order",
  );

  assertContainsInOrder(
    source,
    [
      "const updated = await deps.updateStudyTrackingCase(",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.STUDY_TRACKING_CASE_UPDATED",
    ],
    "admin case updated audit order",
  );
});

test("study tracking queda integrado en flujos críticos auditados", () => {
  const criticalSource = readSource("test/audit-critical-flow-writes.test.ts");

  assertContainsAll(
    criticalSource,
    [
      "STUDY_TRACKING_CASE_CREATED",
      "STUDY_TRACKING_CASE_UPDATED",
      "STUDY_TRACKING_NOTIFICATION_CREATED",
    ],
    "critical audited flows guardrail",
  );
});
