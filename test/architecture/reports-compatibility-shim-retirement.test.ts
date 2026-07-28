import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const feature = "server/features/reports";
const domain = `${feature}/domain`;
const application = `${feature}/application`;
const infrastructure = `${feature}/infrastructure`;
const composition = `${feature}/composition`;

const retiredPaths = [
  "server/db-report-workflow.ts",
  "server/lib/report-workflow-communication.ts",
  "server/lib/report-status.ts",
  "server/lib/report-study-types.ts",
  "server/lib/reports.ts",
] as const;

const reportDbExports = [
  "countReportsByClinicId",
  "countSearchReports",
  "getClinicScopedReportById",
  "getReportsByClinicId",
  "getReportStatusHistory",
  "getReportById",
  "getReportStudyTypes",
  "getStudyTypes",
  "searchReports",
  "upsertReport",
  "updateReportStatus",
] as const;

type ImportReference = {
  specifier: string;
  typeOnly: boolean;
};

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function repoPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function walk(directory: string): string[] {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) {
    return [];
  }

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function imports(path: string): ImportReference[] {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const result: ImportReference[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push({
        specifier: node.moduleSpecifier.text,
        typeOnly:
          ts.isImportDeclaration(node) &&
          !!node.importClause?.isTypeOnly,
      });
    }

    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) {
        result.push({ specifier: argument.text, typeOnly: false });
      }
    }

    node.forEachChild(visit);
  }

  visit(source);
  return result;
}

function target(path: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  const normalized = repoPath(
    relative(root, resolve(root, dirname(path), specifier)),
  );

  if (normalized.endsWith(".ts")) {
    return normalized;
  }
  if (existsSync(resolve(root, `${normalized}.ts`))) {
    return `${normalized}.ts`;
  }
  return existsSync(resolve(root, `${normalized}/index.ts`))
    ? `${normalized}/index.ts`
    : normalized;
}

test("M41 retira físicamente los cinco shims sin reemplazos forwarding", () => {
  for (const path of retiredPaths) {
    assert.equal(existsSync(resolve(root, path)), false, path);
  }

  const reportFiles = walk(feature).filter((path) => path.endsWith(".ts"));
  for (const path of reportFiles) {
    assert.doesNotMatch(path, /(?:compat|legacy|shim)/i, path);
    if (!path.endsWith("/index.ts")) {
      assert.doesNotMatch(
        read(path).trim(),
        /^export \* from ["'][^"']+["'];?$/,
        path,
      );
    }
  }
});

test("M41 elimina todos los exports y ownership Reports de server/db.ts", () => {
  const source = read("server/db.ts");

  assert.equal(source.includes("features/reports"), false);
  assert.equal(source.includes("/* ========================= REPORTS"), false);
  assert.equal(source.includes("report-status"), false);
  assert.equal(source.includes("report-study-types"), false);
  assert.equal(source.includes("report-workflow"), false);

  for (const name of reportDbExports) {
    assert.doesNotMatch(source, new RegExp(`\\b${name}\\b`), name);
  }
});

test("M41 deja cero imports estáticos dinámicos o require a paths retirados", () => {
  const violations: string[] = [];

  for (const base of ["server", "test", "scripts"]) {
    for (const path of walk(base).filter((file) => file.endsWith(".ts"))) {
      for (const reference of imports(path)) {
        const resolved = target(path, reference.specifier);
        if (retiredPaths.includes(resolved as (typeof retiredPaths)[number])) {
          violations.push(`${path}: ${reference.specifier} -> ${resolved}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("consumidores runtime migrados resuelven Reports por composition", () => {
  const consumers = [
    "server/routes/admin-report-access-tokens.fastify.ts",
    "server/routes/admin-study-tracking.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/study-tracking.fastify.ts",
    "server/features/particular-access/particular-access-route-composition.ts",
  ] as const;

  for (const path of consumers) {
    const source = read(path);
    const targets = imports(path).map((reference) =>
      target(path, reference.specifier)
    );
    const expectedTarget = path.startsWith("server/features/")
      ? `${feature}/index.ts`
      : `${composition}/index.ts`;

    assert.ok(targets.includes(expectedTarget), path);
    assert.doesNotMatch(
      source,
      /\bdb\.(?:getReportById|getClinicScopedReportById)\b/,
      path,
    );
  }

  const commandBridge = read(`${composition}/report-command-composition.ts`);
  assert.ok(commandBridge.includes("export async function getReportById"));
  assert.ok(commandBridge.includes(".findReportById(reportId)"));
  assert.ok(
    commandBridge.includes("export function getClinicScopedReportById"),
  );
  assert.ok(commandBridge.includes("findClinicScopedReportByIdUseCase("));
});

test("barrels Reports exportan sólo módulos canónicos de sus capas", () => {
  const expected = new Map<string, readonly string[]>([
    [
      `${domain}/index.ts`,
      [
        'export * from "./report-status.ts";',
        'export * from "./report-study-types.ts";',
        'export * from "./reports.ts";',
      ],
    ],
    [
      `${application}/index.ts`,
      [
        'export * from "./ports/index.ts";',
        'export * from "./report-command-use-cases.ts";',
        'export * from "./report-query-use-cases.ts";',
        'export * from "./report-route-service.ts";',
        'export * from "./report-workflow-communication.ts";',
      ],
    ],
    [
      `${infrastructure}/index.ts`,
      [
        'export * from "./db-report-workflow.ts";',
        'export * from "./report-command-repository.ts";',
        'export * from "./report-query-repository.ts";',
        'export * from "./report-workflow-data-adapter.ts";',
        'export * from "./report-workflow-notification-adapter.ts";',
      ],
    ],
    [
      `${composition}/index.ts`,
      [
        'export * from "./report-command-composition.ts";',
        'export * from "./report-query-composition.ts";',
        'export * from "./report-route-composition.ts";',
        'export * from "./report-workflow-communication-composition.ts";',
      ],
    ],
  ]);

  for (const [path, lines] of expected) {
    assert.deepEqual(
      read(path).trim().split("\n"),
      lines,
      path,
    );
  }
});

test("application mantiene default deny e infrastructure conserva Drizzle", () => {
  const applicationViolations: string[] = [];
  for (const path of walk(application).filter((file) => file.endsWith(".ts"))) {
    for (const reference of imports(path)) {
      const resolved = target(path, reference.specifier);
      if (
        !resolved.startsWith(`${application}/`) &&
        resolved !== `${domain}/index.ts`
      ) {
        applicationViolations.push(`${path}: ${reference.specifier}`);
      }
    }
  }
  assert.deepEqual(applicationViolations, []);

  const infrastructureFiles = walk(infrastructure).filter((path) =>
    path.endsWith(".ts")
  );
  assert.ok(
    infrastructureFiles.some((path) =>
      imports(path).some((reference) => reference.specifier === "drizzle-orm")
    ),
  );

  const runtimeUpwardImports = infrastructureFiles.flatMap((path) =>
    imports(path)
      .filter((reference) => !reference.typeOnly)
      .map((reference) => target(path, reference.specifier))
      .filter((resolved) =>
        resolved.startsWith(`${application}/`) ||
        resolved.startsWith(`${composition}/`)
      )
      .map((resolved) => `${path}: ${resolved}`)
  );
  assert.deepEqual(runtimeUpwardImports, []);
});

test("composition sigue siendo el único bridge Reports entre application e infrastructure", () => {
  const bridges = walk(feature)
    .filter((path) => path.endsWith(".ts"))
    .filter((path) => {
      const targets = imports(path).map((reference) =>
        target(path, reference.specifier)
      );
      return (
        targets.some((resolved) => resolved.startsWith(`${application}/`)) &&
        targets.some((resolved) => resolved.startsWith(`${infrastructure}/`))
      );
    })
    .sort();

  assert.deepEqual(bridges, [
    `${composition}/report-command-composition.ts`,
    `${composition}/report-query-composition.ts`,
    `${composition}/report-route-composition.ts`,
    `${composition}/report-workflow-communication-composition.ts`,
  ]);
});

test("rutas Reports siguen thin y preservan el doble registro ordenado", () => {
  for (const path of [
    "server/routes/admin-reports.fastify.ts",
    "server/routes/admin-report-workflow.fastify.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/reports-status.fastify.ts",
  ]) {
    const source = read(path);
    const runtimeTargets = imports(path)
      .filter((reference) => !reference.typeOnly)
      .map((reference) => target(path, reference.specifier));

    assert.ok(runtimeTargets.includes(`${composition}/index.ts`), path);
    assert.equal(source.includes("drizzle-orm"), false, path);
    assert.equal(source.includes(".select("), false, path);
    assert.equal(source.includes(".insert("), false, path);
    assert.equal(source.includes(".update("), false, path);
  }

  const app = read("server/fastify-app.ts");
  const registrations = Array.from(
    app.matchAll(
      /app\.register\(\s*(reportsNativeRoutes|reportsStatusNativeRoutes),\s*\{\s*prefix:\s*"([^"]+)"/g,
    ),
    (match) => [match[1], match[2]],
  );
  assert.deepEqual(registrations, [
    ["reportsNativeRoutes", "/api/reports"],
    ["reportsStatusNativeRoutes", "/api/reports"],
  ]);
});

test("M36 a M40 permanecen materializados sin reducir inventarios", () => {
  const expectedCounts = new Map<string, number>([
    [domain, 4],
    [application, 10],
    [infrastructure, 6],
    [composition, 5],
  ]);

  for (const [directory, count] of expectedCounts) {
    assert.equal(
      walk(directory).filter((path) => path.endsWith(".ts")).length,
      count,
      directory,
    );
  }

  for (const path of [
    "docs/implementation/m36-reports-domain-moves-catalog-census.md",
    "docs/implementation/m37-reports-workflow-data-notification-ports.md",
    "docs/implementation/m38-reports-create-edit-transition-use-cases.md",
    "docs/implementation/m39-reports-admin-thin-routes-workflow.md",
    "docs/implementation/m40-reports-query-use-cases-thin-routes.md",
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
});
