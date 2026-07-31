import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  relative,
  resolve,
} from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const httpDirectory = "server/lib/http";
const corsPath = "server/lib/cors-headers.ts";
const guardPath =
  "test/architecture/backend-modularization-m46-http-lib-reclassification.test.ts";
const closeoutPath =
  "docs/implementation/m46-http-lib-reclassification-closeout.md";
const auditPath =
  "docs/audit/backend-enterprise-modularization-program-audit.md";
const inventoryPath =
  "docs/architecture/shared-lib-boundary-inventory.md";
const m45CloseoutPath =
  "docs/implementation/m45-backend-feature-dependency-guard-closeout.md";

const expectedHttpFiles = [
  "server/lib/http/api-request-id.ts",
  "server/lib/http/api-response-security.ts",
  "server/lib/http/sensitive-response-cache.ts",
] as const;

const retiredPaths = [
  "server/lib/api-request-id.ts",
  "server/lib/api-response-security.ts",
  "server/lib/sensitive-response-cache.ts",
] as const;

const expectedExports: Record<string, string[]> = {
  "server/lib/http/api-request-id.ts": [
    "API_REQUEST_ID_HEADER_KEY",
    "API_REQUEST_ID_HEADER_NAME",
    "API_REQUEST_ID_MAX_LENGTH",
    "applyApiRequestIdHeader",
    "generateFastifyRequestId",
    "generateSafeRequestId",
    "getSafeApiResponseRequestId",
    "getSafeIncomingRequestId",
    "isSafeRequestId",
  ],
  "server/lib/http/api-response-security.ts": [
    "API_NOSNIFF_HEADER_NAME",
    "API_NOSNIFF_HEADER_VALUE",
    "API_REFERRER_POLICY_HEADER_NAME",
    "API_REFERRER_POLICY_HEADER_VALUE",
    "applyApiNosniffHeader",
    "applyApiSecurityHeaders",
    "shouldApplyApiNosniff",
    "shouldApplyApiSecurityHeaders",
  ],
  "server/lib/http/sensitive-response-cache.ts": [
    "SENSITIVE_API_CACHE_CONTROL",
    "applySensitiveApiNoStoreHeaders",
    "shouldApplySensitiveApiNoStore",
  ],
};

const expectedImportKeys: Record<string, string[]> = {
  "server/lib/http/api-request-id.ts": [
    "static|runtime|./api-response-security.ts",
    "static|runtime|node:crypto",
    "static|type|fastify",
    "static|type|node:http",
  ],
  "server/lib/http/api-response-security.ts": [
    "static|type|fastify",
  ],
  "server/lib/http/sensitive-response-cache.ts": [
    "static|type|fastify",
  ],
};

const expectedConsumerKeys = [
  "server/fastify-app.ts|static|runtime|./lib/http/api-request-id.ts|server/lib/http/api-request-id.ts",
  "server/fastify-app.ts|static|runtime|./lib/http/api-response-security.ts|server/lib/http/api-response-security.ts",
  "server/fastify-app.ts|static|runtime|./lib/http/sensitive-response-cache.ts|server/lib/http/sensitive-response-cache.ts",
  "server/lib/http/api-request-id.ts|static|runtime|./api-response-security.ts|server/lib/http/api-response-security.ts",
  "server/lib/logger.ts|static|runtime|./http/api-request-id.ts|server/lib/http/api-request-id.ts",
  "server/middlewares/request-logger.ts|static|runtime|../lib/http/api-request-id.ts|server/lib/http/api-request-id.ts",
  "test/helpers/api-request-id-contract.ts|dynamic|runtime|../../server/lib/http/api-request-id.ts|server/lib/http/api-request-id.ts",
  "test/integration/adapters/controllers/api-request-id-observability-contract.test.ts|dynamic|runtime|../../../../server/lib/http/api-request-id.ts|server/lib/http/api-request-id.ts",
  "test/integration/app/fastify-app.test.ts|dynamic|runtime|../../../server/lib/http/api-response-security.ts|server/lib/http/api-response-security.ts",
  "test/security/backend-api-no-store-cache-contract.test.ts|dynamic|runtime|../../server/lib/http/sensitive-response-cache.ts|server/lib/http/sensitive-response-cache.ts",
  "test/unit/infrastructure/backend-api-nosniff-responses-contract.test.ts|dynamic|runtime|../../../server/lib/http/api-request-id.ts|server/lib/http/api-request-id.ts",
  "test/unit/infrastructure/backend-api-nosniff-responses-contract.test.ts|dynamic|runtime|../../../server/lib/http/api-response-security.ts|server/lib/http/api-response-security.ts",
  "test/unit/infrastructure/global-performance-resilience-contract.test.ts|dynamic|runtime|../../../server/lib/http/sensitive-response-cache.ts|server/lib/http/sensitive-response-cache.ts",
].sort();

const expectedCorsRuntimeConsumers = [
  "server/routes/admin-audit.fastify.ts",
  "server/routes/admin-auth.fastify.ts",
  "server/routes/admin-clinics.fastify.ts",
  "server/routes/admin-failed-login-alerts.fastify.ts",
  "server/routes/admin-particular-tokens.fastify.ts",
  "server/routes/admin-pricing.fastify.ts",
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/admin-report-workflow.fastify.ts",
  "server/routes/admin-reports.fastify.ts",
  "server/routes/admin-sessions.fastify.ts",
  "server/routes/admin-study-tracking.fastify.ts",
  "server/routes/admin-system-health.fastify.ts",
  "server/routes/admin-system-maintenance.fastify.ts",
  "server/routes/admin-system-schema-health.fastify.ts",
  "server/routes/admin-users-roles.fastify.ts",
  "server/routes/auth.fastify.ts",
  "server/routes/clinic-public-profile.fastify.ts",
  "server/routes/contact.fastify.ts",
  "server/routes/logistics-field-visits.fastify.ts",
  "server/routes/logistics-route-events.fastify.ts",
  "server/routes/logistics-route-plans.fastify.ts",
  "server/routes/logistics-sla.fastify.ts",
  "server/routes/particular-auth.fastify.ts",
  "server/routes/particular-study-tracking.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/public-report-access.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/reports-status.fastify.ts",
  "server/routes/reports.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
] as const;

type ImportSite = {
  specifier: string;
  kind: "static" | "reexport" | "import-type" | "dynamic" | "require";
  isTypeOnly: boolean;
};

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function walkTsFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = resolve(repoRoot, relativeDirectory);

  if (!existsSync(absoluteDirectory)) {
    return [];
  }

  return readdirSync(absoluteDirectory, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = `${relativeDirectory}/${entry.name}`;

      if (entry.isDirectory()) {
        return walkTsFiles(relativePath);
      }

      return entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts")
        ? [relativePath]
        : [];
    })
    .sort();
}

function parse(relativePath: string): ts.SourceFile {
  return ts.createSourceFile(
    relativePath,
    read(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function importIsTypeOnly(declaration: ts.ImportDeclaration): boolean {
  const clause = declaration.importClause;

  if (!clause) {
    return false;
  }

  if (clause.isTypeOnly) {
    return true;
  }

  if (clause.name || !clause.namedBindings) {
    return false;
  }

  return (
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function listImportSites(relativePath: string): ImportSite[] {
  const sites: ImportSite[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      sites.push({
        specifier: node.moduleSpecifier.text,
        kind: "static",
        isTypeOnly: importIsTypeOnly(node),
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      sites.push({
        specifier: node.moduleSpecifier.text,
        kind: "reexport",
        isTypeOnly: node.isTypeOnly,
      });
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      sites.push({
        specifier: node.argument.literal.text,
        kind: "import-type",
        isTypeOnly: true,
      });
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        sites.push({
          specifier: node.arguments[0].text,
          kind: "dynamic",
          isTypeOnly: false,
        });
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require"
      ) {
        sites.push({
          specifier: node.arguments[0].text,
          kind: "require",
          isTypeOnly: false,
        });
      }
    }

    node.forEachChild(visit);
  }

  visit(parse(relativePath));
  return sites;
}

function resolveRelativeSpecifier(
  sourceFile: string,
  specifier: string,
): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const absoluteTarget = resolve(repoRoot, dirname(sourceFile), specifier);
  const relativeTarget = normalizePath(relative(repoRoot, absoluteTarget));
  const candidates = [
    relativeTarget,
    `${relativeTarget}.ts`,
    `${relativeTarget}/index.ts`,
  ];

  for (const candidate of candidates) {
    const absoluteCandidate = resolve(repoRoot, candidate);

    if (
      existsSync(absoluteCandidate) &&
      statSync(absoluteCandidate).isFile()
    ) {
      return candidate;
    }
  }

  return null;
}

function listExportNames(relativePath: string): string[] {
  const names: string[] = [];

  for (const statement of parse(relativePath).statements) {
    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const isExported = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );

    if (!isExported) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        names.push(declaration.name.getText());
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      names.push(statement.name.text);
    }
  }

  return names.sort();
}

function consumerKey(
  sourceFile: string,
  site: ImportSite,
  targetFile: string,
): string {
  return [
    sourceFile,
    site.kind,
    site.isTypeOnly ? "type" : "runtime",
    site.specifier,
    targetFile,
  ].join("|");
}

test("M46 fija inventario y decisiones MOVE/KEEP canónicas", () => {
  assert.deepEqual(
    walkTsFiles(httpDirectory),
    expectedHttpFiles,
  );

  for (const retiredPath of retiredPaths) {
    assert.equal(existsSync(resolve(repoRoot, retiredPath)), false, retiredPath);
  }

  assert.equal(existsSync(resolve(repoRoot, corsPath)), true, corsPath);
  assert.equal(existsSync(resolve(repoRoot, `${httpDirectory}/index.ts`)), false);
});

test("M46 preserva exports e imports eager/type-only exactos", () => {
  for (const file of expectedHttpFiles) {
    assert.deepEqual(listExportNames(file), expectedExports[file], file);
    assert.deepEqual(
      listImportSites(file)
        .map((site) =>
          [
            site.kind,
            site.isTypeOnly ? "type" : "runtime",
            site.specifier,
          ].join("|"),
        )
        .sort(),
      expectedImportKeys[file],
      file,
    );
  }
});

test("server/lib/http no depende de capas o servicios prohibidos", () => {
  const violations: string[] = [];

  for (const file of expectedHttpFiles) {
    for (const site of listImportSites(file)) {
      const target = resolveRelativeSpecifier(file, site.specifier);
      const normalized = normalizePath(target ?? site.specifier).toLowerCase();

      if (
        normalized.startsWith("server/features/") ||
        normalized.startsWith("server/routes/") ||
        normalized.startsWith("server/middlewares/") ||
        /^server\/db(?:-|\.ts)/.test(normalized) ||
        normalized.startsWith("frontend/") ||
        /(?:^|\/)(?:auth|session|cookie|email|supabase)(?:[-./]|$)/.test(
          normalized,
        )
      ) {
        violations.push(`${file} -> ${site.specifier}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("M46 congela consumidores canónicos y elimina imports legacy", () => {
  const consumers: string[] = [];
  const legacyLiterals: string[] = [];

  for (const file of [
    ...walkTsFiles("server"),
    ...walkTsFiles("test"),
  ]) {
    if (file === guardPath) {
      continue;
    }

    const source = read(file);

    for (const retiredPath of retiredPaths) {
      if (source.includes(retiredPath)) {
        legacyLiterals.push(`${file}: ${retiredPath}`);
      }
    }

    for (const site of listImportSites(file)) {
      const target = resolveRelativeSpecifier(file, site.specifier);

      if (
        target &&
        (expectedHttpFiles as readonly string[]).includes(target)
      ) {
        consumers.push(consumerKey(file, site, target));
      }
    }
  }

  assert.deepEqual(consumers.sort(), expectedConsumerKeys);
  assert.deepEqual(legacyLiterals.sort(), []);
});

test("M46 retiene cors-headers con sus 30 consumidores runtime exactos", () => {
  const consumers = walkTsFiles("server")
    .filter((file) =>
      listImportSites(file).some(
        (site) => resolveRelativeSpecifier(file, site.specifier) === corsPath,
      ),
    )
    .sort();

  assert.deepEqual(consumers, expectedCorsRuntimeConsumers);
  assert.ok(
    read("test/unit/infrastructure/cors-headers-shared-helper.test.ts")
      .includes("server/lib/cors-headers.ts"),
  );
  assert.ok(
    read("test/architecture/security/security-production-invariants.test.ts")
      .includes('read("server/lib/cors-headers.ts")'),
  );
});

test("M46 preserva su closeout histórico y reconoce el cierre vigente M48", () => {
  assert.equal(existsSync(resolve(repoRoot, closeoutPath)), true, closeoutPath);

  const closeout = read(closeoutPath);
  const audit = read(auditPath);
  const inventory = read(inventoryPath);
  const m45Closeout = read(m45CloseoutPath);

  for (const marker of [
    "M46 — completado",
    "cors-headers.ts",
    "KEEP",
    "C5 — NOT_RUN",
    "M48 — NOT_RUN",
  ]) {
    assert.ok(closeout.includes(marker), marker);
  }

  assert.ok(audit.includes("M46 — completado"));
  assert.ok(audit.includes("M47 — NO-GO"));
  assert.ok(audit.includes("M48 — completado"));
  assert.ok(inventory.includes("M46 — completado"));
  assert.ok(inventory.includes("M48 — completado"));
  assert.ok(m45Closeout.includes("M46 — NOT_RUN"));
});

test("el guard M46 no consulta Git, ramas, worktrees ni child_process", () => {
  const source = read(guardPath);
  const imports = listImportSites(guardPath).map((site) => site.specifier);

  assert.equal(imports.includes("node:child_process"), false);
  assert.doesNotMatch(
    source,
    /\bgit\s+(?:branch|show-ref|worktree|status|rev-parse)\b/,
  );
});
