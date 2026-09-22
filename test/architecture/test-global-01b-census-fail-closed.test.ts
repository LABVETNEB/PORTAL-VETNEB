import assert from "node:assert/strict";
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
 * Los marcadores se componen en tiempo de ejecución a propósito: escribirlos
 * literalmente haría que este archivo se contara a sí mismo en el censo del
 * árbol y volvería rojo un invariante que aquí sólo se está probando.
 */
const ONLY_CALL = [".only", "("].join("");
const MOCK_CALL = ["mock", ".fn("].join("");
const FS_IMPORT = ['import { readFileSync } from "node', ':fs";'].join("");
const DIR_IMPORT = ['import { read', 'dirSync } from "node', ':fs";'].join("");
const DIR_CALL = ["read", "dirSync"].join("");

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
  "test/unit/domain/pricing-rules.test.ts": syntheticSpec(
    [
      'test("pricing rule rejects a negative amount", () => {',
      "  assert.equal(typeof 1, \"number\");",
      "});",
    ].join("\n"),
  ),
  "server/lib/pricing.ts": "export const pricing = 1;\n",
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
    () => HEALTHY_CORPUS.read("test/unit/domain/absent.test.ts"),
    /not part of the census corpus/,
  );
  assert.throws(
    () =>
      createInMemoryCorpus({
        "test/x.test.ts": 1 as unknown as string,
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
    () => classifySpec(HEALTHY_CORPUS, "server/lib/pricing.ts"),
    /not an executable spec/,
  );
  assert.throws(
    () => readDestinationCensus(HEALTHY_CORPUS, []),
    /destination prefix is required/,
  );
  assert.throws(
    () =>
      staleRegistryEvidence(
        HEALTHY_CORPUS,
        "test/unit/domain/pricing-rules.test.ts",
        "",
      ),
    /registry field name is required/,
  );
});

test("01B fail-closed: un invariante congelable violado pone el censo en rojo", () => {
  const breached = createInMemoryCorpus({
    "test/root-level.test.ts": syntheticSpec(
      'test("spec en raíz", () => { assert.ok(true); });',
    ),
    "test/unit/domain/focused.test.ts": syntheticSpec(
      [
        `test${ONLY_CALL}"caso enfocado", () => {`,
        "  assert.ok(true);",
        "});",
      ].join("\n"),
    ),
    "test/unit/domain/doubles.test.ts": syntheticSpec(
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
    "frontend/src/components/panel.tsx": "export const Panel = () => null;\n",
    "test/unit/ui/panel-empty-state.test.ts": syntheticSpec(
      [
        FS_IMPORT,
        "",
        'test("el panel muestra su empty state y el foco de navegación", () => {',
        '  const source = readFileSync("frontend/src/components/panel.tsx", "utf8");',
        '  assert.ok(source.includes("empty state"));',
        '  assert.ok(source.includes("loading"));',
        "});",
      ].join("\n"),
    ),
    "test/architecture/panel-walker-guard.test.ts": syntheticSpec(
      [
        DIR_IMPORT,
        "",
        'test("ningún componente nuevo introduce el patrón prohibido", () => {',
        `  const offenders = ${DIR_CALL}("frontend/src/components");`,
        "  assert.deepEqual(offenders, []);",
        "});",
      ].join("\n"),
    ),
  });
  const census = couplingCensus(corpus);
  const byPath = new Map(
    census.specs.map((spec) => [spec.path, spec.oracleClass]),
  );

  assert.equal(
    byPath.get("test/unit/ui/panel-empty-state.test.ts"),
    "ACCIDENTAL_COUPLING_CANDIDATE",
  );
  assert.equal(
    byPath.get("test/architecture/panel-walker-guard.test.ts"),
    "LEGITIMATE_GUARD",
  );

  // Un spec sin ninguna señal cae en revisión humana, no en una etiqueta
  // optimista: el clasificador es fail-open hacia la revisión, no hacia el
  // veredicto.
  const opaque = couplingCensus(
    createInMemoryCorpus({
      "test/unit/contracts/opaque.test.ts": syntheticSpec(
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
    "server/routes/reports.fastify.ts": "export const reports = 1;\n",
    "test/architecture/security/evidence-registry.test.ts": syntheticSpec(
      [
        "const CONTRACTS = [",
        "  {",
        '    id: "reports",',
        '    requiredTestEvidence: ["test/reports.fastify.test.ts", "server/routes/reports.fastify.ts"],',
        "  },",
        "];",
        "",
        'test("el registro declara evidencia", () => {',
        "  assert.equal(CONTRACTS.length, 1);",
        "});",
      ].join("\n"),
    ),
    "test/unit/ui/reports-view.test.ts": syntheticSpec(
      [
        'test("la vista de reportes apunta a su ruta", () => {',
        '  assert.ok("server/routes/reports.fastify.ts".length > 0);',
        "});",
      ].join("\n"),
    ),
  });

  const stale = staleRegistryEvidence(
    corpus,
    "test/architecture/security/evidence-registry.test.ts",
    "requiredTestEvidence",
  );

  assert.deepEqual(stale, ["test/reports.fastify.test.ts"]);

  const paths = stalePathCensus(corpus);

  assert.equal(paths.totals.missingPaths, 1);
  assert.equal(
    paths.references.find(
      (reference) => reference.path === "server/routes/reports.fastify.ts",
    )?.exists,
    true,
  );

  const ownership = ownershipCensus(corpus);

  assert.equal(
    ownership.entries.find(
      (entry) => entry.productionFile === "server/routes/reports.fastify.ts",
    )?.guards.length,
    2,
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
