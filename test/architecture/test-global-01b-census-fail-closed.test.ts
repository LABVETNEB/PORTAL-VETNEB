import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  countLines,
  countOccurrences,
  createInMemoryCorpus,
  filesMatching,
  filesUnder,
  normalizePath,
  specFiles,
} from "../helpers/census/corpus.ts";
import { classifySpec, classifyCorpus, inventory } from "../helpers/census/classify.ts";
import { couplingCensus } from "../helpers/census/coupling.ts";
import {
  ownershipCensus,
  readDestinationCensus,
} from "../helpers/census/ownership.ts";
import {
  stalePathCensus,
  staleRegistryEvidence,
} from "../helpers/census/stale-paths.ts";
import {
  type CensusEntry,
  declarationViolation,
  evaluateEntry,
  guardViolation,
  ledgerViolations,
} from "../helpers/census/ledger.ts";
import {
  analyzeTapOutput,
  parseTapEntries,
  paretoAnalysis,
} from "../helpers/census/tap-performance.ts";

/**
 * TEST-GLOBAL-01B — prueba negativa del censo.
 *
 * El censo de `01B` es un control, y un control que nunca se ejerció contra
 * una violación es una suposición (§16). Esta prueba mutila deliberadamente
 * las tres superficies del instrumento y exige rojo en las tres:
 *
 *   1. input inválido            → el tooling falla de forma explícita
 *   2. material inconsistente    → la regla de libro mayor declara violación
 *   3. invariante congelable roto→ el guard declara violación
 *
 * Las mutaciones ocurren sobre corpus sintéticos en memoria: no se toca el
 * árbol, no se escribe disco y ningún spec existente se modifica.
 */

/**
 * Los marcadores y los paths sintéticos se componen en tiempo de ejecución a
 * propósito: escribirlos literalmente haría que este archivo se contara a sí
 * mismo en el censo real del árbol (`stalePathCensus`, `ownershipCensus`) y
 * volvería rojo un invariante que aquí sólo se está probando. Ningún token
 * entrecomillado de este archivo contiene, de punta a punta, un path con
 * forma de repo — la prueba de regresión al final de este archivo lo verifica
 * contra el propio `PATH_LITERAL` del censo.
 */
const ONLY_CALL = [".only", "("].join("");
const MOCK_CALL = ["mock", ".fn("].join("");
const FS_IMPORT = ['import { readFileSync } from "node', ':fs";'].join("");
const DIR_IMPORT = ['import { read', 'dirSync } from "node', ':fs";'].join("");
const DIR_CALL = ["read", "dirSync"].join("");

/**
 * Compone un path sintético con forma de repo a partir de segmentos
 * separados: ningún token entrecomillado de este archivo llega a contener
 * `raíz/resto` completo, así que `PATH_LITERAL` no lo ve como una referencia
 * real (§9.3).
 */
function fixturePath(...segments: readonly string[]): string {
  return segments.join("/");
}

const PRICING_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "domain",
  "pricing-rules.test.ts",
);
const PRICING_SOURCE_PATH = fixturePath("server", "lib", "pricing.ts");
const ABSENT_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "domain",
  "absent.test.ts",
);
const PLACEHOLDER_SPEC_PATH = fixturePath("test", "x.test.ts");
const ROOT_LEVEL_SPEC_PATH = fixturePath("test", "root-level.test.ts");
const FOCUSED_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "domain",
  "focused.test.ts",
);
const DOUBLES_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "domain",
  "doubles.test.ts",
);
const PANEL_SOURCE_PATH = fixturePath(
  "frontend",
  "src",
  "components",
  "panel.tsx",
);
const COMPONENTS_DIR = fixturePath("frontend", "src", "components");
const PANEL_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "ui",
  "panel-empty-state.test.ts",
);
const WALKER_SPEC_PATH = fixturePath(
  "test",
  "architecture",
  "panel-walker-guard.test.ts",
);
const OPAQUE_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "contracts",
  "opaque.test.ts",
);
const REPORTS_ROUTE_PATH = fixturePath(
  "server",
  "routes",
  "reports.fastify.ts",
);
const EVIDENCE_REGISTRY_SPEC_PATH = fixturePath(
  "test",
  "architecture",
  "security",
  "evidence-registry.test.ts",
);
const STALE_EVIDENCE_PATH = fixturePath("test", "reports.fastify.test.ts");
const REPORTS_VIEW_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "ui",
  "reports-view.test.ts",
);
const CODEOWNERS_PATH = fixturePath(".github", "CODEOWNERS");
const OWNERSHIP_SPEC_PATH = fixturePath(
  "test",
  "architecture",
  "ownership-reference.test.ts",
);
const EXAMPLE_HELPER_PATH = fixturePath(
  "test",
  "helpers",
  "example-helper.ts",
);
const MENTIONS_ONLY_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "domain",
  "mentions-helper-by-name.test.ts",
);
const IMPORTS_HELPER_SPEC_PATH = fixturePath(
  "test",
  "unit",
  "domain",
  "imports-helper.test.ts",
);

function syntheticSpec(body: string): string {
  return [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    "",
    body,
    "",
  ].join("\n");
}

const HEALTHY_CORPUS = createInMemoryCorpus({
  [PRICING_SPEC_PATH]: syntheticSpec(
    [
      'test("pricing rule rejects a negative amount", () => {',
      "  assert.equal(typeof 1, \"number\");",
      "});",
    ].join("\n"),
  ),
  [PRICING_SOURCE_PATH]: "export const pricing = 1;\n",
});

test("01B fail-closed: un path inválido rompe el tooling de forma explícita", () => {
  assert.throws(() => normalizePath(""), /non-empty string/);
  assert.throws(
    () => normalizePath(undefined as unknown as string),
    /non-empty string/,
  );
  assert.throws(
    () => countLines(undefined as unknown as string),
    /requires a string/,
  );
  assert.throws(
    () => HEALTHY_CORPUS.read(ABSENT_SPEC_PATH),
    /not part of the census corpus/,
  );
  assert.throws(
    () =>
      createInMemoryCorpus({
        [PLACEHOLDER_SPEC_PATH]: 1 as unknown as string,
      }),
    /must hold string contents/,
  );
  assert.throws(
    () => createInMemoryCorpus(null as unknown as Record<string, string>),
    /object of file entries/,
  );
});

test("01B fail-closed: un argumento de censo inválido no se degrada en silencio", () => {
  const files = specFiles(HEALTHY_CORPUS);

  assert.throws(
    () =>
      filesMatching(HEALTHY_CORPUS, files, "readFileSync" as unknown as RegExp),
    /RegExp pattern is required/,
  );
  assert.throws(
    () => countOccurrences(HEALTHY_CORPUS, files, /assert\./),
    /requires a global RegExp/,
  );
  assert.throws(
    () => filesUnder(null as unknown as never, "test"),
    /census corpus with files and read/,
  );
  assert.throws(
    () => classifySpec(HEALTHY_CORPUS, PRICING_SOURCE_PATH),
    /not an executable spec/,
  );
  assert.throws(
    () => readDestinationCensus(HEALTHY_CORPUS, []),
    /destination prefix is required/,
  );
  assert.throws(
    () => staleRegistryEvidence(HEALTHY_CORPUS, PRICING_SPEC_PATH, ""),
    /registry field name is required/,
  );
});

test("01B fail-closed: un invariante congelable violado pone el censo en rojo", () => {
  const breached = createInMemoryCorpus({
    [ROOT_LEVEL_SPEC_PATH]: syntheticSpec(
      'test("spec en raíz", () => { assert.ok(true); });',
    ),
    [FOCUSED_SPEC_PATH]: syntheticSpec(
      [
        `test${ONLY_CALL}"caso enfocado", () => {`,
        "  assert.ok(true);",
        "});",
      ].join("\n"),
    ),
    [DOUBLES_SPEC_PATH]: syntheticSpec(
      [
        'test("usa la API de dobles", () => {',
        `  const spy = ${MOCK_CALL});`,
        "  assert.ok(spy);",
        "});",
      ].join("\n"),
    ),
  });
  const breachedSpecs = specFiles(breached);
  const breachedInventory = inventory(breached);

  // El censo detecta cada violación…
  assert.equal(breachedInventory.rootSpecs.length, 1);
  assert.equal(
    filesMatching(breached, breachedSpecs, /\.only\(/).length,
    1,
  );
  assert.equal(
    filesMatching(breached, breachedSpecs, /mock\.(fn|method|module|timers)/)
      .length,
    1,
  );

  // …y el guard congelado la convierte en rojo, no en advertencia.
  const frozenEntry: CensusEntry = {
    row: "A0-06-ABSENCES",
    section: "§6.1",
    metric: "specs en test/ raíz",
    historical: 0,
    compute: () => breachedInventory.rootSpecs.length,
    resolution: "REPRODUCED",
    guard: { kind: "FROZEN_EXACT" },
    motive:
      "Congelado en 0: su cambio exige revisión humana del layout de la suite.",
  };

  assert.equal(declarationViolation(frozenEntry), null);
  assert.match(
    guardViolation(frozenEntry, evaluateEntry(frozenEntry)) ?? "",
    /invariante congelado en 0; vigente 1/,
  );
  assert.equal(ledgerViolations([frozenEntry]).length, 1);
});

test("01B fail-closed: una cota de no-regresión superada pone el censo en rojo", () => {
  const entry: CensusEntry = {
    row: "A0-09-PATHS",
    section: "§9.2",
    metric: "paths muertos en un registro de evidencia",
    historical: 11,
    compute: () => 12,
    resolution: "REPRODUCED",
    guard: { kind: "NON_INCREASING" },
    motive:
      "Invariante de no-regresión: una entrada muerta más exige revisión humana.",
  };

  assert.match(
    guardViolation(entry, evaluateEntry(entry)) ?? "",
    /supera la cota de no-regresión 11/,
  );
  assert.equal(
    guardViolation(
      { ...entry, compute: () => 11 },
      evaluateEntry({ ...entry, compute: () => 11 }),
    ),
    null,
  );
});

test("01B fail-closed: una cifra fuera de banda pone el censo en rojo", () => {
  const entry: CensusEntry = {
    row: "A0-06-VOLUME",
    section: "§6.1",
    metric: "specs ejecutables",
    historical: 100,
    compute: () => 140,
    resolution: "REPRODUCED",
    guard: { kind: "TOLERANCE_BAND", tolerance: 0.25 },
    motive: "Volumen que crece por trabajo legítimo: banda, nunca igualdad.",
  };

  assert.match(
    guardViolation(entry, evaluateEntry(entry)) ?? "",
    /sale de la banda 100 ± 25/,
  );
  assert.equal(
    guardViolation(
      { ...entry, compute: () => 125 },
      evaluateEntry({ ...entry, compute: () => 125 }),
    ),
    null,
  );
});

test("01B fail-closed: una declaración inconsistente pone el censo en rojo", () => {
  const admissible: CensusEntry = {
    row: "A0-07-BUCKETS",
    section: "§7.2",
    metric: "specs que leen filesystem y nunca ejecutan runtime",
    historical: 351,
    baseline: 362,
    compute: () => 362,
    resolution: "RECLASSIFIED",
    guard: { kind: "TOLERANCE_BAND", tolerance: 0.25 },
    motive:
      "El scratchpad de A.4 no es recuperable; la definición versionada resuelve el import de producción por path y mueve archivos entre buckets, de modo que la cifra difiere por definición y no por el árbol.",
  };

  assert.equal(declarationViolation(admissible), null);

  // Reclasificación sin diferencia numérica: etiqueta falsa.
  assert.match(
    declarationViolation({ ...admissible, baseline: 351 }) ?? "",
    /sin diferencia numérica/,
  );

  // Reclasificación sin el valor que produce el tooling.
  assert.match(
    declarationViolation({ ...admissible, baseline: undefined }) ?? "",
    /declara el valor que produce el tooling/,
  );

  // Baseline de reclasificación no finito, fraccionario o negativo.
  for (const invalidBaseline of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
  ]) {
    assert.match(
      declarationViolation({ ...admissible, baseline: invalidBaseline }) ?? "",
      /entero finito no negativo/,
      `baseline ${invalidBaseline} debe ser rechazado`,
    );
    assert.throws(
      () => evaluateEntry({ ...admissible, baseline: invalidBaseline }),
      /finite non-negative integer/,
      `evaluateEntry no puede aceptar baseline ${invalidBaseline}`,
    );
  }

  // Reclasificación sin razón verificable.
  assert.match(
    declarationViolation({ ...admissible, motive: "Difiere del scratchpad original de la auditoría." }) ??
      "",
    /razón verificable/,
  );

  // Cifra reproducida que se ancla en un baseline propio.
  assert.match(
    declarationViolation({ ...admissible, resolution: "REPRODUCED" }) ?? "",
    /se ancla en el histórico/,
  );

  // Invariante congelado sobre una magnitud que no es un invariante.
  assert.match(
    declarationViolation({
      ...admissible,
      resolution: "REPRODUCED",
      baseline: undefined,
      guard: { kind: "FROZEN_EXACT" },
    }) ?? "",
    /sólo se congelan invariantes en 0/,
  );

  // Banda que deja de ser umbral.
  assert.match(
    declarationViolation({
      ...admissible,
      guard: { kind: "TOLERANCE_BAND", tolerance: 5 },
    }) ?? "",
    /no un pase libre/,
  );

  // Motivo ausente.
  assert.match(
    declarationViolation({ ...admissible, motive: "porque sí" }) ?? "",
    /motivo por escrito/,
  );
});

test("01B fail-closed: un libro mayor vacío o un cálculo roto no pasan", () => {
  assert.throws(() => ledgerViolations([]), /cannot be empty/);
  assert.throws(
    () =>
      evaluateEntry({
        row: "A0-06-VOLUME",
        section: "§6.1",
        metric: "cálculo roto",
        historical: 1,
        compute: () => Number.NaN,
        resolution: "REPRODUCED",
        guard: { kind: "FROZEN_EXACT" },
        motive: "Entrada sintética para probar que un cálculo roto no pasa.",
      }),
    /non-negative integer/,
  );
  assert.throws(
    () =>
      evaluateEntry({
        row: "A0-06-VOLUME",
        section: "§6.1",
        metric: "cálculo ausente",
        historical: 1,
        compute: undefined as unknown as () => number,
        resolution: "REPRODUCED",
        guard: { kind: "FROZEN_EXACT" },
        motive: "Entrada sintética para probar que falta el cálculo.",
      }),
    /without computation/,
  );
});

test("01B fail-closed: el clasificador no adjudica lo que no puede probar", () => {
  const corpus = createInMemoryCorpus({
    [PANEL_SOURCE_PATH]: "export const Panel = () => null;\n",
    [PANEL_SPEC_PATH]: syntheticSpec(
      [
        FS_IMPORT,
        "",
        'test("el panel muestra su empty state y el foco de navegación", () => {',
        `  const source = readFileSync("${PANEL_SOURCE_PATH}", "utf8");`,
        '  assert.ok(source.includes("empty state"));',
        '  assert.ok(source.includes("loading"));',
        "});",
      ].join("\n"),
    ),
    [WALKER_SPEC_PATH]: syntheticSpec(
      [
        DIR_IMPORT,
        "",
        'test("ningún componente nuevo introduce el patrón prohibido", () => {',
        `  const offenders = ${DIR_CALL}("${COMPONENTS_DIR}");`,
        "  assert.deepEqual(offenders, []);",
        "});",
      ].join("\n"),
    ),
  });
  const census = couplingCensus(corpus);
  const byPath = new Map(
    census.specs.map((spec) => [spec.path, spec.oracleClass]),
  );

  assert.equal(byPath.get(PANEL_SPEC_PATH), "ACCIDENTAL_COUPLING_CANDIDATE");
  assert.equal(byPath.get(WALKER_SPEC_PATH), "LEGITIMATE_GUARD");

  // Un spec sin ninguna señal cae en revisión humana, no en una etiqueta
  // optimista: el clasificador es fail-open hacia la revisión, no hacia el
  // veredicto.
  const opaque = couplingCensus(
    createInMemoryCorpus({
      [OPAQUE_SPEC_PATH]: syntheticSpec(
        'test("contrato opaco", () => { assert.ok(true); });',
      ),
    }),
  );

  assert.equal(
    opaque.specs[0]?.oracleClass,
    "UNKNOWN_REQUIRES_REVIEW",
  );
});

test("01B fail-closed: el censo detecta material stale y ownership difuso", () => {
  const corpus = createInMemoryCorpus({
    [REPORTS_ROUTE_PATH]: "export const reports = 1;\n",
    [EVIDENCE_REGISTRY_SPEC_PATH]: syntheticSpec(
      [
        "const CONTRACTS = [",
        "  {",
        '    id: "reports",',
        `    requiredTestEvidence: ["${STALE_EVIDENCE_PATH}", "${REPORTS_ROUTE_PATH}"],`,
        "  },",
        "];",
        "",
        'test("el registro declara evidencia", () => {',
        "  assert.equal(CONTRACTS.length, 1);",
        "});",
      ].join("\n"),
    ),
    [REPORTS_VIEW_SPEC_PATH]: syntheticSpec(
      [
        'test("la vista de reportes apunta a su ruta", () => {',
        `  assert.ok("${REPORTS_ROUTE_PATH}".length > 0);`,
        "});",
      ].join("\n"),
    ),
  });

  const stale = staleRegistryEvidence(
    corpus,
    EVIDENCE_REGISTRY_SPEC_PATH,
    "requiredTestEvidence",
  );

  assert.deepEqual(stale, [STALE_EVIDENCE_PATH]);

  const paths = stalePathCensus(corpus);

  assert.equal(paths.totals.missingPaths, 1);
  assert.equal(
    paths.references.find(
      (reference) => reference.path === REPORTS_ROUTE_PATH,
    )?.exists,
    true,
  );

  const ownership = ownershipCensus(corpus);

  assert.equal(
    ownership.entries.find(
      (entry) => entry.productionFile === REPORTS_ROUTE_PATH,
    )?.guards.length,
    2,
  );
});

test("01B fail-closed: un archivo tracked sin extensión no se reporta missing", () => {
  // Regresión del finding: un archivo tracked sin extensión (CODEOWNERS bajo
  // .github es el caso real del repo) no debe caer en la rama "¿parece un
  // archivo?" antes de resolverse contra el conjunto tracked — eso lo
  // clasificaba como missing pese a existir. La pertenencia al conjunto
  // tracked tiene precedencia sobre cualquier heurística de extensión.
  const corpus = createInMemoryCorpus({
    [CODEOWNERS_PATH]: "* @vetneb\n",
    [OWNERSHIP_SPEC_PATH]: syntheticSpec(
      [
        'test("referencia CODEOWNERS", () => {',
        `  assert.ok("${CODEOWNERS_PATH}".length > 0);`,
        "});",
      ].join("\n"),
    ),
  });

  const paths = stalePathCensus(corpus);
  const codeowners = paths.references.find(
    (reference) => reference.path === CODEOWNERS_PATH,
  );

  assert.equal(codeowners?.exists, true);
  assert.equal(paths.totals.missingPaths, 0);
  assert.equal(
    paths.missing.some((reference) => reference.path === CODEOWNERS_PATH),
    false,
  );
});

test("01B fail-closed: sólo un import real cuenta como consumidor de soporte", () => {
  // Regresión del finding: una mención textual del nombre de un módulo (un
  // literal pasado a otra función, un comentario) no es un import. Sólo un
  // `import ... from "..."` (u otra forma real: `import "..."`, `import(...)`,
  // `require(...)`) resuelto por path relativo hasta el módulo cuenta.
  const helperModuleName = EXAMPLE_HELPER_PATH.replace(/^test\//, "").replace(
    /\.ts$/,
    "",
  );
  const corpus = createInMemoryCorpus({
    [EXAMPLE_HELPER_PATH]: "export const helperValue = 1;\n",
    [MENTIONS_ONLY_SPEC_PATH]: syntheticSpec(
      [
        'test("menciona el módulo por nombre sin importarlo", () => {',
        `  const label = "${helperModuleName}";`,
        "  assert.ok(label.length > 0);",
        "});",
      ].join("\n"),
    ),
    [IMPORTS_HELPER_SPEC_PATH]: syntheticSpec(
      [
        `import { helperValue } from "../../helpers/example-helper.ts";`,
        "",
        'test("importa el helper de verdad", () => {',
        "  assert.equal(helperValue, 1);",
        "});",
      ].join("\n"),
    ),
  });

  const ownership = ownershipCensus(corpus);
  const entry = ownership.supportConsumers.find(
    (support) => support.supportFile === EXAMPLE_HELPER_PATH,
  );

  assert.deepEqual(entry?.consumers, [IMPORTS_HELPER_SPEC_PATH]);
  assert.equal(
    entry?.consumers.includes(MENTIONS_ONLY_SPEC_PATH),
    false,
    "una mención textual del nombre del módulo no debe contar como import",
  );
});

test("01B fail-closed: el procesador TAP recomputa duración, ranking y Pareto", () => {
  // TAP sintético con la misma forma que emite `node --test-reporter=tap`:
  // un padre con hijos anidados (indentación +4) cuyo propio resumen aparece
  // DESPUÉS de sus hijos, y dos entradas planas sin anidar.
  const tap = [
    "TAP version 13",
    "# Subtest: parent with children",
    "    # Subtest: child one",
    "    ok 1 - child one",
    "      ---",
    "      duration_ms: 10",
    "      type: 'test'",
    "      ...",
    "    # Subtest: child two",
    "    ok 2 - child two",
    "      ---",
    "      duration_ms: 30",
    "      type: 'test'",
    "      ...",
    "    1..2",
    "ok 1 - parent with children",
    "  ---",
    "  duration_ms: 45",
    "  type: 'test'",
    "  ...",
    "# Subtest: flat entry",
    "ok 2 - flat entry",
    "  ---",
    "  duration_ms: 5",
    "  type: 'test'",
    "  ...",
    "1..2",
    "# tests 4",
    "# pass 4",
    "# fail 0",
  ].join("\n");

  const entries = parseTapEntries(tap);

  assert.deepEqual(
    [...entries].sort((left, right) => left.name.localeCompare(right.name)),
    [
      { name: "child one", durationMs: 10 },
      { name: "child two", durationMs: 30 },
      { name: "flat entry", durationMs: 5 },
      { name: "parent with children", durationMs: 45 },
    ].sort((left, right) => left.name.localeCompare(right.name)),
  );

  const result = analyzeTapOutput(tap);

  // total = 10 + 30 + 45 + 5 = 90; ranking desc: parent(45) child two(30)
  // child one(10) flat(5). 50 % de 90 = 45 → alcanzado en la 1ª entrada.
  // 80 % de 90 = 72 → 45+30=75 en la 2ª entrada.
  assert.equal(result.totalDurationMs, 90);
  assert.deepEqual(
    result.entries.map((entry) => entry.name),
    ["parent with children", "child two", "child one", "flat entry"],
  );
  assert.equal(result.entriesFor50Percent, 1);
  assert.equal(result.entriesFor80Percent, 2);

  // Determinismo: el mismo TAP produce el mismo resultado.
  assert.deepEqual(analyzeTapOutput(tap), analyzeTapOutput(tap));
});

test("01B fail-closed: el procesador TAP rechaza input inválido de forma explícita", () => {
  assert.throws(() => parseTapEntries(""), /non-empty string/);
  assert.throws(
    () => parseTapEntries(undefined as unknown as string),
    /non-empty string/,
  );
  assert.throws(
    () => parseTapEntries("TAP version 13\nno hay entradas aquí\n"),
    /no ok\/not ok result lines/,
  );
  assert.throws(
    () =>
      parseTapEntries(
        ["ok 1 - entrada sin duración resoluble", "1..1"].join("\n"),
      ),
    /without a resolvable duration_ms/,
  );
  assert.throws(() => paretoAnalysis([]), /at least one TAP entry/);
  assert.throws(
    () =>
      paretoAnalysis([{ name: "negativa", durationMs: -1 }]),
    /non-finite or negative duration/,
  );
  assert.throws(
    () =>
      paretoAnalysis([{ name: "no finita", durationMs: Number.NaN }]),
    /non-finite or negative duration/,
  );
  assert.throws(
    () =>
      paretoAnalysis([
        { name: "cero uno", durationMs: 0 },
        { name: "cero dos", durationMs: 0 },
      ]),
    /aggregate duration/,
  );
});

test("01B fail-closed: el censo es determinista sobre el mismo corpus", () => {
  const first = classifyCorpus(HEALTHY_CORPUS);
  const second = classifyCorpus(HEALTHY_CORPUS);

  assert.deepEqual(first.specs, second.specs);
  assert.deepEqual(first.byBucket, second.byBucket);
  assert.deepEqual(
    couplingCensus(HEALTHY_CORPUS).byClass,
    couplingCensus(HEALTHY_CORPUS).byClass,
  );
  assert.deepEqual(
    ownershipCensus(HEALTHY_CORPUS).entries,
    ownershipCensus(HEALTHY_CORPUS).entries,
  );
});

test("01B fail-closed: ningún path sintético de este archivo se filtra al censo real", () => {
  // Regresión del finding: los fixtures de este archivo antes escribían
  // paths con forma de repo como literales completos, y el censo real
  // (`stalePathCensus`) los interpretaba como referencias de producción de
  // este mismo archivo. Esta prueba lee el código fuente REAL de este
  // archivo desde disco y le aplica el `PATH_LITERAL` de `stale-paths.ts`:
  // ninguno de los paths sintéticos puede aparecer como literal completo.
  const PATH_LITERAL =
    /["'`]((?:server|frontend|shared|drizzle|scripts|test|docs|\.github)\/[A-Za-z0-9._\-/]*[A-Za-z0-9._-])["'`]/g;
  const ownPath = fileURLToPath(import.meta.url);
  const ownSource = readFileSync(ownPath, "utf8");
  const syntheticPaths = new Set([
    PRICING_SPEC_PATH,
    PRICING_SOURCE_PATH,
    ABSENT_SPEC_PATH,
    PLACEHOLDER_SPEC_PATH,
    ROOT_LEVEL_SPEC_PATH,
    FOCUSED_SPEC_PATH,
    DOUBLES_SPEC_PATH,
    PANEL_SOURCE_PATH,
    COMPONENTS_DIR,
    PANEL_SPEC_PATH,
    WALKER_SPEC_PATH,
    OPAQUE_SPEC_PATH,
    REPORTS_ROUTE_PATH,
    EVIDENCE_REGISTRY_SPEC_PATH,
    STALE_EVIDENCE_PATH,
    REPORTS_VIEW_SPEC_PATH,
    CODEOWNERS_PATH,
    OWNERSHIP_SPEC_PATH,
    EXAMPLE_HELPER_PATH,
    MENTIONS_ONLY_SPEC_PATH,
    IMPORTS_HELPER_SPEC_PATH,
  ]);

  assert.equal(syntheticPaths.size, 21);

  const leaked = [...ownSource.matchAll(PATH_LITERAL)]
    .map((match) => match[1] ?? "")
    .filter((path) => syntheticPaths.has(path));

  assert.deepEqual(
    leaked,
    [],
    "un path sintético de fixture apareció literal en el propio archivo",
  );
});
