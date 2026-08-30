import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const featureDir = "server/features/study-tracking";
const applicationIndex = `${featureDir}/application/index.ts`;
const infrastructureIndex = `${featureDir}/infrastructure/index.ts`;
const compositionFile = `${featureDir}/study-tracking-route-composition.ts`;
const legacyDbPath = "server/db-study-tracking.ts";
const domainShims = [
  "server/lib/study-tracking.ts",
  "server/lib/token-study-tracking.ts",
] as const;
const routes = {
  clinic: "server/routes/study-tracking.fastify.ts",
  particular: "server/routes/particular-study-tracking.fastify.ts",
  admin: "server/routes/admin-study-tracking.fastify.ts",
} as const;

const routeHashes = new Map<string, string>([
  // WBR-08c: migrated to the canonical clinic auth helper.
  [routes.clinic, "95cacc008578974e9884f10bb1fa8edc750b34bbea18d3ead4f4f26eec95e105"],
  [routes.particular, "24c6fa65a94def117e8e155ef1d14672409ac42ed2452e62667763b79ce5cc72"],
  [routes.admin, "eb11f9b1508edd16d5ec3b7353dcfc29ca70963ee9427735eef40857bd0dac79"],
]);

const expectedFeatureFiles = [
  `${featureDir}/README.md`,
  `${featureDir}/application/README.md`,
  `${featureDir}/application/admin-study-tracking-operations.ts`,
  `${featureDir}/application/clinic-study-tracking-operations.ts`,
  `${featureDir}/application/index.ts`,
  `${featureDir}/application/particular-study-tracking-operations.ts`,
  `${featureDir}/application/ports/admin-study-tracking-reference-repository.ts`,
  `${featureDir}/application/ports/clinic-study-tracking-reference-repository.ts`,
  `${featureDir}/application/ports/study-tracking-audit-port.ts`,
  `${featureDir}/application/ports/study-tracking-command-repository.ts`,
  `${featureDir}/application/ports/study-tracking-notification-port.ts`,
  `${featureDir}/application/ports/study-tracking-query-repository.ts`,
  `${featureDir}/application/study-tracking-command-use-cases.ts`,
  `${featureDir}/application/study-tracking-query-use-cases.ts`,
  `${featureDir}/application/study-tracking-side-effect-use-cases.ts`,
  `${featureDir}/application/token-study-tracking-operations.ts`,
  `${featureDir}/domain/README.md`,
  `${featureDir}/domain/index.ts`,
  `${featureDir}/domain/study-tracking.ts`,
  `${featureDir}/domain/token-study-tracking.ts`,
  `${featureDir}/index.ts`,
  `${featureDir}/infrastructure/README.md`,
  `${featureDir}/infrastructure/index.ts`,
  `${featureDir}/infrastructure/study-tracking-repository.ts`,
  compositionFile,
].sort();

const residualDbConsumers = new Map<
  string,
  { owner: string; milestone: string }
>();

function readSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function walkFiles(relativeDir: string): string[] {
  const absoluteDir = resolve(repoRoot, relativeDir);

  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry.name}`;
    return entry.isDirectory() ? walkFiles(relativePath) : [relativePath];
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

function digest(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(repoRoot, relativePath)))
    .digest("hex");
}

test("M33 extiende el inventario canonico de Study Tracking y permanece estable con M34 iniciado", () => {
  assert.deepEqual(walkFiles(featureDir).sort(), expectedFeatureFiles);
  assert.equal(existsSync(resolve(repoRoot, "server/features/particular-access")), true);
  assert.equal(existsSync(resolve(repoRoot, "server/features/report-access")), true);
});

test("M35 retira ambos shims domain y prohíbe imports globales a sus paths", () => {
  for (const shim of domainShims) {
    assert.equal(existsSync(resolve(repoRoot, shim)), false, shim);
  }

  const violations: string[] = [];

  for (const root of ["server", "test"] as const) {
    for (const file of walkFiles(root).filter((path) => path.endsWith(".ts"))) {
      for (const target of importTargets(file)) {
        if (domainShims.includes(target as (typeof domainShims)[number])) {
          violations.push(`${file} -> ${target}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("M44 retira el path DB legacy de Study Tracking sin consumidores", () => {
  assert.equal(existsSync(resolve(repoRoot, legacyDbPath)), false);

  const actualConsumers = ["server", "test"].flatMap((root) =>
    walkFiles(root)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => importTargets(file).includes(legacyDbPath)),
  );
  assert.deepEqual(actualConsumers, []);
});

test("residualDbConsumers permanece vacío después de M44", () => {
  assert.equal(residualDbConsumers.size, 0);
});

test("las tres rutas permanecen exactas y sólo atraviesan application y composition", () => {
  for (const [route, expectedHash] of routeHashes) {
    assert.equal(digest(route), expectedHash, route);

    const targets = importTargets(route);
    assert.ok(targets.includes(applicationIndex), route);
    assert.ok(targets.includes(compositionFile), route);
    assert.equal(targets.includes(legacyDbPath), false, route);
    assert.equal(
      targets.some((target) => target.startsWith(`${featureDir}/infrastructure/`)),
      false,
      route,
    );
  }
});

test("composition sigue siendo el único seam route a infrastructure", () => {
  assert.deepEqual([...new Set(importTargets(compositionFile))], [infrastructureIndex]);

  const source = readSource(compositionFile);
  assert.deepEqual(
    Array.from(
      source.matchAll(/export async function (load[A-Za-z]+StudyTrackingPersistence)\(/g),
      (match) => match[1],
    ),
    [
      "loadClinicStudyTrackingPersistence",
      "loadParticularStudyTrackingPersistence",
      "loadAdminStudyTrackingPersistence",
      "loadParticularAccessStudyTrackingPersistence",
    ],
  );
  assert.equal(/\b(?:select|insert|update|delete)\s*\(/.test(source), false);
  assert.equal(source.includes("drizzle-orm"), false);
  assert.equal(source.includes("Fastify"), false);
});

test("todas las factories application públicas conservan consumidor y test", () => {
  const contracts = [
    {
      factory: "createClinicStudyTrackingQueryUseCases",
      source: `${featureDir}/application/study-tracking-query-use-cases.ts`,
      consumer: `${featureDir}/application/clinic-study-tracking-operations.ts`,
      test: "test/unit/application/study-tracking/study-tracking-query-use-cases.test.ts",
    },
    {
      factory: "createAdminStudyTrackingQueryUseCases",
      source: `${featureDir}/application/study-tracking-query-use-cases.ts`,
      consumer: `${featureDir}/application/admin-study-tracking-operations.ts`,
      test: "test/unit/application/study-tracking/study-tracking-query-use-cases.test.ts",
    },
    {
      factory: "createParticularStudyTrackingQueryUseCases",
      source: `${featureDir}/application/study-tracking-query-use-cases.ts`,
      consumer: `${featureDir}/application/particular-study-tracking-operations.ts`,
      test: "test/unit/application/study-tracking/study-tracking-query-use-cases.test.ts",
    },
    {
      factory: "createClinicStudyTrackingCommandUseCases",
      source: `${featureDir}/application/study-tracking-command-use-cases.ts`,
      consumer: `${featureDir}/application/clinic-study-tracking-operations.ts`,
      test: "test/unit/application/study-tracking/study-tracking-command-use-cases.test.ts",
    },
    {
      factory: "createAdminStudyTrackingCommandUseCases",
      source: `${featureDir}/application/study-tracking-command-use-cases.ts`,
      consumer: `${featureDir}/application/admin-study-tracking-operations.ts`,
      test: "test/unit/application/study-tracking/study-tracking-command-use-cases.test.ts",
    },
    {
      factory: "createParticularStudyTrackingCommandUseCases",
      source: `${featureDir}/application/study-tracking-command-use-cases.ts`,
      consumer: `${featureDir}/application/particular-study-tracking-operations.ts`,
      test: "test/unit/application/study-tracking/study-tracking-command-use-cases.test.ts",
    },
    {
      factory: "createStudyTrackingSideEffectUseCases",
      source: `${featureDir}/application/study-tracking-side-effect-use-cases.ts`,
      consumer: `${featureDir}/application/clinic-study-tracking-operations.ts`,
      test: "test/unit/application/study-tracking/study-tracking-side-effect-use-cases.test.ts",
    },
    {
      factory: "createClinicStudyTrackingOperations",
      source: `${featureDir}/application/clinic-study-tracking-operations.ts`,
      consumer: routes.clinic,
      test: "test/unit/application/study-tracking/clinic-study-tracking-operations.test.ts",
    },
    {
      factory: "createParticularStudyTrackingOperations",
      source: `${featureDir}/application/particular-study-tracking-operations.ts`,
      consumer: routes.particular,
      test: "test/unit/application/study-tracking/particular-study-tracking-operations.test.ts",
    },
    {
      factory: "createTokenStudyTrackingOperations",
      source: `${featureDir}/application/token-study-tracking-operations.ts`,
      consumer: "server/features/particular-access/application/admin-particular-access-operations.ts",
      test: "test/unit/application/study-tracking/token-study-tracking-operations.test.ts",
    },
    {
      factory: "createAdminStudyTrackingOperations",
      source: `${featureDir}/application/admin-study-tracking-operations.ts`,
      consumer: routes.admin,
      test: "test/unit/application/study-tracking/admin-study-tracking-operations.test.ts",
    },
  ] as const;

  for (const contract of contracts) {
    assert.ok(readSource(contract.source).includes(contract.factory), contract.factory);
    assert.ok(readSource(applicationIndex).includes(contract.factory), contract.factory);
    assert.ok(readSource(contract.consumer).includes(contract.factory), contract.factory);
    assert.ok(readSource(contract.test).includes(contract.factory), contract.factory);
  }
});

test("los tres realms quedan separados con evidencia runtime", () => {
  // WBR-08c: routes.clinic delegates cookie reading to the canonical
  // clinic auth helper (mirrors routes.admin's authenticateFastifyAdmin).
  assert.ok(readSource(routes.clinic).includes("authenticateFastifyClinicUser"));
  assert.ok(readSource(routes.particular).includes("cookies[ENV.particularCookieName]"));
  assert.ok(readSource(routes.admin).includes("authenticateFastifyAdmin"));

  const evidence = new Map<string, string>([
    [
      "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
      "no acepta sesiones admin o particular como clínica",
    ],
    [
      "test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts",
      "no acepta sesiones admin o clínica como particular",
    ],
    [
      "test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts",
      "no acepta sesiones clínica o particular como admin",
    ],
  ]);

  for (const [file, marker] of evidence) {
    assert.ok(readSource(file).includes(marker), `${file}: ${marker}`);
  }
});

test("los guards de capa y rutas permanecen ejecutables en el cierre", () => {
  for (const file of [
    "test/architecture/study-tracking-domain-boundary-guard.test.ts",
    "test/architecture/study-tracking-application-boundary-guard.test.ts",
    "test/architecture/study-tracking-infrastructure-boundary-guard.test.ts",
    "test/architecture/study-tracking-clinic-particular-thin-routes.test.ts",
    "test/architecture/study-tracking-admin-thin-route.test.ts",
    "test/unit/contracts/study-tracking/study-tracking-suite-completeness.test.ts",
  ]) {
    assert.equal(existsSync(resolve(repoRoot, file)), true, file);
    assert.ok(readSource(file).includes("node:test"), file);
  }
});
