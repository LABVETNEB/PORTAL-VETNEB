import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Guard de frontera del contexto Pricing (M18 infra + M19 thin routes, Fase D).
// Clona el mecanismo ya validado por los guards de Logistics: node:test +
// lectura de fuente + parser de imports, sin dependencias nuevas, sin spawn y
// sin invocar PNPM.
//
// AUTO-DESCUBRE el directorio infrastructure completo: cualquier archivo futuro
// de la capa queda cubierto sin registrarlo a mano (no hay lista cerrada).
//
// M18 estableció la infraestructura canónica y CONSERVÓ dos shims de
// compatibilidad. M19 adelgaza las rutas (route -> servicio directo -> canónico)
// y RETIRA ambos shims: el guard fija que los paths legacy ya no existen, que
// ningún consumidor productivo ni test operativo los resuelve, que los servicios
// directos no conocen HTTP/auth/CORS/audit y que las rutas delegan en el servicio
// sin importar los canónicos DB/cache directamente.

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const featureDir = "server/features/pricing";
const infrastructureDir = `${featureDir}/infrastructure`;
const canonicalDbFile = `${infrastructureDir}/db-pricing.ts`;
const canonicalCacheFile = `${infrastructureDir}/public-pricing-cache.ts`;
const publicServiceFile = `${featureDir}/public-pricing-service.ts`;
const adminServiceFile = `${featureDir}/admin-pricing-service.ts`;
const serviceFiles = [adminServiceFile, publicServiceFile] as const;

const adminRouteFile = "server/routes/admin-pricing.fastify.ts";
const publicRouteFile = "server/routes/public-pricing.fastify.ts";
const routeFiles = [adminRouteFile, publicRouteFile] as const;

// Paths legacy retirados en M19. La comprobación es por PATH RESUELTO, nunca por
// texto: el canónico conserva el nombre `db-pricing.ts` en su propia capa, así
// que un import relativo `./db-pricing.ts` dentro de infrastructure resuelve al
// canónico (path distinto) y no puede confundirse con el shim retirado.
const dbShimFile = "server/db-pricing.ts";
const cacheShimFile = "server/lib/public-pricing-cache.ts";

// Los tres contratos globales que consumían `clearPublicPricingCache` del shim de
// cache hasta M18; M19 los realinea al canónico. El guard fija que ninguno vuelve
// a resolver al path retirado (verificación por path, no por escaneo textual de
// test/, que contiene el string como dato de prueba en otros archivos).
const CACHE_SHIM_RESET_CONSUMER_TESTS = [
  "test/integration/adapters/controllers/api-error-content-type-contract.test.ts",
  "test/integration/adapters/controllers/api-request-id-observability-contract.test.ts",
  "test/integration/adapters/controllers/global-public-surface-hardening-contract.test.ts",
] as const;

// Superficie pública canónica del acceso a datos de Pricing medida en R0
// (HEAD 877185f, antes del move). Las tres operaciones públicas + los dos tipos
// exportados. Ni el move de M18 ni el adelgazamiento de M19 la alteran.
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
// transaccionales; ni el move ni el thinning pueden introducir ninguna.
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
function isAllowedInfrastructureDependency(file: string, specifier: string): boolean {
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

  // El archivo canónico DB existe con implementación real (no un re-export).
  assert.ok(
    files.includes(canonicalDbFile),
    `${canonicalDbFile} debe existir tras el move de M18`,
  );
  assert.match(
    readText(canonicalDbFile),
    /export async function \w+/,
    `${canonicalDbFile} debe contener la implementación real (no un re-export)`,
  );

  // El cache canónico existe con implementación real.
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

// El cache canónico conserva CERO imports (módulo in-memory puro).
test("El cache canónico conserva cero imports (módulo in-memory puro)", () => {
  assert.deepEqual(
    listImportSpecifiers(readText(canonicalCacheFile)),
    [],
    `${canonicalCacheFile} debe tener cero imports para impedir cablearle Redis/DB/timers sin revisión`,
  );
});

// Infrastructure sólo usa dependencias legítimas.
test("Pricing infrastructure sólo importa dependencias justificadas por M18", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      if (!isAllowedInfrastructureDependency(file, specifier)) {
        violations.push(
          `${file}: specifier no permitido en infrastructure ("${specifier}" -> ${resolveSpecifier(file, specifier)}); permitidos: misma capa, server/db.ts, drizzle/schema.ts, drizzle-orm`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// Prohibidos fastify, routes, application, frontend, auth, sesiones, CORS,
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

// Ningún archivo canónico consume los paths legacy retirados.
test("Ningún archivo canónico de Pricing infrastructure importa los paths legacy retirados", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(infrastructureDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved === dbShimFile || resolved === cacheShimFile) {
        violations.push(
          `${file}: import a un path legacy retirado ("${specifier}" -> ${resolved})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// --- M19: shims retirados ---

test("El shim server/db-pricing.ts fue retirado en M19 y no puede recrearse ni tener consumidores", () => {
  // Retiro efectivo: el path legacy no existe.
  assert.equal(
    existsSync(join(repoRoot, dbShimFile)),
    false,
    `${dbShimFile} fue retirado en M19 (thin routes); su implementación canónica vive en ${canonicalDbFile} y no debe recrearse`,
  );

  // Cero consumidores productivos: ningún módulo de server/ resuelve al shim.
  // Los imports `./db-pricing.ts` dentro de infrastructure/servicios resuelven
  // al canónico (path distinto) y por eso no disparan.
  const productiveViolations: string[] = [];

  for (const file of walkTsFiles("server")) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      if (resolveSpecifier(file, specifier) === dbShimFile) {
        productiveViolations.push(
          `${file}: import al shim retirado ("${specifier}" -> ${dbShimFile}); usar el servicio directo de Pricing o ${canonicalDbFile}`,
        );
      }
    }
  }

  assert.deepEqual(productiveViolations, []);
});

test("El shim server/lib/public-pricing-cache.ts fue retirado en M19 y no puede recrearse ni tener consumidores", () => {
  assert.equal(
    existsSync(join(repoRoot, cacheShimFile)),
    false,
    `${cacheShimFile} fue retirado en M19 (thin routes); el cache canónico vive en ${canonicalCacheFile} y no debe recrearse`,
  );

  // Cero consumidores productivos.
  const productiveViolations: string[] = [];

  for (const file of walkTsFiles("server")) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      if (resolveSpecifier(file, specifier) === cacheShimFile) {
        productiveViolations.push(
          `${file}: import al shim retirado ("${specifier}" -> ${cacheShimFile}); usar el servicio directo de Pricing o ${canonicalCacheFile}`,
        );
      }
    }
  }

  assert.deepEqual(productiveViolations, []);

  // Cero tests operativos resolviendo al path retirado: los tres contratos
  // globales de reset quedaron realineados al canónico (verificación por path).
  const testViolations: string[] = [];

  for (const testFile of CACHE_SHIM_RESET_CONSUMER_TESTS) {
    assert.equal(
      existsSync(join(repoRoot, testFile)),
      true,
      `${testFile} debe existir para verificar su realineación`,
    );

    for (const specifier of listImportSpecifiers(readText(testFile))) {
      if (resolveSpecifier(testFile, specifier) === cacheShimFile) {
        testViolations.push(
          `${testFile}: import al shim retirado ("${specifier}" -> ${cacheShimFile}); usar ${canonicalCacheFile}`,
        );
      }
    }
  }

  assert.deepEqual(testViolations, []);
});

// --- M19: servicios directos (frontera de composición del contexto) ---

test("Los servicios directos de Pricing existen y exponen implementación real", () => {
  for (const serviceFile of serviceFiles) {
    assert.equal(
      existsSync(join(repoRoot, serviceFile)),
      true,
      `${serviceFile} debe existir tras M19 (servicio directo del contexto)`,
    );
    assert.match(
      readText(serviceFile),
      /export (async )?function \w+/,
      `${serviceFile} debe contener implementación real`,
    );
  }
});

test("Los servicios directos de Pricing sólo componen su propio contexto (sin fastify/auth/CORS/audit/DB externa)", () => {
  const violations: string[] = [];

  for (const serviceFile of serviceFiles) {
    for (const specifier of listImportSpecifiers(readText(serviceFile))) {
      const resolved = resolveSpecifier(serviceFile, specifier);

      // Sólo se permite componer archivos del propio contexto Pricing.
      if (!resolved.startsWith(`${featureDir}/`)) {
        violations.push(
          `${serviceFile}: specifier fuera del contexto Pricing ("${specifier}" -> ${resolved}); el servicio directo sólo compone ${featureDir}/**`,
        );
      }

      // Refuerzo explícito: ningún target HTTP/auth/CORS/audit/routes/frontend.
      for (const { label, pattern } of FORBIDDEN_TARGET_RULES) {
        if (pattern.test(resolved) || pattern.test(specifier)) {
          violations.push(`${serviceFile}: ${label} ("${specifier}" -> ${resolved})`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Los servicios directos de Pricing no importan Fastify ni sus tipos request/reply", () => {
  for (const serviceFile of serviceFiles) {
    const specifiers = listImportSpecifiers(readText(serviceFile));

    for (const specifier of specifiers) {
      assert.doesNotMatch(
        specifier,
        /^fastify(\/|$)/,
        `${serviceFile} no puede importar fastify ("${specifier}")`,
      );
    }
  }
});

// --- M19: rutas thin que delegan en el servicio directo ---

test("Las rutas de Pricing no importan los shims retirados ni los canónicos DB/cache directamente", () => {
  const violations: string[] = [];

  for (const routeFile of routeFiles) {
    for (const specifier of listImportSpecifiers(readText(routeFile))) {
      const resolved = resolveSpecifier(routeFile, specifier);

      if (resolved === dbShimFile || resolved === cacheShimFile) {
        violations.push(
          `${routeFile}: import a un shim retirado ("${specifier}" -> ${resolved})`,
        );
      }

      if (resolved === canonicalDbFile || resolved === canonicalCacheFile) {
        violations.push(
          `${routeFile}: import directo al canónico ("${specifier}" -> ${resolved}); usar el servicio directo de Pricing`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("La ruta public de Pricing delega en el servicio directo público", () => {
  const resolvedSpecifiers = listImportSpecifiers(readText(publicRouteFile)).map(
    (specifier) => resolveSpecifier(publicRouteFile, specifier),
  );

  assert.ok(
    resolvedSpecifiers.includes(publicServiceFile),
    `${publicRouteFile} debe importar el servicio directo ${publicServiceFile}`,
  );
});

test("La ruta admin de Pricing delega en el servicio directo admin", () => {
  const resolvedSpecifiers = listImportSpecifiers(readText(adminRouteFile)).map(
    (specifier) => resolveSpecifier(adminRouteFile, specifier),
  );

  assert.ok(
    resolvedSpecifiers.includes(adminServiceFile),
    `${adminRouteFile} debe importar el servicio directo ${adminServiceFile}`,
  );
});

// --- Invariantes de superficie canónica (M18, preservados por M19) ---

// El DB canónico conserva la superficie pública exacta (valores + tipos).
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

// El DB canónico conserva CERO transacciones.
test("El DB canónico conserva cero transacciones (invariante R0)", () => {
  const transactions =
    readText(canonicalDbFile).match(/\.transaction\(/g) ?? [];

  assert.equal(
    transactions.length,
    R0_TRANSACTION_CALL_SITES,
    `${canonicalDbFile} debe conservar ${R0_TRANSACTION_CALL_SITES} call-sites .transaction( medidos en R0`,
  );
});

// El cache conserva TTL, exports y semántica exactos.
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

  // La regla de dependencias permitidas de infrastructure rechaza specifiers
  // prohibidos reales y acepta los legítimos.
  assert.equal(isAllowedInfrastructureDependency(canonicalDbFile, "fastify"), false);
  assert.equal(
    isAllowedInfrastructureDependency(canonicalDbFile, "../../../lib/audit.ts"),
    false,
  );
  assert.equal(isAllowedInfrastructureDependency(canonicalDbFile, "drizzle-orm"), true);
  assert.equal(isAllowedInfrastructureDependency(canonicalDbFile, "../../../db.ts"), true);
  assert.equal(
    isAllowedInfrastructureDependency(canonicalDbFile, "../../../../drizzle/schema.ts"),
    true,
  );
});
