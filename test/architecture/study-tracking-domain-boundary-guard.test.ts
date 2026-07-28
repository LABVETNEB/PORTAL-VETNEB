import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const featureDir = "server/features/study-tracking";
const domainDir = `${featureDir}/domain`;
const domainIndexFile = `${domainDir}/index.ts`;
const studyTrackingFile = `${domainDir}/study-tracking.ts`;
const tokenStudyTrackingFile = `${domainDir}/token-study-tracking.ts`;
const applicationDir = `${featureDir}/application`;
const infrastructureDir = `${featureDir}/infrastructure`;

const legacyShimFiles = [
  "server/lib/study-tracking.ts",
  "server/lib/token-study-tracking.ts",
] as const;

const runtimeConsumers = [
  "server/routes/study-tracking.fastify.ts",
  "server/routes/admin-study-tracking.fastify.ts",
  "server/routes/particular-study-tracking.fastify.ts",
  "server/features/reports/composition/report-route-composition.ts",
] as const;

type ImportReference = {
  specifier: string;
  typeOnly: boolean;
};

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
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

function toRepoPath(path: string): string {
  return path.replaceAll("\\", "/");
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

test("Study Tracking abre Fase G con contexto, domain, barrel y módulos canónicos", () => {
  for (const path of [
    featureDir,
    `${featureDir}/README.md`,
    domainDir,
    `${domainDir}/README.md`,
    domainIndexFile,
    studyTrackingFile,
    tokenStudyTrackingFile,
  ]) {
    assert.equal(existsSync(join(repoRoot, path)), true, `${path} debe existir`);
  }

  assert.deepEqual(
    walkTsFiles(domainDir).sort(),
    [domainIndexFile, studyTrackingFile, tokenStudyTrackingFile].sort(),
  );
});

test("el barrel público reexporta los dos módulos canónicos", () => {
  const source = readText(domainIndexFile).trim();

  assert.equal(
    source,
    [
      'export * from "./study-tracking.ts";',
      'export * from "./token-study-tracking.ts";',
    ].join("\n"),
  );
});

test("los cuatro consumidores runtime usan únicamente el barrel canónico", () => {
  const violations: string[] = [];

  for (const file of runtimeConsumers) {
    const targets = listImportReferences(readText(file)).map(({ specifier }) =>
      resolveSpecifier(file, specifier)
    );
    const expectedTarget = file.startsWith("server/features/")
      ? `${featureDir}/index.ts`
      : domainIndexFile;

    if (!targets.includes(expectedTarget)) {
      violations.push(`${file}: no importa ${expectedTarget}`);
    }

    for (const legacyShimFile of legacyShimFiles) {
      if (targets.includes(legacyShimFile)) {
        violations.push(`${file}: todavía importa ${legacyShimFile}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("M35 retira los shims legacy de dominio sin consumidores", () => {
  for (const file of legacyShimFiles) {
    assert.equal(existsSync(join(repoRoot, file)), false, `${file} debe estar ausente`);
  }
});

test("ningún consumidor global usa los shims legacy retirados", () => {
  const violations: string[] = [];

  for (const root of ["server", "test"] as const) {
    for (const file of walkTsFiles(root)) {
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

test("fuera de domain nadie importa archivos internos directamente", () => {
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

  assert.deepEqual(violations, []);
});

test("domain sólo depende de zod, schema type-only y su propia capa", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(domainDir)) {
    for (const reference of listImportReferences(readText(file))) {
      const target = resolveSpecifier(file, reference.specifier);
      const isZod = reference.specifier === "zod";
      const isInternal = target.startsWith(`${domainDir}/`);
      const isSchema = target === "drizzle/schema.ts";

      if (isSchema && !reference.typeOnly) {
        violations.push(
          `${file}: drizzle/schema.ts debe importarse únicamente con import type`,
        );
      } else if (!isZod && !isInternal && !isSchema) {
        violations.push(`${file}: dependencia no permitida "${reference.specifier}"`);
      }
    }
  }

  assert.deepEqual(violations, []);
  assert.match(readText(studyTrackingFile), /import \{ z \} from "zod";/);
});

test("domain no contiene transporte, infraestructura, I/O ni side effects concretos", () => {
  const forbiddenSpecifiers = [
    /^fastify(\/|$)/i,
    /(^|\/)routes?(\/|$)/i,
    /db-study-tracking/i,
    /(^|\/)env(\.ts)?$/i,
    /auth|session|cookie|cors|audit|email|supabase/i,
    /^(node:)?(fs|http|https|net|dns|tls|child_process|process)(\/|$)/i,
  ];
  const forbiddenSource = [
    /\bFastify(?:Request|Reply|Instance)?\b/,
    /\bdbStudyTracking\b/,
    /\bENV\b/,
    /\bprocess\.\w+/,
    /\bfetch\s*\(/,
    /\b(?:readFile|writeFile|createServer|listen|setInterval)\s*\(/,
    /\bnew\s+(?:Worker|WebSocket)\b/,
  ];
  const violations: string[] = [];

  for (const file of walkTsFiles(domainDir)) {
    const source = readText(file);

    for (const { specifier } of listImportReferences(source)) {
      for (const pattern of forbiddenSpecifiers) {
        if (pattern.test(specifier)) {
          violations.push(`${file}: specifier prohibido "${specifier}"`);
        }
      }
    }

    for (const pattern of forbiddenSource) {
      if (pattern.test(source)) {
        violations.push(`${file}: patrón fuente prohibido ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("token-study-tracking conserva persistencia inyectada y dependencia domain interna", () => {
  const source = readText(tokenStudyTrackingFile);
  const targets = listImportReferences(source).map(({ specifier }) =>
    resolveSpecifier(tokenStudyTrackingFile, specifier)
  );

  assert.ok(targets.includes(studyTrackingFile));
  assert.match(source, /type EnsureTokenTrackingDeps = \{/);
  assert.match(
    source,
    /ensureStudyTrackingCaseForToken\(\s*deps: EnsureTokenTrackingDeps,/,
  );

  for (const dependency of [
    "getParticularStudyTrackingCase",
    "getStudyTrackingCaseByReportId",
    "createStudyTrackingCase",
    "updateStudyTrackingCase",
  ]) {
    assert.match(source, new RegExp(`deps\\.${dependency}\\(`));
  }

  assert.doesNotMatch(source, /from\s+["'][^"']*db-study-tracking/);
});

test("M31 agrega application e infrastructure sin contaminar domain", () => {
  assert.equal(existsSync(join(repoRoot, applicationDir)), true);
  assert.equal(existsSync(join(repoRoot, infrastructureDir)), true);

  for (const file of walkTsFiles(domainDir)) {
    const targets = listImportReferences(readText(file)).map(({ specifier }) =>
      resolveSpecifier(file, specifier)
    );

    assert.equal(
      targets.some(
        (target) =>
          target.startsWith(`${applicationDir}/`) ||
          target.startsWith(`${infrastructureDir}/`),
      ),
      false,
      file,
    );
  }
});
