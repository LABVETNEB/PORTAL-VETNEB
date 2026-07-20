import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Suite global de casos de uso de Logistics application (M11, cierre de Fase B).
//
// Este archivo es un CONTRATO DE INVENTARIO, no un runner agregador: no importa
// ni reejecuta los nueve tests unitarios de M06-M10, no lanza procesos y no
// invoca PNPM. `pnpm test` ya los descubre por glob (`test/**/*.test.ts`); un
// runner agregador solo duplicaria la ejecucion.
//
// Todo el mapeo es dinamico (descubrimiento por fs): un caso de uso nuevo queda
// cubierto sin registrarlo a mano. Los censos numericos se assertan solo como
// PISO documentado de la Fase B, nunca como igualdad cerrada.

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const applicationDir = "server/features/logistics/application";
const applicationIndexFile = `${applicationDir}/index.ts`;
const applicationPortsDir = `${applicationDir}/ports`;
const unitTestDir = "test/unit/application/logistics";
const routesDir = "server/routes";

const selfTestFile = "logistics-application-use-case-suite-completeness.test.ts";

// Piso de la Fase B (M06-M10): nueve modulos de caso de uso, nueve tests
// correlativos, nueve factories publicas y nueve puertos.
const PHASE_B_FLOOR = 9;

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function toRepoRelativePath(path: string): string {
  return path.replaceAll("\\", "/");
}

// --- Normalizacion de fuente -------------------------------------------------

type LiteralRange = { start: number; end: number };

type StrippedSource = {
  withoutComments: string;
  codeOnly: string;
  literalRanges: LiteralRange[];
};

function stripSource(source: string): StrippedSource {
  let withoutComments = "";
  let codeOnly = "";
  let index = 0;
  const length = source.length;
  const literalRanges: LiteralRange[] = [];
  const templateFrames: number[] = [];
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

function listImportSpecifiers(source: string): string[] {
  const { withoutComments, literalRanges } = stripSource(source);
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

// --- Descubrimiento ----------------------------------------------------------

function listTsFilesIn(relativeDir: string, predicate: (name: string) => boolean): string[] {
  return readdirSync(join(repoRoot, relativeDir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

// Modulos de caso de uso: archivos top-level de application, sin el barrel.
function listUseCaseModules(): string[] {
  return listTsFilesIn(
    applicationDir,
    (name) => name.endsWith(".ts") && name !== "index.ts",
  ).map((name) => name.replace(/\.ts$/, ""));
}

function listPortFiles(): string[] {
  return listTsFilesIn(applicationPortsDir, (name) => name.endsWith(".ts"));
}

// Tests unitarios application, excluido este propio contrato de inventario.
function listUnitTestBasenames(): string[] {
  return listTsFilesIn(
    unitTestDir,
    (name) => name.endsWith(".test.ts") && name !== selfTestFile,
  ).map((name) => name.replace(/\.test\.ts$/, ""));
}

function listLogisticsRouteFiles(): string[] {
  return listTsFilesIn(routesDir, (name) =>
    /^logistics-[\w-]+\.fastify\.ts$/.test(name),
  ).map((name) => `${routesDir}/${name}`);
}

// --- Parseo del barrel -------------------------------------------------------

type BarrelExport = {
  name: string;
  isType: boolean;
  specifier: string;
  target: string;
};

function parseBarrelExports(): BarrelExport[] {
  const source = readText(applicationIndexFile);
  const { withoutComments, literalRanges } = stripSource(source);
  const startsInsideLiteral = (offset: number): boolean =>
    literalRanges.some((range) => offset >= range.start && offset < range.end);

  const exports: BarrelExport[] = [];

  for (const match of withoutComments.matchAll(
    /\bexport\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
  )) {
    if (match.index === undefined || startsInsideLiteral(match.index)) {
      continue;
    }

    const isTypeBlock = match[1] !== undefined;
    const specifier = match[3] ?? "";
    const target = resolveRelativeTsSpecifier(applicationIndexFile, specifier);

    for (const rawEntry of (match[2] ?? "").split(",")) {
      const entry = rawEntry.trim();
      if (entry.length === 0) {
        continue;
      }

      const isTypeEntry = isTypeBlock || /^type\s+/.test(entry);
      const withoutTypeKeyword = entry.replace(/^type\s+/, "").trim();
      // `X as Y` publica Y; el nombre publicado es el que consume la ruta.
      const aliasMatch = withoutTypeKeyword.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      const name = aliasMatch ? aliasMatch[1] : withoutTypeKeyword;

      exports.push({ name, isType: isTypeEntry, specifier, target });
    }
  }

  return exports;
}

// --- Contratos ---------------------------------------------------------------

test("la suite de casos de uso application no esta vacia y conserva el piso de la Fase B", () => {
  const modules = listUseCaseModules();
  const tests = listUnitTestBasenames();
  const ports = listPortFiles();
  const factories = parseBarrelExports().filter((entry) => !entry.isType);

  assert.ok(
    modules.length >= PHASE_B_FLOOR,
    `${applicationDir} debe conservar al menos ${PHASE_B_FLOOR} modulos de caso de uso (M06-M10); hay ${modules.length}`,
  );
  assert.ok(
    tests.length >= PHASE_B_FLOOR,
    `${unitTestDir} debe conservar al menos ${PHASE_B_FLOOR} tests unitarios; hay ${tests.length}`,
  );
  assert.ok(
    ports.length >= PHASE_B_FLOOR,
    `${applicationPortsDir} debe conservar al menos ${PHASE_B_FLOOR} puertos; hay ${ports.length}`,
  );
  assert.ok(
    factories.length >= PHASE_B_FLOOR,
    `${applicationIndexFile} debe exponer al menos ${PHASE_B_FLOOR} factories publicas; hay ${factories.length}`,
  );
});

test("cada modulo de caso de uso tiene su test unitario correlativo", () => {
  const tests = new Set(listUnitTestBasenames());

  const modulesWithoutTest = listUseCaseModules()
    .filter((moduleName) => !tests.has(moduleName))
    .map(
      (moduleName) =>
        `${applicationDir}/${moduleName}.ts: modulo de caso de uso sin test ("${unitTestDir}/${moduleName}.test.ts")`,
    );

  assert.deepEqual(modulesWithoutTest, []);
});

test("no existen tests unitarios application huerfanos", () => {
  const modules = new Set(listUseCaseModules());

  const orphanTests = listUnitTestBasenames()
    .filter((testName) => !modules.has(testName))
    .map(
      (testName) =>
        `${unitTestDir}/${testName}.test.ts: test huerfano sin modulo de caso de uso ("${applicationDir}/${testName}.ts")`,
    );

  assert.deepEqual(orphanTests, []);
});

test("cada factory publica del barrel pertenece a un modulo de caso de uso y esta cubierta por su test", () => {
  const violations: string[] = [];
  const modules = new Set(listUseCaseModules());

  for (const factory of parseBarrelExports().filter((entry) => !entry.isType)) {
    const moduleName = factory.target
      .replace(`${applicationDir}/`, "")
      .replace(/\.ts$/, "");

    if (!modules.has(moduleName)) {
      violations.push(
        `${applicationIndexFile}: factory "${factory.name}" no resuelve a un modulo de caso de uso ("${factory.specifier}")`,
      );
      continue;
    }

    const testFile = `${unitTestDir}/${moduleName}.test.ts`;

    if (!existsSync(join(repoRoot, testFile))) {
      violations.push(
        `${applicationIndexFile}: factory "${factory.name}" sin test correlativo ("${testFile}")`,
      );
      continue;
    }

    if (!new RegExp(`\\b${factory.name}\\b`).test(readText(testFile))) {
      violations.push(
        `${testFile}: no referencia la factory publica "${factory.name}"`,
      );
    }
  }

  assert.deepEqual(violations, []);
});

test("cada factory publica se compone exactamente una vez en las rutas de Logistics", () => {
  const violations: string[] = [];
  const routeFiles = listLogisticsRouteFiles();

  assert.ok(routeFiles.length > 0, `${routesDir} debe contener rutas logistics-*.fastify.ts`);

  // Solo codigo: ni imports sin invocacion, ni strings, ni comentarios cuentan
  // como composicion.
  const routeSources = routeFiles.map((file) => ({
    file,
    codeOnly: stripSource(readText(file)).codeOnly,
  }));

  for (const factory of parseBarrelExports().filter((entry) => !entry.isType)) {
    const callPattern = new RegExp(`\\b${factory.name}\\s*\\(`, "g");
    const callSites: string[] = [];

    for (const { file, codeOnly } of routeSources) {
      const occurrences = codeOnly.match(callPattern)?.length ?? 0;

      for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
        callSites.push(file);
      }
    }

    if (callSites.length === 0) {
      violations.push(
        `${applicationIndexFile}: factory "${factory.name}" sin composicion en ninguna ruta de Logistics`,
      );
      continue;
    }

    if (callSites.length > 1) {
      violations.push(
        `${applicationIndexFile}: factory "${factory.name}" compuesta ${callSites.length} veces (${callSites.join(", ")})`,
      );
    }
  }

  assert.deepEqual(violations, []);
});

test("cada puerto se exporta como tipo, pertenece a un caso de uso y esta cubierto por un test", () => {
  const violations: string[] = [];
  const barrelExports = parseBarrelExports();
  const unitTestSources = listUnitTestBasenames().map((testName) =>
    readText(`${unitTestDir}/${testName}.test.ts`),
  );

  // Puertos consumidos por cada modulo de caso de uso, por resolucion de import.
  const portsConsumedByUseCases = new Set<string>();
  for (const moduleName of listUseCaseModules()) {
    const moduleFile = `${applicationDir}/${moduleName}.ts`;

    for (const specifier of listImportSpecifiers(readText(moduleFile))) {
      if (!specifier.startsWith(".")) {
        continue;
      }

      portsConsumedByUseCases.add(resolveRelativeTsSpecifier(moduleFile, specifier));
    }
  }

  for (const portName of listPortFiles()) {
    const portFile = `${applicationPortsDir}/${portName}`;

    const typeExports = barrelExports.filter(
      (entry) => entry.isType && entry.target === portFile,
    );

    if (typeExports.length === 0) {
      violations.push(`${portFile}: puerto no exportado como tipo por el barrel publico`);
      continue;
    }

    if (!portsConsumedByUseCases.has(portFile)) {
      violations.push(`${portFile}: puerto sin ningun modulo de caso de uso que lo consuma`);
    }

    const isReferencedByAnyTest = typeExports.some((entry) =>
      unitTestSources.some((source) => new RegExp(`\\b${entry.name}\\b`).test(source)),
    );

    if (!isReferencedByAnyTest) {
      violations.push(
        `${portFile}: ningun test unitario application referencia sus tipos exportados (${typeExports
          .map((entry) => entry.name)
          .join(", ")})`,
      );
    }
  }

  assert.deepEqual(violations, []);
});

test("los tests unitarios application conservan la higiene minima de la suite", () => {
  const violations: string[] = [];

  const FORBIDDEN_TEST_IMPORTS: Array<{ label: string; pattern: RegExp }> = [
    { label: "fastify", pattern: /^fastify(\/|$)/ },
    { label: "persistencia server/db", pattern: /(^|\/)db(\.ts)?$/i },
    { label: "modulo db-* concreto", pattern: /(^|\/)db-[\w-]+(\.ts)?$/i },
    { label: "drizzle-orm", pattern: /^drizzle-orm(\/|$)/ },
    { label: "schema drizzle", pattern: /(^|\/)drizzle(\/|$)/i },
    { label: "ruta concreta", pattern: /(^|\/)routes(\/|$)/ },
  ];

  for (const testName of listUnitTestBasenames()) {
    const testFile = `${unitTestDir}/${testName}.test.ts`;
    const source = readText(testFile);

    if (!source.includes("node:test")) {
      violations.push(`${testFile}: no importa node:test`);
    }

    if (!source.includes("node:assert/strict")) {
      violations.push(`${testFile}: no importa node:assert/strict`);
    }

    if (/^\s*export\s+/m.test(stripSource(source).codeOnly)) {
      violations.push(`${testFile}: exporta simbolos, debe quedar local a los tests`);
    }

    for (const specifier of listImportSpecifiers(source)) {
      const target = specifier.startsWith(".")
        ? resolveRelativeTsSpecifier(testFile, specifier)
        : toRepoRelativePath(specifier);

      for (const { label, pattern } of FORBIDDEN_TEST_IMPORTS) {
        if (pattern.test(target)) {
          violations.push(`${testFile}: import prohibido de ${label} ("${specifier}")`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("el contrato de inventario no reejecuta la suite ni lanza procesos", () => {
  const source = readText(`${unitTestDir}/${selfTestFile}`);
  const { codeOnly } = stripSource(source);

  for (const { label, pattern } of [
    { label: "spawn de procesos", pattern: /\b(spawn|spawnSync|exec|execSync|execFile|fork)\s*\(/ },
    { label: "invocacion de PNPM", pattern: /\bpnpm\b/ },
    { label: "ejecucion de tests hijos", pattern: /\brun\s*\(\s*\{/ },
  ]) {
    assert.equal(
      pattern.test(codeOnly),
      false,
      `el contrato de inventario no debe contener ${label}`,
    );
  }

  // No importa los modulos de caso de uso: solo lee sus fuentes.
  for (const specifier of listImportSpecifiers(source)) {
    assert.equal(
      specifier.startsWith("."),
      false,
      `el contrato de inventario no debe importar modulos del repo ("${specifier}")`,
    );
  }
});
