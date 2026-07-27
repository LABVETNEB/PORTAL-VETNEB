import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const featureDir = "server/features/reports";
const domainDir = `${featureDir}/domain`;
const domainIndexFile = `${domainDir}/index.ts`;
const reportStatusFile = `${domainDir}/report-status.ts`;
const reportStudyTypesFile = `${domainDir}/report-study-types.ts`;
const reportsFile = `${domainDir}/reports.ts`;

const domainFiles = [
  domainIndexFile,
  reportStatusFile,
  reportStudyTypesFile,
  reportsFile,
] as const;

const legacyShimFiles = [
  "server/lib/report-status.ts",
  "server/lib/report-study-types.ts",
  "server/lib/reports.ts",
] as const;

const runtimeConsumers = [
  "server/routes/admin-reports.fastify.ts",
  "server/routes/reports.fastify.ts",
  "server/routes/reports-status.fastify.ts",
  "server/db.ts",
  "server/lib/particular-token.ts",
  "server/lib/report-access-token.ts",
] as const;

type ImportReference = {
  specifier: string;
  typeOnly: boolean;
};

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function toRepoPath(path: string): string {
  return path.replaceAll("\\", "/");
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

function listImportReferences(source: string): ImportReference[] {
  const references: ImportReference[] = [];

  for (const match of source.matchAll(
    /\b(import\s+type|import|export)\s+([^;]*?)\bfrom\s+["']([^"']+)["']/g,
  )) {
    references.push({
      specifier: match[3],
      typeOnly: match[1] === "import type",
    });
  }

  for (const match of source.matchAll(/\bimport\s+["']([^"']+)["']/g)) {
    references.push({ specifier: match[1], typeOnly: false });
  }

  for (const match of source.matchAll(
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  )) {
    references.push({ specifier: match[1], typeOnly: false });
  }

  return references;
}

function resolveSpecifier(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return toRepoPath(specifier);
  }

  const resolved = toRepoPath(
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

test("Reports conserva domain M36 y admite inventario M37 autorizado", () => {
  assert.equal(existsSync(join(repoRoot, featureDir)), true);
  assert.equal(existsSync(join(repoRoot, domainDir)), true);

  assert.deepEqual(
    readdirSync(join(repoRoot, featureDir)).sort(),
    ["README.md", "application", "composition", "domain", "infrastructure"],
  );
  assert.deepEqual(
    readdirSync(join(repoRoot, domainDir)).sort(),
    [
      "README.md",
      "index.ts",
      "report-status.ts",
      "report-study-types.ts",
      "reports.ts",
    ],
  );
  assert.deepEqual(walkTsFiles(domainDir).sort(), [...domainFiles].sort());
});

test("barrel público reexporta completos los tres módulos M36", () => {
  assert.equal(
    readText(domainIndexFile).trim(),
    [
      'export * from "./report-status.ts";',
      'export * from "./report-study-types.ts";',
      'export * from "./reports.ts";',
    ].join("\n"),
  );
});

test("los tres módulos canónicos contienen implementación real y exports preservados", () => {
  const contracts = [
    {
      file: reportStatusFile,
      markers: [
        "export const REPORT_STATUSES",
        "export function isReportStatus",
        "export function normalizeReportStatus",
        "export function canTransitionReportStatus",
        "const allowedTransitions",
      ],
    },
    {
      file: reportStudyTypesFile,
      markers: [
        "export const REPORT_STUDY_TYPES",
        "export type ReportStudyType",
        "export const REPORT_STUDY_TYPE_LABELS",
        "export function isReportStudyType",
        "export function getReportStudyTypes",
        "export function serializeReportStudyType",
        "export function parseReportStudyType",
        'new Error("Tipo de estudio inválido")',
        "allowedValues: REPORT_STUDY_TYPES",
      ],
    },
    {
      file: reportsFile,
      markers: [
        "export function parsePositiveInt",
        "export function parseOffset",
        "export function normalizeSearchText",
        "export function normalizeOptionalNote",
        "export function parseOptionalDate",
        "export function parseClinicId",
        "export function parseReportStatus",
        "export function getReadClinicScope",
        "export function parseReportId",
        "export function serializeSafeReport",
        "trimmed.slice(0, 2000)",
        "hasFile: Boolean(report.storagePath)",
      ],
    },
  ] as const;

  for (const contract of contracts) {
    const source = readText(contract.file);

    assert.ok(source.split("\n").length > 40, `${contract.file} must contain implementation`);
    assert.notEqual(
      source.trim(),
      'export * from "../features/reports/domain/index.ts";',
    );

    for (const marker of contract.markers) {
      assert.ok(source.includes(marker), `${contract.file} must contain ${marker}`);
    }
  }

  assert.equal(readText(reportsFile).includes("storagePath:"), false);
});

test("los tres shims legacy existen y son reexports exactos de una línea", () => {
  for (const file of legacyShimFiles) {
    assert.equal(existsSync(join(repoRoot, file)), true, `${file} must exist in M36`);
    assert.equal(
      readText(file).trim(),
      'export * from "../features/reports/domain/index.ts";',
      file,
    );
    assert.equal(readText(file).trim().split("\n").length, 1, file);
  }
});

test("ningún consumidor runtime ni test de comportamiento importa los shims", () => {
  const violations: string[] = [];

  for (const root of ["server", "test"] as const) {
    for (const file of walkTsFiles(root)) {
      if (legacyShimFiles.includes(file as (typeof legacyShimFiles)[number])) {
        continue;
      }

      for (const { specifier } of listImportReferences(readText(file))) {
        const target = resolveSpecifier(file, specifier);

        if (legacyShimFiles.includes(target as (typeof legacyShimFiles)[number])) {
          violations.push(`${file}: import legacy "${specifier}" -> ${target}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("consumidores externos usan exclusivamente el barrel canonico", () => {
  const violations: string[] = [];

  for (const root of ["server", "test"] as const) {
    for (const file of walkTsFiles(root)) {
      if (file.startsWith(`${domainDir}/`)) {
        continue;
      }

      for (const { specifier } of listImportReferences(readText(file))) {
        const target = resolveSpecifier(file, specifier);

        if (
          target.startsWith(`${domainDir}/`) &&
          target.endsWith(".ts") &&
          target !== domainIndexFile
        ) {
          violations.push(`${file}: import interno "${specifier}" -> ${target}`);
        }
      }
    }
  }

  for (const file of runtimeConsumers) {
    const targets = listImportReferences(readText(file)).map(({ specifier }) =>
      resolveSpecifier(file, specifier)
    );

    if (!targets.includes(domainIndexFile)) {
      violations.push(`${file}: no importa ${domainIndexFile}`);
    }
  }

  assert.deepEqual(violations, []);
});

test("domain aplica default-deny y sólo permite schema type-only e imports internos", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(domainDir)) {
    for (const reference of listImportReferences(readText(file))) {
      const target = resolveSpecifier(file, reference.specifier);
      const isInternal = target.startsWith(`${domainDir}/`);
      const isSchema = target === "drizzle/schema.ts";

      if (isSchema && !reference.typeOnly) {
        violations.push(`${file}: schema must be imported with import type`);
      } else if (!isInternal && !isSchema) {
        violations.push(`${file}: dependency not allowed "${reference.specifier}"`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("domain no contiene transporte infraestructura I/O ni side effects", () => {
  const forbiddenSpecifiers = [
    /^fastify(\/|$)/i,
    /(^|\/)routes?(\/|$)/i,
    /application|infrastructure|composition|repositories?|services?|factories/i,
    /(^|\/)db(?:-[^/]+)?(\.ts)?$/i,
    /drizzle-orm/i,
    /auth|session|cookie|permissions?|cors|rate-limit|audit|email|supabase/i,
    /^(node:)?(fs|http|https|net|dns|tls|child_process|process)(\/|$)/i,
  ];
  const forbiddenSource = [
    /\bFastify(?:Request|Reply|Instance)?\b/,
    /\bprocess\.\w+/,
    /\bfetch\s*\(/,
    /\b(?:readFile|writeFile|createServer|listen|setTimeout|setInterval)\s*\(/,
    /\bnew\s+(?:Worker|WebSocket)\b/,
    /\b(?:let|var)\s+\w+\s*=\s*(?:new\s+(?:Map|Set)|\[\]|\{\})/,
  ];
  const violations: string[] = [];

  for (const file of walkTsFiles(domainDir)) {
    const source = readText(file);

    for (const { specifier } of listImportReferences(source)) {
      for (const pattern of forbiddenSpecifiers) {
        if (pattern.test(specifier)) {
          violations.push(`${file}: forbidden specifier "${specifier}"`);
        }
      }
    }

    for (const pattern of forbiddenSource) {
      if (pattern.test(source)) {
        violations.push(`${file}: forbidden source pattern ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("M37 a M39 quedan fuera del dominio y M39 está materializado", () => {
  for (const path of [
    `${featureDir}/application`,
    `${featureDir}/infrastructure`,
    `${featureDir}/composition`,
  ]) {
    assert.equal(existsSync(join(repoRoot, path)), true, `${path} must exist in M37`);
  }

  for (const path of [
    "server/lib/report-workflow-communication.ts",
    "server/db-report-workflow.ts",
  ]) {
    assert.equal(existsSync(join(repoRoot, path)), true, `${path} must remain outside domain`);
  }

  for (const file of walkTsFiles(domainDir)) {
    const source = readText(file);
    assert.equal(source.includes("report-workflow-communication"), false, file);
    assert.equal(source.includes("db-report-workflow"), false, file);
  }

  assert.equal(
    existsSync(join(repoRoot, `${featureDir}/infrastructure/db-report-workflow.ts`)),
    true,
  );
  assert.equal(
    existsSync(
      join(
        repoRoot,
        `${featureDir}/application/report-command-use-cases.ts`,
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(repoRoot, `${featureDir}/application/report-route-service.ts`),
    ),
    true,
  );
  assert.equal(
    walkTsFiles(`${featureDir}/application`).some((file) =>
      /report-query/i.test(file),
    ),
    false,
  );
});

test("rutas Reports conservan sus paths M36", () => {
  const routeContracts = [
    {
      file: "server/routes/admin-reports.fastify.ts",
      markers: [
        'app.options("/upload", optionsHandler);',
        '}>("/:reportId/preview-url", async',
        '}>("/:reportId/download-url", async',
        'app.post("/upload", async',
      ],
    },
    {
      file: "server/routes/reports.fastify.ts",
      markers: [
        'app.options("/", optionsHandler);',
        'app.options("/search", optionsHandler);',
        'app.options("/study-types", optionsHandler);',
        '}>("/", async',
        '}>("/search", async',
        '}>("/study-types", async',
        '}>("/:reportId/history", async',
        '}>("/:reportId/preview-url", async',
        '}>("/:reportId/download-url", async',
      ],
    },
    {
      file: "server/routes/reports-status.fastify.ts",
      markers: [
        'app.options("/:reportId/status", optionsHandler);',
        '}>("/:reportId/status", async',
      ],
    },
  ] as const;

  for (const contract of routeContracts) {
    const source = readText(contract.file);

    for (const marker of contract.markers) {
      assert.ok(source.includes(marker), `${contract.file} must contain ${marker}`);
    }
  }
});

test("fastify app conserva el registro Reports M36 sin consumir capas M37", () => {
  const source = readText("server/fastify-app.ts");
  const imports = listImportReferences(source).map(({ specifier }) => specifier);

  assert.equal(
    imports.filter((specifier) =>
      specifier === "./routes/reports.fastify.ts"
    ).length,
    1,
  );
  assert.equal(
    imports.filter((specifier) =>
      specifier === "./routes/reports-status.fastify.ts"
    ).length,
    1,
  );
  assert.equal(
    Array.from(
      source.matchAll(
        /\bimport\s*\{[^}]*\breportsNativeRoutes\b[^}]*\}\s*from\s*["']\.\/routes\/reports\.fastify\.ts["'];/gs,
      ),
    ).length,
    1,
  );
  assert.equal(
    Array.from(
      source.matchAll(
        /\bimport\s*\{[^}]*\breportsStatusNativeRoutes\b[^}]*\}\s*from\s*["']\.\/routes\/reports-status\.fastify\.ts["'];/gs,
      ),
    ).length,
    1,
  );

  const registrations = Array.from(
    source.matchAll(
      /\bapp\.register\(\s*([A-Za-z_$][\w$]*)\s*,/g,
    ),
    (match) => match[1],
  );
  assert.equal(
    registrations.filter((plugin) => plugin === "reportsNativeRoutes").length,
    1,
  );
  assert.equal(
    registrations.filter((plugin) =>
      plugin === "reportsStatusNativeRoutes"
    ).length,
    1,
  );

  const reportsPrefixRegistrations = Array.from(
    source.matchAll(
      /\bapp\.register\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{\s*prefix:\s*"\/api\/reports",/g,
    ),
    (match) => match[1],
  );
  assert.deepEqual(reportsPrefixRegistrations, [
    "reportsNativeRoutes",
    "reportsStatusNativeRoutes",
  ]);

  const reportsIndex = source.indexOf(
    "await app.register(reportsNativeRoutes, {",
  );
  const reportsStatusIndex = source.indexOf(
    "await app.register(reportsStatusNativeRoutes, {",
  );
  assert.notEqual(reportsIndex, -1);
  assert.notEqual(reportsStatusIndex, -1);
  assert.ok(reportsIndex < reportsStatusIndex);

  const forbiddenImports = imports.filter((specifier) =>
    /features\/reports\/(?:application|infrastructure|composition)(?:\/|$)|report-workflow-communication|db-report-workflow/i
      .test(specifier)
  );
  assert.deepEqual(forbiddenImports, []);
});

test("censo path-aware apunta al catálogo canónico y conserva los shims M36", () => {
  const source = readText(
    "test/unit/contracts/reports/report-study-types-catalog.test.ts",
  );

  assert.ok(
    source.includes(
      '"server/features/reports/domain/report-study-types.ts"',
    ),
  );
  assert.ok(source.includes('"server/features/reports/domain/index.ts"'));
  assert.ok(source.includes('"server/lib/report-study-types.ts"'));

  for (const shim of legacyShimFiles) {
    assert.equal(existsSync(join(repoRoot, shim)), true, shim);
  }
});
