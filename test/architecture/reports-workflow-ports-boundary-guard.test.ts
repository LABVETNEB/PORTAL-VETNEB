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
const workflow = "server/db-report-workflow.ts";
const shim = "server/lib/report-workflow-communication.ts";
const route = "server/routes/admin-report-workflow.fastify.ts";

const expectedApplication = [
  `${application}/README.md`,
  `${application}/index.ts`,
  `${application}/report-workflow-communication.ts`,
  `${ports}/index.ts`,
  `${ports}/report-workflow-data-port.ts`,
  `${ports}/report-workflow-notification-port.ts`,
] as const;
const expectedInfrastructure = [
  `${infrastructure}/README.md`,
  `${infrastructure}/index.ts`,
  `${infrastructure}/report-workflow-data-adapter.ts`,
  `${infrastructure}/report-workflow-notification-adapter.ts`,
] as const;
const expectedComposition = [
  `${composition}/README.md`,
  `${composition}/index.ts`,
  `${composition}/report-workflow-communication-composition.ts`,
] as const;

type ImportReference = {
  specifier: string;
  typeOnly: boolean;
};

function repoPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
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

  source.forEachChild((node) => {
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
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.expression.arguments[0];
      if (argument && ts.isStringLiteral(argument)) {
        result.push({ specifier: argument.text, typeOnly: false });
      }
    }
  });

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) {
        result.push({ specifier: argument.text, typeOnly: false });
      }
    }
    node.forEachChild(visit);
  }
  visit(source);

  return result.filter(
    (reference, index) =>
      result.findIndex(
        (candidate) =>
          candidate.specifier === reference.specifier &&
          candidate.typeOnly === reference.typeOnly,
      ) === index,
  );
}

function target(path: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }
  const resolved = repoPath(relative(root, resolve(root, dirname(path), specifier)));
  if (resolved.endsWith(".ts")) {
    return resolved;
  }
  if (existsSync(resolve(root, `${resolved}.ts`))) {
    return `${resolved}.ts`;
  }
  return existsSync(resolve(root, `${resolved}/index.ts`))
    ? `${resolved}/index.ts`
    : resolved;
}

test("M37 crea inventario exacto de application ports infrastructure y composition", () => {
  for (const directory of [application, ports, infrastructure, composition]) {
    assert.equal(existsSync(resolve(root, directory)), true, directory);
  }

  assert.deepEqual(
    walk(application).sort(),
    [...expectedApplication].sort(),
  );
  assert.deepEqual(
    walk(infrastructure).sort(),
    [...expectedInfrastructure].sort(),
  );
  assert.deepEqual(
    walk(composition).sort(),
    [...expectedComposition].sort(),
  );
});

test("domain M36 permanece aislado e intacto frente a capas M37", () => {
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

  const violations: string[] = [];
  for (const path of walk(domain).filter((candidate) => candidate.endsWith(".ts"))) {
    for (const reference of imports(path)) {
      const resolved = target(path, reference.specifier);
      if (
        resolved.startsWith(`${application}/`) ||
        resolved.startsWith(`${infrastructure}/`) ||
        resolved.startsWith(`${composition}/`)
      ) {
        violations.push(`${path}: ${reference.specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("application y ports aplican default deny sin DB Drizzle schema ni capas superiores", () => {
  const violations: string[] = [];

  for (const path of walk(application).filter((candidate) => candidate.endsWith(".ts"))) {
    for (const reference of imports(path)) {
      const resolved = target(path, reference.specifier);
      if (!resolved.startsWith(`${application}/`)) {
        violations.push(`${path}: dependency not allowed "${reference.specifier}"`);
      }
    }

    const source = read(path).toLowerCase();
    for (const marker of [
      "drizzle",
      "schema.ts",
      "db.ts",
      "fastify",
      "infrastructure",
      "composition",
      "auth",
      "audit",
      "email",
      "cors",
      "rate-limit",
      "supabase",
      "node:fs",
      "node:http",
      "process.",
      "fetch(",
    ]) {
      if (source.includes(marker)) {
        violations.push(`${path}: forbidden marker ${marker}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("infrastructure implementa ambos puertos y concentra DB schema y tablas", () => {
  const data = read(`${infrastructure}/report-workflow-data-adapter.ts`);
  const notification = read(
    `${infrastructure}/report-workflow-notification-adapter.ts`,
  );

  for (const marker of [
    "createReportWorkflowDataAdapter(): ReportWorkflowDataPort",
    ".from(studyTrackingCases)",
    ".where(eq(studyTrackingCases.reportId, reportId))",
    ".limit(1)",
  ]) {
    assert.ok(data.includes(marker), marker);
  }
  for (const marker of [
    "createReportWorkflowNotificationAdapter(): ReportWorkflowNotificationPort",
    ".insert(studyTrackingNotifications)",
    ".returning({ id: studyTrackingNotifications.id })",
  ]) {
    assert.ok(notification.includes(marker), marker);
  }

  for (const path of [
    ...walk(application),
    ...walk(composition),
  ].filter((candidate) => candidate.endsWith(".ts"))) {
    const source = read(path);
    for (const marker of [
      'from "../../../db.ts"',
      "drizzle-orm",
      "drizzle/schema.ts",
      "studyTrackingCases",
      "studyTrackingNotifications",
    ]) {
      assert.equal(source.includes(marker), false, `${path}: ${marker}`);
    }
  }
});

test("composition es el unico bridge M37 entre application e infrastructure", () => {
  const bridgeFiles = walk(feature)
    .filter((path) => path.endsWith(".ts"))
    .filter((path) => {
      const targets = imports(path).map((reference) =>
        target(path, reference.specifier)
      );
      return (
        targets.some((resolved) => resolved.startsWith(`${application}/`)) &&
        targets.some((resolved) => resolved.startsWith(`${infrastructure}/`))
      );
    });

  assert.deepEqual(bridgeFiles, [
    `${composition}/report-workflow-communication-composition.ts`,
  ]);
});

test("db workflow consume composition y ningun runtime consume el shim", () => {
  assert.ok(
    imports(workflow)
      .map((reference) => target(workflow, reference.specifier))
      .includes(`${composition}/index.ts`),
  );

  const violations = walk("server")
    .filter((path) => path.endsWith(".ts") && path !== shim)
    .filter((path) =>
      imports(path)
        .map((reference) => target(path, reference.specifier))
        .includes(shim)
    );
  assert.deepEqual(violations, []);

  assert.equal(
    read(shim).trim(),
    'export * from "../features/reports/composition/index.ts";',
  );
  assert.equal(read(shim).trim().split("\n").length, 1);
});

test("ruta admin conserva db-report-workflow y no invade capas M37", () => {
  const targets = imports(route).map((reference) =>
    target(route, reference.specifier)
  );

  assert.ok(targets.includes(workflow));
  assert.deepEqual(
    targets.filter(
      (resolved) =>
        resolved.startsWith(`${application}/`) ||
        resolved.startsWith(`${infrastructure}/`) ||
        resolved.startsWith(`${composition}/`),
    ),
    [],
  );

  const source = read(route);
  for (const marker of [
    'app.options("/", optionsHandler);',
    'app.options("/:id/stage", optionsHandler);',
    'app.options("/:id/special-stain", optionsHandler);',
    'app.get<{ Querystring: WorkflowQuery }>("/",',
    '"/:id/stage"',
    '"/:id/special-stain"',
    "enforceTrustedOrigin(request, reply, allowedOrigins)",
    "authenticateFastifyAdmin",
    "AUDIT_EVENTS.REPORT_WORKFLOW_STAGE_CHANGED",
    "AUDIT_EVENTS.REPORT_SPECIAL_STAIN_CHANGED",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("fastify app conserva el registro actual sin imports M37", () => {
  const path = "server/fastify-app.ts";
  const source = read(path);
  const targets = imports(path).map((reference) =>
    target(path, reference.specifier)
  );

  assert.equal(
    targets.includes("server/routes/admin-report-workflow.fastify.ts"),
    true,
  );
  assert.ok(
    source.includes(
      'await app.register(adminReportWorkflowNativeRoutes, {\n    prefix: "/api/admin/report-workflow",',
    ),
  );
  assert.deepEqual(
    targets.filter((resolved) => resolved.startsWith(`${application}/`) ||
      resolved.startsWith(`${infrastructure}/`) ||
      resolved.startsWith(`${composition}/`)),
    [],
  );
});

test("M38 permanece ausente y db-report-workflow no se mueve prematuramente", () => {
  assert.equal(existsSync(resolve(root, workflow)), true);
  assert.equal(
    existsSync(resolve(root, `${infrastructure}/db-report-workflow.ts`)),
    false,
  );

  const forbiddenFiles = walk(feature).filter((path) =>
    /(?:create|update|transition).*(?:report|status)|reports?-repository|handlers?|controllers?|services?/i
      .test(path.slice(feature.length + 1))
  );
  assert.deepEqual(forbiddenFiles, []);
});

test("contrato resultado exacto y errores sin catch permanecen en application", () => {
  const source = read(`${application}/report-workflow-communication.ts`);
  const typeStart = source.indexOf(
    "export type ReportWorkflowCommunicationResult = {",
  );
  const typeEnd = source.indexOf("\n};", typeStart);

  assert.notEqual(typeStart, -1);
  assert.equal(
    source.slice(typeStart, typeEnd + 3),
    [
      "export type ReportWorkflowCommunicationResult = {",
      "  notificationCreated: boolean;",
      "  notificationId: number | null;",
      "  warning: string | null;",
      "};",
    ].join("\n"),
  );
  assert.equal(/\b(?:try|catch)\b/.test(source), false);
});

test("adapters excluyen console audit email auth CORS y rate limit", () => {
  for (const path of walk(infrastructure).filter((candidate) => candidate.endsWith(".ts"))) {
    const source = read(path).toLowerCase();
    for (const marker of [
      "console.",
      "audit",
      "email",
      "auth",
      "cors",
      "rate-limit",
      "fastify",
    ]) {
      assert.equal(source.includes(marker), false, `${path}: ${marker}`);
    }
  }
});

test("best effort catch y logging seguro permanecen solo en db workflow", () => {
  const workflowSource = read(workflow);
  assert.ok(workflowSource.includes("} catch (error) {"));
  assert.ok(
    workflowSource.includes(
      'errorName: error instanceof Error ? error.name : "unknown_error"',
    ),
  );
  assert.equal(workflowSource.includes("error.message"), false);
  assert.equal(workflowSource.includes("error.stack"), false);

  const catches = walk(feature)
    .filter((path) => path.endsWith(".ts"))
    .filter((path) => /\bcatch\b/.test(read(path)));
  assert.deepEqual(catches, []);
});
