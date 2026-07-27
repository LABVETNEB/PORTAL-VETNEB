import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const feature = "server/features/reports";
const domain = `${feature}/domain`;
const application = `${feature}/application`;
const ports = `${application}/ports`;
const infrastructure = `${feature}/infrastructure`;
const composition = `${feature}/composition`;

const expectedApplication = [
  `${application}/README.md`,
  `${application}/index.ts`,
  `${application}/report-command-use-cases.ts`,
  `${application}/report-query-use-cases.ts`,
  `${application}/report-route-service.ts`,
  `${application}/report-workflow-communication.ts`,
  `${ports}/index.ts`,
  `${ports}/report-command-repository.ts`,
  `${ports}/report-query-repository.ts`,
  `${ports}/report-workflow-data-port.ts`,
  `${ports}/report-workflow-notification-port.ts`,
].sort();
const expectedInfrastructure = [
  `${infrastructure}/README.md`,
  `${infrastructure}/index.ts`,
  `${infrastructure}/db-report-workflow.ts`,
  `${infrastructure}/report-command-repository.ts`,
  `${infrastructure}/report-query-repository.ts`,
  `${infrastructure}/report-workflow-data-adapter.ts`,
  `${infrastructure}/report-workflow-notification-adapter.ts`,
].sort();
const expectedComposition = [
  `${composition}/README.md`,
  `${composition}/index.ts`,
  `${composition}/report-command-composition.ts`,
  `${composition}/report-query-composition.ts`,
  `${composition}/report-route-composition.ts`,
  `${composition}/report-workflow-communication-composition.ts`,
].sort();

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function walk(directory: string): string[] {
  if (!existsSync(resolve(root, directory))) {
    return [];
  }
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? walk(path) : [path];
    },
  );
}

function imports(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const result: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) {
        result.push(argument.text);
      }
    }
    node.forEachChild(visit);
  }
  visit(source);
  return [...new Set(result)];
}

function target(path: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }
  const normalized = relative(
    root,
    resolve(root, dirname(path), specifier),
  ).replaceAll("\\", "/");
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

test("M40 fija inventario productivo exacto de Reports", () => {
  assert.deepEqual(walk(application).sort(), expectedApplication);
  assert.deepEqual(walk(infrastructure).sort(), expectedInfrastructure);
  assert.deepEqual(walk(composition).sort(), expectedComposition);
});

test("M38 crea puerto, casos de uso, repository y composition separados", () => {
  const port = read(`${ports}/report-command-repository.ts`);
  const useCases = read(`${application}/report-command-use-cases.ts`);
  const repository = read(`${infrastructure}/report-command-repository.ts`);
  const bridge = read(`${composition}/report-command-composition.ts`);

  for (const marker of [
    "findReportById",
    "createOrEditReport",
    "persistReportStatusTransition",
    "expectedFromStatus: ReportCommandStatus",
  ]) {
    assert.ok(port.includes(marker), marker);
  }
  for (const marker of [
    "createReportCommandUseCases",
    "canTransitionReportStatus",
    '"not_found"',
    '"same_status"',
    '"transition_not_allowed"',
    '"concurrent_not_found"',
    '"persisted"',
  ]) {
    assert.ok(useCases.includes(marker), marker);
  }
  assert.ok(repository.includes("PersistReportStatusTransitionCommand"));
  assert.equal(repository.includes("../application/"), false);
  assert.equal(repository.includes("../composition/"), false);
  assert.ok(bridge.includes("createReportCommandRepository"));
  assert.ok(bridge.includes("createReportCommandUseCases"));
});

test("application y ports aplican default deny con único acceso al domain canónico", () => {
  const violations: string[] = [];
  for (const path of walk(application).filter((file) => file.endsWith(".ts"))) {
    for (const specifier of imports(path)) {
      const resolved = target(path, specifier);
      const allowed =
        resolved.startsWith(`${application}/`) ||
        ([`${application}/report-command-use-cases.ts`, `${application}/report-query-use-cases.ts`].includes(path) &&
          resolved === `${domain}/index.ts`);
      if (!allowed) {
        violations.push(`${path}: ${specifier} -> ${resolved}`);
      }
    }
    const source = read(path).toLowerCase();
    for (const marker of [
      "drizzle",
      "schema.ts",
      "db.ts",
      "fastify",
      "routes/",
      "infrastructure/",
      "auth",
      "email",
      "cors",
      "rate-limit",
      "supabase",
      "console.",
      ".transaction(",
    ]) {
      if (source.includes(marker)) {
        violations.push(`${path}: forbidden ${marker}`);
      }
    }
    if (
      path !== `${application}/report-route-service.ts` &&
      source.includes("audit")
    ) {
      violations.push(`${path}: forbidden audit`);
    }
  }
  assert.deepEqual(violations, []);
});

test("composition contiene los únicos bridges application a infrastructure", () => {
  const bridges = walk(feature)
    .filter((path) => path.endsWith(".ts"))
    .filter((path) => {
      const targets = imports(path).map((specifier) => target(path, specifier));
      return (
        targets.some((value) => value.startsWith(`${application}/`)) &&
        targets.some((value) => value.startsWith(`${infrastructure}/`))
      );
    })
    .sort();

  assert.deepEqual(bridges, [
    `${composition}/report-command-composition.ts`,
    `${composition}/report-query-composition.ts`,
    `${composition}/report-route-composition.ts`,
    `${composition}/report-workflow-communication-composition.ts`,
  ]);
  assert.equal(read(`${composition}/report-command-composition.ts`).includes(".select("), false);
  assert.equal(read(`${composition}/report-command-composition.ts`).includes(".transaction("), false);
});

test("infrastructure es owner único de DB transacciones tablas y SQL M38", () => {
  const repositoryPath = `${infrastructure}/report-command-repository.ts`;
  const repository = read(repositoryPath);
  const outsideSources = [
    ...walk(application),
    ...walk(composition),
    "server/db.ts",
  ]
    .filter((path) => path.endsWith(".ts"))
    .map((path) => [path, read(path)] as const);

  assert.equal(repository.match(/database\.transaction\(/g)?.length, 2);
  assert.equal(repository.match(/INSERT INTO "report_status_history"/g)?.length, 1);
  for (const marker of [
    'from "../../../db.ts"',
    "reports,",
    "reportStatusHistory",
    ".where(eq(reports.storagePath, input.storagePath))",
    ".where(eq(reports.id, input.reportId))",
    "report.currentStatus !== input.expectedFromStatus",
    "eq(reports.currentStatus, input.expectedFromStatus)",
    "const updatedReport = updated[0]",
    "if (!updatedReport)",
    "fromStatus: input.expectedFromStatus",
    ".limit(1)",
    ".returning()",
    'error.code !== "42703"',
  ]) {
    assert.ok(repository.includes(marker), marker);
  }

  for (const [path, source] of outsideSources) {
    for (const marker of [
      ".transaction(",
      'INSERT INTO "report_status_history"',
    ]) {
      assert.equal(source.includes(marker), false, `${path}: ${marker}`);
    }
  }
  assert.equal(repository.includes("../application/"), false);
  assert.equal(repository.includes("../composition/"), false);
});

test("M38 queda canónico, db.ts se desacopla y rutas usan composition", () => {
  const database = read("server/db.ts");
  const admin = read("server/routes/admin-reports.fastify.ts");
  const status = read("server/routes/reports-status.fastify.ts");
  const reportsRoute = read("server/routes/reports.fastify.ts");
  const workflow = read("server/routes/admin-report-workflow.fastify.ts");
  const app = read("server/fastify-app.ts");

  assert.equal(database.includes("features/reports"), false);
  for (const name of [
    "getReportById",
    "upsertReport",
    "updateReportStatus",
  ]) {
    assert.doesNotMatch(database, new RegExp(`\\b${name}\\b`), name);
  }
  const bridge = read(`${composition}/report-command-composition.ts`);
  for (const marker of [
    "export async function getReportById",
    ".findReportById(reportId)",
    "export function transitionReportStatus",
  ]) {
    assert.ok(bridge.includes(marker), marker);
  }
  assert.equal(bridge.includes("export async function updateReportStatus"), false);
  for (const [source, markers] of [
    [admin, ["export type AdminReportsNativeRoutesOptions", "createAdminReportsRouteComposition"]],
    [status, ["export type ReportsStatusNativeRoutesOptions", "createClinicReportStatusRouteComposition"]],
    [reportsRoute, ["export type ReportsNativeRoutesOptions", "createClinicReportsRouteComposition"]],
    [workflow, ["export type AdminReportWorkflowNativeRoutesOptions", "createAdminReportWorkflowRouteComposition"]],
    [app, ['prefix: "/api/reports"', "reportsNativeRoutes", "reportsStatusNativeRoutes"]],
  ] as const) {
    for (const marker of markers) {
      assert.ok(source.includes(marker), marker);
    }
    assert.equal(source.includes("report-command-composition"), false);
  }
});

test("M36 a M40 permanecen materializados", () => {
  assert.deepEqual(
    walk(domain).sort(),
    [
      `${domain}/README.md`,
      `${domain}/index.ts`,
      `${domain}/report-status.ts`,
      `${domain}/report-study-types.ts`,
      `${domain}/reports.ts`,
    ].sort(),
  );
  assert.ok(
    read(`${application}/report-workflow-communication.ts`).includes(
      "createReportWorkflowCommunication",
    ),
  );
  assert.ok(
    read(`${infrastructure}/report-workflow-data-adapter.ts`).includes(
      "createReportWorkflowDataAdapter",
    ),
  );

  for (const path of [
    `${application}/report-route-service.ts`,
    `${composition}/report-route-composition.ts`,
    `${infrastructure}/db-report-workflow.ts`,
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
  assert.equal(
    existsSync(resolve(root, `${application}/report-query-use-cases.ts`)),
    true,
  );
});

test("M38 excluye HTTP auth audit storage email y catch general", () => {
  const files = [
    `${application}/report-command-use-cases.ts`,
    `${ports}/report-command-repository.ts`,
    `${infrastructure}/report-command-repository.ts`,
    `${composition}/report-command-composition.ts`,
  ];
  for (const path of files) {
    const source = read(path).toLowerCase();
    for (const marker of [
      "fastify",
      "routes/",
      "writeaudit",
      "sendemail",
      "supabase",
      "uploadreport",
      "createsignedreport",
      "cors",
      "rate-limit",
      "console.",
    ]) {
      assert.equal(source.includes(marker), false, `${path}: ${marker}`);
    }
  }

  const repository = read(`${infrastructure}/report-command-repository.ts`);
  assert.equal(repository.match(/\bcatch\s*\(/g)?.length, 1);
  assert.ok(repository.includes('error.code !== "42703"'));
});
