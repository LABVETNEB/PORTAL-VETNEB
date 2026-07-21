import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Guard de frontera de la capa infrastructure de Logistics (M12, Fase C).
// Clona el mecanismo ya validado por `logistics-domain-boundary-guard.test.ts` y
// `logistics-application-boundary-guard.test.ts`: node:test + lectura de fuente
// + parser de imports, sin dependencias nuevas, sin spawn y sin invocar PNPM.
//
// AUTO-DESCUBRE el directorio completo: cualquier archivo futuro de la capa
// queda cubierto sin registrarlo a mano (no hay lista cerrada de archivos).

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const infrastructureDir = "server/features/logistics/infrastructure";
const canonicalDbFile = `${infrastructureDir}/db-logistics.ts`;
const slaBreachAdapterFile = `${infrastructureDir}/sla-breach-db.ts`;
const domainDir = "server/features/logistics/domain";
const domainIndexFile = `${domainDir}/index.ts`;
const rootShimFile = "server/db-logistics.ts";
const canonicalSpecifierFromRoot =
  "./features/logistics/infrastructure/db-logistics.ts";
const canonicalCacheFile = `${infrastructureDir}/logistics-route-plans-cache.ts`;
const cacheAdapterFile = `${infrastructureDir}/logistics-route-plans-cache-adapter.ts`;
const dbAdapterFile = `${infrastructureDir}/logistics-route-plans-db-adapter.ts`;
const fieldVisitsDbAdapterFile = `${infrastructureDir}/logistics-field-visits-db-adapter.ts`;
const retiredCacheShimFile = "server/lib/logistics-route-plans-cache.ts";

// Superficie de persistencia de field visits consumida por la ruta thin (M15):
// exactamente las siete operaciones canónicas con call-site real.
const FIELD_VISITS_ADAPTER_OPERATIONS = [
  "createFieldVisit",
  "listClinicFieldVisits",
  "updateClinicScopedFieldVisit",
  "getVisitLocationForClinicVisit",
  "upsertVisitLocationForClinicVisit",
  "createTimeWindowForClinicVisit",
  "listTimeWindowsForClinicVisit",
] as const;

// Baseline R0 medido en HEAD 101731d, antes del move: `server/db-logistics.ts`
// contenía exactamente 7 call-sites `db.transaction(`. M12 prohíbe
// reparticionar transacciones, así que la cifra es un invariante del move.
const R0_TRANSACTION_CALL_SITES = 7;

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function toRepoRelativePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function walkTsFiles(relativeDir: string): string[] {
  const absoluteDir = join(repoRoot, relativeDir);
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

// Dependencias legítimas de infrastructure según ARCH-2: implementa puertos
// sobre el motor de persistencia real. Por eso `drizzle-orm`, `server/db.ts` y
// `drizzle/schema.ts` NO se prohíben aquí (a diferencia de domain/application).
function isAllowedDependency(file: string, specifier: string): boolean {
  const resolved = resolveSpecifier(file, specifier);

  // Archivos relativos de la misma capa.
  if (resolved.startsWith(`${infrastructureDir}/`)) {
    return true;
  }

  // Barrel público del dominio del propio contexto.
  if (resolved === domainIndexFile) {
    return true;
  }

  // Motor de persistencia y shared kernel de tipos.
  if (resolved === "server/db.ts" || resolved === "drizzle/schema.ts") {
    return true;
  }

  // Runtime de Drizzle.
  if (specifier === "drizzle-orm" || specifier.startsWith("drizzle-orm/")) {
    return true;
  }

  return false;
}

const FORBIDDEN_TARGET_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "import de fastify", pattern: /^fastify(\/|$)/ },
  { label: "import hacia server/routes", pattern: /^server\/routes(\/|$)/ },
  {
    label: "import hacia la capa routes del contexto",
    pattern: /(^|\/)features\/logistics\/routes(\/|$)/,
  },
  {
    label: "import hacia la capa application (invierte la dirección)",
    pattern: /(^|\/)application(\/|$)/,
  },
  { label: "import hacia frontend", pattern: /(^|\/)frontend(\/|$)/ },
  {
    label: "import de auth/session/CORS/audit/email concretos",
    pattern: /(^|\/)(auth|session|sessions|cors|audit|email|mailer)([./-][\w-]*)?$/i,
  },
  { label: "import hacia server/lib", pattern: /^server\/lib(\/|$)/ },
];

test("Logistics infrastructure existe y contiene código", () => {
  assert.equal(
    existsSync(join(repoRoot, infrastructureDir)),
    true,
    `${infrastructureDir} debe existir`,
  );

  const files = walkTsFiles(infrastructureDir);

  assert.ok(
    files.length > 0,
    `${infrastructureDir} debe contener al menos un archivo .ts para que el guard proteja algo`,
  );

  // El guard no pasa en vacío: el archivo canónico del move de M12 debe existir
  // y contener implementación real, no un re-export.
  assert.ok(
    files.includes(canonicalDbFile),
    `${canonicalDbFile} debe existir tras el move de M12`,
  );

  const canonicalSource = readText(canonicalDbFile);
  assert.match(
    canonicalSource,
    /export async function \w+/,
    `${canonicalDbFile} debe contener la implementación real`,
  );
});

test("Logistics infrastructure sólo importa dependencias justificadas por M12", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      if (!isAllowedDependency(file, specifier)) {
        violations.push(
          `${file}: specifier no permitido en infrastructure ("${specifier}" -> ${resolveSpecifier(file, specifier)}); permitidos: misma capa, ${domainIndexFile}, server/db.ts, drizzle/schema.ts, drizzle-orm`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Logistics infrastructure no importa fastify, routes, application, frontend, auth ni server/lib", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);

      for (const { label, pattern } of FORBIDDEN_TARGET_RULES) {
        if (pattern.test(resolved) || pattern.test(specifier)) {
          violations.push(
            `${file}: ${label} ("${specifier}" -> ${resolved})`,
          );
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Logistics infrastructure consume el dominio sólo por su barrel público", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);

      if (resolved.startsWith(`${domainDir}/`) && resolved !== domainIndexFile) {
        violations.push(
          `${file}: import directo a archivo interno de domain ("${specifier}" -> ${resolved}); usar ${domainIndexFile}`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Ningún archivo de Logistics infrastructure importa el shim raíz server/db-logistics.ts", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      if (resolveSpecifier(file, specifier) === rootShimFile) {
        violations.push(
          `${file}: import al shim raíz ("${specifier}" -> ${rootShimFile}); usar ${canonicalDbFile}`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("sla-breach-db.ts consume el archivo canónico de su propia capa", () => {
  const source = readText(slaBreachAdapterFile);
  const resolvedSpecifiers = listImportSpecifiers(source).map((specifier) =>
    resolveSpecifier(slaBreachAdapterFile, specifier),
  );

  assert.ok(
    resolvedSpecifiers.includes(canonicalDbFile),
    `${slaBreachAdapterFile} debe importar ${canonicalDbFile}`,
  );

  // Import lazy preservado.
  assert.match(
    source,
    /await\s+import\(\s*"\.\/db-logistics\.ts"\s*\)/,
    `${slaBreachAdapterFile} debe conservar la carga dinámica (lazy) del helper de breach`,
  );
});

test("El shim raíz existe y sólo re-exporta la implementación canónica", () => {
  assert.equal(
    existsSync(join(repoRoot, rootShimFile)),
    true,
    `${rootShimFile} debe existir mientras las rutas legacy lo importen (hasta M14–M16)`,
  );

  const shimSource = readText(rootShimFile);
  const specifiers = listImportSpecifiers(shimSource);

  assert.ok(
    specifiers.length > 0,
    `${rootShimFile} debe re-exportar la superficie pública`,
  );

  const offending = specifiers.filter(
    (specifier) => specifier !== canonicalSpecifierFromRoot,
  );

  assert.deepEqual(
    offending,
    [],
    `${rootShimFile} sólo puede referenciar ${canonicalSpecifierFromRoot}`,
  );

  assert.match(
    shimSource,
    /export \* from "\.\/features\/logistics\/infrastructure\/db-logistics\.ts";/,
    `${rootShimFile} debe re-exportar toda la superficie con export *`,
  );

  assert.doesNotMatch(
    shimSource,
    /^export\s+(async\s+)?function\b/m,
    `${rootShimFile} no puede declarar funciones`,
  );
});

// --- M13: cache adapter de route plans movido a infrastructure ---

test("El cache canónico de M13 existe y es un módulo puro sin imports", () => {
  assert.equal(
    existsSync(join(repoRoot, canonicalCacheFile)),
    true,
    `${canonicalCacheFile} debe existir tras el move de M13`,
  );

  const source = readText(canonicalCacheFile);

  // Implementación real, no un re-export.
  assert.match(
    source,
    /^export function \w+/m,
    `${canonicalCacheFile} debe contener la implementación real del cache`,
  );

  // Invariante de pureza: el cache es in-memory puro. Cero specifiers de
  // import (estático, dinámico o require) impide cablearle Redis, DB,
  // Fastify o server/lib a futuro sin pasar por revisión de arquitectura.
  assert.deepEqual(
    listImportSpecifiers(source),
    [],
    `${canonicalCacheFile} debe tener cero imports (módulo in-memory puro)`,
  );
});

// --- M14: shim legacy del cache retirado y adapter del puerto de cache ---

test("El shim legacy del cache fue retirado en M14 y ningún módulo lo referencia", () => {
  assert.equal(
    existsSync(join(repoRoot, retiredCacheShimFile)),
    false,
    `${retiredCacheShimFile} fue retirado en M14 (la ruta consume el puerto de cache vía application); no debe recrearse`,
  );

  const violations: string[] = [];

  for (const scanDir of [infrastructureDir, "server/routes"]) {
    for (const file of walkTsFiles(scanDir)) {
      for (const specifier of listImportSpecifiers(readText(file))) {
        if (resolveSpecifier(file, specifier) === retiredCacheShimFile) {
          violations.push(
            `${file}: import al shim retirado del cache ("${specifier}" -> ${retiredCacheShimFile})`,
          );
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("El adapter del puerto de cache (M14) compone el cache canónico sin reescribirlo", () => {
  assert.equal(
    existsSync(join(repoRoot, cacheAdapterFile)),
    true,
    `${cacheAdapterFile} debe existir tras M14 (implementación del puerto de cache de application)`,
  );

  const source = readText(cacheAdapterFile);

  // Implementación real del puerto (factory), no un re-export.
  assert.match(
    source,
    /^export function createLogisticsRoutePlansCacheAdapter\b/m,
    `${cacheAdapterFile} debe exportar la factory del adapter`,
  );

  // Composición mínima: el adapter sólo importa el cache canónico de su capa.
  const specifiers = listImportSpecifiers(source);

  assert.deepEqual(
    specifiers.map((specifier) => resolveSpecifier(cacheAdapterFile, specifier)),
    [canonicalCacheFile],
    `${cacheAdapterFile} sólo puede importar ${canonicalCacheFile}`,
  );

  // El adapter no re-implementa el cache: sin Maps propios ni TTL propio.
  assert.doesNotMatch(
    source,
    /new\s+Map\s*[<(]/,
    `${cacheAdapterFile} no puede declarar Maps propios (el estado vive en el cache canónico)`,
  );
});

test("La ruta de route plans no importa los canónicos de infraestructura directamente (sólo los adapters)", () => {
  const routeFile = "server/routes/logistics-route-plans.fastify.ts";
  const routeSource = readText(routeFile);
  const violations: string[] = [];

  for (const specifier of listImportSpecifiers(routeSource)) {
    const resolved = resolveSpecifier(routeFile, specifier);

    if (resolved === canonicalCacheFile) {
      violations.push(
        `${routeFile}: import directo al cache canónico ("${specifier}"); usar el puerto de application y el adapter ${cacheAdapterFile}`,
      );
    }

    if (resolved === canonicalDbFile || resolved === rootShimFile) {
      violations.push(
        `${routeFile}: import de db-logistics ("${specifier}"); usar el adapter ${dbAdapterFile}`,
      );
    }
  }

  // Refuerzo textual M14: ni siquiera referencias type-only o en comentarios al
  // módulo db-logistics dentro de la ruta thin.
  assert.doesNotMatch(
    routeSource,
    /db-logistics/,
    `${routeFile} no puede contener ninguna referencia textual a db-logistics`,
  );

  assert.deepEqual(violations, []);
});

test("El adapter DB de route plans (M14) compone el canónico de su capa sin reescribirlo", () => {
  assert.equal(
    existsSync(join(repoRoot, dbAdapterFile)),
    true,
    `${dbAdapterFile} debe existir tras M14 (superficie DB consumida por la ruta thin)`,
  );

  const source = readText(dbAdapterFile);

  assert.match(
    source,
    /^export function createLogisticsRoutePlansDbAdapter\b/m,
    `${dbAdapterFile} debe exportar la factory del adapter DB`,
  );

  // Composición mínima: sólo importa el DB canónico de su propia capa.
  const specifiers = listImportSpecifiers(source);

  assert.deepEqual(
    Array.from(
      new Set(
        specifiers.map((specifier) => resolveSpecifier(dbAdapterFile, specifier)),
      ),
    ),
    [canonicalDbFile],
    `${dbAdapterFile} sólo puede importar ${canonicalDbFile}`,
  );

  // No re-implementa persistencia: sin Drizzle, sin transacciones propias.
  assert.doesNotMatch(
    source,
    /db\.transaction\(|drizzle-orm/,
    `${dbAdapterFile} no puede contener queries ni transacciones propias`,
  );
});

// --- M15: adapter DB de field visits y ruta thin ---

test("El adapter DB de field visits (M15) compone el canónico de su capa sin reescribirlo", () => {
  assert.equal(
    existsSync(join(repoRoot, fieldVisitsDbAdapterFile)),
    true,
    `${fieldVisitsDbAdapterFile} debe existir tras M15 (superficie DB consumida por la ruta thin)`,
  );

  const source = readText(fieldVisitsDbAdapterFile);

  assert.match(
    source,
    /^export function createLogisticsFieldVisitsDbAdapter\b/m,
    `${fieldVisitsDbAdapterFile} debe exportar la factory del adapter DB`,
  );

  // Composición mínima: sólo importa el DB canónico de su propia capa.
  const specifiers = listImportSpecifiers(source);

  assert.deepEqual(
    Array.from(
      new Set(
        specifiers.map((specifier) =>
          resolveSpecifier(fieldVisitsDbAdapterFile, specifier),
        ),
      ),
    ),
    [canonicalDbFile],
    `${fieldVisitsDbAdapterFile} sólo puede importar ${canonicalDbFile}`,
  );

  // No re-implementa persistencia: sin Drizzle, sin transacciones propias.
  assert.doesNotMatch(
    source,
    /db\.transaction\(|drizzle-orm/,
    `${fieldVisitsDbAdapterFile} no puede contener queries ni transacciones propias`,
  );

  // Expone exactamente la superficie field-visits esperada: las siete
  // operaciones canónicas, cada una como referencia directa dentro de la
  // factory, sin operaciones extra.
  const factoryBody = source.match(
    /export function createLogisticsFieldVisitsDbAdapter\(\) \{\s*return \{([\s\S]*?)\};\s*\}/,
  );
  assert.ok(
    factoryBody,
    `${fieldVisitsDbAdapterFile} debe retornar un objeto literal de referencias directas`,
  );

  const returnedOperations = (factoryBody?.[1] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort();

  assert.deepEqual(
    returnedOperations,
    [...FIELD_VISITS_ADAPTER_OPERATIONS].sort(),
    `${fieldVisitsDbAdapterFile} debe exponer exactamente las siete operaciones de field visits como referencias directas (sin wrappers)`,
  );
});

test("La ruta de field visits no importa canónicos de infraestructura ni referencia db-logistics (M15)", () => {
  const routeFile = "server/routes/logistics-field-visits.fastify.ts";
  const routeSource = readText(routeFile);
  const violations: string[] = [];

  for (const specifier of listImportSpecifiers(routeSource)) {
    const resolved = resolveSpecifier(routeFile, specifier);

    if (resolved === canonicalDbFile || resolved === rootShimFile) {
      violations.push(
        `${routeFile}: import de db-logistics ("${specifier}"); usar el adapter ${fieldVisitsDbAdapterFile}`,
      );
    }
  }

  // Refuerzo textual M15: ni siquiera referencias type-only o en comentarios al
  // módulo db-logistics dentro de la ruta thin.
  assert.doesNotMatch(
    routeSource,
    /db-logistics/,
    `${routeFile} no puede contener ninguna referencia textual a db-logistics`,
  );

  assert.deepEqual(violations, []);
});

test("El move de M12 conserva exactamente los call-sites transaccionales del baseline R0", () => {
  const canonicalTransactions =
    readText(canonicalDbFile).match(/db\.transaction\(/g) ?? [];

  assert.equal(
    canonicalTransactions.length,
    R0_TRANSACTION_CALL_SITES,
    `${canonicalDbFile} debe conservar ${R0_TRANSACTION_CALL_SITES} call-sites db.transaction( medidos en R0; reparticionar transacciones está prohibido en M12`,
  );
});

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

  // La regla de dependencias permitidas rechaza un specifier prohibido real.
  assert.equal(isAllowedDependency(canonicalDbFile, "fastify"), false);
  assert.equal(
    isAllowedDependency(canonicalDbFile, "../application/index.ts"),
    false,
  );
  assert.equal(isAllowedDependency(canonicalDbFile, "drizzle-orm"), true);
  assert.equal(isAllowedDependency(canonicalDbFile, "../../../db.ts"), true);
  assert.equal(isAllowedDependency(canonicalDbFile, "../domain/index.ts"), true);
});
