import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const featureDir = "server/features/particular-access";
const applicationDir = `${featureDir}/application`;
const domainDir = `${featureDir}/domain`;
const infrastructureDir = `${featureDir}/infrastructure`;
const applicationIndex = `${applicationDir}/index.ts`;
const infrastructureIndex = `${infrastructureDir}/index.ts`;
const repositoryFile = `${infrastructureDir}/particular-access-repository.ts`;
const compositionFile = `${featureDir}/particular-access-route-composition.ts`;
const dbShim = "server/db-particular.ts";
const studyShim = "server/db-study-tracking.ts";
const closeout =
  "docs/implementation/m33-particular-access-domain-repository-thin-closeout.md";
const routes = [
  "server/routes/admin-particular-tokens.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
] as const;

const expectedFeatureFiles = [
  `${featureDir}/README.md`,
  `${applicationDir}/README.md`,
  `${applicationDir}/admin-particular-access-operations.ts`,
  `${applicationDir}/clinic-particular-access-operations.ts`,
  applicationIndex,
  `${applicationDir}/ports/particular-access-ports.ts`,
  `${domainDir}/README.md`,
  `${domainDir}/index.ts`,
  `${domainDir}/particular-access.ts`,
  `${infrastructureDir}/README.md`,
  infrastructureIndex,
  repositoryFile,
  compositionFile,
].sort();

const particularShimConsumers = [
  "server/middlewares/particular-auth.ts",
  "server/preflight.ts",
  "server/routes/admin-reports.fastify.ts",
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

function walkFiles(relativeDir: string): string[] {
  const absolute = resolve(repoRoot, relativeDir);
  if (!existsSync(absolute)) {
    return [];
  }
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = `${relativeDir}/${entry.name}`;
    return entry.isDirectory() ? walkFiles(path) : [path];
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

function importTargets(relativePath: string): string[] {
  const targets: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      targets.push(resolveSpecifier(relativePath, node.moduleSpecifier.text));
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      targets.push(resolveSpecifier(relativePath, node.arguments[0].text));
    }
    node.forEachChild(visit);
  }
  visit(parse(relativePath));
  return targets;
}

function optionNames(relativePath: string, aliasName: string): string[] {
  const sourceFile = parse(relativePath);
  const alias = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === aliasName,
  );
  assert.ok(alias);
  assert.ok(ts.isTypeLiteralNode(alias.type));
  return alias.type.members
    .filter(ts.isPropertySignature)
    .map((member) => member.name.getText(sourceFile).replaceAll('"', ""))
    .sort();
}

function digest(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(repoRoot, relativePath)))
    .digest("hex");
}

test("M33 fija Particular Access y M34 no inicia M35b", () => {
  assert.deepEqual(walkFiles(featureDir).sort(), expectedFeatureFiles);
  assert.equal(
    existsSync(resolve(repoRoot, "server/features/report-access")),
    true,
  );
  assert.equal(
    existsSync(resolve(repoRoot, "server/features/particular-access-v2")),
    false,
  );
});

test("domain es puro y contiene sólo reglas reales", () => {
  for (const file of walkFiles(domainDir).filter((path) => path.endsWith(".ts"))) {
    const source = readSource(file);
    assert.equal(importTargets(file).some((target) => target !== `${domainDir}/particular-access.ts`), false, file);
    for (const forbidden of [
      "fastify",
      "drizzle",
      "zod",
      "schema.ts",
      "email",
      "cookie",
      "session",
      "serialize",
    ]) {
      assert.equal(source.toLowerCase().includes(forbidden), false, `${file}: ${forbidden}`);
    }
  }
});

test("application no conoce Fastify, Drizzle ni infrastructure concreta", () => {
  for (const file of walkFiles(applicationDir).filter((path) => path.endsWith(".ts"))) {
    const source = readSource(file);
    assert.equal(source.includes("fastify"), false, file);
    assert.equal(source.includes("drizzle"), false, file);
    assert.equal(source.includes("schema.ts"), false, file);
    assert.equal(
      importTargets(file).some((target) => target.startsWith(`${infrastructureDir}/`)),
      false,
      file,
    );
  }
});

test("repository conserva queries M33 1:1 después de normalizar sólo paths", () => {
  const normalized = readSource(repositoryFile)
    .replace('"../../../db.ts"', '"./db.ts"')
    .replace('"../../../../drizzle/schema.ts"', '"../drizzle/schema.ts"')
    .replace(
      '"../../../lib/list-pagination.ts"',
      '"./lib/list-pagination.ts"',
    );
  assert.equal(
    createHash("sha256").update(normalized).digest("hex"),
    "6a7f8fbe6ce08d281d928a0b5930dc3c408bb62c1df52ed8512dc876f712cbe2",
  );
  const source = readSource(repositoryFile).toLowerCase();
  for (const forbidden of [
    "fastify",
    "cors",
    "auth-security",
    "email",
    "cookie",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("composition es el único seam de rutas propias a infrastructure", () => {
  for (const route of routes) {
    const targets = importTargets(route);
    assert.ok(targets.includes(applicationIndex), route);
    assert.ok(targets.includes(compositionFile), route);
    assert.equal(targets.includes(dbShim), false, route);
    assert.equal(targets.includes(studyShim), false, route);
    assert.equal(
      targets.some((target) => target.startsWith(`${infrastructureDir}/`)),
      false,
      route,
    );
  }
  const compositionTargets = importTargets(compositionFile);
  assert.ok(compositionTargets.includes(infrastructureIndex));
  assert.ok(
    compositionTargets.includes(
      "server/features/study-tracking/study-tracking-route-composition.ts",
    ),
  );
  assert.equal(readSource(compositionFile).includes("drizzle-orm"), false);
  assert.equal(
    /\b(?:select|insert|update|delete)\s*\(/.test(readSource(compositionFile)),
    false,
  );
});

test("Options y endpoints de ambas rutas permanecen completos", () => {
  assert.deepEqual(
    optionNames(routes[0], "AdminParticularTokensNativeRoutesOptions"),
    [
      "createParticularToken",
      "createStudyTrackingCase",
      "createStudyTrackingNotification",
      "deleteAdminSession",
      "deleteParticularToken",
      "generateSessionToken",
      "getAdminSessionByToken",
      "getAdminUserById",
      "getClinicById",
      "getParticularStudyTrackingCase",
      "getParticularTokenById",
      "getReportById",
      "getStudyTrackingCaseByReportId",
      "hashSessionToken",
      "listParticularTokens",
      "now",
      "revokeParticularToken",
      "sendParticularTokenEmail",
      "updateAdminSessionLastAccess",
      "updateParticularTokenReport",
      "updateStudyTrackingCase",
    ].sort(),
  );
  assert.deepEqual(
    optionNames(routes[1], "ParticularTokensNativeRoutesOptions"),
    [
      "createParticularToken",
      "createStudyTrackingCase",
      "deleteActiveSession",
      "generateSessionToken",
      "getActiveSessionByToken",
      "getClinicScopedParticularToken",
      "getClinicScopedReportById",
      "getClinicUserById",
      "getParticularStudyTrackingCase",
      "getReportById",
      "getStudyTrackingCaseByReportId",
      "hashSessionToken",
      "listParticularTokens",
      "now",
      "revokeParticularToken",
      "sendParticularTokenEmail",
      "updateParticularTokenReport",
      "updateSessionLastAccess",
      "updateStudyTrackingCase",
    ].sort(),
  );
  const adminSource = readSource(routes[0]);
  const clinicSource = readSource(routes[1]);
  for (const endpoint of [
    'app.options("/", optionsHandler)',
    'app.options("/:tokenId", optionsHandler)',
    'app.options("/:tokenId/report", optionsHandler)',
    'app.options("/:tokenId/revoke", optionsHandler)',
    '}>("/", async (request, reply)',
    '}>("/:tokenId", async (request, reply)',
    '}>("/:tokenId/report", async (request, reply)',
    '}>("/:tokenId/revoke", async (request, reply)',
  ]) {
    assert.ok(adminSource.includes(endpoint), endpoint);
  }
  assert.ok(adminSource.includes('app.delete<{'));
  for (const endpoint of [
    'app.options("/", optionsHandler)',
    'app.options("/:tokenId", optionsHandler)',
    'app.options("/:tokenId/report", optionsHandler)',
    '}>("/", async (request, reply)',
    '}>("/:tokenId", async (request, reply)',
    '}>("/:tokenId/report", async (request, reply)',
  ]) {
    assert.ok(clinicSource.includes(endpoint), endpoint);
  }
});

test("shims conservan una línea y allowlists residuales exactas", () => {
  assert.equal(
    readSource(dbShim).trim(),
    'export * from "./features/particular-access/infrastructure/index.ts";',
  );
  assert.equal(
    readSource(studyShim).trim(),
    'export * from "./features/study-tracking/infrastructure/index.ts";',
  );
  const actualParticularConsumers = walkFiles("server")
    .filter((file) => file.endsWith(".ts") && file !== dbShim)
    .filter((file) => importTargets(file).includes(dbShim))
    .sort();
  assert.deepEqual(actualParticularConsumers, particularShimConsumers);
  const actualStudyConsumers = walkFiles("server")
    .filter((file) => file.endsWith(".ts") && file !== studyShim)
    .filter((file) => importTargets(file).includes(studyShim))
    .sort();
  assert.deepEqual(actualStudyConsumers, [
    "server/routes/admin-reports.fastify.ts",
  ]);
});

test("Auth y Reports denylist permanecen byte-identical", () => {
  assert.equal(
    digest("server/routes/particular-auth.fastify.ts"),
    "ae2847fd9c6dd68a13f88ad1d9672d0863741c2839c0343696dd67133e21078a",
  );
  assert.equal(
    digest("server/middlewares/particular-auth.ts"),
    "fc551f73cc21beb99d35e97cc9abde62d10e98621185b8d829f5bbe9919dc17b",
  );
  assert.equal(
    digest("server/routes/admin-reports.fastify.ts"),
    "7724b90996d023a5b1b1e4966dd092cb78768034dc46d97f27e30848d46dfe04",
  );
});

test("README y closeout documentan owners, seguridad y milestones pendientes", () => {
  for (const file of [`${featureDir}/README.md`, closeout]) {
    const source = readSource(file);
    for (const marker of [
      "server/db-particular.ts",
      "admin-reports.fastify.ts",
      "M34",
      "M35b",
    ]) {
      assert.ok(source.includes(marker), `${file}: ${marker}`);
    }
  }
  const source = readSource(closeout);
  for (const marker of [
    "cross-tenant",
    "anti-enumeración",
    "tokenLast4",
    "No se afirma RLS",
    "Rollback",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});
