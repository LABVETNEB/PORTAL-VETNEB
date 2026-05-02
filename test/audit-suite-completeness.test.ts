import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

type FileAnchor = {
  path: string;
  markers: readonly string[];
};

type AuditSuiteEntry = {
  slug: string;
  purpose: string;
  testFiles: readonly FileAnchor[];
  runtimeAnchors: readonly FileAnchor[];
};

const AUDIT_SUITE: readonly AuditSuiteEntry[] = [
  {
    slug: "audit-write-core",
    purpose:
      "The core audit writer keeps payload normalization, request-path sanitization and write-failure isolation covered.",
    testFiles: [
      {
        path: "test/audit-write.test.ts",
        markers: [
          "writeAuditLog inserta payload",
          "writeAuditLog absorbe errores",
          "AUDIT_LOG_WRITTEN",
          "AUDIT_LOG_WRITE_ERROR",
        ],
      },
      {
        path: "test/audit.test.ts",
        markers: [
          "AUDIT_EVENTS conserva los eventos",
          "normalizeAuditMetadata normaliza fechas",
          "resolveAuditActorFromRequest",
          "buildAuditLogInsert",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/audit.ts",
        markers: [
          "export const AUDIT_EVENTS",
          "export function createWriteAuditLog",
          "normalizeAuditMetadata",
          "sanitizeUrlForLogs",
          "AUDIT_LOG_WRITE_ERROR",
        ],
      },
    ],
  },
  {
    slug: "audit-helper-domain-boundaries",
    purpose:
      "Shared audit helpers stay neutral while admin, clinic and particular facades preserve domain-specific imports.",
    testFiles: [
      {
        path: "test/audit-helper-domain-boundaries.test.ts",
        markers: [
          "audit helper domain split",
          "audit-log core conserva helpers",
          "admin-audit facade preserva contrato",
          "clinic y particular audit routes consumen facades",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/audit-log.ts",
        markers: [
          "export const AUDIT_ACTOR_TYPES",
          "export const AUDIT_EVENTS",
          "export function buildAuditListFilters",
          "export function buildClinicAuditListFilters",
          "export function buildParticularAuditListFilters",
          "export function buildAuditCsv",
        ],
      },
      {
        path: "server/lib/admin-audit.ts",
        markers: [
          "AUDIT_EVENTS as ADMIN_AUDIT_EVENTS",
          "buildAuditListFilters as buildAdminAuditListFilters",
          "buildAuditCsv as buildAdminAuditCsv",
        ],
      },
      {
        path: "server/lib/clinic-audit.ts",
        markers: ["buildClinicAuditListFilters", "buildAuditCsv"],
      },
      {
        path: "server/lib/particular-audit.ts",
        markers: ["buildParticularAuditListFilters", "buildAuditCsv"],
      },
      {
        path: "server/db-audit.ts",
        markers: ["from \"./lib/audit-log.ts\"", "serializeAuditLogListItem"],
      },
    ],
  },
  {
    slug: "audit-separated-surfaces",
    purpose:
      "Admin, clinic and particular audit routes remain mounted under separate prefixes with separate session cookies.",
    testFiles: [
      {
        path: "test/audit-separated-surfaces.test.ts",
        markers: [
          "audit surfaces quedan montadas",
          "admin audit mantiene superficie global",
          "clinic audit mantiene superficie clinic-scoped",
          "particular audit mantiene superficie propia",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/fastify-app.ts",
        markers: [
          "adminAuditNativeRoutes",
          "clinicAuditNativeRoutes",
          "particularAuditNativeRoutes",
          "prefix: \"/api/admin/audit-log\"",
          "prefix: \"/api/clinic/audit-log\"",
          "prefix: \"/api/particular/audit-log\"",
        ],
      },
      {
        path: "server/routes/admin-audit.fastify.ts",
        markers: ["cookies[ENV.adminCookieName]", "buildAdminAuditListFilters"],
      },
      {
        path: "server/routes/clinic-audit.fastify.ts",
        markers: ["cookies[ENV.cookieName]", "buildClinicAuditListFilters"],
      },
      {
        path: "server/routes/particular-audit.fastify.ts",
        markers: [
          "cookies[ENV.particularCookieName]",
          "buildParticularAuditListFilters",
          "listParticularAuditLog",
        ],
      },
    ],
  },
  {
    slug: "audit-export-boundaries",
    purpose:
      "Audit CSV exports preserve domain scoping, reject cross-domain cookies and enforce maximum export size.",
    testFiles: [
      {
        path: "test/audit-export-boundaries.test.ts",
        markers: [
          "admin audit export conserva alcance global",
          "clinic audit export fuerza clinicId",
          "particular audit export fuerza scope",
          "audit exports rechazan cookies",
          "10000",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-audit.fastify.ts",
        markers: ["\"/export.csv\"", "const exportFilters:", "buildAdminAuditCsv"],
      },
      {
        path: "server/routes/clinic-audit.fastify.ts",
        markers: ["\"/export.csv\"", "const exportFilters:", "buildAdminAuditCsv"],
      },
      {
        path: "server/routes/particular-audit.fastify.ts",
        markers: ["\"/export.csv\"", "const exportFilters:", "buildAuditCsv"],
      },
    ],
  },
  {
    slug: "audit-critical-flow-writes",
    purpose:
      "Critical auth, report, token, upload, public access and study tracking flows keep explicit audit writes.",
    testFiles: [
      {
        path: "test/audit-critical-flow-writes.test.ts",
        markers: [
          "audit event registry conserva eventos",
          "auth login",
          "REPORT_STATUS_CHANGED",
          "REPORT_ACCESS_TOKEN_CREATED",
          "REPORT_ACCESS_TOKEN_REVOKED",
          "REPORT_PUBLIC_ACCESSED",
          "REPORT_UPLOADED",
          "STUDY_TRACKING_CASE_CREATED",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: ["AUDIT_EVENTS.ADMIN_LOGIN_SUCCEEDED", "writeAuditLog"],
      },
      {
        path: "server/routes/auth.fastify.ts",
        markers: ["AUDIT_EVENTS.CLINIC_LOGIN_SUCCEEDED", "writeAuditLog"],
      },
      {
        path: "server/routes/reports-status.fastify.ts",
        markers: ["AUDIT_EVENTS.REPORT_STATUS_CHANGED", "writeAuditLog"],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: [
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
          "writeAuditLog",
        ],
      },
      {
        path: "server/routes/admin-report-access-tokens.fastify.ts",
        markers: [
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
          "writeAuditLog",
        ],
      },
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED", "writeAuditLog"],
      },
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: ["AUDIT_EVENTS.REPORT_UPLOADED", "writeAuditLog"],
      },
    ],
  },
  {
    slug: "audit-study-tracking-writes",
    purpose:
      "Study tracking audit events and route writes stay integrated with the critical audit flow guardrails.",
    testFiles: [
      {
        path: "test/audit-study-tracking-gaps.test.ts",
        markers: [
          "audit registry declara eventos dedicados",
          "STUDY_TRACKING_CASE_CREATED",
          "STUDY_TRACKING_CASE_UPDATED",
          "STUDY_TRACKING_NOTIFICATION_CREATED",
          "critical audited flows guardrail",
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
        markers: [
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
          "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
          "writeAuditLog",
        ],
      },
      {
        path: "server/routes/admin-study-tracking.fastify.ts",
        markers: [
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
          "AUDIT_EVENTS.STUDY_TRACKING_CASE_UPDATED",
          "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
          "writeAuditLog",
        ],
      },
    ],
  },
  {
    slug: "audit-route-runtime",
    purpose:
      "Admin, clinic and particular audit route tests keep list, export, invalid filter and auth/session behavior explicit.",
    testFiles: [
      {
        path: "test/admin-audit.fastify.test.ts",
        markers: ["adminAuditNativeRoutes", "export.csv", "filtros"],
      },
      {
        path: "test/admin-audit.test.ts",
        markers: ["buildAdminAuditListFilters", "buildAdminAuditCsv"],
      },
      {
        path: "test/admin-audit-constants.test.ts",
        markers: [
          "ADMIN_AUDIT_ACTOR_TYPES expone strings",
          "ADMIN_AUDIT_EVENTS expone eventos",
          "AUDIT_LOG_CSV_HEADERS expone cabeceras",
        ],
      },
      {
        path: "test/admin-audit-edge.test.ts",
        markers: [
          "buildAdminAuditListFilters acumula errores",
          "normalizeAuditListMetadata rechaza roots",
          "buildAdminAuditCsv escapa comas",
          "buildClinicAuditListFilters fuerza clinicId",
        ],
      },
      {
        path: "test/clinic-audit.fastify.test.ts",
        markers: ["clinicAuditNativeRoutes", "export.csv", "ENV.cookieName"],
      },
      {
        path: "test/clinic-audit.test.ts",
        markers: ["buildClinicAuditListFilters", "clinicId"],
      },
      {
        path: "test/particular-audit.fastify.test.ts",
        markers: ["particularAuditNativeRoutes", "export.csv", "particular"],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-audit.fastify.ts",
        markers: ["adminAuditNativeRoutes", "\"/export.csv\"", "\"/\""],
      },
      {
        path: "server/routes/clinic-audit.fastify.ts",
        markers: ["clinicAuditNativeRoutes", "\"/export.csv\"", "\"/\""],
      },
      {
        path: "server/routes/particular-audit.fastify.ts",
        markers: ["particularAuditNativeRoutes", "\"/export.csv\"", "\"/\""],
      },
    ],
  },
  {
    slug: "audit-suite-completeness",
    purpose:
      "The audit suite completeness registry keeps every audit-named guardrail inventoried and runtime-connected.",
    testFiles: [
      {
        path: "test/audit-suite-completeness.test.ts",
        markers: [
          "audit suite completeness registry keeps canonical order",
          "audit suite includes every audit-named test file",
          "audit suite remains connected to runtime anchors",
          "audit suite completeness guardrail source stays ascii only",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/audit.ts",
        markers: ["export const AUDIT_EVENTS", "export function createWriteAuditLog"],
      },
      {
        path: "server/fastify-app.ts",
        markers: ["adminAuditNativeRoutes", "clinicAuditNativeRoutes", "particularAuditNativeRoutes"],
      },
    ],
  },
  {
    slug: "audit-security-phase-boundaries",
    purpose:
      "Security audit phase guardrails stay tied to audit write isolation and critical durable mutation ordering.",
    testFiles: [
      {
        path: "test/security-audit-logging-phase-boundaries.test.ts",
        markers: [
          "audit logging phase matrix",
          "AUDIT_LOG_WRITE_ERROR",
          "critical audit routes",
          "audit logging phase guardrail source stays ascii only",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/audit.ts",
        markers: ["createWriteAuditLog", "AUDIT_LOG_WRITE_ERROR"],
      },
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["recordReportAccessTokenAccess", "writeAuditLog"],
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
  return AUDIT_SUITE.flatMap((entry) =>
    entry.testFiles.map((file) => file.path),
  );
}

test("audit suite completeness registry keeps canonical order", () => {
  const slugs = AUDIT_SUITE.map((entry) => entry.slug);

  assert.deepEqual(slugs, [
    "audit-write-core",
    "audit-helper-domain-boundaries",
    "audit-separated-surfaces",
    "audit-export-boundaries",
    "audit-critical-flow-writes",
    "audit-study-tracking-writes",
    "audit-route-runtime",
    "audit-suite-completeness",
    "audit-security-phase-boundaries",
  ]);

  assert.deepEqual(slugs, uniqueValues(slugs));

  for (const entry of AUDIT_SUITE) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(entry.purpose.length >= 80);
    assert.ok(entry.testFiles.length > 0);
    assert.ok(entry.runtimeAnchors.length > 0);
  }
});

test("audit suite includes every audit-named test file", () => {
  const actualFiles = readdirSync(resolve(REPO_ROOT, "test"))
    .filter((fileName) => fileName.includes("audit") && fileName.endsWith(".test.ts"))
    .sort();

  const expectedFiles = allSuiteTestPaths()
    .map((filePath) => basename(filePath))
    .sort();

  assert.deepEqual(actualFiles, expectedFiles);
});

test("audit suite test files exist and keep node test with assert strict", () => {
  for (const filePath of allSuiteTestPaths()) {
    assertFileExists(filePath);

    const source = readSource(filePath);

    assertContains(source, "node:test", `${filePath} node:test`);
    assertContains(source, "node:assert/strict", `${filePath} assert strict`);
    assert.equal(
      /^\s*export\s+/m.test(source),
      false,
      `${filePath} must stay local to tests`,
    );
  }
});

test("audit suite entries keep their test anchors explicit", () => {
  for (const entry of AUDIT_SUITE) {
    for (const testFile of entry.testFiles) {
      const source = readSource(testFile.path);

      for (const marker of testFile.markers) {
        assertContains(source, marker, `${entry.slug} test anchor ${testFile.path}`);
      }
    }
  }
});

test("audit suite remains connected to runtime anchors", () => {
  for (const entry of AUDIT_SUITE) {
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

test("audit suite keeps every audit route surface mounted in Fastify app", () => {
  const source = readSource("server/fastify-app.ts");

  for (const marker of [
    "adminAuditNativeRoutes",
    "clinicAuditNativeRoutes",
    "particularAuditNativeRoutes",
    "prefix: \"/api/admin/audit-log\"",
    "prefix: \"/api/clinic/audit-log\"",
    "prefix: \"/api/particular/audit-log\"",
  ]) {
    assertContains(source, marker, "fastify audit route mounts");
  }
});

test("audit suite completeness guardrail source stays ascii only", () => {
  const source = readSource("test/audit-suite-completeness.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "audit suite completeness source must not contain replacement characters",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `audit suite completeness source must stay ascii-only at index ${index}`,
    );
  }
});
