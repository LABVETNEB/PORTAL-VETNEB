import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

type FileAnchor = {
  path: string;
  markers: readonly string[];
};

type StudyTrackingSuiteEntry = {
  slug: string;
  purpose: string;
  testFiles: readonly FileAnchor[];
  runtimeAnchors: readonly FileAnchor[];
};

const STUDY_TRACKING_SUITE: readonly StudyTrackingSuiteEntry[] = [
  {
    slug: "study-tracking-domain-helpers",
    purpose:
      "Study tracking domain helpers keep schemas, delivery rules, stage timestamps, notification rules and serializers explicit.",
    testFiles: [
      {
        path: "test/study-tracking.test.ts",
        markers: [
          "adminCreateStudyTrackingSchema",
          "updateStudyTrackingSchema",
          "calculateEstimatedDeliveryAt",
          "applyEstimatedDeliveryRules",
          "applyStageTimestampDefaults",
          "shouldCreateSpecialStainNotification",
          "serializeStudyTrackingCase",
          "serializeStudyTrackingNotification",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/study-tracking.ts",
        markers: [
          "export const STUDY_TRACKING_STAGES",
          "export const adminCreateStudyTrackingSchema",
          "export const clinicCreateStudyTrackingSchema",
          "export const updateStudyTrackingSchema",
          "export function calculateEstimatedDeliveryAt",
          "export function applyEstimatedDeliveryRules",
          "export function applyStageTimestampDefaults",
          "export function shouldCreateSpecialStainNotification",
          "export function serializeStudyTrackingCase",
          "export function serializeStudyTrackingNotification",
        ],
      },
    ],
  },
  {
    slug: "clinic-study-tracking-routes",
    purpose:
      "Clinic study tracking routes keep authenticated clinic scope, management permission, links, notifications, email and audit writes.",
    testFiles: [
      {
        path: "test/study-tracking.fastify.test.ts",
        markers: [
          "studyTrackingNativeRoutes",
          "createStudyTrackingCase",
          "updateParticularTokenReport",
          "createStudyTrackingNotification",
          "listStudyTrackingCases",
          "listStudyTrackingNotifications",
          "sendSpecialStainRequiredEmail",
          "writeAuditLog",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/study-tracking.fastify.ts",
        markers: [
          "export const studyTrackingNativeRoutes",
          "requireStudyTrackingManagementPermission",
          "clinicCreateStudyTrackingSchema.safeParse",
          "applyEstimatedDeliveryRules",
          "await deps.createStudyTrackingCase({",
          "await deps.updateParticularTokenReport(",
          "await deps.createStudyTrackingNotification({",
          "await notifySpecialStainByEmail(finalCase, deps)",
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
          "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
          "createdVia: \"clinic\"",
        ],
      },
    ],
  },
  {
    slug: "admin-study-tracking-routes",
    purpose:
      "Admin study tracking routes keep global or clinic-scoped reads, create/update mutations, special stain notifications and admin audit attribution.",
    testFiles: [
      {
        path: "test/admin-study-tracking.fastify.test.ts",
        markers: [
          "adminStudyTrackingNativeRoutes",
          "createStudyTrackingCase",
          "updateStudyTrackingCase",
          "getClinicScopedStudyTrackingCase",
          "getStudyTrackingCaseById",
          "createStudyTrackingNotification",
          "sendSpecialStainRequiredEmail",
          "writeAuditLog",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-study-tracking.fastify.ts",
        markers: [
          "export const adminStudyTrackingNativeRoutes",
          "adminCreateStudyTrackingSchema.safeParse",
          "updateStudyTrackingSchema.safeParse",
          "applyEstimatedDeliveryRules",
          "applyStageTimestampDefaults",
          "shouldCreateSpecialStainNotification",
          "await deps.createStudyTrackingCase({",
          "await deps.updateStudyTrackingCase(",
          "await deps.createStudyTrackingNotification({",
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_UPDATED",
          "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
          "createdVia: \"admin\"",
        ],
      },
    ],
  },
  {
    slug: "particular-study-tracking-read-surface",
    purpose:
      "Particular study tracking remains a read-only token-scoped surface for tracking detail and notifications using the particular session cookie.",
    testFiles: [
      {
        path: "test/particular-study-tracking.fastify.test.ts",
        markers: [
          "particularStudyTrackingNativeRoutes",
          "getParticularStudyTrackingCase",
          "listStudyTrackingNotifications",
          "ENV.particularCookieName",
          "particularTokenId: 7",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/particular-study-tracking.fastify.ts",
        markers: [
          "export const particularStudyTrackingNativeRoutes",
          "cookies[ENV.particularCookieName]",
          "authenticateParticularUser",
          "app.get(\"/me\"",
          "app.get<{",
          "\"/notifications\"",
          "getParticularStudyTrackingCase",
          "listStudyTrackingNotifications",
          "particularTokenId: particular.tokenId",
          "serializeStudyTrackingCase",
          "serializeStudyTrackingNotification",
        ],
      },
    ],
  },
  {
    slug: "special-stain-email",
    purpose:
      "Special stain email coverage keeps recipient normalization, SMTP payload construction and send logging explicit.",
    testFiles: [
      {
        path: "test/email-success.test.ts",
        markers: [
          "sendSpecialStainRequiredEmail",
          "nodemailer.createTransport",
          "sendMailCalls",
          "special_stain_required",
          "trackingCaseId: 55",
        ],
      },
      {
        path: "test/logger-and-email.test.ts",
        markers: [
          "sendSpecialStainRequiredEmail",
          "SMTP",
          "trackingCaseId",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/email.ts",
        markers: [
          "export async function sendSpecialStainRequiredEmail",
          "ENV.smtp.enabled",
          "nodemailer.createTransport",
          "special_stain_required",
          "trackingCaseId",
        ],
      },
      {
        path: "server/routes/study-tracking.fastify.ts",
        markers: ["sendSpecialStainRequiredEmail", "notifySpecialStainByEmail"],
      },
      {
        path: "server/routes/admin-study-tracking.fastify.ts",
        markers: ["sendSpecialStainRequiredEmail", "notifySpecialStainByEmail"],
      },
    ],
  },
  {
    slug: "study-tracking-cross-suite-guards",
    purpose:
      "Study tracking remains connected to audit and security guardrails for ownership, validation cut-off and audit logging phase order.",
    testFiles: [
      {
        path: "test/audit-study-tracking-gaps.test.ts",
        markers: [
          "STUDY_TRACKING_CASE_CREATED",
          "STUDY_TRACKING_CASE_UPDATED",
          "STUDY_TRACKING_NOTIFICATION_CREATED",
          "study-tracking.fastify.ts",
          "admin-study-tracking.fastify.ts",
        ],
      },
      {
        path: "test/audit-critical-flow-writes.test.ts",
        markers: [
          "STUDY_TRACKING_CASE_CREATED",
          "STUDY_TRACKING_NOTIFICATION_CREATED",
          "study tracking",
        ],
      },
      {
        path: "test/security-resource-ownership-boundaries.test.ts",
        markers: [
          "study-tracking.fastify.ts",
          "admin-study-tracking.fastify.ts",
          "particular-study-tracking.fastify.ts",
        ],
      },
      {
        path: "test/security-validation-cutoff-boundaries.test.ts",
        markers: [
          "study-tracking.fastify.ts",
          "clinic study tracking create validates body before linked lookups writes notifications and audit",
          "createStudyTrackingCase",
        ],
      },
      {
        path: "test/security-audit-logging-phase-boundaries.test.ts",
        markers: [
          "server/routes/study-tracking.fastify.ts",
          "server/routes/admin-study-tracking.fastify.ts",
          "writeAuditLog",
        ],
      },
      {
        path: "test/audit-suite-completeness.test.ts",
        markers: [
          "audit-study-tracking-writes",
          "STUDY_TRACKING_CASE_CREATED",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/audit.ts",
        markers: [
          "STUDY_TRACKING_CASE_CREATED",
          "STUDY_TRACKING_CASE_UPDATED",
          "STUDY_TRACKING_NOTIFICATION_CREATED",
        ],
      },
      {
        path: "server/routes/study-tracking.fastify.ts",
        markers: ["writeAuditLog", "createdVia: \"clinic\""],
      },
      {
        path: "server/routes/admin-study-tracking.fastify.ts",
        markers: ["writeAuditLog", "createdVia: \"admin\""],
      },
    ],
  },
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertFileExists(relativePath: string): void {
  assert.equal(
    existsSync(resolve(REPO_ROOT, relativePath)),
    true,
    `${relativePath} must exist`,
  );
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function allSuiteTestPaths(): string[] {
  return STUDY_TRACKING_SUITE.flatMap((entry) =>
    entry.testFiles.map((file) => file.path),
  );
}

test("study tracking suite completeness registry keeps canonical order", () => {
  const slugs = STUDY_TRACKING_SUITE.map((entry) => entry.slug);

  assert.deepEqual(slugs, [
    "study-tracking-domain-helpers",
    "clinic-study-tracking-routes",
    "admin-study-tracking-routes",
    "particular-study-tracking-read-surface",
    "special-stain-email",
    "study-tracking-cross-suite-guards",
  ]);

  assert.deepEqual(slugs, uniqueValues(slugs));

  for (const entry of STUDY_TRACKING_SUITE) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(entry.purpose.length >= 80);
    assert.ok(entry.testFiles.length > 0);
    assert.ok(entry.runtimeAnchors.length > 0);
  }
});

test("study tracking suite registers canonical guardrail files", () => {
  const registeredFiles = allSuiteTestPaths().map((filePath) => basename(filePath));

  for (const requiredFile of [
    "study-tracking.test.ts",
    "study-tracking.fastify.test.ts",
    "admin-study-tracking.fastify.test.ts",
    "particular-study-tracking.fastify.test.ts",
    "email-success.test.ts",
    "logger-and-email.test.ts",
    "audit-study-tracking-gaps.test.ts",
    "audit-critical-flow-writes.test.ts",
    "security-resource-ownership-boundaries.test.ts",
    "security-validation-cutoff-boundaries.test.ts",
    "security-audit-logging-phase-boundaries.test.ts",
    "audit-suite-completeness.test.ts",
  ]) {
    assert.equal(
      registeredFiles.includes(requiredFile),
      true,
      `${requiredFile} must be registered in study tracking suite`,
    );
  }
});

test("study tracking suite test files exist and keep node test with assert strict", () => {
  for (const filePath of uniqueValues(allSuiteTestPaths())) {
    assertFileExists(filePath);

    const source = readSource(filePath);

    assertContains(source, "node:test", `${filePath} node:test`);
    assertContains(source, "node:assert/strict", `${filePath} assert strict`);
  }
});

test("study tracking suite entries keep their test anchors explicit", () => {
  for (const entry of STUDY_TRACKING_SUITE) {
    for (const testFile of entry.testFiles) {
      const source = readSource(testFile.path);

      for (const marker of testFile.markers) {
        assertContains(source, marker, `${entry.slug} test anchor ${testFile.path}`);
      }
    }
  }
});

test("study tracking suite remains connected to runtime anchors", () => {
  for (const entry of STUDY_TRACKING_SUITE) {
    for (const runtimeAnchor of entry.runtimeAnchors) {
      assertFileExists(runtimeAnchor.path);

      const source = readSource(runtimeAnchor.path);

      for (const marker of runtimeAnchor.markers) {
        assertContains(
          source,
          marker,
          `${entry.slug} runtime anchor ${runtimeAnchor.path}`,
        );
      }
    }
  }
});

test("study tracking suite keeps particular surface read-only", () => {
  const source = readSource("server/routes/particular-study-tracking.fastify.ts");

  assert.equal(source.includes("app.post("), false);
  assert.equal(source.includes("app.patch("), false);
  assert.equal(source.includes("app.delete("), false);

  for (const requiredMarker of [
    "app.get(\"/me\"",
    "\"/notifications\"",
    "getParticularStudyTrackingCase",
    "listStudyTrackingNotifications",
  ]) {
    assertContains(source, requiredMarker, "particular study tracking read surface");
  }
});

test("study tracking suite completeness guardrail source stays ascii only", () => {
  const source = readSource("test/study-tracking-suite-completeness.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "study tracking suite completeness source must not contain replacement characters",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `study tracking suite completeness source must stay ascii-only at index ${index}`,
    );
  }
});
