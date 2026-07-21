import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Guard de frontera de la capa infrastructure de Pricing (M18, Fase D).
// Clona el mecanismo ya validado por los guards de Logistics: node:test +
// lectura de fuente + parser de imports, sin dependencias nuevas, sin spawn y
// sin invocar PNPM.
//
// AUTO-DESCUBRE el directorio completo: cualquier archivo futuro de la capa
// queda cubierto sin registrarlo a mano (no hay lista cerrada de archivos).
//
// A diferencia de M17 (Logistics, shim retirado), M18 CONSERVA los shims de
// compatibilidad hasta M19; el guard fija que siguen siendo sólo re-exports y
// que ningún archivo canónico los consume.

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const infrastructureDir = "server/features/pricing/infrastructure";
const canonicalDbFile = `${infrastructureDir}/db-pricing.ts`;
const canonicalCacheFile = `${infrastructureDir}/public-pricing-cache.ts`;
const dbShimFile = "server/db-pricing.ts";
const cacheShimFile = "server/lib/public-pricing-cache.ts";

// Superficie pública canónica del acceso a datos de Pricing medida en R0
// (HEAD 877185f, antes del move). Las tres operaciones públicas + los dos tipos
// exportados. El move no adelgaza ni renombra exports.
const DB_PUBLIC_VALUE_EXPORTS = [
  "listPublicPricingItems",
  "listAdminPricingItems",
  "updatePricingItem",
] as const;

const DB_PUBLIC_TYPE_EXPORTS = ["PricingItem", "UpdatePricingItemInput"] as const;

// Superficie pública canónica del cache medida en R0: tres operaciones + tres
// tipos de snapshot. El TTL es un invariante del move.
const CACHE_PUBLIC_VALUE_EXPORTS = [
  "getCachedPublicPricingSnapshot",
  "setCachedPublicPricingSnapshot",
  "clearPublicPricingCache",
] as const;

const CACHE_PUBLIC_TYPE_EXPORTS = [
  "PublicPricingSnapshotItem",
  "PublicPricingSnapshotCategory",
  "PublicPricingSnapshot",
] as const;

// R0: `db-pricing.ts` (160 LOC) contiene exactamente CERO call-sites
// `.transaction(`. Pricing no tiene reglas de dominio ni escrituras
// transaccionales; el move no puede introducir ninguna.
const R0_TRANSACTION_CALL_SITES = 0;

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

// Dependencias legítimas de infrastructure (ARCH-2): implementa persistencia y
// cache sobre el motor real. Por eso `drizzle-orm`, `server/db.ts` y
// `drizzle/schema.ts` NO se prohíben aquí. Pricing no tiene domain ni
// application, así que la única capa permitida es la propia.
function isAllowedDependency(file: string, specifier: string): boolean {
  const resolved = resolveSpecifier(file, specifier);

  // Archivos relativos de la misma capa.
  if (resolved.startsWith(`${infrastructureDir}/`)) {
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
    label: "import hacia una capa application",
    pattern: /(^|\/)application(\/|$)/,
  },
  { label: "import hacia frontend", pattern: /(^|\/)frontend(\/|$)/ },
  {
    label: "import de auth/session/CORS/audit/email concretos",
    pattern: /(^|\/)(auth|session|sessions|cors|audit|email|mailer)([./-][\w-]*)?$/i,
  },
  { label: "import hacia server/lib", pattern: /^server\/lib(\/|$)/ },
];

// 1 + 12: La capa existe, contiene implementación real y el guard no puede
// pasar con una carpeta vacía.
test("Pricing infrastructure existe y contiene implementación real (no pasa en vacío)", () => {
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

  // 2: El archivo canónico DB existe con implementación real (no un re-export).
  assert.ok(
    files.includes(canonicalDbFile),
    `${canonicalDbFile} debe existir tras el move de M18`,
  );
  assert.match(
    readText(canonicalDbFile),
    /export async function \w+/,
    `${canonicalDbFile} debe contener la implementación real (no un re-export)`,
  );

  // 3: El cache canónico existe con implementación real.
  assert.ok(
    files.includes(canonicalCacheFile),
    `${canonicalCacheFile} debe existir tras el move de M18`,
  );
  assert.match(
    readText(canonicalCacheFile),
    /^export function \w+/m,
    `${canonicalCacheFile} debe contener la implementación real del cache`,
  );
});

// 3: El cache canónico conserva CERO imports (módulo in-memory puro).
test("El cache canónico conserva cero imports (módulo in-memory puro)", () => {
  assert.deepEqual(
    listImportSpecifiers(readText(canonicalCacheFile)),
    [],
    `${canonicalCacheFile} debe tener cero imports para impedir cablearle Redis/DB/timers sin revisión`,
  );
});

// 4: Infrastructure sólo usa dependencias legítimas.
test("Pricing infrastructure sólo importa dependencias justificadas por M18", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      if (!isAllowedDependency(file, specifier)) {
        violations.push(
          `${file}: specifier no permitido en infrastructure ("${specifier}" -> ${resolveSpecifier(file, specifier)}); permitidos: misma capa, server/db.ts, drizzle/schema.ts, drizzle-orm`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 5: Prohibidos fastify, routes, application, frontend, auth, sesiones, CORS,
// audit, email y server/lib.
test("Pricing infrastructure no importa fastify, routes, application, frontend, auth, audit ni server/lib", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);

      for (const { label, pattern } of FORBIDDEN_TARGET_RULES) {
        if (pattern.test(resolved) || pattern.test(specifier)) {
          violations.push(`${file}: ${label} ("${specifier}" -> ${resolved})`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 5 (refuerzo) + 8: Ningún archivo canónico consume los shims legacy.
test("Ningún archivo canónico de Pricing infrastructure importa los shims legacy", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved === dbShimFile || resolved === cacheShimFile) {
        violations.push(
          `${file}: import a un shim legacy ("${specifier}" -> ${resolved}); la capa canónica no puede depender de sus shims`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 6: `server/db-pricing.ts` es solamente un shim (un único re-export, sin
// imports de runtime, sin funciones, sin Drizzle, sin default export).
test("server/db-pricing.ts es solamente un shim de re-export hacia el canónico", () => {
  assert.equal(
    existsSync(join(repoRoot, dbShimFile)),
    true,
    `${dbShimFile} debe existir como shim de compatibilidad hasta M19`,
  );

  const source = readText(dbShimFile);
  const specifiers = listImportSpecifiers(source);

  assert.deepEqual(
    specifiers.map((specifier) => resolveSpecifier(dbShimFile, specifier)),
    [canonicalDbFile],
    `${dbShimFile} sólo puede re-exportar ${canonicalDbFile}`,
  );

  assert.match(
    source,
    /^export \* from "\.\/features\/pricing\/infrastructure\/db-pricing\.ts";$/m,
    `${dbShimFile} debe usar un único 'export *' hacia el canónico`,
  );

  // Sin lógica propia: ni funciones, ni Drizzle, ni default export.
  assert.doesNotMatch(
    source,
    /\bfunction\b|=>|\bdrizzle-orm\b|\bdb\.select\b|\bexport default\b/,
    `${dbShimFile} no puede contener funciones, Drizzle, queries ni default export`,
  );
});

// 7: `server/lib/public-pricing-cache.ts` es solamente un shim.
test("server/lib/public-pricing-cache.ts es solamente un shim de re-export hacia el canónico", () => {
  assert.equal(
    existsSync(join(repoRoot, cacheShimFile)),
    true,
    `${cacheShimFile} debe existir como shim de compatibilidad hasta M19`,
  );

  const source = readText(cacheShimFile);
  const specifiers = listImportSpecifiers(source);

  assert.deepEqual(
    specifiers.map((specifier) => resolveSpecifier(cacheShimFile, specifier)),
    [canonicalCacheFile],
    `${cacheShimFile} sólo puede re-exportar ${canonicalCacheFile}`,
  );

  assert.match(
    source,
    /^export \* from "\.\.\/features\/pricing\/infrastructure\/public-pricing-cache\.ts";$/m,
    `${cacheShimFile} debe usar un único 'export *' hacia el canónico`,
  );

  assert.doesNotMatch(
    source,
    /\bfunction\b|=>|\bexport default\b|\blet\b|\bconst \w+ =/,
    `${cacheShimFile} no puede contener funciones, estado module-level ni default export`,
  );
});

// 9: El DB canónico conserva la superficie pública exacta (valores + tipos).
test("El DB canónico conserva la superficie pública exacta medida en R0", () => {
  const source = readText(canonicalDbFile);

  for (const name of DB_PUBLIC_VALUE_EXPORTS) {
    assert.match(
      source,
      new RegExp(`export async function ${name}\\b`),
      `${canonicalDbFile} debe exportar la función ${name}`,
    );
  }

  for (const name of DB_PUBLIC_TYPE_EXPORTS) {
    assert.match(
      source,
      new RegExp(`export type ${name}\\b`),
      `${canonicalDbFile} debe exportar el tipo ${name}`,
    );
  }

  // Serialización de updatedAt como ISO string y normalización de priceLabel a
  // null: invariantes del serializer que el move no puede alterar.
  assert.match(
    source,
    /updatedAt: row\.updatedAt\.toISOString\(\)/,
    `${canonicalDbFile} debe conservar la serialización ISO de updatedAt`,
  );
  assert.match(
    source,
    /priceLabel: row\.priceLabel \?\? null/,
    `${canonicalDbFile} debe conservar la normalización de priceLabel a null`,
  );
});

// 10: El DB canónico conserva CERO transacciones.
test("El DB canónico conserva cero transacciones (invariante R0)", () => {
  const transactions =
    readText(canonicalDbFile).match(/\.transaction\(/g) ?? [];

  assert.equal(
    transactions.length,
    R0_TRANSACTION_CALL_SITES,
    `${canonicalDbFile} debe conservar ${R0_TRANSACTION_CALL_SITES} call-sites .transaction( medidos en R0`,
  );
});

// 11: El cache conserva TTL, exports y semántica exactos.
test("El cache canónico conserva TTL de 5 minutos, exports y semántica de expiración", () => {
  const source = readText(canonicalCacheFile);

  // TTL exacto: cinco minutos.
  assert.match(
    source,
    /const PUBLIC_PRICING_CACHE_TTL_MS = 5 \* 60 \* 1000;/,
    `${canonicalCacheFile} debe conservar el TTL exacto de 5 minutos`,
  );

  // Superficie pública: tres operaciones + tres tipos de snapshot.
  for (const name of CACHE_PUBLIC_VALUE_EXPORTS) {
    assert.match(
      source,
      new RegExp(`export function ${name}\\b`),
      `${canonicalCacheFile} debe exportar la función ${name}`,
    );
  }

  for (const name of CACHE_PUBLIC_TYPE_EXPORTS) {
    assert.match(
      source,
      new RegExp(`export type ${name}\\b`),
      `${canonicalCacheFile} debe exportar el tipo ${name}`,
    );
  }

  // Expiración lazy (<=) y default Date.now() en lectura/escritura.
  assert.match(
    source,
    /if \(cacheEntry\.expiresAt <= now\)/,
    `${canonicalCacheFile} debe conservar la expiración lazy (<=)`,
  );
  assert.match(
    source,
    /now: number = Date\.now\(\)/,
    `${canonicalCacheFile} debe conservar el default Date.now() en get/set`,
  );
  assert.match(
    source,
    /expiresAt: now \+ PUBLIC_PRICING_CACHE_TTL_MS/,
    `${canonicalCacheFile} debe fijar expiresAt = now + TTL`,
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

  // La regla de dependencias permitidas rechaza specifiers prohibidos reales y
  // acepta los legítimos de infrastructure.
  assert.equal(isAllowedDependency(canonicalDbFile, "fastify"), false);
  assert.equal(isAllowedDependency(canonicalDbFile, "../../../lib/audit.ts"), false);
  assert.equal(isAllowedDependency(canonicalDbFile, "drizzle-orm"), true);
  assert.equal(isAllowedDependency(canonicalDbFile, "../../../db.ts"), true);
  assert.equal(
    isAllowedDependency(canonicalDbFile, "../../../../drizzle/schema.ts"),
    true,
  );
});
