import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const repoRoot = process.cwd();

const featureDir = "server/features/public-professionals";
const domainDir = `${featureDir}/domain`;
const domainIndexFile = `${domainDir}/index.ts`;
const canonicalModuleFile = `${domainDir}/professional-bank-eligibility.ts`;

// Path legacy conservado sólo como shim temporal (M21 → expira en M24). Se
// construye por concatenación (no como literal fijo) para que el propio archivo
// del guard no sea un falso positivo bajo ningún escaneo, y para comparar contra
// specifiers de import ya resueltos, nunca contra texto libre.
const legacyShimFile = ["server", "lib", "professional-bank-eligibility.ts"].join(
  "/",
);

// Tras M22 la persistencia vive en `infrastructure/`; el consumidor runtime real
// del barrel de dominio es el repository canónico, no el shim legacy
// `server/db-public-professionals.ts` (que quedó como único re-export hacia el
// barrel de infraestructura y ya no importa el dominio directamente).
const runtimeConsumerFile =
  "server/features/public-professionals/infrastructure/public-professionals-repository.ts";

// Catálogo de Reports cuyo move está reservado para M36: el dominio canónico de
// Public Professionals no debe depender de él en runtime (se preserva la
// relación contractual por test, no por import).
const REPORT_STUDY_TYPES_STEM = ["report", "study", "types"].join("-");

function readText(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function walkFiles(relativeDir: string, extension = ".ts"): string[] {
  const absoluteDir = join(repoRoot, relativeDir);

  if (!existsSync(absoluteDir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...walkFiles(relativePath, extension));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(relativePath);
    }
  }

  return files;
}

// Parser robusto de imports: cubre `import ... from`, `require(...)`,
// `import(...)` dinámico, `import "..."` de efecto lateral y `export ... from`.
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

function resolveSpecifier(file: string, specifier: string) {
  return specifier.startsWith(".")
    ? resolveRelativeTsSpecifier(file, specifier)
    : toRepoRelativePath(specifier);
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Reglas de frontera de la capa domain (ADR ARCH-2): domain sólo importa el
// shared kernel como tipos y utilidades puras relativas del propio contexto.
const FORBIDDEN_SPECIFIER_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "import de persistencia (server/db o db-*)",
    pattern: /(^|\/)(db|database)([./-][\w-]*)?$/i,
  },
  {
    label: "import directo de configuración de entorno (lib/env)",
    pattern: /(^|\/)env(\.ts)?$/i,
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
    label: "import del runtime de drizzle",
    pattern: /^drizzle-orm(\/|$)/,
  },
  {
    label: "import de auth/middleware",
    pattern: /(^|\/)auth([-./]|$)/i,
  },
  {
    label: "import relacionado con CORS",
    pattern: /cors/i,
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
    label: "import de módulos node de I/O (fs/http/https)",
    pattern: /^(node:)?(fs|http|https)(\/|$)/,
  },
  {
    label: "import del catálogo de Reports (report-study-types)",
    pattern: new RegExp(REPORT_STUDY_TYPES_STEM),
  },
];

const FORBIDDEN_SOURCE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "acceso directo a process.* (env, cwd, exit, etc.)",
    pattern: /\bprocess\.\w+/,
  },
  {
    label: "I/O de red explícito (fetch)",
    pattern: /\bfetch\s*\(/,
  },
];

// 1 + 2 + 3
test("Public Professionals domain existe, contiene el módulo canónico y el barrel, con código real", () => {
  assert.equal(
    existsSync(join(repoRoot, domainDir)),
    true,
    `${domainDir} debe existir`,
  );

  assert.equal(
    existsSync(join(repoRoot, domainIndexFile)),
    true,
    `${domainIndexFile} debe existir`,
  );

  assert.equal(
    existsSync(join(repoRoot, canonicalModuleFile)),
    true,
    `${canonicalModuleFile} debe existir`,
  );

  const canonicalSource = readText(canonicalModuleFile);

  assert.ok(
    canonicalSource.length > 500,
    "el módulo canónico debe contener código real, no un stub",
  );

  for (const requiredExport of [
    "PROFESSIONAL_BANK_ELIGIBILITY_MONTHS",
    "HISTOPATHOLOGY_REPORT_STUDY_TYPE",
    "isHistopathologyReport",
    "getProfessionalBankEligibility",
  ]) {
    assert.ok(
      canonicalSource.includes(`export`) && canonicalSource.includes(requiredExport),
      `el módulo canónico debe exportar ${requiredExport}`,
    );
  }
});

// 4
test("Public Professionals domain permanece puro: sin db/env/fastify/infra/routes/supabase/fs/http/process/report-study-types", () => {
  const violations: string[] = [];

  for (const file of walkFiles(domainDir)) {
    const content = readText(file);
    const specifiers = listImportSpecifiers(content);

    for (const specifier of specifiers) {
      for (const { label, pattern } of FORBIDDEN_SPECIFIER_RULES) {
        if (pattern.test(specifier)) {
          violations.push(`${file}: ${label} ("${specifier}")`);
        }
      }

      // Ningún import a otros módulos de `server/lib/**`.
      const resolved = resolveSpecifier(file, specifier);
      if (resolved.startsWith("server/lib/")) {
        violations.push(
          `${file}: import a server/lib/** desde el dominio puro ("${specifier}" -> ${resolved})`,
        );
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

// 4 (positivo): sólo imports relativos internos o tipos del shared kernel
test("Public Professionals domain sólo importa dependencias relativas internas o el shared kernel de tipos", () => {
  const violations: string[] = [];

  for (const file of walkFiles(domainDir)) {
    const content = readText(file);

    for (const specifier of listImportSpecifiers(content)) {
      const isRelativeImport = specifier.startsWith(".");
      const isSharedKernelTypes = /drizzle\/schema(\.ts)?$/.test(specifier);

      if (!isRelativeImport && !isSharedKernelTypes) {
        violations.push(`${file}: import no permitido en domain puro ("${specifier}")`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 5
test("El módulo canónico de elegibilidad tiene cero imports", () => {
  const specifiers = listImportSpecifiers(readText(canonicalModuleFile));

  assert.deepEqual(
    specifiers,
    [],
    `${canonicalModuleFile} debe ser 100% puro (cero imports)`,
  );
});

// 6
test("El barrel de dominio re-exporta el módulo canónico", () => {
  const barrelSource = readText(domainIndexFile);
  const resolvedTargets = listImportSpecifiers(barrelSource).map((specifier) =>
    resolveSpecifier(domainIndexFile, specifier),
  );

  assert.ok(
    resolvedTargets.includes(canonicalModuleFile),
    `${domainIndexFile} debe re-exportar ${canonicalModuleFile}`,
  );

  assert.ok(
    /export\s+\*\s+from\s+["']\.\/professional-bank-eligibility\.ts["']/.test(
      barrelSource,
    ),
    "el barrel debe re-exportar la superficie completa del módulo canónico",
  );
});

// 7
test("Los consumidores runtime de server/** importan el dominio por el barrel, no archivos internos", () => {
  const violations: string[] = [];
  const runtimeFiles = walkFiles("server").filter(
    (file) => !file.startsWith(`${domainDir}/`),
  );

  for (const file of runtimeFiles) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);

      const importsDomainInternalFile =
        resolved.startsWith(`${domainDir}/`) &&
        resolved.endsWith(".ts") &&
        resolved !== domainIndexFile;

      if (importsDomainInternalFile) {
        violations.push(
          `${file}: import directo a archivo interno del dominio ("${specifier}" -> ${resolved})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 8
test("Ningún archivo runtime salvo el propio shim importa el path legacy", () => {
  const violations: string[] = [];

  for (const file of walkFiles("server")) {
    if (file === legacyShimFile) {
      continue;
    }

    for (const specifier of listImportSpecifiers(readText(file))) {
      const resolved = resolveSpecifier(file, specifier);

      if (resolved === legacyShimFile) {
        violations.push(
          `${file}: import al shim legacy ("${specifier}" -> ${resolved})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 9
test("el repository canónico de infrastructure importa el barrel del dominio, no el shim legacy", () => {
  const resolvedTargets = listImportSpecifiers(readText(runtimeConsumerFile)).map(
    (specifier) => resolveSpecifier(runtimeConsumerFile, specifier),
  );

  assert.ok(
    resolvedTargets.includes(domainIndexFile),
    `${runtimeConsumerFile} debe importar ${domainIndexFile}`,
  );

  assert.ok(
    !resolvedTargets.includes(legacyShimFile),
    `${runtimeConsumerFile} no debe importar el shim legacy`,
  );
});

// 10 + 11
test("El shim legacy es sólo el re-export exacto hacia el barrel, sin lógica", () => {
  const shimSource = readText(legacyShimFile);
  const codeLines = stripComments(shimSource)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  assert.deepEqual(
    codeLines,
    ['export * from "../features/public-professionals/domain/index.ts";'],
    "el shim debe contener exactamente un re-export y ninguna lógica",
  );

  const resolvedTargets = listImportSpecifiers(shimSource).map((specifier) =>
    resolveSpecifier(legacyShimFile, specifier),
  );

  assert.deepEqual(
    resolvedTargets,
    [domainIndexFile],
    "el único re-export del shim debe resolver al barrel canónico",
  );
});

// 12
test("No existe una copia nueva de report-study-types dentro del feature", () => {
  const copies = walkFiles(featureDir).filter((file) =>
    file.endsWith(`/${REPORT_STUDY_TYPES_STEM}.ts`),
  );

  assert.deepEqual(
    copies,
    [],
    "el catálogo de Reports (M36) no debe copiarse dentro de public-professionals",
  );
});
