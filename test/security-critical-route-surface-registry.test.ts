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
          'cookieName: rawEnv.COOKIE_NAME ?? "app_session_id"',
          'adminCookieName: rawEnv.ADMIN_COOKIE_NAME ?? "admin_session_id"',
          "PARTICULAR_COOKIE_NAME",
          "trustProxy: rawEnv.TRUST_PROXY ?? 1",
        ],
      },
      {
        path: "server/routes/auth.fastify.ts",
        markers: ["cookies[ENV.cookieName]", "name: ENV.cookieName"],
      },
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: ["cookies[ENV.adminCookieName]", "name: ENV.adminCookieName"],
      },
      {
        path: "server/routes/particular-auth.fastify.ts",
        markers: [
          "cookies[ENV.particularCookieName]",
          "name: ENV.particularCookieName",
        ],
      },
      {
        path: "server/routes/clinic-audit.fastify.ts",
        markers: ["cookies[ENV.cookieName]", "name: ENV.cookieName"],
      },
    ],
    guardrailTests: [
      {
        path: "test/security-production-invariants.test.ts",
        markers: [
          "ENV mantiene cookies de sesión separadas y política productiva segura",
          "cada dominio de sesión lee y escribe únicamente su cookie correspondiente",
          "rutas clinic-scoped que limpian sesión usan contrato central ENV",
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
        ],
      },
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: [
          'app.options("/login"',
          'app.options("/me"',
          'app.options("/logout"',
        ],
      },
      {
        path: "server/routes/reports.fastify.ts",
        markers: [
          'app.options("/", optionsHandler)',
          'app.options("/upload", optionsHandler)',
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
        path: "test/auth.fastify.test.ts",
        markers: [
          "clinicAuthNativeRoutes responde preflight OPTIONS permitido sin autenticar",
          "clinicAuthNativeRoutes bloquea preflight OPTIONS con origin no permitido",
        ],
      },
      {
        path: "test/admin-auth.fastify.test.ts",
        markers: [
          "adminAuthNativeRoutes responde preflight OPTIONS permitido sin autenticar",
          "adminAuthNativeRoutes bloquea preflight OPTIONS con origin no permitido",
        ],
      },
      {
        path: "test/reports.fastify.test.ts",
        markers: [
          "reportsNativeRoutes responde preflight OPTIONS permitido sin autenticar",
          "reportsNativeRoutes bloquea preflight OPTIONS con origin no permitido",
        ],
      },
      {
        path: "test/report-access-tokens.fastify.test.ts",
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
        path: "server/routes/reports.fastify.ts",
        markers: ["auth.canUploadReports", "deps.uploadReport"],
      },
      {
        path: "server/routes/reports-status.fastify.ts",
        markers: ["requireReportStatusWritePermission", "deps.updateReportStatus"],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: [
          "requireReportAccessTokenManagementPermission",
          "deps.createReportAccessToken",
        ],
      },
      {
        path: "server/routes/particular-tokens.fastify.ts",
        markers: [
          "requireParticularTokenManagementPermission",
          "deps.createParticularToken",
        ],
      },
      {
        path: "server/routes/study-tracking.fastify.ts",
        markers: [
          "requireStudyTrackingManagementPermission",
          "deps.createStudyTrackingCase",
        ],
      },
      {
        path: "server/routes/clinic-public-profile.fastify.ts",
        markers: [
          "requireClinicManagementPermission",
          "deps.patchClinicPublicProfile",
          "deps.uploadClinicAvatar",
        ],
      },
    ],
    guardrailTests: [
      {
        path: "test/security-mutation-permission-surface.test.ts",
        markers: [
          "SENSITIVE_MUTATION_ROUTES",
          "mutation permission registry cubre rutas mutantes clinic-scoped sensibles",
          "rutas mutantes sensibles validan origin, sesión y permiso antes de operar",
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
        path: "test/supabase-storage-boundaries.test.ts",
        markers: [
          "storage boundaries mantienen bucket privado y no exponen public URLs",
          "storage boundaries generan signed URLs sólo con TTL configurado por ENV",
          "storage boundaries suben archivos con storage path privado y upsert deshabilitado",
        ],
      },
      {
        path: "test/supabase-upload-success.test.ts",
        markers: [
          "uploadReport neutraliza path traversal y separadores de ruta en fileName",
          "uploadClinicAvatar neutraliza path traversal y separadores de ruta en fileName",
        ],
      },
      {
        path: "test/supabase-signed-url.test.ts",
        markers: [
          "createSignedStorageUrl devuelve signedUrl cuando storage responde correctamente",
          "createSignedReportDownloadUrl usa nombre de descarga explicito cuando se provee",
        ],
      },
      {
        path: "test/supabase-recovery-edge.test.ts",
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
        path: "test/public-professionals-route-surface-invariants.test.ts",
        markers: [
          "router público de profesionales conserva solo endpoints GET search y detail",
          "superficie pública no acepta métodos mutantes en profesionales públicos",
        ],
      },
      {
        path: "test/public-professionals-response-headers-invariants.test.ts",
        markers: [
          "profesionales públicos responde JSON y sin cookies en search detail y errores públicos",
          "profesionales públicos expone CORS permitido solo en rutas reales con Origin permitido",
        ],
      },
      {
        path: "test/public-professionals-fixture-suite-completeness-invariants.test.ts",
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
        path: "test/backend-ci-workflow.test.ts",
        markers: [
          "Backend CI ejecuta todos los gates obligatorios en orden",
          "Backend CI mantiene Postgres efímero y migraciones antes de validaciones",
        ],
      },
      {
        path: "test/package-scripts.test.ts",
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
    "test/security-production-invariants.test.ts",
    "test/security-mutation-permission-surface.test.ts",
    "test/supabase-storage-boundaries.test.ts",
    "test/public-professionals-route-surface-invariants.test.ts",
    "test/public-professionals-fixture-suite-completeness-invariants.test.ts",
    "test/backend-ci-workflow.test.ts",
    "test/package-scripts.test.ts",
  ]) {
    assert.equal(
      guardrailPaths.includes(requiredGuardrail),
      true,
      `registry crítico debe incluir guardrail final: ${requiredGuardrail}`,
    );
  }
});

test("critical route surface registry permanece test-only y sin artefactos temporales", () => {
  const source = read("test/security-critical-route-surface-registry.test.ts");

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
