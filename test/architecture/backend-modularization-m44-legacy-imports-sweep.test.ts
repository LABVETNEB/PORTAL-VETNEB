import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const legacyPaths = [
  "server/db-particular.ts",
  "server/db-study-tracking.ts",
] as const;
const particularInfrastructureIndex =
  "server/features/particular-access/infrastructure/index.ts";
const studyTrackingInfrastructureIndex =
  "server/features/study-tracking/infrastructure/index.ts";
const particularComposition =
  "server/features/particular-access/particular-access-route-composition.ts";
const reportAccessTokenModule =
  "server/features/report-access/report-access-token.ts";
const m44Closeout =
  "docs/implementation/m44-legacy-imports-sweep-closeout.md";
const m45Closeout =
  "docs/implementation/m45-backend-feature-dependency-guard-closeout.md";
const programAudit =
  "docs/audit/backend-enterprise-modularization-program-audit.md";
const guardFile =
  "test/architecture/backend-modularization-m44-legacy-imports-sweep.test.ts";

const expectedMigratedConsumers = [
  "server/preflight.ts",
  "server/routes/admin-study-tracking.fastify.ts",
  "server/routes/auth.fastify.ts",
  "server/routes/particular-audit.fastify.ts",
  "server/routes/particular-auth.fastify.ts",
  "server/routes/particular-study-tracking.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
].sort();

function readSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function walkTsFiles(relativeDir: string): string[] {
  const absoluteDir = resolve(repoRoot, relativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      return walkTsFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

function parse(relativePath: string): ts.SourceFile {
  return ts.createSourceFile(
    relativePath,
    readSource(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function resolveSpecifier(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  const target = normalizePath(
    relative(repoRoot, resolve(repoRoot, dirname(file), specifier)),
  );
  if (target.endsWith(".ts")) {
    return target;
  }
  if (existsSync(resolve(repoRoot, `${target}.ts`))) {
    return `${target}.ts`;
  }
  return existsSync(resolve(repoRoot, `${target}/index.ts`))
    ? `${target}/index.ts`
    : target;
}

function executableImportTargets(relativePath: string): string[] {
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
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      targets.push(
        resolveSpecifier(
          relativePath,
          node.moduleReference.expression.text,
        ),
      );
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

  visit(parse(relativePath));
  return targets;
}

function reexportTargets(relativePath: string): string[] {
  return parse(relativePath).statements
    .filter(
      (statement): statement is ts.ExportDeclaration =>
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier),
    )
    .map((statement) =>
      resolveSpecifier(
        relativePath,
        (statement.moduleSpecifier as ts.StringLiteral).text,
      ),
    );
}

function isPureFeatureReexportShim(relativePath: string): boolean {
  const statements = parse(relativePath).statements;
  return (
    statements.length > 0 &&
    statements.every(
      (statement) =>
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        resolveSpecifier(relativePath, statement.moduleSpecifier.text).startsWith(
          "server/features/",
        ),
    )
  );
}

test("M44 retira ambos paths legacy y sus imports ejecutables", () => {
  for (const legacyPath of legacyPaths) {
    assert.equal(existsSync(resolve(repoRoot, legacyPath)), false, legacyPath);
  }

  const violations = ["server", "test"].flatMap((root) =>
    walkTsFiles(root).flatMap((file) =>
      executableImportTargets(file)
        .filter((target) =>
          legacyPaths.includes(target as (typeof legacyPaths)[number]),
        )
        .map((target) => `${file} -> ${target}`),
    ),
  );
  assert.deepEqual(violations, []);
});

test("M44 no deja shims puros raíz hacia features", () => {
  const rootDbFiles = readdirSync(resolve(repoRoot, "server"), {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isFile() &&
        /^db-.+\.ts$/.test(entry.name),
    )
    .map((entry) => `server/${entry.name}`);
  const candidates = [
    ...rootDbFiles,
    ...walkTsFiles("server/lib"),
  ];

  assert.deepEqual(
    candidates.filter(isPureFeatureReexportShim),
    [],
  );
});

test("report-access-token permanece módulo real y no shim", () => {
  assert.equal(existsSync(resolve(repoRoot, reportAccessTokenModule)), true);
  assert.equal(isPureFeatureReexportShim(reportAccessTokenModule), false);

  const source = readSource(reportAccessTokenModule);
  for (const marker of [
    "reportAccessTokenRawTokenSchema",
    "parsePositiveInt",
    "serializeReportAccessToken",
    "serializePublicReportAccess",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("los siete consumidores migrados apuntan al barrel Particular Access", () => {
  const canonicalConsumers = walkTsFiles("server")
    .filter((file) =>
      executableImportTargets(file).includes(particularInfrastructureIndex),
    )
    .sort();
  const canonicalInternalConsumers = [
    particularComposition,
    "server/features/particular-access/particular-access-public-composition.ts",
  ].sort();

  assert.deepEqual(
    canonicalConsumers.filter(
      (file) => !canonicalInternalConsumers.includes(file),
    ),
    expectedMigratedConsumers,
  );
  assert.deepEqual(
    canonicalConsumers.filter((file) =>
      canonicalInternalConsumers.includes(file),
    ),
    canonicalInternalConsumers,
  );

  for (const consumer of expectedMigratedConsumers) {
    assert.equal(
      executableImportTargets(consumer).filter(
        (target) => target === particularInfrastructureIndex,
      ).length,
      1,
      consumer,
    );
  }
});

test("los barrels canónicos existen y no hay aliases forwarding alternativos", () => {
  for (const barrel of [
    particularInfrastructureIndex,
    studyTrackingInfrastructureIndex,
  ]) {
    assert.equal(existsSync(resolve(repoRoot, barrel)), true, barrel);
  }

  const alternateAliases = walkTsFiles("server").flatMap((file) =>
    reexportTargets(file)
      .filter(
        (target) =>
          target === particularInfrastructureIndex ||
          target === studyTrackingInfrastructureIndex,
      )
      .map((target) => `${file} -> ${target}`),
  );
  assert.deepEqual(alternateAliases, []);
});

test("M44 conserva su closeout y reconoce el cierre M45", () => {
  assert.equal(existsSync(resolve(repoRoot, m44Closeout)), true);
  assert.equal(existsSync(resolve(repoRoot, m45Closeout)), true);

  const m44CloseoutSource = readSource(m44Closeout);
  const m45CloseoutSource = readSource(m45Closeout);
  const audit = readSource(programAudit);
  assert.ok(m44CloseoutSource.includes("M44 CLOSED localmente"));
  assert.ok(m45CloseoutSource.includes("M45 CLOSED localmente"));
  assert.ok(audit.includes("M44 — completado"));
  assert.ok(audit.includes("M45 — completado"));
});

test("el guard M44 no consulta estado Git ni worktrees", () => {
  const source = readSource(guardFile);
  assert.equal(
    executableImportTargets(guardFile).includes("node:child_process"),
    false,
  );
  assert.doesNotMatch(source, /\bgit\s+(?:branch|show-ref|worktree)\b/);
});
