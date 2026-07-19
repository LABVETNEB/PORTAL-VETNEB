import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const repoRoot = process.cwd();
const domainDir = "server/features/logistics/domain";
const domainIndexFile = `${domainDir}/index.ts`;

// Inventario mínimo requerido del dominio Logistics tras el cierre de Fase A
// (M02b → M03 → M04 → M05). Es un subconjunto obligatorio, NO un inventario
// cerrado: futuras incorporaciones legítimas pueden agregar módulos sin tocar
// este contrato (se comprueba presencia, no igualdad exacta del directorio).
const REQUIRED_DOMAIN_MODULES = [
  "index.ts",
  "pagination.ts",
  "route-plan-field-visits.ts",
  "time-window.ts",
  "sla-breach.ts",
  "route-planning.ts",
  "metrics.ts",
] as const;

// Namespace de dominio legacy retirado en la Fase A. Se construye por
// concatenación (no como literal fijo) para que el propio archivo del guard no
// sea un falso positivo bajo ningún escaneo, y para comparar contra specifiers
// de import ya parseados (nunca contra texto libre ni comentarios históricos).
const LEGACY_DOMAIN_DIR = ["server", "lib", "logistics"].join("/");

function readText(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
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

function listImportSpecifiers(source: string) {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g,
    ),
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );
}

function toRepoRelativePath(path: string) {
  return path.replaceAll("\\", "/");
}

function resolveRelativeTsSpecifier(file: string, specifier: string) {
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

// Reglas de frontera de la capa domain segun ADR ARCH-2
// (docs/architecture/backend-boundary-adr.md): domain solo puede importar el
// shared kernel como tipos y utilidades puras del propio contexto.
const FORBIDDEN_SPECIFIER_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "import de persistencia (server/db o db-*)",
    pattern: /(^|\/)(db|database)([./-][\w-]*)?$/i,
  },
  {
    label: "import directo de configuracion de entorno (lib/env)",
    pattern: /(^|\/)env$/i,
  },
  {
    label: "import hacia la capa infrastructure del propio contexto",
    pattern: /(^|\/)infrastructure(\/|$)/,
  },
  {
    label: "import hacia la capa routes del propio contexto",
    pattern: /(^|\/)routes(\/|$)/,
  },
  {
    label: "import de fastify",
    pattern: /^fastify(\/|$)/,
  },
  {
    label: "import de node:process",
    pattern: /^(node:)?process(\/|$)/,
  },
  {
    label: "import de cliente supabase",
    pattern: /supabase/i,
  },
  {
    label: "import de modulos node de I/O (fs/http/https)",
    pattern: /^(node:)?(fs|http|https)(\/|$)/,
  },
];

const FORBIDDEN_SOURCE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "acceso directo a process.* (env, cwd, exit, etc.)",
    pattern: /\bprocess\.\w+/,
  },
  {
    label: "IO de red explicito (fetch)",
    pattern: /\bfetch\s*\(/,
  },
];

test("Logistics domain (server/features/logistics/domain) existe y contiene codigo", () => {
  assert.equal(
    existsSync(join(repoRoot, domainDir)),
    true,
    `${domainDir} debe existir`,
  );

  const files = walkTsFiles(domainDir);

  assert.ok(
    files.length > 0,
    `${domainDir} debe contener al menos un archivo .ts para que el guardrail proteja algo`,
  );
});

test("Logistics domain permanece puro: sin db/env/fastify/infrastructure/routes/supabase/fs/http/https", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(domainDir)) {
    const content = readText(file);
    const specifiers = listImportSpecifiers(content);

    for (const specifier of specifiers) {
      for (const { label, pattern } of FORBIDDEN_SPECIFIER_RULES) {
        if (pattern.test(specifier)) {
          violations.push(`${file}: ${label} ("${specifier}")`);
        }
      }
    }

    for (const { label, pattern } of FORBIDDEN_SOURCE_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${file}: ${label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Logistics domain solo importa dependencias relativas internas o el shared kernel de tipos", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(domainDir)) {
    const content = readText(file);
    const specifiers = listImportSpecifiers(content);

    for (const specifier of specifiers) {
      const isRelativeImport = specifier.startsWith(".");
      const isSharedKernelTypes = /drizzle\/schema(\.ts)?$/.test(specifier);

      if (!isRelativeImport && !isSharedKernelTypes) {
        violations.push(`${file}: import no permitido en domain puro ("${specifier}")`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Logistics runtime consumers import logistics domain through the public barrel", () => {
  const violations: string[] = [];
  const runtimeFiles = walkTsFiles("server").filter(
    (file) => !file.startsWith(`${domainDir}/`),
  );

  for (const file of runtimeFiles) {
    const content = readText(file);
    const specifiers = listImportSpecifiers(content);

    for (const specifier of specifiers) {
      const resolvedSpecifier = specifier.startsWith(".")
        ? resolveRelativeTsSpecifier(file, specifier)
        : toRepoRelativePath(specifier);

      const importsDomainInternalFile =
        resolvedSpecifier.startsWith(`${domainDir}/`) &&
        resolvedSpecifier.endsWith(".ts") &&
        resolvedSpecifier !== domainIndexFile;

      if (importsDomainInternalFile) {
        violations.push(
          `${file}: import directo a archivo interno de logistics/domain ("${specifier}" -> ${resolvedSpecifier})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// --- Cierre de Fase A (M05): endurecimiento del contrato de dominio ---

function pointsToLegacyDomain(resolvedSpecifier: string) {
  // Sólo el namespace de dominio retirado: `server/lib/logistics` exacto o
  // cualquier archivo bajo `server/lib/logistics/`. NO matchea la cache vigente
  // `server/lib/logistics-route-plans-cache.ts` (prefijo con guion, no `/`),
  // que sigue siendo runtime legítimo hasta M13.
  const normalized = resolvedSpecifier.replace(/\.ts$/, "");
  return normalized === LEGACY_DOMAIN_DIR || normalized.startsWith(`${LEGACY_DOMAIN_DIR}/`);
}

test("El parser de imports cubre imports estáticos de efecto lateral", () => {
  const legacySideEffectSpecifier = `${LEGACY_DOMAIN_DIR}/side-effect`;

  // Sintaxis que originó el review: `import "..."` sin binding. El parser debe
  // extraer el specifier y `pointsToLegacyDomain` clasificarlo como legacy.
  assert.deepEqual(
    listImportSpecifiers(`import "${legacySideEffectSpecifier}";`),
    [legacySideEffectSpecifier],
  );
  assert.equal(pointsToLegacyDomain(legacySideEffectSpecifier), true);

  // Regresión: las tres formas previas siguen reconociéndose sin cambios.
  assert.deepEqual(
    listImportSpecifiers(
      [
        `import { x } from "${LEGACY_DOMAIN_DIR}/from";`,
        `const y = require("${LEGACY_DOMAIN_DIR}/require");`,
        `const z = await import("${LEGACY_DOMAIN_DIR}/dynamic");`,
      ].join("\n"),
    ),
    [
      `${LEGACY_DOMAIN_DIR}/from`,
      `${LEGACY_DOMAIN_DIR}/require`,
      `${LEGACY_DOMAIN_DIR}/dynamic`,
    ],
  );
});

test("Logistics domain expone el inventario mínimo requerido de la Fase A (subconjunto, no cerrado)", () => {
  const missing = REQUIRED_DOMAIN_MODULES.filter(
    (moduleName) => !existsSync(join(repoRoot, domainDir, moduleName)),
  );

  assert.deepEqual(
    missing,
    [],
    `faltan módulos requeridos en ${domainDir}: ${missing.join(", ")}`,
  );
});

test("El namespace de dominio legacy no reaparece en un checkout limpio", () => {
  assert.equal(
    existsSync(join(repoRoot, LEGACY_DOMAIN_DIR)),
    false,
    `${LEGACY_DOMAIN_DIR} no debe reaparecer después del cierre M05`,
  );
});

test("Ningún archivo de server/** ni test/** importa el namespace de dominio legacy", () => {
  const violations: string[] = [];

  for (const relativeDir of ["server", "test"]) {
    for (const file of walkTsFiles(relativeDir)) {
      const specifiers = listImportSpecifiers(readText(file));

      for (const specifier of specifiers) {
        const resolvedSpecifier = specifier.startsWith(".")
          ? resolveRelativeTsSpecifier(file, specifier)
          : toRepoRelativePath(specifier);

        if (pointsToLegacyDomain(resolvedSpecifier)) {
          violations.push(
            `${file}: import al dominio legacy retirado ("${specifier}" -> ${resolvedSpecifier})`,
          );
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});
