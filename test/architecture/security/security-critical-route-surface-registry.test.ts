import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type FileExpectation = {
  path: string;
  markers: readonly string[];
};

type CriticalSurface = {
  slug: string;
  category: string;
  purpose: string;
  runtimeFiles: readonly FileExpectation[];
  guardrailTests: readonly FileExpectation[];
};

const CRITICAL_ROUTE_SURFACE_REGISTRY: readonly CriticalSurface[] = [
  {
    slug: "auth-session-cookie-contract",
    category: "security",
    purpose:
      "Cookies, sesiones, trusted origin, trust proxy y errores seguros permanecen cubiertos por invariants productivos.",
    runtimeFiles: [
      {
        path: "server/lib/env.ts",
        markers: [
          "cookieName: CLINIC_SESSION_COOKIE_NAME",
          "adminCookieName: ADMIN_SESSION_COOKIE_NAME",
          "particularCookieName: resolveParticularSessionCookieName(",
          "trustProxy: rawEnv.TRUST_PROXY ?? 1",
        ],
      },
      {
        path: "server/fastify-app.ts",
        markers: [
          "adminAuditNativeRoutes",
          'prefix: "/api/admin/audit-log"',
          "adminAuthNativeRoutes",
          'prefix: "/api/admin/auth"',
          "adminFailedLoginAlertsNativeRoutes",
          'prefix: "/api/admin/failed-login-alerts"',
          "adminParticularTokensNativeRoutes",
          'prefix: "/api/admin/particular-tokens"',
          "adminReportAccessTokensNativeRoutes",
          'prefix: "/api/admin/report-access-tokens"',
          "adminReportsNativeRoutes",
          'prefix: "/api/admin/reports"',
          "adminSessionsNativeRoutes",
          'prefix: "/api/admin/sessions"',
          "adminStudyTrackingNativeRoutes",
          'prefix: "/api/admin/study-tracking"',
          "adminSystemHealthNativeRoutes",
          'prefix: "/api/admin/system/health"',
          "adminSystemMaintenanceNativeRoutes",
          'prefix: "/api/admin/system/maintenance"',
          "adminSystemSchemaHealthNativeRoutes",
          'prefix: "/api/admin/system/schema-health"',
          "adminUsersRolesNativeRoutes",
          'prefix: "/api/admin/users-roles"',
        ],
      },
      {
        // WBR-08c: migrated to the canonical clinic auth helper.
        path: "server/routes/auth.fastify.ts",
        markers: ["authenticateFastifyClinicUser", "name: ENV.cookieName"],
      },
      {
        path: "server/lib/fastify-admin-auth.ts",
        markers: ["cookies[ENV.adminCookieName]", "name: ENV.adminCookieName"],
      },
      {
        path: "server/routes/admin-audit.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-failed-login-alerts.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-particular-tokens.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-report-access-tokens.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-sessions.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-study-tracking.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-system-health.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-system-maintenance.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-system-schema-health.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/admin-users-roles.fastify.ts",
        markers: ["authenticateFastifyAdmin"],
      },
      {
        path: "server/routes/particular-auth.fastify.ts",
        markers: [
          "cookies[ENV.particularCookieName]",
          "name: ENV.particularCookieName",
        ],
      },
      {
        // WBR-08c: migrated to the canonical clinic auth helper.
        path: "server/routes/clinic-audit.fastify.ts",
        markers: ["authenticateFastifyClinicUser"],
      },
    ],
    guardrailTests: [
      {
        path: "test/architecture/security/security-production-invariants.test.ts",
        markers: [
          "ENV mantiene cookies de sesión separadas y política productiva segura",
          "cada dominio de sesión lee y escribe únicamente su cookie correspondiente",
          "rutas clinic-scoped que limpian sesión usan contrato central ENV",
        ],
      },
      {
        path: "test/architecture/security/security-session-cookie-boundaries.test.ts",
        markers: [
          "session cookie boundary matrix documents separated auth domains",
          "clinic admin and particular route surfaces read only their own cookie",
          "session cookie guardrail source stays ascii only",
        ],
      },
      {
        path: "test/architecture/security/security-cross-auth-surface-boundaries.test.ts",
        markers: [
          "admin route surfaces accept only admin session cookies",
          "public token surfaces do not accept browser session cookies",
          "cross auth surface registry keeps every protected route family explicit",
        ],
      },
      {
        path: "test/architecture/security/security-boundary-suite-completeness.test.ts",
        markers: [
          "security boundary suite completeness registry keeps canonical order",
          "security boundary guardrails remain connected to runtime anchors",
          "security boundary suite completeness guardrail source stays ascii only",
        ],
      },
      {
        path: "test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts",
        markers: [
          "sensitive log redaction matrix documents protected boundaries",
          "request logger keeps token and query redaction centralized",
          "sensitive log redaction guardrail source stays ascii only",
        ],
      },
      {
        path: "test/security/security-audit-logging-phase-boundaries.test.ts",
        markers: [
          "audit logging phase matrix documents the protected contract",
          "writeAuditLog keeps audit storage failures isolated from business flow",
          "audit logging phase guardrail source stays ascii only",
        ],
      },
      {
        path: "test/architecture/security/security-actor-relationship-boundaries.test.ts",
        markers: [
          "actor relationship matrix documents admin clinic and particular boundaries",
          "admin routes keep explicit clinic relationships before linking reports tokens or tracking",
          "clinic routes force authenticated clinic relationships and reject cross clinic links",
        ],
      },
      {
        path: "test/architecture/security/security-resource-ownership-boundaries.test.ts",
        markers: [
          "resource ownership matrix documents protected owner keys",
          "clinic-owned resources reject cross-clinic reports tokens and tracking cases",
          "admin-owned linking validates target clinic before binding resources",
        ],
      },
      {
        path: "test/architecture/security/security-write-attribution-boundaries.test.ts",
        markers: [
          "write attribution matrix documents admin clinic particular and public token actors",
          "admin writes persist admin attribution and audit through admin context",
          "clinic writes persist clinic attribution and audit through clinic context",
        ],
      },
      {
        path: "test/architecture/security/security-access-lifecycle-boundaries.test.ts",
        markers: [
          "access lifecycle matrix documents public token revoke session and rate-limit states",
          "public report access enforces token lifecycle before signed URLs and audit",
          "runtime lifecycle tests remain explicit for public report access",
        ],
      },
      {
        path: "test/architecture/security/security-response-disclosure-boundaries.test.ts",
        markers: [
          "response disclosure matrix documents stable public error semantics",
          "public report access unifies unusable tokens as 404 and preserves 409 and 429",
          "runtime disclosure tests remain explicit for hidden resources and response codes",
        ],
      },
    ],
  },
  {
    slug: "critical-preflight-cors-contract",
    category: "security",
    purpose:
      "Rutas críticas mantienen contrato OPTIONS/CORS permitido y bloqueo de Origin no permitido.",
    runtimeFiles: [
      {
        path: "server/routes/auth.fastify.ts",
        markers: [
          'app.options("/login"',
          'app.options("/me"',
          'app.options("/logout"',
          'app.options("/change-password"',
        ],
      },
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: [
          'app.options("/login"',
          'app.options("/me"',
          'app.options("/logout"',
          'app.options("/change-password"',
        ],
      },
      {
        path: "server/routes/admin-particular-tokens.fastify.ts",
        markers: [
          'app.options("/", optionsHandler)',
          'app.options("/:tokenId", optionsHandler)',
          'app.options("/:tokenId/report", optionsHandler)',
        ],
      },
      {
        path: "server/routes/admin-report-access-tokens.fastify.ts",
        markers: [
          'app.options("/", optionsHandler)',
          'app.options("/:tokenId", optionsHandler)',
          'app.options("/:tokenId/revoke", optionsHandler)',
        ],
      },
      {
        path: "server/routes/admin-study-tracking.fastify.ts",
        markers: [
          'app.options("/", optionsHandler)',
          'app.options("/notifications", optionsHandler)',
          'app.options("/:trackingCaseId", optionsHandler)',
        ],
      },
      {
        path: "server/routes/reports.fastify.ts",
        markers: [
          'app.options("/", optionsHandler)',
          'app.options("/search", optionsHandler)',
        ],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: [
          'app.options("/", optionsHandler)',
          'app.options("/:tokenId", optionsHandler)',
          'app.options("/:tokenId/revoke", optionsHandler)',
        ],
      },
    ],
    guardrailTests: [
      {
        path: "test/integration/adapters/controllers/auth.fastify.test.ts",
        markers: [
          "clinicAuthNativeRoutes responde preflight OPTIONS permitido sin autenticar",
          "clinicAuthNativeRoutes bloquea preflight OPTIONS con origin no permitido",
        ],
      },
      {
        path: "test/integration/adapters/controllers/admin-auth.fastify.test.ts",
        markers: [
          "adminAuthNativeRoutes responde preflight OPTIONS permitido sin autenticar",
          "adminAuthNativeRoutes bloquea preflight OPTIONS con origin no permitido",
        ],
      },
      {
        path: "test/security/security-trusted-origin-cors-boundaries.test.ts",
        markers: [
          "auth login y mutations bloquean Origin no permitido antes de tocar dependencias",
          "auth preflight OPTIONS solo expone CORS con origins confiables y sin wildcard credentials",
          "CORS con credentials no usa wildcard y trust proxy queda gobernado por ENV",
        ],
      },
      {
        path: "test/integration/adapters/controllers/admin-particular-tokens.fastify.test.ts",
        markers: [
          "adminParticularTokensNativeRoutes bloquea POST / con origin no permitido",
          "adminParticularTokensNativeRoutes vincula PATCH /:tokenId/report con trusted origin",
        ],
      },
      {
        path: "test/integration/adapters/controllers/admin-report-access-tokens.fastify.test.ts",
        markers: [
          "adminReportAccessTokensNativeRoutes bloquea POST / con origin no permitido",
          "adminReportAccessTokensNativeRoutes aplica rate limit nativo fijo sobre mutaciones",
        ],
      },
      {
        path: "test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts",
        markers: [
          "adminStudyTrackingNativeRoutes bloquea POST / con origin no permitido",
          "adminStudyTrackingNativeRoutes actualiza PATCH /:trackingCaseId y notifica tinción especial",
        ],
      },
      {
        path: "test/integration/adapters/controllers/reports.fastify.test.ts",
        markers: [
          "reportsNativeRoutes responde preflight OPTIONS para superficie clinic read-only sin autenticar",
          "reportsNativeRoutes no anuncia POST /upload en preflight clinic",
          "reportsNativeRoutes bloquea preflight OPTIONS con origin no permitido",
        ],
      },
      {
        path: "test/integration/adapters/controllers/report-access-tokens.fastify.test.ts",
        markers: [
          "reportAccessTokensNativeRoutes responde preflight OPTIONS permitido sin autenticar",
          "reportAccessTokensNativeRoutes bloquea preflight OPTIONS con origin no permitido",
        ],
      },
    ],
  },
  {
    slug: "mutation-permission-surface",
    category: "security",
    purpose:
      "Mutaciones clinic-scoped sensibles preservan origin, sesión y permiso antes de DB/storage/audit.",
    runtimeFiles: [
      {
        path: "server/routes/reports-status.fastify.ts",
        markers: [
          "requireReportStatusWritePermission",
          "transitionClinicReportStatus",
          "composition.writeAuditLog",
        ],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: [
          "requireReportAccessTokenManagementPermission",
          "reportAccess.createToken",
        ],
      },
      {
        path: "server/routes/particular-tokens.fastify.ts",
        markers: [
          "requireParticularTokenManagementPermission",
          "clinicOperations.createToken",
        ],
      },
      {
        path: "server/routes/study-tracking.fastify.ts",
        markers: [
          "requireStudyTrackingManagementPermission",
          "clinicOperations.createClinicStudyTrackingCase",
        ],
      },
       {
         path: "server/routes/clinic-public-profile.fastify.ts",
         markers: [
           "requireClinicManagementPermission",
           "patchClinicPublicProfileCommand",
           "runAvatarUpload",
         ],
       },
       {
         path: "server/features/clinics/clinic-public-profile-command-service.ts",
         markers: [
           "const patchClinicPublicProfile = await resolveDep(",
           "const uploadClinicAvatar = await resolveDep(",
         ],
       },
    ],
    guardrailTests: [
      {
        path: "test/architecture/security/security-mutation-permission-surface.test.ts",
        markers: [
          "SENSITIVE_MUTATION_ROUTES",
          "mutation permission registry cubre rutas mutantes clinic-scoped sensibles",
          "rutas mutantes sensibles validan origin, sesión y permiso antes de operar",
        ],
      },
      {
        path: "test/architecture/security/security-validation-cutoff-boundaries.test.ts",
        markers: [
          "validation cut-off matrix documents the protected contract",
          "public report access validates raw token before hash db signing and audit",
          "validation cut-off guardrail source stays ascii only",
        ],
      },
      {
        path: "test/architecture/security/security-rate-limit-isolation-boundaries.test.ts",
        markers: [
          "rate limit isolation matrix documents the protected contract",
          "auth login rate limits keep persistent stores with memory fallback per auth domain",
          "rate limit isolation guardrail source stays ascii only",
        ],
      },
      {
        path: "test/architecture/security/security-cross-tenant-idor-contract.test.ts",
        markers: [
          "cross-tenant IDOR contract matrix has unique IDs",
          "cross-tenant IDOR matrix covers critical production attack surfaces",
          "pending_runtime_staging_evidence",
        ],
      },
    ],
  },
  {
    slug: "storage-upload-signing-boundaries",
    category: "storage",
    purpose:
      "Storage privado, uploads y signed URLs mantienen boundaries contra path traversal y exposición pública accidental.",
    runtimeFiles: [
      {
        path: "server/lib/supabase.ts",
        markers: [
          "sanitizeFileName(fileName: string, fallback: string)",
          "ENV.signedUrlExpiresInSeconds",
          "upsert: false",
          "public: false",
        ],
      },
    ],
    guardrailTests: [
      {
        path: "test/unit/infrastructure/supabase-storage-boundaries.test.ts",
        markers: [
          "storage boundaries mantienen bucket privado y no exponen public URLs",
          "storage boundaries generan signed URLs sólo con TTL configurado por ENV",
          "storage boundaries suben archivos con storage path privado y upsert deshabilitado",
        ],
      },
      {
        path: "test/unit/infrastructure/supabase-upload-success.test.ts",
        markers: [
          "uploadReport neutraliza path traversal y separadores de ruta en fileName",
          "uploadClinicAvatar neutraliza path traversal y separadores de ruta en fileName",
        ],
      },
      {
        path: "test/unit/infrastructure/supabase-signed-url.test.ts",
        markers: [
          "createSignedStorageUrl devuelve signedUrl cuando storage responde correctamente",
          "createSignedReportDownloadUrl usa nombre de descarga explicito cuando se provee",
        ],
      },
      {
        path: "test/unit/infrastructure/supabase-recovery-edge.test.ts",
        markers: [
          "ensureStorageBucketExists crea bucket cuando getBucket devuelve error",
          "createSignedStorageUrl usa fallback cuando data viene null sin error",
        ],
      },
    ],
  },
  {
    slug: "public-professionals-route-surface",
    category: "public-search",
    purpose:
      "Superficie pública de profesionales conserva endpoints públicos mínimos, headers, boundaries y fixture suite.",
    runtimeFiles: [
      {
        path: "server/routes/public-professionals.fastify.ts",
        markers: [
          "publicProfessionalsNativeRoutes",
          '"/search"',
          '"/:clinicId"',
        ],
      },
      {
        path: "server/fastify-app.ts",
        markers: [
          "publicProfessionalsNativeRoutes",
          'prefix: "/api/public/professionals"',
        ],
      },
    ],
    guardrailTests: [
      {
        path: "test/integration/adapters/controllers/public-professionals-route-surface-invariants.test.ts",
        markers: [
          "router público de profesionales conserva solo endpoints GET search y detail",
          "superficie pública no acepta métodos mutantes en profesionales públicos",
        ],
      },
      {
        path: "test/integration/adapters/controllers/public-professionals-response-headers-invariants.test.ts",
        markers: [
          "profesionales públicos responde JSON y sin cookies en search detail y errores públicos",
          "profesionales públicos expone CORS permitido solo en rutas reales con Origin permitido",
        ],
      },
      {
        path: "test/architecture/public-professionals-fixture-suite-completeness-invariants.test.ts",
        markers: [
          "fixture suite completeness conserva inventario esperado de guardrails",
          "fixture suite completeness coincide con el registry explícito",
        ],
      },
    ],
  },
  {
    slug: "ci-local-validation-gates",
    category: "validation",
    purpose:
      "CI y validación local conservan gates obligatorios de typecheck, test y build.",
    runtimeFiles: [
      {
        path: ".github/workflows/backend-ci.yml",
        markers: [
          "pnpm typecheck",
          "pnpm typecheck:test",
          "pnpm test",
          "pnpm build",
        ],
      },
      {
        path: "package.json",
        markers: [
          '"typecheck"',
          '"typecheck:test"',
          '"test"',
          '"build"',
          '"validate:local"',
        ],
      },
    ],
    guardrailTests: [
      {
        path: "test/unit/infrastructure/backend-ci-workflow.test.ts",
        markers: [
          "Backend CI ejecuta todos los gates obligatorios en orden",
          "Backend CI mantiene Postgres efímero y migraciones antes de validaciones",
        ],
      },
      {
        path: "test/unit/infrastructure/package-scripts.test.ts",
        markers: [
          "package scripts expose required validation commands",
          "validate:local keeps local gates in required order",
        ],
      },
    ],
  },
];

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertFileContains(expectation: FileExpectation): void {
  assert.equal(
    existsSync(resolve(process.cwd(), expectation.path)),
    true,
    `${expectation.path} debe existir`,
  );

  const source = read(expectation.path);

  for (const marker of expectation.markers) {
    assert.ok(
      source.includes(marker),
      `${expectation.path} debe conservar marker: ${marker}`,
    );
  }
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

test("critical route surface registry mantiene inventario final esperado", () => {
  const slugs = CRITICAL_ROUTE_SURFACE_REGISTRY.map((surface) => surface.slug);

  assert.deepEqual(slugs, [
    "auth-session-cookie-contract",
    "critical-preflight-cors-contract",
    "mutation-permission-surface",
    "storage-upload-signing-boundaries",
    "public-professionals-route-surface",
    "ci-local-validation-gates",
  ]);

  assert.deepEqual(slugs, uniqueValues(slugs));

  for (const surface of CRITICAL_ROUTE_SURFACE_REGISTRY) {
    assert.match(surface.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(surface.category, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(surface.purpose.length >= 40);
    assert.ok(surface.runtimeFiles.length > 0);
    assert.ok(surface.guardrailTests.length > 0);
  }
});

test("critical route surface registry apunta a runtime y guardrails existentes", () => {
  for (const surface of CRITICAL_ROUTE_SURFACE_REGISTRY) {
    for (const runtimeFile of surface.runtimeFiles) {
      assertFileContains(runtimeFile);
    }

    for (const guardrailTest of surface.guardrailTests) {
      assertFileContains(guardrailTest);

      const source = read(guardrailTest.path);
      assert.ok(
        source.includes('import test from "node:test";'),
        `${guardrailTest.path} debe usar node:test`,
      );
      assert.ok(
        source.includes('import assert from "node:assert/strict";'),
        `${guardrailTest.path} debe usar assert strict`,
      );
    }
  }
});

test("critical route surface registry no duplica archivos dentro de cada superficie", () => {
  for (const surface of CRITICAL_ROUTE_SURFACE_REGISTRY) {
    const runtimePaths = surface.runtimeFiles.map((file) => file.path);
    const guardrailPaths = surface.guardrailTests.map((file) => file.path);

    assert.deepEqual(
      runtimePaths,
      uniqueValues(runtimePaths),
      `${surface.slug} no debe repetir runtime files`,
    );
    assert.deepEqual(
      guardrailPaths,
      uniqueValues(guardrailPaths),
      `${surface.slug} no debe repetir guardrail tests`,
    );
  }
});

test("critical route surface registry cubre todos los guardrails finales obligatorios", () => {
  const guardrailPaths = CRITICAL_ROUTE_SURFACE_REGISTRY.flatMap((surface) =>
    surface.guardrailTests.map((file) => file.path),
  );

  for (const requiredGuardrail of [
    "test/architecture/security/security-production-invariants.test.ts",
    "test/architecture/security/security-session-cookie-boundaries.test.ts",
    "test/architecture/security/security-cross-auth-surface-boundaries.test.ts",
    "test/architecture/security/security-boundary-suite-completeness.test.ts",
    "test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts",
    "test/security/security-audit-logging-phase-boundaries.test.ts",
    "test/architecture/security/security-actor-relationship-boundaries.test.ts",
    "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    "test/architecture/security/security-write-attribution-boundaries.test.ts",
    "test/architecture/security/security-access-lifecycle-boundaries.test.ts",
    "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    "test/architecture/security/security-cross-tenant-idor-contract.test.ts",
    "test/security/security-trusted-origin-cors-boundaries.test.ts",
    "test/architecture/security/security-mutation-permission-surface.test.ts",
    "test/architecture/security/security-validation-cutoff-boundaries.test.ts",
    "test/architecture/security/security-rate-limit-isolation-boundaries.test.ts",
    "test/unit/infrastructure/supabase-storage-boundaries.test.ts",
    "test/integration/adapters/controllers/public-professionals-route-surface-invariants.test.ts",
    "test/architecture/public-professionals-fixture-suite-completeness-invariants.test.ts",
    "test/unit/infrastructure/backend-ci-workflow.test.ts",
    "test/unit/infrastructure/package-scripts.test.ts",
  ]) {
    assert.equal(
      guardrailPaths.includes(requiredGuardrail),
      true,
      `registry crítico debe incluir guardrail final: ${requiredGuardrail}`,
    );
  }
});

test("critical route surface registry permanece test-only y sin artefactos temporales", () => {
  const source = read("test/architecture/security/security-critical-route-surface-registry.test.ts");

  assert.equal(/^\s*export\s+/m.test(source), false);
  const forbiddenMarkers = [
    "pr145" + "-body.md",
    "TO" + "DO",
    "FIX" + "ME",
    "create" + "Client(",
    "fet" + "ch(",
  ];

  for (const marker of forbiddenMarkers) {
    assert.equal(
      source.includes(marker),
      false,
      `registry crítico no debe contener marker prohibido: ${marker}`,
    );
  }
});
