import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Guard de frontera del contexto Public Professionals — capa infrastructure
// (M22, Fase E). Clona el mecanismo ya validado por los guards de Logistics
// (M12) y Pricing (M18/M19): node:test + lectura de fuente + parser de imports,
// sin dependencias nuevas, sin spawn y sin invocar PNPM. La comprobación es por
// PATH RESUELTO, nunca por texto libre.
//
// M22 divide `server/db-public-professionals.ts` (756 LOC) en dos módulos con
// responsabilidades separadas dentro de `infrastructure/` (mapping puro +
// repository de datos) tras un barrel, y CONSERVA el path legacy como shim
// mínimo porque las rutas todavía lo consumen (su reapunte/retiro es M23/M24).

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const featureDir = "server/features/public-professionals";
const domainDir = `${featureDir}/domain`;
const domainIndexFile = `${domainDir}/index.ts`;
const infrastructureDir = `${featureDir}/infrastructure`;
const barrelFile = `${infrastructureDir}/index.ts`;
const mappingFile = `${infrastructureDir}/public-professionals-mapping.ts`;
const repositoryFile = `${infrastructureDir}/public-professionals-repository.ts`;
const rateLimitFile = `${infrastructureDir}/public-professionals-rate-limit.ts`;
const queryServiceFile = `${featureDir}/public-professionals-query-service.ts`;

// Shim legacy conservado en M22: único re-export hacia el barrel canónico. Su
// path se construye por concatenación para que el propio guard no sea un falso
// positivo y para comparar contra specifiers ya resueltos, no contra texto.
const legacyShimFile = ["server", "db-public-professionals.ts"].join("/");
const legacyRateLimitShimFile = [
  "server",
  "lib",
  "public-professionals-rate-limit.ts",
].join("/");

// Rutas que todavía consumen el path legacy durante M22 (M23 las adelgaza).
const routeFiles = [
  "server/routes/public-professionals.fastify.ts",
  "server/routes/clinic-public-profile.fastify.ts",
] as const;

// Superficie pública canónica medida en R0 (HEAD 56f081e, antes del move).
const MAPPING_VALUE_EXPORTS = [
  "MIN_PUBLIC_PROFILE_QUALITY_SCORE",
  "evaluateClinicPublicProfilePublication",
  "buildClinicPublicProfileResponse",
] as const;

const MAPPING_TYPE_EXPORTS = ["UpsertClinicPublicProfileInput"] as const;

const REPOSITORY_VALUE_EXPORTS = [
  "getClinicPublicProfileByClinicId",
  "upsertClinicPublicProfile",
  "patchClinicPublicProfile",
  "syncClinicPublicSearch",
  "removeClinicPublicAvatar",
  "getPublicProfessionalByClinicId",
  "searchPublicProfessionals",
] as const;

// Constantes SQL de elegibilidad que sólo pueden existir en el repository
// canónico (una única copia; el shim no puede reintroducirlas).
const SQL_CONSTANT_NAMES = [
  "LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL",
  "PROFESSIONAL_BANK_ELIGIBILITY_SQL",
  "PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL",
] as const;

// R0: `db-public-professionals.ts` (756 LOC) contenía exactamente CERO
// call-sites `.transaction(`. El move no puede introducir ninguna.
const R0_TRANSACTION_CALL_SITES = 0;

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function toRepoRelativePath(path: string): string {
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
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(relativePath);
    }
  }

  return files;
}

// Parser robusto de imports: `import ... from`, `require(...)`, `import(...)`
// dinámico, `import "..."` de efecto lateral y `export ... from`.
function listImportSpecifiers(source: string): string[] {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g,
    ),
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );
}

function resolveRelativeTsSpecifier(file: string, specifier: string): string {
  const resolvedPath = toRepoRelativePath(
    relative(repoRoot, join(repoRoot, dirname(file), specifier)),
  );

  if (resolvedPath.endsWith(".ts")) {
    return resolvedPath;
  }

  const tsFilePath = `${resolvedPath}.ts`;
  if (existsSync(join(repoRoot, tsFilePath))) {
    return tsFilePath;
  }

  const indexFilePath = `${resolvedPath}/index.ts`;
  if (existsSync(join(repoRoot, indexFilePath))) {
    return indexFilePath;
  }

  return resolvedPath;
}

function resolveSpecifier(file: string, specifier: string): string {
  return specifier.startsWith(".")
    ? resolveRelativeTsSpecifier(file, specifier)
    : toRepoRelativePath(specifier);
}

function resolvedSpecifiers(file: string): string[] {
  return listImportSpecifiers(readText(file)).map((specifier) =>
    resolveSpecifier(file, specifier),
  );
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Reglas de frontera comunes (ADR ARCH-2): infrastructure adapta persistencia,
// nunca transporte HTTP ni orquestación. Se evalúan contra el specifier y el
// path resuelto.
const FORBIDDEN_TARGET_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "import de fastify", pattern: /^fastify(\/|$)/ },
  { label: "import hacia server/routes", pattern: /^server\/routes(\/|$)/ },
  {
    label: "import hacia una capa application",
    pattern: /(^|\/)application(\/|$)/,
  },
  { label: "import hacia frontend", pattern: /(^|\/)frontend(\/|$)/ },
  {
    label: "import de auth/session/CORS/audit/email/supabase concretos",
    pattern:
      /(^|\/)(auth|session|sessions|cors|audit|email|mailer|supabase)([./-][\w-]*)?$/i,
  },
  { label: "import hacia server/lib", pattern: /^server\/lib(\/|$)/ },
  { label: "import de configuración de entorno (lib/env)", pattern: /(^|\/)env(\.ts)?$/i },
];

// Dependencias legítimas del repository: misma capa, el domain barrel, el motor
// de datos y el shared kernel de tipos, más el runtime de Drizzle.
function isAllowedRepositoryDependency(file: string, specifier: string): boolean {
  const resolved = resolveSpecifier(file, specifier);

  if (resolved.startsWith(`${infrastructureDir}/`)) {
    return true;
  }

  if (resolved === domainIndexFile) {
    return true;
  }

  if (resolved === "server/db.ts" || resolved === "drizzle/schema.ts") {
    return true;
  }

  if (specifier === "drizzle-orm" || specifier.startsWith("drizzle-orm/")) {
    return true;
  }

  return false;
}

// Dependencias legítimas del mapping puro: sólo la propia capa y los TIPOS del
// shared kernel. Nada de DB ni runtime de Drizzle.
function isAllowedMappingDependency(file: string, specifier: string): boolean {
  const resolved = resolveSpecifier(file, specifier);

  if (resolved.startsWith(`${infrastructureDir}/`)) {
    return true;
  }

  if (resolved === "drizzle/schema.ts") {
    return true;
  }

  return false;
}

// 1 + 2 + 3: la capa existe con los tres módulos e implementación real (no
// stubs); el guard no puede pasar sobre una carpeta vacía.
test("Public Professionals infrastructure existe con mapping, repository y barrel de código real", () => {
  assert.equal(
    existsSync(join(repoRoot, infrastructureDir)),
    true,
    `${infrastructureDir} debe existir`,
  );

  const files = walkTsFiles(infrastructureDir);
  assert.ok(files.length > 0, `${infrastructureDir} debe contener al menos un .ts`);

  for (const requiredFile of [mappingFile, repositoryFile, rateLimitFile, barrelFile]) {
    assert.ok(files.includes(requiredFile), `${requiredFile} debe existir`);
  }

  const mappingSource = readText(mappingFile);
  assert.ok(
    mappingSource.length > 500,
    "el mapping debe contener código real, no un stub",
  );
  assert.match(
    mappingSource,
    /export function evaluateClinicPublicProfilePublication\(/,
    "el mapping debe contener la evaluación de publicación real",
  );

  const repositorySource = readText(repositoryFile);
  assert.ok(
    repositorySource.length > 500,
    "el repository debe contener código real, no un stub",
  );
  assert.match(
    repositorySource,
    /export async function searchPublicProfessionals\(/,
    "el repository debe contener la búsqueda real (no un re-export)",
  );
});

// 4: superficie pública exacta preservada por el split (valores + tipos).
test("El mapping y el repository conservan la superficie pública exacta medida en R0", () => {
  const mappingSource = readText(mappingFile);
  for (const name of MAPPING_VALUE_EXPORTS) {
    assert.match(
      mappingSource,
      new RegExp(`export (const|function) ${name}\\b`),
      `${mappingFile} debe exportar ${name}`,
    );
  }
  for (const name of MAPPING_TYPE_EXPORTS) {
    assert.match(
      mappingSource,
      new RegExp(`export type ${name}\\b`),
      `${mappingFile} debe exportar el tipo ${name}`,
    );
  }

  const repositorySource = readText(repositoryFile);
  for (const name of REPOSITORY_VALUE_EXPORTS) {
    assert.match(
      repositorySource,
      new RegExp(`export async function ${name}\\b`),
      `${repositoryFile} debe exportar ${name}`,
    );
  }
});

// 5: el barrel re-exporta ambos módulos y nada más (sin lógica).
test("El barrel de infrastructure re-exporta el mapping y el repository", () => {
  const targets = resolvedSpecifiers(barrelFile);

  assert.ok(targets.includes(mappingFile), `${barrelFile} debe re-exportar ${mappingFile}`);
  assert.ok(
    targets.includes(repositoryFile),
    `${barrelFile} debe re-exportar ${repositoryFile}`,
  );

  const codeLines = stripComments(readText(barrelFile))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  assert.deepEqual(
    codeLines,
    [
      'export * from "./public-professionals-mapping.ts";',
      'export * from "./public-professionals-repository.ts";',
    ],
    "el barrel debe ser sólo dos re-exports, sin lógica adicional",
  );
});

// 6: el repository importa el domain barrel (no archivos internos del dominio)
// y el mapping por path interno.
test("El repository importa el domain barrel y el mapping por path interno, sin tocar archivos internos del dominio", () => {
  const targets = resolvedSpecifiers(repositoryFile);

  assert.ok(
    targets.includes(domainIndexFile),
    `${repositoryFile} debe importar el domain barrel ${domainIndexFile}`,
  );
  assert.ok(
    targets.includes(mappingFile),
    `${repositoryFile} debe importar el mapping ${mappingFile}`,
  );

  const domainInternalImports = targets.filter(
    (resolved) =>
      resolved.startsWith(`${domainDir}/`) &&
      resolved.endsWith(".ts") &&
      resolved !== domainIndexFile,
  );

  assert.deepEqual(
    domainInternalImports,
    [],
    "el repository no debe importar archivos internos del dominio, sólo el barrel",
  );
});

// 7: el repository sólo importa dependencias justificadas.
test("El repository sólo importa dependencias justificadas por M22", () => {
  const violations: string[] = [];

  for (const specifier of listImportSpecifiers(readText(repositoryFile))) {
    if (!isAllowedRepositoryDependency(repositoryFile, specifier)) {
      violations.push(
        `${repositoryFile}: specifier no permitido ("${specifier}" -> ${resolveSpecifier(repositoryFile, specifier)}); permitidos: misma capa, domain barrel, server/db.ts, drizzle/schema.ts, drizzle-orm`,
      );
    }
  }

  assert.deepEqual(violations, []);
});

// 8: el repository no toca routes/http/application/auth/etc.
test("El repository no importa routes, application, fastify, auth ni server/lib", () => {
  const violations: string[] = [];

  for (const specifier of listImportSpecifiers(readText(repositoryFile))) {
    const resolved = resolveSpecifier(repositoryFile, specifier);
    for (const { label, pattern } of FORBIDDEN_TARGET_RULES) {
      if (pattern.test(resolved) || pattern.test(specifier)) {
        violations.push(`${repositoryFile}: ${label} ("${specifier}" -> ${resolved})`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 9: el mapping permanece puro (sin DB ni runtime de Drizzle).
test("El mapping sólo importa la propia capa y tipos del shared kernel (sin DB ni runtime de Drizzle)", () => {
  const violations: string[] = [];

  for (const specifier of listImportSpecifiers(readText(mappingFile))) {
    if (!isAllowedMappingDependency(mappingFile, specifier)) {
      violations.push(
        `${mappingFile}: specifier no permitido en mapping puro ("${specifier}" -> ${resolveSpecifier(mappingFile, specifier)}); permitidos: misma capa, drizzle/schema.ts (tipos)`,
      );
    }
  }

  // Refuerzo explícito: ni server/db, ni drizzle-orm runtime, ni fastify/routes/
  // application/auth/cors/env/supabase/server-lib.
  for (const specifier of listImportSpecifiers(readText(mappingFile))) {
    const resolved = resolveSpecifier(mappingFile, specifier);

    if (specifier === "drizzle-orm" || specifier.startsWith("drizzle-orm/")) {
      violations.push(`${mappingFile}: runtime de Drizzle en mapping puro ("${specifier}")`);
    }

    if (/(^|\/)(db|database)([./-][\w-]*)?$/i.test(resolved)) {
      violations.push(`${mappingFile}: import de persistencia en mapping puro ("${specifier}" -> ${resolved})`);
    }

    for (const { label, pattern } of FORBIDDEN_TARGET_RULES) {
      if (pattern.test(resolved) || pattern.test(specifier)) {
        violations.push(`${mappingFile}: ${label} ("${specifier}" -> ${resolved})`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 10: cero I/O de red / acceso a process en el mapping puro.
test("El mapping no usa process.* ni fetch (efectos prohibidos en lógica pura)", () => {
  const source = readText(mappingFile);

  assert.doesNotMatch(source, /\bprocess\.\w+/, "el mapping no debe tocar process.*");
  assert.doesNotMatch(source, /\bfetch\s*\(/, "el mapping no debe hacer I/O de red");
});

// 11: el SQL de elegibilidad y el mapping viven en UNA sola copia canónica.
test("No existe una segunda copia del SQL de elegibilidad ni del mapping fuera del canónico", () => {
  const serverFiles = walkTsFiles("server");

  for (const constantName of SQL_CONSTANT_NAMES) {
    const declarers = serverFiles.filter((file) =>
      readText(file).includes(`const ${constantName} =`),
    );
    assert.deepEqual(
      declarers,
      [repositoryFile],
      `${constantName} debe declararse sólo en ${repositoryFile}`,
    );
  }

  const evaluators = serverFiles.filter((file) =>
    readText(file).includes("export function evaluateClinicPublicProfilePublication("),
  );
  assert.deepEqual(
    evaluators,
    [mappingFile],
    `evaluateClinicPublicProfilePublication debe definirse sólo en ${mappingFile}`,
  );
});

// 12: el repository conserva CERO transacciones (invariante R0).
test("El repository conserva cero transacciones (invariante R0)", () => {
  const transactions = readText(repositoryFile).match(/\.transaction\(/g) ?? [];

  assert.equal(
    transactions.length,
    R0_TRANSACTION_CALL_SITES,
    `${repositoryFile} debe conservar ${R0_TRANSACTION_CALL_SITES} call-sites .transaction( medidos en R0`,
  );
});

// M24: las constantes de rate limit viven únicamente en infrastructure.
test("El rate limit público vive únicamente en infrastructure", () => {
  const source = readText(rateLimitFile);

  for (const name of [
    "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS",
    "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS",
    "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE",
    "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS",
    "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS",
    "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE",
  ]) {
    assert.ok(
      source.includes(`export const ${name}`),
      `${rateLimitFile} debe exportar ${name}`,
    );
  }

  assert.deepEqual(
    listImportSpecifiers(source),
    [],
    "el wrapper de rate limit no debe importar el store ni transporte HTTP",
  );

  assert.equal(
    existsSync(join(repoRoot, legacyRateLimitShimFile)),
    false,
    `${legacyRateLimitShimFile} debe permanecer eliminado después del cierre M24`,
  );
});
// 13: M24 retira el shim DB y bloquea su recreación.
test("M24 retira el path legacy server/db-public-professionals.ts", () => {
  assert.equal(
    existsSync(join(repoRoot, legacyShimFile)),
    false,
    `${legacyShimFile} debe permanecer eliminado después del cierre M24`,
  );
});
// 14: ningún archivo runtime puede resolver hacia los paths retirados.
test("M24 impide imports runtime hacia los paths legacy retirados", () => {
  const retiredPaths = new Set([
    legacyShimFile,
    legacyRateLimitShimFile,
  ]);
  const violations: string[] = [];

  for (const file of walkTsFiles("server")) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);

      if (retiredPaths.has(resolved)) {
        violations.push(
          `${file}: import al path legacy retirado ("${specifier}" -> ${resolved})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 16: M24 conserva el query service directo y la topología proporcional.
test("M24 conserva query service directo, sin application ni shims", () => {
  assert.equal(
    existsSync(join(repoRoot, queryServiceFile)),
    true,
    `${queryServiceFile} debe existir`,
  );

  assert.equal(
    existsSync(join(repoRoot, `${featureDir}/application`)),
    false,
    "Public Professionals no debe crear una capa application",
  );

  assert.equal(
    existsSync(join(repoRoot, legacyShimFile)),
    false,
    "el path DB legacy debe permanecer eliminado",
  );

  assert.equal(
    existsSync(join(repoRoot, legacyRateLimitShimFile)),
    false,
    "el path legacy de rate limit debe permanecer eliminado",
  );
});
// 17: el parser de imports del guard reconoce las cuatro formas de specifier.
test("El parser de imports del guard reconoce las cuatro formas de specifier", () => {
  assert.deepEqual(
    listImportSpecifiers(
      [
        `import { a } from "./from.ts";`,
        `const b = require("./require.ts");`,
        `const c = await import("./dynamic.ts");`,
        `import "./side-effect.ts";`,
      ].join("\n"),
    ),
    ["./from.ts", "./require.ts", "./dynamic.ts", "./side-effect.ts"],
  );

  assert.equal(isAllowedRepositoryDependency(repositoryFile, "fastify"), false);
  assert.equal(isAllowedRepositoryDependency(repositoryFile, "../domain/index.ts"), true);
  assert.equal(isAllowedRepositoryDependency(repositoryFile, "drizzle-orm"), true);
  assert.equal(isAllowedRepositoryDependency(repositoryFile, "../../../db.ts"), true);
  assert.equal(
    isAllowedRepositoryDependency(repositoryFile, "../../../../drizzle/schema.ts"),
    true,
  );

  assert.equal(isAllowedMappingDependency(mappingFile, "drizzle-orm"), false);
  assert.equal(isAllowedMappingDependency(mappingFile, "../../../db.ts"), false);
  assert.equal(
    isAllowedMappingDependency(mappingFile, "../../../../drizzle/schema.ts"),
    true,
  );
});
