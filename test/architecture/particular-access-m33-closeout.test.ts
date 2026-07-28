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
const legacyParticularPath = "server/db-particular.ts";
const legacyStudyTrackingPath = "server/db-study-tracking.ts";
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

const expectedExternalParticularConsumers = [
  "server/middlewares/particular-auth.ts",
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
    assert.equal(targets.includes(legacyParticularPath), false, route);
    assert.equal(targets.includes(legacyStudyTrackingPath), false, route);
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

test("M44 retira paths legacy y realinea los ocho consumidores externos", () => {
  assert.equal(existsSync(resolve(repoRoot, legacyParticularPath)), false);
  assert.equal(existsSync(resolve(repoRoot, legacyStudyTrackingPath)), false);

  const legacyViolations = ["server", "test"].flatMap((root) =>
    walkFiles(root)
      .filter((file) => file.endsWith(".ts"))
      .flatMap((file) =>
        importTargets(file)
          .filter(
            (target) =>
              target === legacyParticularPath ||
              target === legacyStudyTrackingPath,
          )
          .map((target) => `${file} -> ${target}`),
      ),
  );
  assert.deepEqual(legacyViolations, []);

  const reportsComposition =
    "server/features/reports/composition/report-route-composition.ts";
  const actualExternalParticularConsumers = walkFiles("server")
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !file.startsWith(`${featureDir}/`))
    .filter((file) => file !== reportsComposition)
    .filter((file) => importTargets(file).includes(infrastructureIndex))
    .sort();
  assert.deepEqual(
    actualExternalParticularConsumers,
    expectedExternalParticularConsumers,
  );

  const compositionTargets = importTargets(reportsComposition);
  assert.ok(compositionTargets.includes(infrastructureIndex));
  assert.ok(
    compositionTargets.includes(
      "server/features/study-tracking/infrastructure/index.ts",
    ),
  );
});

test("Auth preserva contrato y Reports usa composition M41", () => {
  assert.equal(
    digest("server/routes/particular-auth.fastify.ts"),
    "e94e5a2847f635f30a8edd81fa5270fd1501f727fc1b91e434677c3d101a0c86",
  );
  assert.equal(
    digest("server/middlewares/particular-auth.ts"),
    "5004967d61238de6d5fc38582ca48e0da1468189e418d279a4cd9786126c4683",
  );
  const reports = readSource("server/routes/admin-reports.fastify.ts");
  assert.ok(reports.includes("createAdminReportsRouteComposition"));
  assert.equal(reports.includes("../db-particular.ts"), false);
  assert.equal(reports.includes("../db-study-tracking.ts"), false);
});

test("README vigente M44 y closeout histórico M33 permanecen trazables", () => {
  const readme = readSource(`${featureDir}/README.md`);
  for (const marker of [
    "server/db-particular.ts",
    "M44",
    "ocho consumidores externos",
    "M44 no reorganizó Auth",
  ]) {
    assert.ok(readme.includes(marker), `${featureDir}/README.md: ${marker}`);
  }

  const historicalCloseout = readSource(closeout);
  for (const marker of [
    "server/db-particular.ts",
    "admin-reports.fastify.ts",
    "M34",
    "M35b",
  ]) {
    assert.ok(historicalCloseout.includes(marker), `${closeout}: ${marker}`);
  }

  for (const marker of [
    "cross-tenant",
    "anti-enumeración",
    "tokenLast4",
    "No se afirma RLS",
    "Rollback",
  ]) {
    assert.ok(historicalCloseout.includes(marker), marker);
  }
});
