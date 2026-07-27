import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

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
        path: "test/security/report-write-surface-ownership.test.ts",
        markers: [
          "report write surface owner registry",
          "createdByAdminUserId",
          "clinic particular y publico",
          "rutas clinic particular y publicas",
        ],
      },
      {
        path: "test/integration/adapters/controllers/admin-reports.fastify.test.ts",
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
          "createAdminReportsRouteComposition",
          "composition.service.uploadAdminReport({",
          "return reply.code(201).send({",
        ],
      },
      {
        path: "server/features/reports/application/report-route-service.ts",
        markers: [
          "const storagePath = await dependencies.uploadReport({",
          "dependencies.parseReportStudyType(input.studyType)",
          "createdByAdminUserId: input.adminUserId",
          "auditEvents.reportUploaded",
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
        path: "test/integration/adapters/controllers/reports.fastify.test.ts",
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
        path: "test/integration/adapters/controllers/reports-status.fastify.test.ts",
        markers: [
          "reportsStatusNativeRoutes actualiza PATCH /:reportId/status",
          "bloquea PATCH /:reportId/status sin management permission",
          "valida reportId y status invalidos",
          "rechaza status repetido o transicion invalida",
        ],
      },
      {
        path: "test/unit/contracts/reports/permissions-and-report-status.test.ts",
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
          "transitionClinicReportStatus",
          "createClinicReportStatusRouteComposition",
          "AUDIT_EVENTS.REPORT_STATUS_CHANGED",
        ],
      },
      {
        path: "server/features/reports/domain/report-status.ts",
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
        path: "test/unit/contracts/reports/report-study-types-catalog.test.ts",
        markers: [
          "report study types have canonical internal catalog",
          "report study types block free-text",
          "report routes use canonical parser",
          "M40 infrastructure exposes study types and M41 removes DB reexports",
        ],
      },
    ],
    runtimeAnchors: [
      {
        path: "server/features/reports/domain/report-study-types.ts",
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
        path: "server/features/reports/application/report-route-service.ts",
        markers: ["dependencies.parseReportStudyType(input.studyType)"],
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
        path: "test/unit/domain/report-access-token.test.ts",
        markers: [
          "reportAccessTokenRawTokenSchema",
          "clinicCreateReportAccessTokenSchema",
          "report access token state",
          "public report access solo permite ready y delivered",
          "buildPublicReportAccessPath",
        ],
      },
      {
        path: "test/integration/adapters/controllers/report-access-tokens.fastify.test.ts",
        markers: [
          "reportAccessTokensNativeRoutes crea POST /",
          "reportAccessTokensNativeRoutes revoca PATCH /:tokenId/revoke",
          "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar",
        ],
      },
      {
        path: "test/integration/adapters/controllers/admin-report-access-tokens.fastify.test.ts",
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
          "createClinicReportAccessOperations",
          "reportAccess.createToken",
          "reportAccess.revokeToken",
        ],
      },
      {
        path: "server/routes/admin-report-access-tokens.fastify.ts",
        markers: [
          "createAdminReportAccessOperations",
          "reportAccess.createToken",
          "reportAccess.revokeToken",
        ],
      },
      {
        path: "server/features/report-access/application/clinic-report-access-operations.ts",
        markers: [
          "createReportAccessToken",
          "revokeReportAccessToken",
          'event: "report_access_token.created"',
          'event: "report_access_token.revoked"',
        ],
      },
      {
        path: "server/features/report-access/application/admin-report-access-operations.ts",
        markers: [
          "createReportAccessToken",
          "revokeReportAccessToken",
          'event: "report_access_token.created"',
          'event: "report_access_token.revoked"',
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
        path: "test/integration/adapters/controllers/public-report-access.fastify.test.ts",
        markers: [
          "publicReportAccessNativeRoutes responde acceso",
          "urls firmadas",
          "oculta token malformado como informe no encontrado",
          "oculta token revocado como informe no encontrado",
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
          "reportAccess.access",
          "serializePublicReportAccess",
        ],
      },
      {
        path: "server/features/report-access/application/public-report-access-operations.ts",
        markers: [
          "getReportAccessTokenState",
          "canAccessReportPublicly",
          "recordReportAccessTokenAccess",
          "deps.createSignedReportUrl(record.report.storagePath)",
          "deps.createSignedReportDownloadUrl(",
          'event: "report.public_accessed"',
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
        path: "test/integration/adapters/controllers/particular-auth.fastify.test.ts",
        markers: [
          "particularAuthNativeRoutes expone preview-url",
          "particularAuthNativeRoutes expone download-url",
          "particularAuthNativeRoutes login exitoso",
        ],
      },
      {
        path: "test/unit/domain/particular-token.test.ts",
        markers: [
          "serializeParticularToken",
          "serializeParticularTokenDetail",
          "updateParticularTokenReportSchema",
        ],
      },
      {
        path: "test/integration/adapters/controllers/particular-tokens.fastify.test.ts",
        markers: [
          "particularTokensNativeRoutes crea POST /",
          "particularTokensNativeRoutes vincula PATCH /:tokenId/report",
        ],
      },
      {
        path: "test/integration/adapters/controllers/admin-particular-tokens.fastify.test.ts",
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
        path: "test/architecture/reports-domain-boundary-guard.test.ts",
        markers: [
          "Reports conserva domain M36 y admite inventario M37 autorizado",
          "consumidores externos usan exclusivamente el barrel canonico",
          "domain aplica default-deny",
          "M41 retira sus shims",
        ],
      },
      {
        path: "test/architecture/reports-workflow-ports-boundary-guard.test.ts",
        markers: [
          "M40 conserva inventario exacto de application ports infrastructure y composition",
          "application y ports aplican default deny",
          "composition es el unico bridge M37",
          "best effort catch y logging seguro",
        ],
      },
      {
        path: "test/unit/application/reports/report-workflow-communication.test.ts",
        markers: [
          "sin tracking context omite notification",
          "mapea el tracking context completo",
          "prefiere el reportId propio",
          "propaga el error del data port",
          "propaga el error del notification port",
        ],
      },
      {
        path: "test/unit/infrastructure/reports/report-workflow-adapters-contract.test.ts",
        markers: [
          "data adapter preserva consulta y mapping minimo",
          "notification adapter preserva tabla values y returning exactos",
        ],
      },
      {
        path: "test/unit/application/reports/report-command-use-cases.test.ts",
        markers: [
          "createOrEditReport delega una vez",
          "transitionReportStatus devuelve not_found",
          "transitionReportStatus modela desaparici\u00f3n concurrente",
        ],
      },
      {
        path: "test/unit/infrastructure/reports/report-command-repository-contract.test.ts",
        markers: [
          "upsert update conserva transacci\u00f3n",
          "fallback Drizzle corre s\u00f3lo ante PostgreSQL 42703",
          "source contract fija SQL dual",
        ],
      },
      {
        path: "test/unit/contracts/reports/report-command-persistence-contract.test.ts",
        markers: [
          "server/db.ts retira exports Reports",
          "infrastructure es owner \u00fanico",
          "rutas conservan Options",
        ],
      },
      {
        path: "test/architecture/reports-command-use-cases-boundary-guard.test.ts",
        markers: [
          "M40 fija inventario productivo exacto",
          "application y ports aplican default deny",
          "M36 a M40 permanecen materializados",
        ],
      },
      {
        path: "test/unit/application/reports/report-query-use-cases.test.ts",
        markers: [
          "M40 list coordina query y count",
          "M40 history ocurre solo despues de ownership",
          "M40 propaga errores de infraestructura",
        ],
      },
      {
        path: "test/unit/infrastructure/reports/report-query-repository-contract.test.ts",
        markers: [
          "M40 repository es owner unico",
          "M40 search y count comparten filtros exactos",
          "M40 counts y catalogo conservan semantica legacy",
        ],
      },
      {
        path: "test/architecture/reports-query-use-cases-boundary-guard.test.ts",
        markers: [
          "M40 materializa inventario productivo exacto",
          "M40 composition es bridge lazy unico",
          "M40 conserva doble registro /api/reports",
        ],
      },
      {
        path: "test/architecture/reports-compatibility-shim-retirement.test.ts",
        markers: [
          "M41 retira f\u00edsicamente los cinco shims",
          "M41 elimina todos los exports",
          "consumidores runtime migrados resuelven Reports por composition",
          "M36 a M40 permanecen materializados",
        ],
      },
      {
        path: "test/architecture/security/security-resource-ownership-boundaries.test.ts",
        markers: [
          "resource ownership matrix",
          "clinic-owned resources reject cross-clinic reports",
          "particular and public surfaces derive ownership",
        ],
      },
      {
        path: "test/architecture/security/security-access-lifecycle-boundaries.test.ts",
        markers: [
          "access lifecycle matrix",
          "public report access enforces token lifecycle",
        ],
      },
      {
        path: "test/architecture/security/security-write-attribution-boundaries.test.ts",
        markers: [
          "write attribution matrix",
          "admin writes persist admin attribution",
          "clinic writes persist clinic attribution",
        ],
      },
      {
        path: "test/architecture/security/security-validation-cutoff-boundaries.test.ts",
        markers: [
          "validation cut-off matrix",
          "admin report upload validates clinicId",
        ],
      },
      {
        path: "test/architecture/storage-suite-completeness.test.ts",
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
        markers: [
          "uploadReport?:",
          "createSignedReportUrl?:",
          "writeAuditLog?:",
          "createAdminReportsRouteComposition",
        ],
      },
      {
        path: "server/features/reports/application/report-route-service.ts",
        markers: [
          "dependencies.uploadReport",
          "dependencies.createSignedReportUrl",
          "dependencies.writeAuditLog",
        ],
      },
      {
        path: "server/routes/reports.fastify.ts",
        markers: [
          "createClinicReportsRouteComposition",
          "getClinicReportHistory",
          "getClinicReportPreview",
          "getClinicReportDownload",
        ],
      },
      {
        path: "server/features/reports/application/report-query-use-cases.ts",
        markers: [
          "listClinicReports",
          "searchClinicReports",
          "transitionClinicReportStatus",
        ],
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
    "reports-domain-boundary-guard.test.ts",
    "reports-workflow-ports-boundary-guard.test.ts",
    "report-workflow-communication.test.ts",
    "report-workflow-adapters-contract.test.ts",
    "report-command-use-cases.test.ts",
    "report-command-repository-contract.test.ts",
    "report-command-persistence-contract.test.ts",
    "reports-command-use-cases-boundary-guard.test.ts",
    "report-query-use-cases.test.ts",
    "report-query-repository-contract.test.ts",
    "reports-query-use-cases-boundary-guard.test.ts",
    "reports-compatibility-shim-retirement.test.ts",
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
  const source = readSource("test/architecture/reports-suite-completeness.test.ts");
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
