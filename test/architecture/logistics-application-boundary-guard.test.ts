import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Guard de frontera de la capa application de Logistics (M11, cierre de Fase B).
// Clona el mecanismo ya validado por `logistics-domain-boundary-guard.test.ts`:
// node:test + lectura de fuente + parser de imports, sin dependencias nuevas.
//
// A diferencia de los checks de frontera embebidos en cada test unitario de
// M06-M10 (que fijan listas literales de archivos por milestone), este guard
// AUTO-DESCUBRE el directorio completo: cualquier archivo futuro de la capa
// queda cubierto sin registrarlo a mano.

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const applicationDir = "server/features/logistics/application";
const applicationIndexFile = `${applicationDir}/index.ts`;
const applicationPortsDir = `${applicationDir}/ports`;
const domainDir = "server/features/logistics/domain";
const domainIndexFile = `${domainDir}/index.ts`;

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

// --- Normalizacion de fuente -------------------------------------------------

type LiteralRange = { start: number; end: number };

type StrippedSource = {
  // Comentarios eliminados, literales de string preservados: base para extraer
  // specifiers reales y evitar falsos positivos por texto en comentarios.
  withoutComments: string;
  // Comentarios y contenido textual de strings eliminados: base para detectar
  // patrones de runtime (process.*, fetch, filesystem) sin que un literal los
  // dispare. El interior de las interpolaciones `${...}` SI se preserva como
  // codigo, para que un template no sirva de bypass.
  codeOnly: string;
  // Tramos de `withoutComments` ocupados por texto literal. Permiten descartar
  // coincidencias del parser que caen DENTRO de un string (p. ej. la constante
  // `'import "supabase"'`), que no son imports reales.
  literalRanges: LiteralRange[];
};

function stripSource(source: string): StrippedSource {
  let withoutComments = "";
  let codeOnly = "";
  let index = 0;
  const length = source.length;
  const literalRanges: LiteralRange[] = [];

  // Cada frame representa un template literal abierto. El valor -1 significa
  // "dentro del texto del template"; >= 0 cuenta la profundidad de llaves de la
  // interpolacion `${ ... }` activa.
  const templateFrames: number[] = [];
  // Offset en `withoutComments` donde arranca el tramo de texto del template
  // abierto mas interno; se cierra al entrar en `${` o al cerrar el template.
  const templateTextStarts: number[] = [];
  const insideTemplateText = (): boolean =>
    templateFrames.length > 0 && templateFrames[templateFrames.length - 1] === -1;

  while (index < length) {
    const char = source[index];
    const next = index + 1 < length ? source[index + 1] : "";

    if (insideTemplateText()) {
      if (char === "\\") {
        withoutComments += char + next;
        index += 2;
        continue;
      }

      if (char === "$" && next === "{") {
        literalRanges.push({
          start: templateTextStarts[templateTextStarts.length - 1],
          end: withoutComments.length,
        });
        templateFrames[templateFrames.length - 1] = 0;
        withoutComments += "${";
        index += 2;
        continue;
      }

      if (char === "`") {
        literalRanges.push({
          start: templateTextStarts[templateTextStarts.length - 1],
          end: withoutComments.length,
        });
        templateFrames.pop();
        templateTextStarts.pop();
        withoutComments += char;
        index += 1;
        continue;
      }

      withoutComments += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const literalStart = withoutComments.length;
      let literal = char;
      index += 1;

      while (index < length) {
        const current = source[index];
        literal += current;
        index += 1;

        if (current === "\\") {
          if (index < length) {
            literal += source[index];
            index += 1;
          }
          continue;
        }

        if (current === quote) {
          break;
        }
      }

      withoutComments += literal;
      literalRanges.push({ start: literalStart, end: withoutComments.length });
      codeOnly += `${quote}${quote}`;
      continue;
    }

    if (char === "`") {
      templateFrames.push(-1);
      withoutComments += char;
      templateTextStarts.push(withoutComments.length);
      codeOnly += "``";
      index += 1;
      continue;
    }

    if (templateFrames.length > 0) {
      const depth = templateFrames[templateFrames.length - 1];

      if (char === "{") {
        templateFrames[templateFrames.length - 1] = depth + 1;
      } else if (char === "}") {
        if (depth === 0) {
          templateFrames[templateFrames.length - 1] = -1;
          withoutComments += char;
          templateTextStarts[templateTextStarts.length - 1] = withoutComments.length;
          codeOnly += char;
          index += 1;
          continue;
        }

        templateFrames[templateFrames.length - 1] = depth - 1;
      }
    }

    withoutComments += char;
    codeOnly += char;
    index += 1;
  }

  return { withoutComments, codeOnly, literalRanges };
}

// --- Parser de imports -------------------------------------------------------

// Cubre las cinco formas exigidas por el contrato del guard:
//   1. import ... from "x"      2. export ... from "x"     (ambas por `from`)
//   3. import("x")              4. require("x")            5. import "x"
function listImportSpecifiers(source: string): string[] {
  const { withoutComments, literalRanges } = stripSource(source);

  // La palabra clave (`from`/`import`/`require`) de un import real siempre esta
  // en posicion de codigo. Si la coincidencia arranca dentro de un literal, es
  // texto, no un import.
  const startsInsideLiteral = (offset: number): boolean =>
    literalRanges.some((range) => offset >= range.start && offset < range.end);

  const specifiers: string[] = [];

  for (const match of withoutComments.matchAll(
    /\bfrom\s*["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g,
  )) {
    if (match.index === undefined || startsInsideLiteral(match.index)) {
      continue;
    }

    specifiers.push(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
  }

  return specifiers;
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

// Objetivo de un import: path repo-relativo resuelto para los relativos, o el
// propio specifier para los bare.
function resolveImportTarget(file: string, specifier: string): string {
  return specifier.startsWith(".")
    ? resolveRelativeTsSpecifier(file, specifier)
    : toRepoRelativePath(specifier);
}

// --- Reglas de frontera ------------------------------------------------------

// Estas reglas SOLO se evaluan sobre objetivos que ya quedaron fuera de la lista
// de permitidos (dentro de application, o el barrel publico de domain). Al ser
// default-deny, un objetivo no contemplado igual se reporta: las reglas solo
// aportan la etiqueta precisa, nunca amplian lo permitido.
const FORBIDDEN_TARGET_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "import de fastify", pattern: /^fastify(\/|$)/ },
  { label: "import hacia la capa routes", pattern: /(^|\/)routes(\/|$)/ },
  { label: "import de persistencia server/db", pattern: /(^|\/)db(\.ts)?$/i },
  { label: "import de un modulo db-* concreto", pattern: /(^|\/)db-[\w-]+(\.ts)?$/i },
  { label: "import del runtime de drizzle-orm", pattern: /^drizzle-orm(\/|$)/ },
  { label: "import del schema de persistencia (drizzle)", pattern: /(^|\/)drizzle(\/|$)/i },
  {
    label: "import hacia la capa infrastructure",
    pattern: /(^|\/)infrastructure(\/|$)/,
  },
  { label: "import hacia server/lib", pattern: /(^|\/)lib(\/|$)/ },
  {
    label: "import de auth/session/CORS/audit/email concretos",
    pattern: /(^|\/)(auth|session|cors|cors-headers|audit|audit-log|email)([.-][\w-]*)?$/i,
  },
  { label: "import de cliente supabase", pattern: /supabase/i },
  { label: "import hacia frontend", pattern: /(^|\/)frontend(\/|$)/ },
  { label: "import directo de configuracion de entorno (env)", pattern: /(^|\/)env(\.ts)?$/i },
  {
    label: "import de modulos node de IO/proceso (fs/http/https/process)",
    pattern: /^(node:)?(fs|http|https|process)(\/|$)/,
  },
];

const FORBIDDEN_SOURCE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "acceso directo a process.* (env, cwd, exit, etc.)", pattern: /\bprocess\.\w+/ },
  { label: "IO de red explicito (fetch)", pattern: /\bfetch\s*\(/ },
  {
    label: "acceso directo al filesystem",
    pattern:
      /\b(readFileSync|writeFileSync|appendFileSync|existsSync|readdirSync|mkdirSync|rmSync|unlinkSync|createReadStream|createWriteStream)\s*\(/,
  },
];

function isInsideApplication(target: string): boolean {
  return target === applicationIndexFile || target.startsWith(`${applicationDir}/`);
}

function classifyApplicationImport(target: string, isRelative: boolean): string | undefined {
  if (isInsideApplication(target)) {
    return undefined;
  }

  if (target === domainIndexFile) {
    return undefined;
  }

  for (const { label, pattern } of FORBIDDEN_TARGET_RULES) {
    if (pattern.test(target)) {
      return label;
    }
  }

  if (target.startsWith(`${domainDir}/`)) {
    return "import directo a archivo interno de domain (usar el barrel domain/index.ts)";
  }

  return isRelative
    ? "import relativo fuera de la capa application"
    : "bare specifier no permitido en application";
}

// --- Contratos ---------------------------------------------------------------

test("Logistics application existe, contiene codigo y expone su barrel publico", () => {
  assert.equal(
    existsSync(join(repoRoot, applicationDir)),
    true,
    `${applicationDir} debe existir`,
  );

  assert.equal(
    existsSync(join(repoRoot, applicationIndexFile)),
    true,
    `${applicationIndexFile} debe existir como barrel publico de la capa`,
  );

  const files = walkTsFiles(applicationDir);

  assert.ok(
    files.length > 0,
    `${applicationDir} debe contener al menos un archivo .ts para que el guard proteja algo`,
  );
});

test("Logistics application solo importa dentro de la capa o el barrel publico de domain", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(applicationDir)) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const isRelative = specifier.startsWith(".");
      const target = resolveImportTarget(file, specifier);
      const label = classifyApplicationImport(target, isRelative);

      if (label !== undefined) {
        violations.push(`${file}: ${label} ("${specifier}")`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Logistics application no ejecuta runtime de proceso, red ni filesystem", () => {
  const violations: string[] = [];

  for (const file of walkTsFiles(applicationDir)) {
    const { codeOnly } = stripSource(readText(file));

    for (const { label, pattern } of FORBIDDEN_SOURCE_PATTERNS) {
      if (pattern.test(codeOnly)) {
        violations.push(`${file}: ${label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Los puertos de Logistics application declaran contratos, no implementaciones", () => {
  const violations: string[] = [];

  // Un puerto puede importar tipos (de la propia capa o del barrel de domain);
  // lo que no puede es exportar runtime ejecutable ni instanciar nada.
  const FORBIDDEN_PORT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
    { label: "export de funcion ejecutable", pattern: /^export\s+(async\s+)?function\b/m },
    { label: "export de clase", pattern: /^export\s+(abstract\s+)?class\b/m },
    { label: "export de valor (const/let/var)", pattern: /^export\s+(const|let|var)\b/m },
    { label: "export default ejecutable", pattern: /^export\s+default\b/m },
    { label: "instanciacion de clase", pattern: /\bnew\s+[A-Z]\w*\s*\(/ },
  ];

  for (const file of walkTsFiles(applicationPortsDir)) {
    const { codeOnly } = stripSource(readText(file));

    for (const { label, pattern } of FORBIDDEN_PORT_PATTERNS) {
      if (pattern.test(codeOnly)) {
        violations.push(`${file}: ${label}`);
      }
    }

    for (const { label, pattern } of FORBIDDEN_SOURCE_PATTERNS) {
      if (pattern.test(codeOnly)) {
        violations.push(`${file}: ${label}`);
      }
    }

    for (const specifier of listImportSpecifiers(readText(file))) {
      const isRelative = specifier.startsWith(".");
      const target = resolveImportTarget(file, specifier);
      const label = classifyApplicationImport(target, isRelative);

      if (label !== undefined) {
        violations.push(`${file}: ${label} ("${specifier}")`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Los consumidores runtime importan Logistics application por el barrel publico", () => {
  const violations: string[] = [];
  const runtimeFiles = walkTsFiles("server").filter(
    (file) => !file.startsWith(`${applicationDir}/`),
  );

  for (const file of runtimeFiles) {
    for (const specifier of listImportSpecifiers(readText(file))) {
      const target = resolveImportTarget(file, specifier);

      const importsApplicationInternalFile =
        target.startsWith(`${applicationDir}/`) &&
        target.endsWith(".ts") &&
        target !== applicationIndexFile;

      if (importsApplicationInternalFile) {
        violations.push(
          `${file}: import directo a archivo interno de logistics/application ("${specifier}" -> ${target})`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

// --- Auto-tests del parser y del resolutor -----------------------------------

test("El parser de imports cubre las cinco formas de import del contrato", () => {
  const target = "fastify";

  assert.deepEqual(
    listImportSpecifiers(
      [
        `import x from "${target}";`,
        `export { y } from "${target}";`,
        `const z = await import("${target}");`,
        `const w = require("${target}");`,
        `import "${target}";`,
      ].join("\n"),
    ),
    [target, target, target, target, target],
  );

  // Un import type-only se detecta igual: el guard no exime tipos.
  assert.deepEqual(listImportSpecifiers(`import type { A } from "drizzle/schema";`), [
    "drizzle/schema",
  ]);
});

test("El parser ignora comentarios y no confunde texto libre con imports", () => {
  const source = [
    `// import { Bad } from "fastify";`,
    `/* export { Bad } from "../../../db-logistics.ts"; */`,
    `const note = 'import "supabase"';`,
    `import type { Port } from "./ports/example.ts";`,
  ].join("\n");

  assert.deepEqual(listImportSpecifiers(source), ["./ports/example.ts"]);
});

test("Los patrones de runtime prohibido ignoran strings pero no interpolaciones", () => {
  const literalOnly = stripSource(`const label = "process.env.SECRET";`).codeOnly;
  assert.equal(/\bprocess\.\w+/.test(literalOnly), false);

  const interpolated = stripSource("const value = `${process.env.SECRET}`;").codeOnly;
  assert.equal(/\bprocess\.\w+/.test(interpolated), true);

  const commented = stripSource(`// fetch("https://example.test")`).codeOnly;
  assert.equal(/\bfetch\s*\(/.test(commented), false);
});

test("La resolucion de specifiers relativos cubre .ts, index.ts y saltos con ..", () => {
  const fromUseCase = `${applicationDir}/update-field-visit.ts`;

  assert.equal(
    resolveRelativeTsSpecifier(
      fromUseCase,
      "./ports/logistics-field-visit-update-repository.ts",
    ),
    `${applicationPortsDir}/logistics-field-visit-update-repository.ts`,
  );

  // Extension implicita e index.ts implicito.
  assert.equal(resolveRelativeTsSpecifier(fromUseCase, "./index"), applicationIndexFile);
  assert.equal(resolveRelativeTsSpecifier(fromUseCase, "../domain"), domainIndexFile);

  // Salto fuera de la capa con `..`, con separadores normalizados.
  assert.equal(
    resolveRelativeTsSpecifier(fromUseCase, "../../../db-logistics.ts"),
    "server/db-logistics.ts",
  );
});

test("La clasificacion de frontera acepta lo permitido y rechaza lo prohibido", () => {
  // Permitidos: dentro de la capa (incluido ports) y el barrel publico de domain.
  assert.equal(
    classifyApplicationImport(`${applicationPortsDir}/logistics-sla-read-repository.ts`, true),
    undefined,
  );
  assert.equal(classifyApplicationImport(applicationIndexFile, true), undefined);
  assert.equal(classifyApplicationImport(domainIndexFile, true), undefined);

  // Prohibidos, incluidos los que solo pueden llegar como tipos.
  const forbidden: Array<[string, boolean]> = [
    ["fastify", false],
    ["server/routes/logistics-sla.fastify.ts", true],
    ["server/db.ts", true],
    ["server/db-logistics.ts", true],
    ["drizzle-orm", false],
    ["drizzle/schema.ts", true],
    ["server/features/logistics/infrastructure/sla-breach-db.ts", true],
    ["server/lib/audit.ts", true],
    ["server/lib/supabase.ts", true],
    ["frontend/src/lib/api.ts", true],
    ["server/lib/env.ts", true],
    ["node:fs", false],
    ["node:process", false],
    ["http", false],
    ["zod", false],
    [`${domainDir}/sla-breach.ts`, true],
  ];

  for (const [target, isRelative] of forbidden) {
    assert.notEqual(
      classifyApplicationImport(target, isRelative),
      undefined,
      `${target} debe quedar clasificado como violacion de frontera`,
    );
  }
});
