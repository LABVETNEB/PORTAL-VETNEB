import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const featureDir = "server/features/study-tracking";
const applicationDir = `${featureDir}/application`;
const applicationIndexFile = `${applicationDir}/index.ts`;
const domainIndexFile = `${featureDir}/domain/index.ts`;

const routeFactories = new Map<string, readonly string[]>([
  [
    "server/routes/study-tracking.fastify.ts",
    ["createClinicStudyTrackingOperations"],
  ],
  [
    "server/routes/admin-study-tracking.fastify.ts",
    ["createAdminStudyTrackingOperations"],
  ],
  [
    "server/routes/particular-study-tracking.fastify.ts",
    ["createParticularStudyTrackingOperations"],
  ],
]);

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function walkTsFiles(relativeDir: string): string[] {
  const absoluteDir = join(repoRoot, relativeDir);

  if (!existsSync(absoluteDir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...walkTsFiles(relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(relativePath);
    }
  }

  return files;
}

function listImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  for (const match of source.matchAll(
    /\b(?:import|export)\s+(?:type\s+)?[^;]*?\bfrom\s+["']([^"']+)["']/g,
  )) {
    specifiers.push(match[1]);
  }

  for (const match of source.matchAll(/\bimport\s+["']([^"']+)["']/g)) {
    specifiers.push(match[1]);
  }

  for (const match of source.matchAll(
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  )) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function resolveSpecifier(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  const resolved = normalizePath(
    relative(repoRoot, join(repoRoot, dirname(file), specifier)),
  );

  if (resolved.endsWith(".ts")) {
    return resolved;
  }

  const tsFile = `${resolved}.ts`;

  if (existsSync(join(repoRoot, tsFile))) {
    return tsFile;
  }

  const indexFile = `${resolved}/index.ts`;
  return existsSync(join(repoRoot, indexFile)) ? indexFile : resolved;
}

test("M32 conserva application canónica y agrega operaciones por realm", () => {
  const expectedFiles = [
    `${applicationDir}/index.ts`,
    `${applicationDir}/admin-study-tracking-operations.ts`,
    `${applicationDir}/clinic-study-tracking-operations.ts`,
    `${applicationDir}/particular-study-tracking-operations.ts`,
    `${applicationDir}/study-tracking-query-use-cases.ts`,
    `${applicationDir}/study-tracking-command-use-cases.ts`,
    `${applicationDir}/study-tracking-side-effect-use-cases.ts`,
    `${applicationDir}/ports/admin-study-tracking-reference-repository.ts`,
    `${applicationDir}/ports/clinic-study-tracking-reference-repository.ts`,
    `${applicationDir}/ports/study-tracking-query-repository.ts`,
    `${applicationDir}/ports/study-tracking-command-repository.ts`,
    `${applicationDir}/ports/study-tracking-notification-port.ts`,
    `${applicationDir}/ports/study-tracking-audit-port.ts`,
  ].sort();

  assert.deepEqual(walkTsFiles(applicationDir).sort(), expectedFiles);
  assert.equal(
    existsSync(join(repoRoot, `${applicationDir}/README.md`)),
    true,
  );
});

test("application sólo depende de su propia capa y del barrel de domain", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(applicationDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const target = resolveSpecifier(file, specifier);
      const internal = target.startsWith(`${applicationDir}/`);

      if (!internal && target !== domainIndexFile) {
        violations.push(`${file}: ${specifier} -> ${target}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("application no contiene Fastify, DB, Drizzle ni side effects concretos", () => {
  const forbidden =
    /\bFastify(?:Request|Reply|Instance)?\b|dbStudyTracking|drizzle-orm|drizzle\/schema|server\/lib|sendMail\s*\(|writeAuditLog:\s*audit\.|process\.|fetch\s*\(/;
  const violations = walkTsFiles(applicationDir)
    .filter((file) => forbidden.test(readText(file)));

  assert.deepEqual(violations, []);
});

test("los puertos son contratos type-only sin valores ni implementación", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(`${applicationDir}/ports`)) {
    const source = readText(file);

    if (
      /\bexport\s+(?:const|let|var|function|class|default)\b/.test(source) ||
      /\bnew\s+[A-Za-z_$]/.test(source)
    ) {
      violations.push(file);
    }
  }

  assert.deepEqual(violations, []);
});

test("los únicos puertos de side effects son email y auditoría reales", () => {
  const portFiles = walkTsFiles(`${applicationDir}/ports`);
  const sideEffectPorts = portFiles.filter((file) =>
    /(?:notification|audit)-port\.ts$/.test(file)
  );

  assert.deepEqual(sideEffectPorts.sort(), [
    `${applicationDir}/ports/study-tracking-audit-port.ts`,
    `${applicationDir}/ports/study-tracking-notification-port.ts`,
  ]);
  assert.match(
    readText(`${applicationDir}/ports/study-tracking-notification-port.ts`),
    /sendSpecialStainRequiredEmail/,
  );
  assert.match(
    readText(`${applicationDir}/ports/study-tracking-audit-port.ts`),
    /writeAuditLog/,
  );
});

test("las rutas consumen sólo el barrel application y componen cada factory una vez", () => {
  for (const [routeFile, factories] of routeFactories) {
    const source = readText(routeFile);
    const applicationTargets = listImportSpecifiers(source)
      .map((specifier) => resolveSpecifier(routeFile, specifier))
      .filter((target) => target.startsWith(`${applicationDir}/`));

    assert.deepEqual(applicationTargets, [applicationIndexFile], routeFile);

    for (const factory of factories) {
      assert.equal(
        source.match(new RegExp(`\\b${factory}\\s*\\(`, "g"))?.length ?? 0,
        1,
        `${routeFile}: ${factory}`,
      );
    }
  }
});

test("las operaciones por realm componen los use cases M31 una sola vez", () => {
  const expectedFactories = new Map<string, readonly string[]>([
    [
      `${applicationDir}/admin-study-tracking-operations.ts`,
      [
        "createAdminStudyTrackingQueryUseCases",
        "createAdminStudyTrackingCommandUseCases",
        "createStudyTrackingSideEffectUseCases",
      ],
    ],
    [
      `${applicationDir}/clinic-study-tracking-operations.ts`,
      [
        "createClinicStudyTrackingQueryUseCases",
        "createClinicStudyTrackingCommandUseCases",
        "createStudyTrackingSideEffectUseCases",
      ],
    ],
    [
      `${applicationDir}/particular-study-tracking-operations.ts`,
      [
        "createParticularStudyTrackingQueryUseCases",
        "createParticularStudyTrackingCommandUseCases",
      ],
    ],
  ]);

  for (const [file, factories] of expectedFactories) {
    const source = readText(file);

    for (const factory of factories) {
      assert.equal(
        source.match(new RegExp(`\\b${factory}\\s*\\(`, "g"))?.length ?? 0,
        1,
        `${file}: ${factory}`,
      );
    }
  }
});

test("email y auditoría se portan sólo en clínica y admin", () => {
  const clinicSource = readText("server/routes/study-tracking.fastify.ts");
  const clinicOperationsSource = readText(
    `${applicationDir}/clinic-study-tracking-operations.ts`,
  );
  const adminSource = readText("server/routes/admin-study-tracking.fastify.ts");
  const particularSource = readText(
    "server/routes/particular-study-tracking.fastify.ts",
  );

  for (const source of [clinicSource, adminSource]) {
    assert.match(
      source,
      /notification:\s*\{\s*sendSpecialStainRequiredEmail:/s,
    );
    assert.match(source, /audit:\s*\{\s*writeAuditLog:/s);
  }

  assert.match(
    clinicOperationsSource,
    /createStudyTrackingSideEffectUseCases/,
  );
  assert.match(
    clinicOperationsSource,
    /sendSpecialStainRequiredEmail/,
  );
  assert.match(clinicOperationsSource, /writeAuditLog/);
  assert.equal(
    particularSource.includes("createStudyTrackingSideEffectUseCases"),
    false,
  );
  assert.equal(particularSource.includes("sendSpecialStainRequiredEmail"), false);
  assert.equal(particularSource.includes("writeAuditLog"), false);
});

test("fuera de application nadie importa archivos internos", () => {
  const violations: string[] = [];

  for (const root of ["server", "test"] as const) {
    for (const file of walkTsFiles(root)) {
      if (file.startsWith(`${applicationDir}/`)) {
        continue;
      }

      for (const specifier of listImportSpecifiers(readText(file))) {
        const target = resolveSpecifier(file, specifier);

        if (
          target.startsWith(`${applicationDir}/`) &&
          target !== applicationIndexFile
        ) {
          violations.push(`${file}: ${specifier} -> ${target}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});
