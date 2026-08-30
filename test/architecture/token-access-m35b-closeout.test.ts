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
const reportsM41Closeout =
  "docs/implementation/m41-reports-compatibility-shim-retirement.md";
const usersRolesM42Closeout =
  "docs/implementation/m42-users-roles-domain-use-cases.md";
const usersRolesM43Closeout =
  "docs/implementation/m43-users-roles-repository-thin-route-closeout.md";

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

const legacyParticularPath = "server/db-particular.ts";
const particularInfrastructureIndex =
  "server/features/particular-access/infrastructure/index.ts";
const reportsComposition =
  "server/features/reports/composition/report-route-composition.ts";
const expectedExternalParticularConsumers = [
  "server/preflight.ts",
  "server/routes/admin-study-tracking.fastify.ts",
  "server/routes/auth.fastify.ts",
  "server/routes/particular-audit.fastify.ts",
  "server/routes/particular-auth.fastify.ts",
  "server/routes/particular-study-tracking.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
].sort();

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
  if (!specifier.startsWith(".")) {
    return specifier;
  }
  const target = relative(
    root,
    resolve(root, dirname(path), specifier),
  ).replaceAll("\\", "/");
  if (target.endsWith(".ts")) {
    return target;
  }

  let emittedTypeScriptTarget: string | null = null;
  if (target.endsWith(".mjs")) {
    emittedTypeScriptTarget = `${target.slice(0, -4)}.ts`;
  } else if (target.endsWith(".js")) {
    emittedTypeScriptTarget = `${target.slice(0, -3)}.ts`;
  }

  if (
    emittedTypeScriptTarget !== null &&
    existsSync(resolve(root, emittedTypeScriptTarget))
  ) {
    return emittedTypeScriptTarget;
  }

  if (existsSync(resolve(root, `${target}.ts`))) {
    return `${target}.ts`;
  }
  return existsSync(resolve(root, `${target}/index.ts`))
    ? `${target}/index.ts`
    : target;
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
  assert.equal(
    resolveImportTarget("server/preflight.ts", "./db.ts"),
    "server/db.ts",
  );
  assert.equal(
    resolveImportTarget("server/preflight.ts", "./db"),
    "server/db.ts",
  );
  assert.equal(
    resolveImportTarget("server/preflight.ts", "./db.js"),
    "server/db.ts",
  );
  assert.equal(
    resolveImportTarget("server/preflight.ts", "./db.mjs"),
    "server/db.ts",
  );
  assert.equal(
    resolveImportTarget(
      "server/preflight.ts",
      "./db-report-access.js",
    ),
    "server/db-report-access.js",
  );
  assert.equal(
    resolveImportTarget(
      "server/routes/admin-particular-tokens.fastify.ts",
      "../features/particular-access/infrastructure",
    ),
    particularInfrastructureIndex,
  );
  assert.equal(
    resolveImportTarget("server/preflight.ts", "./db-report-access"),
    "server/db-report-access",
  );
  assert.equal(
    resolveImportTarget("server/preflight.ts", "typescript"),
    "typescript",
  );

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

test("M44 retira el shim Particular y fija siete consumidores canónicos", () => {
  assert.equal(existsSync(resolve(root, legacyParticularPath)), false);

  const legacyViolations = ["server", "test"].flatMap((scanRoot) =>
    walk(scanRoot)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) =>
        executableImportTargets(file).includes(legacyParticularPath),
      ),
  );
  assert.deepEqual(legacyViolations, []);

  const actualExternalConsumers = walk("server")
    .filter((file) => file.endsWith(".ts"))
    .filter(
      (file) =>
        !file.startsWith("server/features/particular-access/") &&
        file !== reportsComposition,
    )
    .filter((file) =>
      executableImportTargets(file).includes(particularInfrastructureIndex),
    )
    .sort();
  assert.deepEqual(
    actualExternalConsumers,
    expectedExternalParticularConsumers,
  );

  for (const route of ownRoutes) {
    assert.equal(
      executableImportTargets(route).some((target) =>
        target.includes("/infrastructure/"),
      ),
      false,
      route,
    );
  }
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

test("M35b preserva la secuencia materializada hasta el cierre M43", () => {
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
  assert.equal(existsSync(resolve(root, reportsM41Closeout)), true);
  assert.equal(existsSync(resolve(root, usersRolesM42Closeout)), true);
  assert.equal(existsSync(resolve(root, usersRolesM43Closeout)), true);

  const usersRolesM42Source = read(usersRolesM42Closeout);
  for (const marker of [
    "M42 — Users/Roles domain + application use cases",
    "M43 queda responsable",
  ]) {
    assert.equal(usersRolesM42Source.includes(marker), true, marker);
  }
  const usersRolesM43Source = read(usersRolesM43Closeout);
  for (const marker of [
    "M43 — Users/Roles repository + thin-route closeout",
    "Fase J",
    "M43: cerrado",
  ]) {
    assert.equal(usersRolesM43Source.includes(marker), true, marker);
  }
  assert.doesNotMatch(usersRolesM43Source, /M43:\s*`?NOT_RUN`?/);

  for (const path of [
    "server/features/reports/application",
    "server/features/reports/infrastructure",
    "server/features/reports/composition",
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }

  const m43Closeouts = walk("docs/implementation").filter((path) =>
    /\/m43-/i.test(path),
  );
  assert.deepEqual(m43Closeouts, [usersRolesM43Closeout]);
});
