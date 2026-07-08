import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type FileExpectation = {
  path: string;
  markers: readonly string[];
};

type GlobalSurface = {
  group: "G1" | "G2" | "G3" | "G4" | "G5" | "G6";
  purpose: string;
  runtimeFiles: readonly FileExpectation[];
  guardrailFiles: readonly FileExpectation[];
};

const GLOBAL_SURFACES: readonly GlobalSurface[] = [
  {
    group: "G1",
    purpose:
      "Public web and API surface keeps headers, safe metadata, public route limits and bundle exposure guardrails.",
    runtimeFiles: [
      {
        path: "server/fastify-app.ts",
        markers: [
          'prefix: "/api/public/professionals"',
          'prefix: "/api/public/pricing"',
          'prefix: "/api/public/report-access"',
        ],
      },
      {
        path: "frontend/next.config.ts",
        markers: [
          "buildSecurityHeaders",
          "Content-Security-Policy-Report-Only",
          "X-Content-Type-Options",
        ],
      },
      {
        path: "scripts/security/audit-public-devtools-surface.mjs",
        markers: [
          "DANGEROUSLY_SET_INNER_HTML_REGEX",
          "EXPLICIT_BLOCKED_IDENTIFIERS",
          "publicExposure",
        ],
      },
    ],
    guardrailFiles: [
      {
        path: "test/unit/ui/public/frontend-public-devtools-exposure-contract.test.ts",
        markers: ["public devtools auditor script passes with no exposure findings"],
      },
      {
        path: "test/unit/ui/frontend/frontend-next-config-security-headers.test.ts",
        markers: ["X-Content-Type-Options", "Content-Security-Policy-Report-Only"],
      },
    ],
  },
  {
    group: "G2",
    purpose:
      "Admin, clinic and particular auth boundaries keep session cookies, role checks, trusted origin and CORS separated.",
    runtimeFiles: [
      {
        path: "server/fastify-app.ts",
        markers: [
          "requireTrustedOriginForFastify",
          'prefix: "/api/admin/auth"',
          'prefix: "/api/auth"',
          'prefix: "/api/particular/auth"',
        ],
      },
      {
        path: "server/lib/env.ts",
        markers: ["cookieName", "adminCookieName", "particularCookieName"],
      },
      {
        path: "server/lib/fastify-admin-auth.ts",
        markers: ["authenticateFastifyAdmin", "ENV.adminCookieName"],
      },
    ],
    guardrailFiles: [
      {
        path: "test/security-session-cookie-boundaries.test.ts",
        markers: ["session cookie boundary matrix documents separated auth domains"],
      },
      {
        path: "test/security-cross-auth-surface-boundaries.test.ts",
        markers: ["cross auth surface registry keeps every protected route family explicit"],
      },
    ],
  },
  {
    group: "G3",
    purpose:
      "Contact, uploads and input parsers reject unsafe payloads before DB storage signing or audit side effects.",
    runtimeFiles: [
      {
        path: "server/routes/contact.fastify.ts",
        markers: ["contactNativeRoutes", "safeParse"],
      },
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: ["multer", "fileSize", "Tipo de archivo no permitido"],
      },
      {
        path: "server/lib/supabase.ts",
        markers: ["sanitizeFileName(fileName: string, fallback: string)", "upsert: false"],
      },
    ],
    guardrailFiles: [
      {
        path: "test/security-validation-cutoff-boundaries.test.ts",
        markers: ["validation cut-off matrix documents the protected contract"],
      },
      {
        path: "test/supabase-upload-success.test.ts",
        markers: ["neutraliza path traversal"],
      },
    ],
  },
  {
    group: "G4",
    purpose:
      "Private report storage paths, access tokens and signed URLs stay lazy, scoped and absent from public JSON.",
    runtimeFiles: [
      {
        path: "server/lib/report-access-token.ts",
        markers: ["serializePublicReportAccess", "serializeReportAccessToken"],
      },
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: [
          "reportAccessTokenRawTokenSchema.safeParse",
          "createSignedReportUrl",
          "createSignedReportDownloadUrl",
        ],
      },
      {
        path: "server/lib/supabase.ts",
        markers: ["ENV.signedUrlExpiresInSeconds", "createSignedUrl"],
      },
    ],
    guardrailFiles: [
      {
        path: "test/storage-suite-completeness.test.ts",
        markers: ["Public report access and public professionals tests keep signed URLs delegated"],
      },
      {
        path: "test/security-sensitive-log-redaction-boundaries.test.ts",
        markers: ["sensitive log redaction matrix documents protected boundaries"],
      },
    ],
  },
  {
    group: "G5",
    purpose:
      "Heavy lists, cache policy, rate limits and local validation gates keep production behavior bounded and observable.",
    runtimeFiles: [
      {
        path: "server/lib/list-pagination.ts",
        markers: ["DEFAULT_LIST_LIMIT", "MAX_LIST_LIMIT", "MAX_LIST_OFFSET"],
      },
      {
        path: "server/lib/sensitive-response-cache.ts",
        markers: ["SENSITIVE_API_CACHE_CONTROL", "!url.startsWith(\"/api/public/\")"],
      },
      {
        path: "package.json",
        markers: ["\"test\"", "\"build\"", "\"typecheck\"", "\"security:public-surface\""],
      },
    ],
    guardrailFiles: [
      {
        path: "test/unit/contracts/admin/admin-heavy-list-pagination-contract.test.ts",
        markers: ["normalizeListPagination clampa max limit y offset"],
      },
      {
        path: "test/security-rate-limit-isolation-boundaries.test.ts",
        markers: ["rate limit isolation matrix documents the protected contract"],
      },
    ],
  },
  {
    group: "G6",
    purpose:
      "Public, dashboard and particular UX surfaces keep route guards, mobile parity and semantic frontend checks.",
    runtimeFiles: [
      {
        path: "frontend/src/proxy.ts",
        markers: ["ADMIN_DASHBOARD_PATH_PREFIX", "NextResponse.redirect"],
      },
      {
        path: "frontend/src/app/layout.tsx",
        markers: ["metadata", "viewport"],
      },
      {
        path: "frontend/src/components/public/PublicAction.tsx",
        markers: ["PublicRouteControl", "PublicExternalControl", "aria-hidden"],
      },
    ],
    guardrailFiles: [
      {
        path: "test/mobile-production-parity-invariants.test.ts",
        markers: ["mobile"],
      },
      {
        path: "test/unit/ui/public/frontend-public-page-semantics.test.ts",
        markers: [
          "home page keeps one clear h1 and institutional section hierarchy",
          "profesionales content keeps semantic search/result structure and map safety",
        ],
      },
    ],
  },
];

const REQUIRED_VALIDATION_SCRIPTS = [
  "test",
  "build",
  "security:public-surface",
  "typecheck",
  "typecheck:test",
] as const;

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
    `${expectation.path} must exist`,
  );

  const source = read(expectation.path);

  for (const marker of expectation.markers) {
    assert.ok(
      source.includes(marker),
      `${expectation.path} must contain marker: ${marker}`,
    );
  }
}

test("global e2e readiness registry covers G1 to G6 production surfaces", () => {
  assert.deepEqual(
    GLOBAL_SURFACES.map((surface) => surface.group),
    ["G1", "G2", "G3", "G4", "G5", "G6"],
  );

  for (const surface of GLOBAL_SURFACES) {
    assert.ok(surface.purpose.length >= 80);
    assert.ok(surface.runtimeFiles.length >= 3);
    assert.ok(surface.guardrailFiles.length >= 2);

    for (const file of surface.runtimeFiles) {
      assertFileContains(file);
    }

    for (const file of surface.guardrailFiles) {
      assertFileContains(file);
    }
  }
});

test("global e2e readiness keeps required local validation gates", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    scripts?: Record<string, string>;
  };

  for (const script of REQUIRED_VALIDATION_SCRIPTS) {
    assert.equal(
      typeof packageJson.scripts?.[script],
      "string",
      `package.json must expose pnpm ${script}`,
    );
  }

  assert.ok(
    packageJson.scripts?.["validate:local"]?.includes("pnpm typecheck"),
    "validate:local must keep typecheck in the local gate",
  );
  assert.ok(
    packageJson.scripts?.["validate:local"]?.includes("pnpm test"),
    "validate:local must keep test in the local gate",
  );
  assert.ok(
    packageJson.scripts?.["validate:local"]?.includes("pnpm build"),
    "validate:local must keep build in the local gate",
  );
});

test("global e2e readiness docs keep audit matrix evidence and PR scope", () => {
  const auditDocPath = "docs/audit/global-e2e-extreme-production-audit.md";
  const prDocPath =
    "docs/pr-history/pr-826-global-e2e-extreme-production-readiness.md";

  assert.equal(existsSync(resolve(process.cwd(), auditDocPath)), true);
  assert.equal(existsSync(resolve(process.cwd(), prDocPath)), true);

  const auditDoc = read(auditDocPath);
  const prDoc = read(prDocPath);

  for (const marker of [
    "## Executive summary",
    "## Risk matrix",
    "## Findings corrected",
    "## Accepted and documented findings",
    "## Validation evidence",
    "G1",
    "G2",
    "G3",
    "G4",
    "G5",
    "G6",
  ]) {
    assert.ok(auditDoc.includes(marker), `${auditDocPath} must contain ${marker}`);
  }

  for (const command of [
    "pnpm test",
    "pnpm build",
    "pnpm security:public-surface",
    "pnpm typecheck",
    "pnpm typecheck:test",
    "git diff --check",
  ]) {
    assert.ok(auditDoc.includes(command), `${auditDocPath} must mention ${command}`);
    assert.ok(prDoc.includes(command), `${prDocPath} must mention ${command}`);
  }
});

test("global e2e readiness guardrail source stays ascii only", () => {
  const source = read("test/global-e2e-production-readiness-contract.test.ts");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `global e2e readiness source must stay ascii-only at index ${index}`,
    );
  }
});
