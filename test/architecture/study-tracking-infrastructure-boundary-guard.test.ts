import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const featureDir = "server/features/study-tracking";
const infrastructureDir = `${featureDir}/infrastructure`;
const repositoryFile = `${infrastructureDir}/study-tracking-repository.ts`;
const infrastructureIndexFile = `${infrastructureDir}/index.ts`;
const publicIndexFile = `${featureDir}/index.ts`;
const legacyShimFile = "server/db-study-tracking.ts";
const routeCompositionFile =
  "server/features/study-tracking/study-tracking-route-composition.ts";

const thinRouteConsumers = [
  "server/routes/study-tracking.fastify.ts",
  "server/routes/admin-study-tracking.fastify.ts",
  "server/routes/particular-study-tracking.fastify.ts",
] as const;

const reportsCompositionFile =
  "server/features/reports/composition/report-route-composition.ts";

const publicFunctions = [
  "createStudyTrackingCase",
  "getStudyTrackingCaseById",
  "getClinicScopedStudyTrackingCase",
  "getParticularStudyTrackingCase",
  "getStudyTrackingCaseByReportId",
  "listStudyTrackingCases",
  "updateStudyTrackingCase",
  "createStudyTrackingNotification",
  "listStudyTrackingNotifications",
  "markStudyTrackingNotificationRead",
  "markAllStudyTrackingNotificationsRead",
  "markStudyTrackingNotificationReadScoped",
  "markAllStudyTrackingNotificationsReadScoped",
] as const;

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function walkTsFiles(relativeDir: string): string[] {
  const absoluteDir = join(repoRoot, relativeDir);

  if (!existsSync(absoluteDir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...walkTsFiles(relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(relativePath);
    }
  }

  return files;
}

function listImportSpecifiers(source: string): string[] {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g,
    ),
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function resolveSpecifier(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  const resolved = normalizePath(
    relative(repoRoot, join(repoRoot, dirname(file), specifier)),
  );

  if (resolved.endsWith(".ts")) {
    return resolved;
  }

  const tsFile = `${resolved}.ts`;

  if (existsSync(join(repoRoot, tsFile))) {
    return tsFile;
  }

  const indexFile = `${resolved}/index.ts`;
  return existsSync(join(repoRoot, indexFile)) ? indexFile : resolved;
}

function executableImportTargets(relativePath: string): string[] {
  const sourceFile = ts.createSourceFile(
    relativePath,
    readText(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const targets: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnlyBindings =
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((element) => element.isTypeOnly);
      if (!clause?.isTypeOnly && (clause?.name || !typeOnlyBindings)) {
        targets.push(resolveSpecifier(relativePath, node.moduleSpecifier.text));
      }
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      targets.push(resolveSpecifier(relativePath, node.moduleSpecifier.text));
    } else if (
      ts.isCallExpression(node) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")
      )
    ) {
      targets.push(resolveSpecifier(relativePath, node.arguments[0].text));
    }

    node.forEachChild(visit);
  }

  visit(sourceFile);
  return targets;
}

test("M44 conserva repository y barrel canónicos y retira el shim", () => {
  assert.deepEqual(walkTsFiles(infrastructureDir).sort(), [
    infrastructureIndexFile,
    repositoryFile,
  ].sort());
  assert.equal(
    readText(infrastructureIndexFile).trim(),
    'export * from "./study-tracking-repository.ts";',
  );
  assert.equal(existsSync(join(repoRoot, legacyShimFile)), false);

  const violations = ["server", "test"].flatMap((root) =>
    walkTsFiles(root)
      .filter((file) =>
        executableImportTargets(file).includes(legacyShimFile),
      )
      .map((file) => `${file} -> ${legacyShimFile}`),
  );
  assert.deepEqual(violations, []);
});

test("el repository conserva la superficie pública completa", () => {
  const source = readText(repositoryFile);
  const actual = Array.from(
    source.matchAll(/\bexport\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/g),
    (match) => match[1],
  );

  assert.deepEqual(actual, publicFunctions);
});

test("el repository sólo importa persistencia y paginación autorizadas", () => {
  const allowed = new Set([
    "drizzle-orm",
    "server/db.ts",
    "drizzle/schema.ts",
    "server/lib/list-pagination.ts",
  ]);
  const violations = listImportSpecifiers(readText(repositoryFile))
    .map((specifier) => `${specifier} -> ${resolveSpecifier(repositoryFile, specifier)}`)
    .filter((entry) => !allowed.has(entry.split(" -> ")[1]));

  assert.deepEqual(violations, []);
});

test("infrastructure no contiene transporte, auth, email ni auditoría", () => {
  const source = readText(repositoryFile);

  for (const forbidden of [
    "FastifyRequest",
    "FastifyReply",
    "authenticate",
    "enforceTrustedOrigin",
    "sendSpecialStainRequiredEmail",
    "writeAuditLog",
    "AUDIT_EVENTS",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("queries, filtros, paginación y timestamps permanecen anclados", () => {
  const source = readText(repositoryFile);

  for (const marker of [
    "normalizeListPagination(params)",
    ".orderBy(desc(studyTrackingCases.createdAt))",
    ".orderBy(desc(studyTrackingNotifications.createdAt))",
    "eq(studyTrackingCases.clinicId, clinicId)",
    "eq(studyTrackingNotifications.particularTokenId, params.particularTokenId)",
    "updatedAt: new Date()",
    "readAt: now",
    "updatedCount: updated.length",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("las rutas M32/M32b atraviesan una composición feature-level sin tocar persistence", () => {
  for (const file of thinRouteConsumers) {
    const targets = listImportSpecifiers(readText(file)).map((specifier) =>
      resolveSpecifier(file, specifier)
    );

    assert.ok(targets.includes(routeCompositionFile), file);
    assert.equal(targets.includes(legacyShimFile), false, file);
    assert.equal(targets.includes(repositoryFile), false, file);
    assert.equal(targets.includes(infrastructureIndexFile), false, file);
  }

  const compositionTargets = listImportSpecifiers(
    readText(routeCompositionFile),
  ).map((specifier) => resolveSpecifier(routeCompositionFile, specifier));

  assert.deepEqual([...new Set(compositionTargets)], [
    infrastructureIndexFile,
  ]);
  assert.equal(readText(routeCompositionFile).includes("drizzle-orm"), false);
  assert.equal(
    /\b(?:select|insert|update|delete)\s*\(/.test(
      readText(routeCompositionFile),
    ),
    false,
  );
});

test("Reports composition M39 consume infrastructure canónica sin shim", () => {
  const targets = listImportSpecifiers(
    readText(reportsCompositionFile),
  ).map((specifier) => resolveSpecifier(reportsCompositionFile, specifier));

  assert.equal(targets.includes(legacyShimFile), false);
  assert.equal(targets.includes(repositoryFile), false);
  assert.ok(targets.includes(publicIndexFile));
});

test("los contratos source-only leen el repository canónico", () => {
  for (const file of [
    "test/unit/contracts/admin/admin-heavy-list-pagination-contract.test.ts",
    "test/unit/infrastructure/global-performance-resilience-contract.test.ts",
  ]) {
    const source = readText(file);

    assert.ok(source.includes(repositoryFile), file);
    assert.equal(source.includes(`file: "${legacyShimFile}"`), false, file);
    assert.equal(source.includes(`"${legacyShimFile}",`), false, file);
  }
});

test("application no depende de infrastructure concreta", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(`${featureDir}/application`)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const target = resolveSpecifier(file, specifier);

      if (target.startsWith(`${infrastructureDir}/`)) {
        violations.push(`${file}: ${specifier} -> ${target}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
