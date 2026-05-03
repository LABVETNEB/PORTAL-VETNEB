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

type ReportsSuiteEntry = {
  slug: string;
  purpose: string;
  testFiles: readonly FileAnchor[];
  runtimeAnchors: readonly FileAnchor[];
};

const REPORTS_SUITE: readonly ReportsSuiteEntry[] = [
  {
    slug: "admin-report-upload-ownership",
    purpose:
      "Admin report upload remains the only report write surface and persists admin attribution before returning signed URLs.",
    testFiles: [
      {
        path: "test/report-write-surface-ownership.test.ts",
        markers: [
          "report write surface owner registry",
          "createdByAdminUserId",
          "clinic particular y publico",
          "rutas clinic particular y publicas",
        ],
      },
      {
        path: "test/admin-reports.fastify.test.ts",
        markers: [
          "adminReportsNativeRoutes crea POST /upload",
          "requiere clinicId valido antes de storage",
          "bloquea POST /upload sin sesion admin antes de storage",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: [
          "export const adminReportsNativeRoutes",
          "app.post(\"/upload\"",
          "enforceTrustedOrigin(request, reply, allowedOrigins)",
          "authenticateAdminUser(request, reply, deps, now)",
          "parseReportStudyType(body.studyType)",
          "const storagePath = await deps.uploadReport({",
          "createdByAdminUserId: admin.id",
          "AUDIT_EVENTS.REPORT_UPLOADED",
          "return reply.code(201).send({",
        ],
      },
    ],
  },
  {
    slug: "clinic-reports-read-only",
    purpose:
      "Clinic reports stay read-only with list, search, study types, history, preview and download routes only.",
    testFiles: [
      {
        path: "test/reports.fastify.test.ts",
        markers: [
          "reportsNativeRoutes no registra POST /upload",
          "reportsNativeRoutes expone GET / con lista",
          "reportsNativeRoutes expone GET /search",
          "reportsNativeRoutes expone GET /study-types",
          "reportsNativeRoutes responde preflight OPTIONS",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/reports.fastify.ts",
        markers: [
          "export const reportsNativeRoutes",
          "app.get<",
          "\"/search\"",
          "\"/study-types\"",
          "\"/:reportId/history\"",
          "\"/:reportId/preview-url\"",
          "\"/:reportId/download-url\"",
          "parseReportStudyType(request.query.studyType)",
          "createSignedReportUrl",
          "createSignedReportDownloadUrl",
        ],
      },
    ],
  },
  {
    slug: "report-status-transitions",
    purpose:
      "Report status mutation keeps trusted origin, clinic session, management permission, transition validation and audit logging.",
    testFiles: [
      {
        path: "test/reports-status.fastify.test.ts",
        markers: [
          "reportsStatusNativeRoutes actualiza PATCH /:reportId/status",
          "bloquea PATCH /:reportId/status sin management permission",
          "valida reportId y status invalidos",
          "rechaza status repetido o transicion invalida",
        ],
      },
      {
        path: "test/permissions-and-report-status.test.ts",
        markers: [
          "REPORT_STATUSES",
          "canTransitionReportStatus",
          "normalizeReportStatus",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/reports-status.fastify.ts",
        markers: [
          "export const reportsStatusNativeRoutes",
          "app.patch<",
          "\"/:reportId/status\"",
          "requireReportStatusWritePermission(auth, reply)",
          "parseReportStatus(request.body?.status)",
          "canTransitionReportStatus",
          "await deps.updateReportStatus({",
          "AUDIT_EVENTS.REPORT_STATUS_CHANGED",
        ],
      },
      {
        path: "server/lib/report-status.ts",
        markers: [
          "export const REPORT_STATUSES",
          "export function canTransitionReportStatus",
          "export function normalizeReportStatus",
        ],
      },
    ],
  },
  {
    slug: "report-study-types-catalog",
    purpose:
      "Report study types remain canonical internal values and routes use the catalog parser instead of free text.",
    testFiles: [
      {
        path: "test/report-study-types-catalog.test.ts",
        markers: [
          "report study types have canonical internal catalog",
          "report study types block free-text",
          "report routes use canonical parser",
          "DB exposes study types from catalog",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/report-study-types.ts",
        markers: [
          "REPORT_STUDY_TYPES",
          "REPORT_STUDY_TYPE_LABELS",
          "parseReportStudyType",
          "serializeReportStudyType",
          "\"citologia\"",
          "\"histopatologia\"",
          "\"hemoparasitos\"",
        ],
      },
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: ["parseReportStudyType(body.studyType)"],
      },
      {
        path: "server/routes/reports.fastify.ts",
        markers: ["parseReportStudyType(request.query.studyType)"],
      },
    ],
  },
  {
    slug: "report-access-token-lifecycle",
    purpose:
      "Clinic and admin report access tokens preserve creation, revoke, state, public path and lifecycle behavior.",
    testFiles: [
      {
        path: "test/report-access-token.test.ts",
        markers: [
          "reportAccessTokenRawTokenSchema",
          "clinicCreateReportAccessTokenSchema",
          "report access token state",
          "public report access solo permite ready y delivered",
          "buildPublicReportAccessPath",
        ],
      },
      {
        path: "test/report-access-tokens.fastify.test.ts",
        markers: [
          "reportAccessTokensNativeRoutes crea POST /",
          "reportAccessTokensNativeRoutes revoca PATCH /:tokenId/revoke",
          "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar",
        ],
      },
      {
        path: "test/admin-report-access-tokens.fastify.test.ts",
        markers: [
          "adminReportAccessTokensNativeRoutes crea POST /",
          "adminReportAccessTokensNativeRoutes revoca PATCH /:tokenId/revoke",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/lib/report-access-token.ts",
        markers: [
          "reportAccessTokenRawTokenSchema",
          "clinicCreateReportAccessTokenSchema",
          "getReportAccessTokenState",
          "canAccessReportPublicly",
          "buildPublicReportAccessPath",
          "serializePublicReportAccess",
        ],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: [
          "createReportAccessToken",
          "revokeReportAccessToken",
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
        ],
      },
      {
        path: "server/routes/admin-report-access-tokens.fastify.ts",
        markers: [
          "createReportAccessToken",
          "revokeReportAccessToken",
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
          "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
        ],
      },
    ],
  },
  {
    slug: "public-report-access",
    purpose:
      "Public report access validates raw token state before signing URLs, recording access and writing audit logs.",
    testFiles: [
      {
        path: "test/public-report-access.fastify.test.ts",
        markers: [
          "publicReportAccessNativeRoutes responde acceso",
          "urls firmadas",
          "devuelve 400 cuando el token es invalido",
          "devuelve 410 cuando el token fue revocado",
          "aplica rate limit nativo fijo",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: [
          "publicReportAccessNativeRoutes",
          "reportAccessTokenRawTokenSchema.safeParse",
          "getReportAccessTokenState",
          "canAccessReportPublicly",
          "recordReportAccessTokenAccess",
          "deps.createSignedReportUrl(record.report.storagePath)",
          "deps.createSignedReportDownloadUrl(",
          "AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED",
          "serializePublicReportAccess",
        ],
      },
    ],
  },
  {
    slug: "particular-linked-report-access",
    purpose:
      "Particular token auth and token management keep linked report preview and download behavior explicit.",
    testFiles: [
      {
        path: "test/particular-auth.fastify.test.ts",
        markers: [
          "particularAuthNativeRoutes expone preview-url",
          "particularAuthNativeRoutes expone download-url",
          "particularAuthNativeRoutes login exitoso",
        ],
      },
      {
        path: "test/particular-token.test.ts",
        markers: [
          "serializeParticularToken",
          "serializeParticularTokenDetail",
          "updateParticularTokenReportSchema",
        ],
      },
      {
        path: "test/particular-tokens.fastify.test.ts",
        markers: [
          "particularTokensNativeRoutes crea POST /",
          "particularTokensNativeRoutes vincula PATCH /:tokenId/report",
        ],
      },
      {
        path: "test/admin-particular-tokens.fastify.test.ts",
        markers: [
          "adminParticularTokensNativeRoutes crea POST /",
          "adminParticularTokensNativeRoutes vincula PATCH /:tokenId/report",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/particular-auth.fastify.ts",
        markers: [
          "createSignedReportUrl",
          "createSignedReportDownloadUrl",
          "\"/report/preview-url\"",
          "\"/report/download-url\"",
        ],
      },
      {
        path: "server/routes/particular-tokens.fastify.ts",
        markers: [
          "createParticularToken",
          "updateParticularTokenReport",
          "serializeParticularTokenDetail",
        ],
      },
      {
        path: "server/routes/admin-particular-tokens.fastify.ts",
        markers: [
          "createParticularToken",
          "updateParticularTokenReport",
          "serializeParticularTokenDetail",
        ],
      },
    ],
  },
  {
    slug: "reports-cross-suite-guards",
    purpose:
      "Reports remain connected to security, audit and storage suite registries that protect ownership, lifecycle and signed URLs.",
    testFiles: [
      {
        path: "test/security-resource-ownership-boundaries.test.ts",
        markers: [
          "resource ownership matrix",
          "clinic-owned resources reject cross-clinic reports",
          "particular and public surfaces derive ownership",
        ],
      },
      {
        path: "test/security-access-lifecycle-boundaries.test.ts",
        markers: [
          "access lifecycle matrix",
          "public report access enforces token lifecycle",
        ],
      },
      {
        path: "test/security-write-attribution-boundaries.test.ts",
        markers: [
          "write attribution matrix",
          "admin writes persist admin attribution",
          "clinic writes persist clinic attribution",
        ],
      },
      {
        path: "test/security-validation-cutoff-boundaries.test.ts",
        markers: [
          "validation cut-off matrix",
          "admin report upload validates clinicId",
        ],
      },
      {
        path: "test/storage-suite-completeness.test.ts",
        markers: [
          "storage suite completeness registry keeps canonical order",
          "storage-route-consumers",
          "storage-public-response-consumers",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: ["uploadReport", "createSignedReportUrl", "writeAuditLog"],
      },
      {
        path: "server/routes/reports.fastify.ts",
        markers: ["getAuthorizedReport", "serializeReport"],
      },
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["serializePublicReportAccess", "writeAuditLog"],
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
  return REPORTS_SUITE.flatMap((entry) =>
    entry.testFiles.map((file) => file.path),
  );
}

test("reports suite completeness registry keeps canonical order", () => {
  const slugs = REPORTS_SUITE.map((entry) => entry.slug);

  assert.deepEqual(slugs, [
    "admin-report-upload-ownership",
    "clinic-reports-read-only",
    "report-status-transitions",
    "report-study-types-catalog",
    "report-access-token-lifecycle",
    "public-report-access",
    "particular-linked-report-access",
    "reports-cross-suite-guards",
  ]);

  assert.deepEqual(slugs, uniqueValues(slugs));

  for (const entry of REPORTS_SUITE) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(entry.purpose.length >= 80);
    assert.ok(entry.testFiles.length > 0);
    assert.ok(entry.runtimeAnchors.length > 0);
  }
});

test("reports suite registers canonical reports guardrail files", () => {
  const registeredFiles = allSuiteTestPaths().map((filePath) => basename(filePath));

  for (const requiredFile of [
    "admin-reports.fastify.test.ts",
    "report-write-surface-ownership.test.ts",
    "reports.fastify.test.ts",
    "reports-status.fastify.test.ts",
    "permissions-and-report-status.test.ts",
    "report-study-types-catalog.test.ts",
    "report-access-token.test.ts",
    "report-access-tokens.fastify.test.ts",
    "admin-report-access-tokens.fastify.test.ts",
    "public-report-access.fastify.test.ts",
    "particular-auth.fastify.test.ts",
    "particular-token.test.ts",
    "particular-tokens.fastify.test.ts",
    "admin-particular-tokens.fastify.test.ts",
  ]) {
    assert.equal(
      registeredFiles.includes(requiredFile),
      true,
      `${requiredFile} must be registered in reports suite`,
    );
  }
});

test("reports suite test files exist and keep node test with assert strict", () => {
  for (const filePath of uniqueValues(allSuiteTestPaths())) {
    assertFileExists(filePath);

    const source = readSource(filePath);

    assertContains(source, "node:test", `${filePath} node:test`);
    assertContains(source, "node:assert/strict", `${filePath} assert strict`);
  }
});

test("reports suite entries keep their test anchors explicit", () => {
  for (const entry of REPORTS_SUITE) {
    for (const testFile of entry.testFiles) {
      const source = readSource(testFile.path);

      for (const marker of testFile.markers) {
        assertContains(source, marker, `${entry.slug} test anchor ${testFile.path}`);
      }
    }
  }
});

test("reports suite remains connected to runtime anchors", () => {
  for (const entry of REPORTS_SUITE) {
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

test("reports suite keeps clinic report upload removed from clinic public and particular surfaces", () => {
  for (const runtimePath of [
    "server/routes/reports.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
    "server/routes/public-report-access.fastify.ts",
  ]) {
    const source = readSource(runtimePath);

    for (const forbiddenMarker of [
      'app.post("/upload"',
      "runReportUpload",
      "deps.uploadReport",
      "ReportUploadInput",
      "createdByClinicUserId",
    ]) {
      assert.equal(
        source.includes(forbiddenMarker),
        false,
        `${runtimePath} must not contain report upload surface marker ${forbiddenMarker}`,
      );
    }
  }
});

test("reports suite completeness guardrail source stays ascii only", () => {
  const source = readSource("test/reports-suite-completeness.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "reports suite completeness source must not contain replacement characters",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `reports suite completeness source must stay ascii-only at index ${index}`,
    );
  }
});
