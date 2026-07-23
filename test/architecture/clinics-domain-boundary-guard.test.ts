import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const repoRoot = process.cwd();

const featureDir = "server/features/clinics";
const domainDir = `${featureDir}/domain`;
const domainIndexFile = `${domainDir}/index.ts`;
const canonicalModuleFile = `${domainDir}/clinic-management-validation.ts`;
const applicationDir = `${featureDir}/application`;

// Ruta admin que consume el dominio (único consumidor runtime en M25).
const routeConsumerFile = "server/routes/admin-clinics.fastify.ts";

// Las 8 funciones extraídas del inline de la ruta hacia el dominio. El guard
// verifica que no vuelvan a definirse dentro de la ruta.
const MIGRATED_FUNCTION_NAMES = [
  "parseClinicUserRole",
  "parseRequiredString",
  "parseOptionalString",
  "parseOptionalRequiredString",
  "isValidEmail",
  "parseCreateClinicBody",
  "parseClinicUpdateBody",
  "parseClinicDeleteBody",
];

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
// Al operar sobre specifiers cubre también los imports `import type`, de modo
// que la prohibición de drizzle aplica incluso type-only.
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

// Elimina comentarios de línea/bloque y literales de string/template para que la
// detección de redefiniciones no dispare falsos positivos sobre texto que
// menciona un nombre sin declararlo. Es una aproximación léxica (no un parser
// completo) pero cubre las formas relevantes de la ruta.
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ") // comentarios de bloque
    .replace(/\/\/[^\n]*/g, " ") // comentarios de línea
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, " ") // template literals
    .replace(/"(?:\\.|[^"\\])*"/g, " ") // strings dobles
    .replace(/'(?:\\.|[^'\\])*'/g, " "); // strings simples
}

// Detecta si `name` se *redefine* (declara) en el código, cubriendo:
//   function name(...)            async function name(...)
//   const name = (...) =>         const name = function (...)
//   const name: Tipo = (...) =>   let/var name = (...) =>
// Ignora imports, llamadas, propiedades de objeto y menciones en
// strings/comentarios (removidos previamente).
function definesSymbolInline(rawSource: string, name: string): boolean {
  const source = stripCommentsAndStrings(rawSource);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Declaración de función (con o sin async).
  const functionDeclaration = new RegExp(
    `(^|[^.\\w])(?:async\\s+)?function\\s+${escaped}\\s*\\(`,
  );

  // Binding const/let/var con inicializador de función:
  //   name [: Tipo] = (async)? (...) =>   |   = (async)? function
  const boundInitializer = new RegExp(
    `(^|[^.\\w])(?:const|let|var)\\s+${escaped}\\s*(?::[^=;]+)?=\\s*(?:async\\s+)?(?:function\\b|\\([^)]*\\)\\s*(?::[^=>{;]+)?=>|[A-Za-z_$][\\w$]*\\s*=>)`,
  );

  return functionDeclaration.test(source) || boundInitializer.test(source);
}

// Reglas de frontera de la capa domain (ADR ARCH-2). El dominio Clinics es
// autónomo: define su propio `ClinicUserRole` y no importa el shared kernel de
// Drizzle ni siquiera como tipos (corrección aprobada en M25).
const FORBIDDEN_SPECIFIER_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "import de fastify",
    pattern: /^fastify(\/|$)/,
  },
  {
    label: "import de drizzle (schema u ORM), incluso type-only",
    pattern: /(^|\/)drizzle(-orm)?(\/|$)/i,
  },
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
    label: "import hacia la capa application del propio contexto",
    pattern: /(^|\/)application(\/|$)/,
  },
  {
    label: "import hacia la capa routes del propio contexto",
    pattern: /(^|\/)routes(\/|$)/,
  },
  {
    label: "import hacia middlewares",
    pattern: /(^|\/)middlewares?(\/|$)/i,
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
    label: "import de cliente supabase",
    pattern: /supabase/i,
  },
  {
    label: "import de node:process",
    pattern: /^(node:)?process(\/|$)/,
  },
  {
    label: "import de módulos node de I/O (fs/http/https/net/child_process)",
    pattern: /^(node:)?(fs|http|https|net|child_process)(\/|$)/,
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
  {
    label: "acoplamiento a transporte Fastify (FastifyRequest)",
    pattern: /\bFastifyRequest\b/,
  },
  {
    label: "acoplamiento a transporte Fastify (FastifyReply)",
    pattern: /\bFastifyReply\b/,
  },
  {
    label: "referencia a request/reply de transporte",
    pattern: /\b(request|reply)\b/,
  },
  {
    label: "referencia a SQL crudo",
    pattern: /\bsql`|\bSQL\b/,
  },
  {
    label: "referencia a transacciones de persistencia",
    pattern: /\btransaction\b/i,
  },
  {
    label: "status codes HTTP en el dominio",
    pattern: /\b(200|201|204|400|401|403|404|409|500)\b/,
  },
];

// 1 + 2 + 3
test("Clinics domain existe, contiene el módulo canónico y el barrel, con código real", () => {
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

  const sanitized = stripCommentsAndStrings(canonicalSource);

  // Exports de tipo: `export type Nombre =` o `export interface Nombre`.
  for (const typeExport of [
    "ClinicUserRole",
    "ClinicValidationResult",
    "ClinicCreateInput",
    "ClinicUpdateInput",
  ]) {
    const escaped = typeExport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const typeExportPattern = new RegExp(
      `\\bexport\\s+(?:type\\s+${escaped}\\s*(?:<[^=]*>)?\\s*=|interface\\s+${escaped}\\b)`,
    );
    assert.ok(
      typeExportPattern.test(sanitized),
      `el módulo canónico debe exportar el tipo ${typeExport}`,
    );
  }

  // Exports runtime: `export function Nombre(` (con o sin async).
  for (const runtimeExport of [
    "parseClinicUserRole",
    "parseClinicCreateInput",
    "parseClinicUpdateInput",
    "parseClinicDeleteConfirmation",
    "confirmClinicNameMatches",
  ]) {
    const escaped = runtimeExport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const runtimeExportPattern = new RegExp(
      `\\bexport\\s+(?:async\\s+)?function\\s+${escaped}\\s*\\(`,
    );
    assert.ok(
      runtimeExportPattern.test(sanitized),
      `el módulo canónico debe exportar la función runtime ${runtimeExport}`,
    );
  }
});

// 4 (negativo): pureza del dominio por censo de imports resueltos
test("Clinics domain permanece puro: sin fastify/drizzle/db/env/infra/application/routes/middlewares/auth/cors/supabase/fs/http/net/process", () => {
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

      // Ningún import a otros módulos de `server/lib/**` ni a `server/db*`.
      const resolved = resolveSpecifier(file, specifier);
      if (resolved.startsWith("server/lib/")) {
        violations.push(
          `${file}: import a server/lib/** desde el dominio puro ("${specifier}" -> ${resolved})`,
        );
      }
      if (/^server\/db(\.ts|-)/.test(resolved)) {
        violations.push(
          `${file}: import a persistencia desde el dominio puro ("${specifier}" -> ${resolved})`,
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

// 4 (positivo): el dominio sólo importa dependencias relativas internas
test("Clinics domain sólo importa dependencias relativas internas del propio contexto", () => {
  const violations: string[] = [];

  for (const file of walkFiles(domainDir)) {
    const content = readText(file);

    for (const specifier of listImportSpecifiers(content)) {
      const isRelativeImport = specifier.startsWith(".");

      if (!isRelativeImport) {
        violations.push(
          `${file}: import no permitido en domain puro ("${specifier}")`,
        );
        continue;
      }

      const resolved = resolveSpecifier(file, specifier);
      if (!resolved.startsWith(`${domainDir}/`)) {
        violations.push(
          `${file}: import relativo fuera del dominio ("${specifier}" -> ${resolved})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// 5
test("El módulo canónico de validaciones tiene cero imports", () => {
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

  for (const publicExport of [
    "parseClinicUserRole",
    "parseClinicCreateInput",
    "parseClinicUpdateInput",
    "parseClinicDeleteConfirmation",
    "confirmClinicNameMatches",
  ]) {
    assert.ok(
      barrelSource.includes(publicExport),
      `el barrel debe exportar ${publicExport}`,
    );
  }
});

// 7
test("La ruta admin importa el dominio por el barrel, no el archivo interno", () => {
  const resolvedTargets = listImportSpecifiers(readText(routeConsumerFile)).map(
    (specifier) => resolveSpecifier(routeConsumerFile, specifier),
  );

  assert.ok(
    resolvedTargets.includes(domainIndexFile),
    `${routeConsumerFile} debe importar ${domainIndexFile}`,
  );

  assert.ok(
    !resolvedTargets.includes(canonicalModuleFile),
    `${routeConsumerFile} no debe importar el archivo interno del dominio`,
  );
});

// 7 (global): ningún consumidor runtime importa el archivo interno del dominio
test("Ningún runtime de server/** importa el archivo interno del dominio (sólo barrel)", () => {
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
test("Las 8 funciones migradas no vuelven a definirse inline en la ruta admin", () => {
  const routeSource = readText(routeConsumerFile);
  const violations: string[] = [];

  for (const fnName of MIGRATED_FUNCTION_NAMES) {
    if (definesSymbolInline(routeSource, fnName)) {
      violations.push(`${routeConsumerFile}: redefine inline ${fnName}`);
    }
  }

  assert.deepEqual(violations, []);
});

// 8 (caracterización): el detector reconoce todas las formas de declaración y
// no dispara sobre llamadas ni imports.
test("definesSymbolInline detecta todas las formas de redefinición y evita falsos positivos", () => {
  // 1 · function declaration
  assert.equal(
    definesSymbolInline("function parseRequiredString(input) { return input; }", "parseRequiredString"),
    true,
  );
  // 2 · async function declaration
  assert.equal(
    definesSymbolInline("async function parseRequiredString(input) { return input; }", "parseRequiredString"),
    true,
  );
  // 3 · const arrow
  assert.equal(
    definesSymbolInline("const parseRequiredString = (input) => input;", "parseRequiredString"),
    true,
  );
  // 4 · const function expression
  assert.equal(
    definesSymbolInline("const parseRequiredString = function (input) { return input; };", "parseRequiredString"),
    true,
  );
  // 5 · declaración tipada
  assert.equal(
    definesSymbolInline("const parseRequiredString: Parser = (input) => input;", "parseRequiredString"),
    true,
  );
  // 6 · let / var
  assert.equal(
    definesSymbolInline("let parseRequiredString = (input) => input;", "parseRequiredString"),
    true,
  );
  assert.equal(
    definesSymbolInline("var parseRequiredString = function (input) { return input; };", "parseRequiredString"),
    true,
  );
  // 7 · llamada legítima → no es redefinición
  assert.equal(
    definesSymbolInline("const parsed = parseRequiredString(request.body);", "parseRequiredString"),
    false,
  );
  // 8 · import del símbolo → no es redefinición
  assert.equal(
    definesSymbolInline('import { parseRequiredString } from "../features/clinics/domain/index.ts";', "parseRequiredString"),
    false,
  );
  // extra · mención sólo en comentario o string → no es redefinición
  assert.equal(
    definesSymbolInline("// function parseRequiredString(x) {}\nconst s = 'function parseRequiredString(x) {}';", "parseRequiredString"),
    false,
  );
  // extra · propiedad de objeto homónima → no es redefinición
  assert.equal(
    definesSymbolInline("const deps = { parseRequiredString: other };", "parseRequiredString"),
    false,
  );
});

// 9
test("No existe una capa application anticipada en el contexto Clinics", () => {
  assert.equal(
    existsSync(join(repoRoot, applicationDir)),
    false,
    `${applicationDir} no debe existir en M25 (application diferido)`,
  );
});
