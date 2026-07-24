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
const dbShim = "server/db-study-tracking.ts";
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
  [routes.clinic, "2ce07bd8abb818b39bc2369095f71e19b5b1bd2a1dcba38f7848acaf349507b1"],
  [routes.particular, "ed7d3f4a949af488a9dab5a9a89ccc9e89d19399ddde7230a25a3189a32591fb"],
  [routes.admin, "c93824a2a7f2866c658e00304964927cbfc981b5b9c2046860657a6feb89c589"],
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
  `${featureDir}/infrastructure/README.md`,
  `${featureDir}/infrastructure/index.ts`,
  `${featureDir}/infrastructure/study-tracking-repository.ts`,
  compositionFile,
].sort();

const residualDbConsumers = new Map<string, { owner: string; milestone: string }>([
  [
    "server/routes/admin-reports.fastify.ts",
    { owner: "Reports", milestone: "M36" },
  ],
]);

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

test("M33 extiende el inventario canonico de Study Tracking sin iniciar M34", () => {
  assert.deepEqual(walkFiles(featureDir).sort(), expectedFeatureFiles);
  assert.equal(existsSync(resolve(repoRoot, "server/features/particular-access")), true);
  assert.equal(existsSync(resolve(repoRoot, "server/features/report-access")), false);
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

test("M35 conserva el shim DB de una linea con allowlist externa exacta", () => {
  assert.equal(
    readSource(dbShim).trim(),
    'export * from "./features/study-tracking/infrastructure/index.ts";',
  );

  const actualConsumers = walkFiles("server")
    .filter((file) => file.endsWith(".ts") && file !== dbShim)
    .filter((file) => importTargets(file).includes(dbShim))
    .sort();

  assert.deepEqual(actualConsumers, [...residualDbConsumers.keys()].sort());
});

test("cada consumidor residual del shim DB tiene owner y milestone documentados", () => {
  const readme = readSource(`${featureDir}/README.md`);
  const closeout = readSource("docs/implementation/m35-study-tracking-phase-closeout.md");

  for (const [consumer, ownership] of residualDbConsumers) {
    for (const source of [readme, closeout]) {
      assert.ok(source.includes(consumer), consumer);
      assert.ok(source.includes(ownership.owner), ownership.owner);
      assert.ok(source.includes(ownership.milestone), ownership.milestone);
    }
  }
});

test("las tres rutas permanecen exactas y sólo atraviesan application y composition", () => {
  for (const [route, expectedHash] of routeHashes) {
    assert.equal(digest(route), expectedHash, route);

    const targets = importTargets(route);
    assert.ok(targets.includes(applicationIndex), route);
    assert.ok(targets.includes(compositionFile), route);
    assert.equal(targets.includes(dbShim), false, route);
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
  assert.ok(readSource(routes.clinic).includes("cookies[ENV.cookieName]"));
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
