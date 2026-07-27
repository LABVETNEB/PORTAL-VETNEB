import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const evidence =
  "test/security/token-access-enumeration-disclosure-regression.test.ts";
const closeout =
  "docs/implementation/m35b-token-access-enumeration-disclosure-closeout.md";
const reportsM36Closeout =
  "docs/implementation/m36-reports-domain-moves-catalog-census.md";
const reportsM37Closeout =
  "docs/implementation/m37-reports-workflow-data-notification-ports.md";
const reportsM38Closeout =
  "docs/implementation/m38-reports-create-edit-transition-use-cases.md";
const reportsM39Closeout =
  "docs/implementation/m39-reports-admin-thin-routes-workflow.md";
const reportsM40Closeout =
  "docs/implementation/m40-reports-query-use-cases-thin-routes.md";

const featureLayers = [
  {
    feature: "server/features/particular-access",
    required: [
      "README.md",
      "domain",
      "application",
      "infrastructure",
      "particular-access-route-composition.ts",
    ],
  },
  {
    feature: "server/features/report-access",
    required: [
      "README.md",
      "domain",
      "application",
      "infrastructure",
      "composition",
    ],
  },
] as const;

const ownRoutes = [
  "server/routes/admin-particular-tokens.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/public-report-access.fastify.ts",
] as const;

const globalGuardAnchors = [
  {
    path: "test/architecture/security/security-access-lifecycle-boundaries.test.ts",
    anchors: [
      "server/features/report-access/application/public-report-access-operations.ts",
      "server/routes/public-report-access.fastify.ts",
    ],
  },
  {
    path: "test/architecture/security/security-rate-limit-isolation-boundaries.test.ts",
    anchors: [
      "server/routes/public-report-access.fastify.ts",
      "server/lib/public-report-access-rate-limit.ts",
    ],
  },
  {
    path: "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    anchors: [
      "server/features/particular-access/application/clinic-particular-access-operations.ts",
      "server/features/report-access/application/clinic-report-access-operations.ts",
    ],
  },
  {
    path: "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    anchors: [
      "server/routes/public-report-access.fastify.ts",
      "server/routes/report-access-tokens.fastify.ts",
    ],
  },
  {
    path: "test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts",
    anchors: [
      "server/routes/public-report-access.fastify.ts",
      "server/features/report-access/application/public-report-access-operations.ts",
    ],
  },
  {
    path: "test/architecture/security/security-write-attribution-boundaries.test.ts",
    anchors: [
      "server/features/particular-access/application/clinic-particular-access-operations.ts",
      "server/features/report-access/application/public-report-access-operations.ts",
    ],
  },
  {
    path: "test/architecture/security/security-cross-tenant-idor-contract.test.ts",
    anchors: [evidence, "CTIDOR-018"],
  },
  {
    path: "test/architecture/security/security-boundary-suite-completeness.test.ts",
    anchors: [
      evidence,
      "test/architecture/token-access-m35b-closeout.test.ts",
    ],
  },
] as const;

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
}

function walk(path: string): string[] {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function resolveImportTarget(path: string, specifier: string): string {
  return specifier.startsWith(".")
    ? relative(root, resolve(root, dirname(path), specifier)).replaceAll("\\", "/")
    : specifier;
}

function executableImportTargets(path: string): string[] {
  const targets: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const namedBindings = clause?.namedBindings;
      const onlyTypeSpecifiers =
        namedBindings &&
        ts.isNamedImports(namedBindings) &&
        namedBindings.elements.length > 0 &&
        namedBindings.elements.every((element) => element.isTypeOnly);
      if (
        !clause?.isTypeOnly &&
        (clause?.name || !onlyTypeSpecifiers)
      ) {
        targets.push(
          resolveImportTarget(path, node.moduleSpecifier.text),
        );
      }
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      targets.push(resolveImportTarget(path, node.moduleSpecifier.text));
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      targets.push(resolveImportTarget(path, node.arguments[0].text));
    }
    node.forEachChild(visit);
  }
  parse(path).forEachChild(visit);
  return targets;
}

function testNames(path: string): string[] {
  const names: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "test" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      names.push(node.arguments[0].text);
    }
    node.forEachChild(visit);
  }
  parse(path).forEachChild(visit);
  return names;
}

function scenarioNames(path: string, variableName: string): string[] {
  const names: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      function collectNameProperties(child: ts.Node): void {
        if (
          ts.isPropertyAssignment(child) &&
          ts.isIdentifier(child.name) &&
          child.name.text === "name" &&
          ts.isStringLiteral(child.initializer)
        ) {
          names.push(child.initializer.text);
        }
        child.forEachChild(collectNameProperties);
      }
      node.initializer.forEachChild(collectNameProperties);
    }
    node.forEachChild(visit);
  }
  parse(path).forEachChild(visit);
  return names;
}

function stringArrayInitializer(path: string, variableName: string): string[] {
  let values: string[] | undefined;
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      const initializer =
        ts.isCallExpression(node.initializer) &&
        ts.isPropertyAccessExpression(node.initializer.expression) &&
        node.initializer.expression.name.text === "sort"
          ? node.initializer.expression.expression
          : node.initializer;
      if (ts.isArrayLiteralExpression(initializer)) {
        values = initializer.elements
          .filter(ts.isStringLiteral)
          .map((element) => element.text);
      }
    }
    node.forEachChild(visit);
  }
  parse(path).forEachChild(visit);
  assert.ok(values, `${variableName} must remain an explicit string array`);
  return values;
}

test("M35b conserva features, closeouts y evidencia canónicos", () => {
  for (const { feature, required } of featureLayers) {
    for (const layer of required) {
      assert.equal(existsSync(resolve(root, feature, layer)), true, `${feature}/${layer}`);
    }
  }

  for (const path of [
    "test/architecture/particular-access-m33-closeout.test.ts",
    "test/architecture/report-access-m34-closeout.test.ts",
    "docs/implementation/m33-particular-access-domain-repository-thin-closeout.md",
    "docs/implementation/m34-report-access-domain-repository-thin-closeout.md",
    evidence,
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
});

test("M35b ancla la matriz ejecutable conjunta por tests y escenarios concretos", () => {
  const names = testNames(evidence);
  for (const expected of [
    "Particular Access unifica missing y foreign, ignora selectores hostiles y redacta secretos",
    "Particular Access unifica report foreign y missing y redacta fallos repository",
    "Report Access publico ejecuta la matriz M35b sin enumeracion ni disclosure",
    "Report Access publico aplica rate limit antes de parse, hash y repository",
  ]) {
    assert.equal(names.includes(expected), true, expected);
  }

  assert.deepEqual(scenarioNames(evidence, "scenarios"), [
    "malformed",
    "missing",
    "revoked",
    "expired",
    "cross-clinic",
    "unavailable",
    "success",
    "repository-failure",
    "storage-failure",
  ]);

  const source = read(evidence);
  assert.equal(
    source.includes('"/api/public/report-access/[REDACTED]"'),
    true,
    "Report repository/storage failures must assert a redacted response.path",
  );
});

test("M35b prohíbe repositories legacy e imports ejecutables directos desde rutas", () => {
  assert.equal(existsSync(resolve(root, "server/db-report-access.ts")), false);

  for (const path of walk("server").filter((file) => file.endsWith(".ts"))) {
    assert.equal(
      executableImportTargets(path).includes("server/db-report-access.ts"),
      false,
      path,
    );
  }

  for (const route of ownRoutes) {
    for (const target of executableImportTargets(route)) {
      assert.equal(target.includes("drizzle"), false, `${route}: ${target}`);
      assert.equal(
        target.includes("/infrastructure/") ||
          target.endsWith("/db-particular.ts") ||
          target.endsWith("/db-report-access.ts"),
        false,
        `${route}: ${target}`,
      );
    }
  }
});

test("M35b reutiliza la allowlist M33 de shims Particular sin ampliarla", () => {
  const m33Guard = "test/architecture/particular-access-m33-closeout.test.ts";
  const expected = stringArrayInitializer(m33Guard, "particularShimConsumers")
    .slice()
    .sort();
  assert.equal(expected.length, 8);

  const actual = walk("server")
    .filter((file) => file.endsWith(".ts") && file !== "server/db-particular.ts")
    .filter((file) =>
      executableImportTargets(file).includes("server/db-particular.ts"),
    )
    .sort();
  assert.deepEqual(actual, expected);

  const source = read(m33Guard);
  assert.equal(
    source.includes(
      'test("shims conservan una línea y allowlists residuales exactas"',
    ),
    true,
  );
});

test("M35b mantiene conectados los guards globales de token access", () => {
  for (const guard of globalGuardAnchors) {
    assert.equal(existsSync(resolve(root, guard.path)), true, guard.path);
    const source = read(guard.path);
    for (const anchor of guard.anchors) {
      assert.equal(source.includes(anchor), true, `${guard.path}: ${anchor}`);
    }
  }
});

test("M35b documenta cierre de Fase H y preserva fases siguientes", () => {
  for (const path of [
    "docs/implementation/public-report-access-error-path-redaction-hotfix.md",
    closeout,
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }

  const source = read(closeout);
  for (const marker of [
    "M33: cerrado",
    "M34: cerrado",
    "PR #1573",
    "Fase H: cerrada",
    "M36: no iniciado",
    "Reports Phase I: no iniciada",
  ]) {
    assert.equal(source.includes(marker), true, marker);
  }

  assert.equal(existsSync(resolve(root, reportsM36Closeout)), true);
  assert.equal(existsSync(resolve(root, reportsM37Closeout)), true);
  assert.equal(existsSync(resolve(root, reportsM38Closeout)), true);
  assert.equal(existsSync(resolve(root, reportsM39Closeout)), true);
  assert.equal(existsSync(resolve(root, reportsM40Closeout)), true);

  for (const path of [
    "server/features/reports/application",
    "server/features/reports/infrastructure",
    "server/features/reports/composition",
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }

  const futureCloseouts = walk("docs/implementation").filter((path) =>
    /\/(?:m41-|reports-phase-i)/i.test(path),
  );
  assert.deepEqual(futureCloseouts, []);
});
