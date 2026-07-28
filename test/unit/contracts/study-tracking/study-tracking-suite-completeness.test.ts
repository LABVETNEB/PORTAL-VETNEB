import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

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
        path: "test/unit/domain/study-tracking/study-tracking.test.ts",
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
        path: "server/features/study-tracking/domain/study-tracking.ts",
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
    slug: "study-tracking-application-infrastructure",
    purpose:
      "Study tracking application use cases, real side-effect ports and canonical persistence keep their boundaries and one-delegation contracts explicit.",
    testFiles: [
      {
        path: "test/unit/application/study-tracking/study-tracking-query-use-cases.test.ts",
        markers: [
          "createClinicStudyTrackingQueryUseCases",
          "createAdminStudyTrackingQueryUseCases",
          "createParticularStudyTrackingQueryUseCases",
        ],
      },
      {
        path: "test/unit/application/study-tracking/study-tracking-command-use-cases.test.ts",
        markers: [
          "createClinicStudyTrackingCommandUseCases",
          "createAdminStudyTrackingCommandUseCases",
          "createParticularStudyTrackingCommandUseCases",
        ],
      },
      {
        path: "test/unit/application/study-tracking/study-tracking-side-effect-use-cases.test.ts",
        markers: [
          "createStudyTrackingSideEffectUseCases",
          "sendSpecialStainRequiredEmail",
          "writeAuditLog",
        ],
      },
      {
        path: "test/unit/application/study-tracking/admin-study-tracking-operations.test.ts",
        markers: [
          "createAdminStudyTrackingOperations",
          "special_stain_required",
          "side-effect order",
        ],
      },
      {
        path: "test/unit/application/study-tracking/clinic-study-tracking-operations.test.ts",
        markers: [
          "createClinicStudyTrackingOperations",
          "clinic create con",
          "clinic create propaga por identidad errores de repositorio",
        ],
      },
      {
        path: "test/unit/application/study-tracking/particular-study-tracking-operations.test.ts",
        markers: [
          "createParticularStudyTrackingOperations",
          "particular operations derivan todo el scope del token autenticado",
          "particular operations preservan null, undefined",
        ],
      },
      {
        path: "test/unit/application/study-tracking/token-study-tracking-operations.test.ts",
        markers: [
          "createTokenStudyTrackingOperations",
          "delega el token sin alterar scope",
          "preserva identidad del error",
        ],
      },
      {
        path: "test/architecture/study-tracking-admin-thin-route.test.ts",
        markers: [
          "M32b conserva exactamente Options y endpoint registry admin",
          "M32b handlers delegan",
          "resolveAdminStudyTrackingCase",
        ],
      },
      {
        path: "test/architecture/study-tracking-application-boundary-guard.test.ts",
        markers: [
          "const applicationDir",
          "createStudyTrackingSideEffectUseCases",
          "fuera de application nadie importa archivos internos",
        ],
      },
      {
        path: "test/architecture/study-tracking-infrastructure-boundary-guard.test.ts",
        markers: [
          "study-tracking-repository.ts",
          "server/db-study-tracking.ts",
          "application no depende de infrastructure concreta",
        ],
      },
      {
        path: "test/architecture/study-tracking-clinic-particular-thin-routes.test.ts",
        markers: [
          "M32 conserva exactamente Options y endpoints",
          "M32 routes delegan",
          "M44 preserva rutas M32 y realinea s\u00f3lo el specifier Particular Access",
        ],
      },
      {
        path: "test/architecture/study-tracking-phase-closeout.test.ts",
        markers: [
          "M33 extiende el inventario canonico de Study Tracking",
          "M44 retira el path DB legacy de Study Tracking sin consumidores",
          "los tres realms quedan separados con evidencia runtime",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/features/study-tracking/application/index.ts",
        markers: [
          "createClinicStudyTrackingQueryUseCases",
          "createAdminStudyTrackingCommandUseCases",
          "createParticularStudyTrackingCommandUseCases",
          "createStudyTrackingSideEffectUseCases",
          "createAdminStudyTrackingOperations",
          "createClinicStudyTrackingOperations",
          "createParticularStudyTrackingOperations",
          "AdminStudyTrackingReferenceRepository",
          "ClinicStudyTrackingReferenceRepository",
          "StudyTrackingNotificationPort",
          "StudyTrackingAuditPort",
        ],
      },
      {
        path: "server/features/study-tracking/infrastructure/study-tracking-repository.ts",
        markers: [
          "export async function createStudyTrackingCase",
          "export async function listStudyTrackingCases",
          "export async function listStudyTrackingNotifications",
          "export async function markStudyTrackingNotificationReadScoped",
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
        path: "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
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
          "createClinicStudyTrackingOperations",
          "clinicOperations.createClinicStudyTrackingCase",
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
          "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
        ],
      },
      {
        path: "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
        markers: [
          "applyEstimatedDeliveryRules",
          "commands.createStudyTrackingCase",
          "updateParticularTokenReport",
          "commands.createStudyTrackingNotification",
          "notifySpecialStainByEmail",
          "deps.auditEvents.caseCreated",
          "deps.auditEvents.notificationCreated",
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
        path: "test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts",
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
          "createAdminStudyTrackingOperations",
          "adminOperations.createAdminStudyTrackingCase",
          "adminOperations.resolveAdminStudyTrackingCase",
          "adminOperations.updateAdminStudyTrackingCase",
          "createAuditRequestLike",
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_UPDATED",
          "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
        ],
      },
      {
        path: "server/features/study-tracking/application/admin-study-tracking-operations.ts",
        markers: [
          "applyEstimatedDeliveryRules",
          "applyStageTimestampDefaults",
          "shouldCreateSpecialStainNotification",
          "commands.createStudyTrackingCase({",
          "commands.updateStudyTrackingCase(",
          "commands.createStudyTrackingNotification({",
          "deps.auditEvents.caseCreated",
          "deps.auditEvents.caseUpdated",
          "deps.auditEvents.notificationCreated",
          "createdVia: \"admin\"",
          "updatedVia: \"admin\"",
        ],
      },
    ],
  },
  {
    slug: "particular-study-tracking-read-surface",
    purpose:
      "Particular study tracking keeps token-scoped reads and notification read acknowledgements using the particular session cookie without exposing write operations outside its own scope.",
    testFiles: [
      {
        path: "test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts",
        markers: [
          "particularStudyTrackingNativeRoutes",
          "getParticularStudyTrackingCase",
          "listStudyTrackingNotifications",
          "markStudyTrackingNotificationReadScoped",
          "markAllStudyTrackingNotificationsReadScoped",
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
          "\"/notifications/:notificationId/read\"",
          "\"/notifications/read-all\"",
          "getParticularStudyTrackingForToken",
          "listParticularStudyTrackingNotifications",
          "acknowledgeParticularStudyTrackingNotification",
          "acknowledgeAllParticularStudyTrackingNotifications",
          "particularTokenId: particular.tokenId",
          "serializeStudyTrackingCase",
          "serializeStudyTrackingNotification",
        ],
      },
      {
        path: "server/features/study-tracking/application/particular-study-tracking-operations.ts",
        markers: [
          "queries.getParticularStudyTrackingCase(particularTokenId)",
          "queries.listStudyTrackingNotifications(input)",
          "commands.markStudyTrackingNotificationReadScoped",
          "commands.markAllStudyTrackingNotificationsReadScoped",
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
        path: "test/unit/infrastructure/email-success.test.ts",
        markers: [
          "sendSpecialStainRequiredEmail",
          "nodemailer.createTransport",
          "sendMailCalls",
          "special_stain_required",
          "trackingCaseId: 55",
        ],
      },
      {
        path: "test/unit/infrastructure/logger-and-email.test.ts",
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
        path: "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
        markers: ["sendSpecialStainRequiredEmail", "notifySpecialStainByEmail"],
      },
      {
        path: "server/features/study-tracking/application/admin-study-tracking-operations.ts",
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
        path: "test/architecture/audit-study-tracking-gaps.test.ts",
        markers: [
          "STUDY_TRACKING_CASE_CREATED",
          "STUDY_TRACKING_CASE_UPDATED",
          "STUDY_TRACKING_NOTIFICATION_CREATED",
          "study-tracking.fastify.ts",
          "admin-study-tracking.fastify.ts",
        ],
      },
      {
        path: "test/architecture/audit-critical-flow-writes.test.ts",
        markers: [
          "STUDY_TRACKING_CASE_CREATED",
          "STUDY_TRACKING_NOTIFICATION_CREATED",
          "study tracking",
        ],
      },
      {
        path: "test/architecture/security/security-resource-ownership-boundaries.test.ts",
        markers: [
          "study-tracking.fastify.ts",
          "admin-study-tracking.fastify.ts",
          "particular-study-tracking.fastify.ts",
        ],
      },
      {
        path: "test/architecture/security/security-validation-cutoff-boundaries.test.ts",
        markers: [
          "study-tracking.fastify.ts",
          "clinic study tracking create validates body before linked lookups writes notifications and audit",
          "createStudyTrackingCase",
        ],
      },
      {
        path: "test/security/security-audit-logging-phase-boundaries.test.ts",
        markers: [
          "server/routes/study-tracking.fastify.ts",
          "server/routes/admin-study-tracking.fastify.ts",
          "writeAuditLog",
        ],
      },
      {
        path: "test/architecture/audit-suite-completeness.test.ts",
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
        markers: ["writeAuditLog", "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED"],
      },
      {
        path: "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
        markers: ["writeAuditLog", "createdVia: \"clinic\""],
      },
      {
        path: "server/features/study-tracking/application/admin-study-tracking-operations.ts",
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
    "study-tracking-application-infrastructure",
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
    "study-tracking-query-use-cases.test.ts",
    "study-tracking-command-use-cases.test.ts",
    "study-tracking-side-effect-use-cases.test.ts",
    "admin-study-tracking-operations.test.ts",
    "clinic-study-tracking-operations.test.ts",
    "particular-study-tracking-operations.test.ts",
    "study-tracking-admin-thin-route.test.ts",
    "study-tracking-application-boundary-guard.test.ts",
    "study-tracking-infrastructure-boundary-guard.test.ts",
    "study-tracking-clinic-particular-thin-routes.test.ts",
    "study-tracking-phase-closeout.test.ts",
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

test("study tracking suite keeps particular surface token-scoped sin create/delete", () => {
  const source = readSource("server/routes/particular-study-tracking.fastify.ts");

  assert.equal(source.includes("app.post("), false);
  assert.equal(source.includes("app.delete("), false);

  for (const requiredMarker of [
    "app.get(\"/me\"",
    "\"/notifications\"",
    "\"/notifications/:notificationId/read\"",
    "\"/notifications/read-all\"",
    "getParticularStudyTrackingForToken",
    "listParticularStudyTrackingNotifications",
    "acknowledgeParticularStudyTrackingNotification",
    "acknowledgeAllParticularStudyTrackingNotifications",
  ]) {
    assertContains(source, requiredMarker, "particular study tracking read surface");
  }
});

test("study tracking suite completeness guardrail source stays ascii only", () => {
  const source = readSource("test/unit/contracts/study-tracking/study-tracking-suite-completeness.test.ts");
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
