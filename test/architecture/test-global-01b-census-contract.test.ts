import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
  type CensusCorpus,
  countMatchingLines,
  countOccurrences,
  createTrackedCorpus,
  filesMatching,
  filesUnder,
  sourceFilesUnder,
  specFiles,
  totalLines,
} from "../helpers/census/corpus.ts";
import {
  type CensusClassification,
  classifyCorpus,
  inventory,
} from "../helpers/census/classify.ts";
import {
  ORACLE_CLASSES,
  SUBSTRING_DOMINANCE,
  couplingCensus,
} from "../helpers/census/coupling.ts";
import {
  DIFFUSED_OWNERSHIP_THRESHOLD,
  ownershipCensus,
} from "../helpers/census/ownership.ts";
import {
  stalePathCensus,
  staleRegistryEvidence,
} from "../helpers/census/stale-paths.ts";
import {
  type CensusEntry,
  type CensusGuard,
  type LedgerReport,
  declarationViolation,
  evaluateEntry,
  guardViolation,
  ledgerViolations,
} from "../helpers/census/ledger.ts";
import { analyzeTapOutput } from "../helpers/census/tap-performance.ts";

/**
 * TEST-GLOBAL-01B — contrato de censo.
 *
 * Regla de fuente única (§31.2 del documento rector `LIMPIEZA TEST GLOBAL`):
 *
 *   FUENTE DE VERDAD  el árbol tracked (`git ls-files` + lectura del árbol).
 *                     Ninguna cifra vigente se escribe a mano: cada una la
 *                     produce `compute()` sobre el corpus.
 *   CÁLCULO           el tooling versionado de `test/helpers/census/**`.
 *                     Determinista, sin red, sin `.env`, sin escribir disco.
 *   GUARD             este contrato. Compara el cálculo contra un INVARIANTE,
 *                     un UMBRAL o una BANDA, no contra un literal exacto,
 *                     salvo en las cifras cuyo cambio debe forzar revisión
 *                     humana. Cada congelación lleva su motivo escrito.
 *   REVISIÓN          `TEST-GLOBAL-11` audita este censo (§31.2, `TG-A08`).
 *
 * Los únicos literales de este archivo son (a) cifras HISTÓRICAS del Anexo A
 * —registro del pasado, no afirmación sobre el árbol— y (b) los motivos y
 * razones de divergencia. El valor vigente y la diferencia se calculan.
 *
 * Alcance: las cifras de A.0 que se obtienen ejecutando la suite, el coverage
 * o GitHub (entradas del runner, 9 FAILED, tiempos, CI) NO se reproducen
 * aquí: dependen de host, DB y red. Quedan declaradas en
 * `EXECUTION_DERIVED_METRICS` con el comando del repo que las reproduce.
 */

const corpus: CensusCorpus = createTrackedCorpus();
const classification: CensusClassification = classifyCorpus(corpus);
const specs = specFiles(corpus);
const testTypeScriptFiles = filesUnder(corpus, "test").filter((file) =>
  file.endsWith(".ts"),
);
const coupling = couplingCensus(corpus, classification);
const ownership = ownershipCensus(corpus);
const paths = stalePathCensus(corpus);
const volumes = inventory(corpus);

/** Banda relativa admitida para magnitudes que crecen por trabajo legítimo. */
const GROWTH_TOLERANCE = 0.25;

const BAND: CensusGuard = {
  kind: "TOLERANCE_BAND",
  tolerance: GROWTH_TOLERANCE,
};
const FROZEN: CensusGuard = { kind: "FROZEN_EXACT" };
const NON_INCREASING: CensusGuard = { kind: "NON_INCREASING" };

function folderFiles(folder: string): number {
  return (
    classification.byFolder.find((entry) => entry.folder === folder)?.files ?? 0
  );
}

function folderLines(folder: string): number {
  return (
    classification.byFolder.find((entry) => entry.folder === folder)?.lines ?? 0
  );
}

function specsUnder(folder: string): readonly { readonly path: string }[] {
  return classification.specs.filter((spec) =>
    spec.path.startsWith(`${folder}/`),
  );
}

function filesystemShare(folder: string): number {
  const inFolder = classification.specs.filter((spec) =>
    spec.path.startsWith(`${folder}/`),
  );

  if (inFolder.length === 0) {
    throw new Error(`no specs under ${folder}`);
  }

  return Math.round(
    (inFolder.filter((spec) => spec.readsFilesystem).length / inFolder.length) *
      100,
  );
}

function supportConsumers(supportFile: string): number {
  const entry = ownership.supportConsumers.find(
    (candidate) => candidate.supportFile === supportFile,
  );

  if (!entry) {
    throw new Error(`support module absent from the census: ${supportFile}`);
  }

  return entry.consumers.length;
}

function productionVolume(root: string, field: "files" | "lines"): number {
  const entry = volumes.production.find((candidate) => candidate.root === root);

  if (!entry) {
    throw new Error(`production root absent from the census: ${root}`);
  }

  return entry[field];
}

function statusAssertions(status: string): number {
  return classification.specs.reduce(
    (sum, spec) => sum + (spec.httpStatusAssertions[status] ?? 0),
    0,
  );
}

function ownReaderFiles(form: string): number {
  return classification.specs.filter((spec) =>
    spec.ownReaderForms.includes(form),
  ).length;
}

/**
 * Libro mayor del censo. Cada fila `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` y cada
 * fila `REPRODUCIBLE_*` de §6 aparece aquí exactamente una vez, con su
 * resolución. `REPRODUCED` = el tooling devuelve la cifra del Anexo A sobre
 * este árbol. `RECLASSIFIED` = la definición versionada difiere de la del
 * scratchpad no recuperable (A.4) y la diferencia queda declarada y calculada.
 */
const CENSUS_LEDGER: readonly CensusEntry[] = [
  // ── §6.1 volumen ──────────────────────────────────────────────────────────
  {
    row: "A0-06-VOLUME",
    section: "§6.1",
    metric: "archivos tracked bajo test/**",
    historical: 576,
    compute: () => volumes.testFiles,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "El volumen crece por trabajo legítimo: banda, nunca igualdad.",
  },
  {
    row: "A0-06-VOLUME",
    section: "§6.1",
    metric: "specs ejecutables test/**/*.test.ts",
    historical: 562,
    compute: () => volumes.specs,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Añadir specs es trabajo legítimo (§31.2, fila No congelable).",
  },
  {
    row: "A0-06-VOLUME",
    section: "§6.1",
    metric: "archivos de soporte bajo test/**",
    historical: 14,
    compute: () => volumes.supportFiles,
    resolution: "REPRODUCED",
    guard: { kind: "TOLERANCE_BAND", tolerance: 0.5 },
    motive:
      "01B añade los módulos de censo versionados bajo test/helpers/census: la banda del 50 % absorbe esa alta y sigue siendo umbral, no pase libre.",
  },
  {
    row: "A0-06-VOLUME",
    section: "§6.1",
    metric: "casos test( de primer nivel",
    historical: 4530,
    compute: () => classification.totals.tests,
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Crece con cada spec nuevo: es magnitud de volumen, no invariante.",
  },
  {
    row: "A0-06-VOLUME",
    section: "§6.1",
    metric: "LOC tracked bajo test/**",
    historical: 156887,
    compute: () => volumes.testLines,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "LOC es explícitamente no congelable (§31.2).",
  },
  {
    row: "A0-06-VOLUME",
    section: "§8",
    metric: "assertions assert.*",
    historical: 20623,
    compute: () => classification.totals.assertions,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Assertions es magnitud no congelable (§31.2).",
  },
  // ── §6.1 invariantes congelados ───────────────────────────────────────────
  {
    row: "A0-06-ABSENCES",
    section: "§6.1",
    metric: "specs en test/ raíz",
    historical: 0,
    compute: () => volumes.rootSpecs.length,
    resolution: "REPRODUCED",
    guard: FROZEN,
    // Contrato de layout vigente (test-support-layout-contract): un spec en
    // raíz reintroduce la estructura previa a la reorganización física.
    motive: "Congelado en 0: su cambio exige revisión humana del layout.",
  },
  {
    row: "A0-06-ABSENCES",
    section: "§6.1",
    metric: "specs que marcan foco exclusivo de caso",
    historical: 0,
    compute: () => filesMatching(corpus, specs, /\.only\(/).length,
    resolution: "REPRODUCED",
    guard: FROZEN,
    // El foco exclusivo silencia el resto del archivo en CI: falso verde.
    motive:
      "Congelado en 0: el foco exclusivo de caso apaga cobertura sin avisar.",
  },
  {
    row: "A0-06-ABSENCES",
    section: "§6.1",
    metric: "líneas describe( de primer nivel",
    historical: 0,
    compute: () => countMatchingLines(corpus, specs, /^\s*describe\(/),
    resolution: "REPRODUCED",
    guard: FROZEN,
    motive: "Congelado en 0: la convención de la suite es test() plano.",
  },
  {
    row: "A0-06-ABSENCES",
    section: "§12.2",
    metric: "specs que usan la API de dobles de node:test",
    historical: 0,
    compute: () =>
      filesMatching(corpus, specs, /mock\.(fn|method|module|timers)/).length,
    resolution: "REPRODUCED",
    guard: FROZEN,
    motive:
      "Congelado en 0: adoptar la API de dobles cambia la arquitectura de la suite.",
  },
  // ── §6.2 distribución por carpeta ─────────────────────────────────────────
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "specs en test/unit/ui",
    historical: 163,
    compute: () => folderFiles("test/unit/ui"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Carpeta foco del programa; crece o decrece por remediación.",
  },
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "LOC en test/unit/ui",
    historical: 29907,
    compute: () => folderLines("test/unit/ui"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "LOC por carpeta: magnitud no congelable (§31.2), y la remediación de 07/08 debe poder bajarla.",
  },
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "specs en test/architecture (raíz)",
    historical: 78,
    compute: () => folderFiles("test/architecture"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Este PR añade guards de arquitectura; la banda lo absorbe.",
  },
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "specs en test/unit/infrastructure",
    historical: 93,
    compute: () => folderFiles("test/unit/infrastructure"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Volumen por carpeta: §14 la describe como carpeta heterogénea, y separarla cambiará la cifra legítimamente.",
  },
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "specs en test/unit/contracts",
    historical: 68,
    compute: () => folderFiles("test/unit/contracts"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Volumen por carpeta: contratos estáticos mayormente legítimos (§14) que pueden crecer sin revisión.",
  },
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "specs en test/integration/adapters",
    historical: 56,
    compute: () => folderFiles("test/integration/adapters"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Volumen por carpeta: TEST-GLOBAL-09 debe aumentarlo, de modo que congelarlo penalizaría el programa.",
  },
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "specs en test/architecture/security",
    historical: 17,
    compute: () => folderFiles("test/architecture/security"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "TEST-GLOBAL-02 y 04 añaden contratos aquí.",
  },
  {
    row: "A0-06-FOLDERS",
    section: "§6.2",
    metric: "specs en test/security",
    historical: 10,
    compute: () => folderFiles("test/security"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Volumen por carpeta: TEST-GLOBAL-04 añade prueba negativa aquí y la cifra debe poder subir.",
  },
  // ── §6.3 ratio test : producción ──────────────────────────────────────────
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "archivos fuente de server/**",
    historical: 226,
    compute: () => productionVolume("server", "files"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "El censo M48 congela esta cifra aparte; aquí se verifica por banda para no triplicar la fuente (TG-R13).",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "LOC de server/**",
    historical: 46081,
    compute: () => productionVolume("server", "lines"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "LOC de producción, no congelable en este censo.",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "archivos fuente de frontend/src/**",
    historical: 200,
    compute: () => productionVolume("frontend/src", "files"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Volumen de producción: lo gobiernan los PR de producto, no este censo de tests.",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "LOC de frontend/src/**",
    historical: 43276,
    compute: () => productionVolume("frontend/src", "lines"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "LOC de producción: magnitud que crece con el producto; el censo la observa, no la fija.",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "archivos fuente de shared + drizzle + scripts",
    historical: 33,
    compute: () =>
      ["shared", "drizzle", "scripts"].reduce(
        (sum, root) => sum + productionVolume(root, "files"),
        0,
      ),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Reproduce 33 con el set de extensiones ts|tsx|js|mjs|mts, que es el único que da esa cifra.",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "LOC de shared + drizzle + scripts",
    historical: 9822,
    baseline: 9854,
    compute: () =>
      ["shared", "drizzle", "scripts"].reduce(
        (sum, root) => sum + productionVolume(root, "lines"),
        0,
      ),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La cifra versionada es 9.854: exactamente 32 LOC más, que son las de shared/ (1 archivo, 32 líneas), contadas en el archivo pero no en el total histórico. Verificable: 9854 - 9822 = 32 = LOC de shared/**.",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "archivos fuente de frontend/e2e/**",
    historical: 123,
    compute: () => sourceFilesUnder(corpus, "frontend/e2e").length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Volumen E2E, no congelable (lo gobierna LIMPIEZA E2E).",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "LOC de frontend/e2e/**",
    historical: 43756,
    compute: () =>
      totalLines(corpus, sourceFilesUnder(corpus, "frontend/e2e")),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "LOC de la suite E2E: la gobierna LIMPIEZA E2E y crece por trabajo ajeno a este programa.",
  },
  {
    row: "A0-06-RATIOS",
    section: "§6.3",
    metric: "LOC de archivos .ts bajo test/**",
    historical: 156700,
    compute: () => totalLines(corpus, testTypeScriptFiles),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "LOC de la suite: numerador del ratio de §6.3 y magnitud explícitamente no congelable (§31.2).",
  },
  // ── §6.4 / §12.1 soporte compartido ───────────────────────────────────────
  {
    row: "A0-06-SUPPORT",
    section: "§6.4",
    metric: "importadores de helpers/tracked-source-files.ts",
    historical: 8,
    compute: () => supportConsumers("test/helpers/tracked-source-files.ts"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "TEST-GLOBAL-05A debe subirlo; congelarlo penalizaría el objetivo del programa.",
  },
  {
    row: "A0-06-SUPPORT",
    section: "§6.4",
    metric: "consumidores de helpers/clean7a-dependency-cleanup-scope.ts",
    historical: 11,
    compute: () =>
      supportConsumers("test/helpers/clean7a-dependency-cleanup-scope.ts"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Consumo de soporte compartido, no congelable.",
  },
  {
    row: "A0-12-DOUBLES",
    section: "§12.1",
    metric: "consumidores de mocks/public-professionals-route.ts",
    historical: 9,
    baseline: 5,
    compute: () => supportConsumers("test/mocks/public-professionals-route.ts"),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El corrector del finding P2 sobre `supportConsumerCensus` (§23) cuenta imports reales (import/require resueltos por path), no menciones textuales del nombre del módulo. La cifra histórica de 9 incluía coincidencias de substring; los 5 consumidores reales son los que realmente importan el módulo (verificado por lectura manual de `git grep -nE 'from [\"\\']\\.\\./mocks/public-professionals-route'`).",
  },
  {
    row: "A0-12-DOUBLES",
    section: "§12.1",
    metric: "consumidores de factories/public-professionals.ts",
    historical: 9,
    baseline: 5,
    compute: () => supportConsumers("test/factories/public-professionals.ts"),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Misma causa que mocks/public-professionals-route.ts: el corrector cuenta imports reales, no menciones textuales. La cifra histórica de 9 se apoyaba en substring; los 5 consumidores reales importan el módulo de verdad (verificado por lectura manual de `git grep -nE 'from [\"\\']\\.\\./factories/public-professionals'`).",
  },
  {
    row: "A0-12-DOUBLES",
    section: "§12.1",
    metric: "consumidores de factories/report-access.ts",
    historical: 4,
    compute: () => supportConsumers("test/factories/report-access.ts"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Consumo de dobles compartidos: sube o baja con la remediación, no es invariante.",
  },
  {
    row: "A0-12-DOUBLES",
    section: "§12.1",
    metric: "consumidores de helpers/fastify-app-route-stubs.ts",
    historical: 2,
    compute: () => supportConsumers("test/helpers/fastify-app-route-stubs.ts"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Sobre-especialización declarada en §12.1: 762 LOC para 2 consumidores.",
  },
  {
    row: "A0-12-DOUBLES",
    section: "§12.1",
    metric: "consumidores de fixtures/dashboard-operational-contract.ts",
    historical: 1,
    compute: () =>
      supportConsumers("test/fixtures/dashboard-operational-contract.ts"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Sobre-especialización declarada en §12.1.",
  },
  // ── §7.1 censo bruto ──────────────────────────────────────────────────────
  {
    row: "A0-07-RAW",
    section: "§7.1",
    metric: "specs que importan node:fs",
    historical: 410,
    compute: () => coupling.rawSignals["node:fs"] ?? -1,
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "TEST-GLOBAL-05A debe reducirlo migrando al lector canónico: banda, no igualdad.",
  },
  {
    row: "A0-07-RAW",
    section: "§7.1",
    metric: "specs con readdirSync",
    historical: 82,
    compute: () => coupling.rawSignals.readdirSync ?? -1,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Señal física, objetivo de reducción de 05A.",
  },
  {
    row: "A0-07-RAW",
    section: "§7.1",
    metric: "specs con node:child_process",
    historical: 25,
    compute: () => coupling.rawSignals["node:child_process"] ?? -1,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Señal de determinismo (§13), no congelable.",
  },
  // ── §7.2 buckets fs × runtime ─────────────────────────────────────────────
  {
    row: "A0-07-BUCKETS",
    section: "§7.2",
    metric: "specs que leen filesystem y nunca ejecutan runtime",
    historical: 351,
    baseline: 362,
    compute: () => classification.byBucket.FILESYSTEM_ONLY,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El scratchpad de A.4 no es recuperable. La definición versionada llama 'runtime' sólo al import estático de producción resuelto por path (server|frontend|shared|drizzle|scripts) y cuenta `.inject(` como runtime en MIXED, no aquí; eso mueve archivos entre FILESYSTEM_ONLY y FILESYSTEM_AND_RUNTIME. Los totales siguen particionando los 562 specs.",
  },
  {
    row: "A0-07-BUCKETS",
    section: "§7.2",
    metric: "specs que ejecutan runtime y no leen filesystem",
    historical: 89,
    compute: () => classification.byBucket.RUNTIME_ONLY,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Reproduce la cifra del Anexo con la definición versionada.",
  },
  {
    row: "A0-07-BUCKETS",
    section: "§7.2",
    metric: "specs MIXED estructural (filesystem y runtime)",
    historical: 59,
    baseline: 48,
    compute: () => classification.byBucket.FILESYSTEM_AND_RUNTIME,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Misma causa que FILESYSTEM_ONLY: la resolución de imports por path es más estricta que la señal textual del scratchpad.",
  },
  {
    row: "A0-07-BUCKETS",
    section: "§7.2",
    metric: "specs sólo con import dinámico",
    historical: 61,
    baseline: 59,
    compute: () => classification.byBucket.DYNAMIC_IMPORT_ONLY,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La definición versionada exige que el `import()` dinámico apunte a un path de producción; un `import()` de soporte ya no cuenta como runtime.",
  },
  {
    row: "A0-07-BUCKETS",
    section: "§7.2",
    metric: "specs sin ninguna de las dos señales",
    historical: 2,
    baseline: 6,
    compute: () => classification.byBucket.NEITHER,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Resto de la partición: se mueve por arrastre de los tres buckets anteriores, cuya definición versionada ya está declarada. No tiene causa propia y su valor absoluto es marginal.",
  },
  // ── §7.3 clasificación por poder del oracle ───────────────────────────────
  {
    row: "A0-07-ORACLE",
    section: "§7.3",
    metric: "archivos ACCIDENTAL_COUPLING_CANDIDATE",
    historical: 137,
    baseline: 66,
    compute: () => coupling.byClass.ACCIDENTAL_COUPLING_CANDIDATE.files,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El clasificador versionado exige DOS condiciones para candidato: oracle dominado por substring (>= 80 %) Y afirmación de comportamiento de navegador (§19). El scratchpad marcaba candidatos sin la segunda condición, de modo que su pool era mayor; los que aquí no la cumplen caen en UNKNOWN_REQUIRES_REVIEW, que es adjudicable por TEST-GLOBAL-06 sin perder ninguno.",
  },
  {
    row: "A0-07-ORACLE",
    section: "§7.3",
    metric: "tests ACCIDENTAL_COUPLING_CANDIDATE",
    historical: 1042,
    baseline: 623,
    compute: () => coupling.byClass.ACCIDENTAL_COUPLING_CANDIDATE.tests,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Consecuencia directa del criterio de dos condiciones: al exigirse además afirmación de comportamiento, los tests de los archivos que no la cumplen salen del pool junto con ellos.",
  },
  {
    row: "A0-07-ORACLE",
    section: "§7.3",
    metric: "archivos RUNTIME_BEHAVIOURAL",
    historical: 151,
    baseline: 150,
    compute: () => coupling.byClass.RUNTIME_BEHAVIOURAL.files,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Diferencia de 2 archivos: la definición versionada exige import de producción resoluble, no la mera presencia de `await import(`.",
  },
  {
    row: "A0-07-ORACLE",
    section: "§7.3",
    metric: "archivos LEGITIMATE_GUARD",
    historical: 95,
    baseline: 55,
    compute: () => coupling.byClass.LEGITIMATE_GUARD.files,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Aquí LEGITIMATE_GUARD exige las dos propiedades de §16 juntas: auto-discovery por walker Y assertion fail-closed. Un guard con walker pero sin assertion fail-closed ya no se declara legítimo por su forma.",
  },
  {
    row: "A0-07-ORACLE",
    section: "§7.3",
    metric: "archivos UNKNOWN_REQUIRES_REVIEW",
    historical: 2,
    baseline: 164,
    compute: () => coupling.byClass.UNKNOWN_REQUIRES_REVIEW.files,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Clase deliberadamente fail-open hacia la revisión humana: todo spec que el clasificador no puede adjudicar con evidencia cae aquí en vez de recibir una etiqueta optimista. Por eso absorbe la diferencia de las otras clases.",
  },
  {
    row: "A0-07-ORACLE",
    section: "§7.3",
    metric: "archivos candidatos concentrados en test/unit/ui",
    historical: 122,
    baseline: 65,
    compute: () =>
      coupling.candidateConcentration.find(
        (entry) => entry.folder === "test/unit/ui",
      )?.files ?? 0,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Se mueve con el pool. El hallazgo cualitativo se conserva y se verifica aparte: la concentración en test/unit/ui sigue siendo dominante.",
  },
  // ── §8.1 / §8.2 oracle débil ──────────────────────────────────────────────
  {
    row: "A0-08-SUBSTRING",
    section: "§8.2",
    metric: "assertions assert.ok(x.includes(...))",
    historical: 6262,
    compute: () =>
      countOccurrences(
        corpus,
        specs,
        /assert\.ok\([A-Za-z0-9_.]*\.includes\(/g,
      ),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Volumen de assertions de forma substring: 07 y 08 deben reducirlo, así que no se congela.",
  },
  {
    row: "A0-08-SUBSTRING",
    section: "§8.2",
    metric: "assertions assert.equal(x.includes(...), …)",
    historical: 1522,
    compute: () =>
      countOccurrences(
        corpus,
        specs,
        /assert\.equal\([A-Za-z0-9_.]*\.includes\(/g,
      ),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Volumen de assertions de forma substring: 07 y 08 deben reducirlo, así que no se congela.",
  },
  {
    row: "A0-08-SUBSTRING",
    section: "§8.1",
    metric: "specs con cero assert.*",
    historical: 0,
    compute: () =>
      classification.specs.filter((spec) => spec.assertions === 0).length,
    resolution: "REPRODUCED",
    guard: FROZEN,
    // Un spec sin assertions es un test sin oracle: pasa siempre.
    motive: "Congelado en 0: un spec sin oracle es verde perpetuo por diseño.",
  },
  {
    row: "A0-08-SUBSTRING",
    section: "§8.1",
    metric: "specs con densidad < 1 assert/test",
    historical: 21,
    compute: () =>
      classification.specs.filter(
        (spec) => spec.tests > 0 && spec.assertions / spec.tests < 1,
      ).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Los 21 usan wrappers de assertion y sí asertan (§8.1): no son deuda y su número puede variar.",
  },
  {
    row: "A0-08-SUBSTRING",
    section: "§8.2",
    metric: "archivos con oracle dominado por substring y sin runtime",
    historical: 157,
    baseline: 101,
    compute: () => coupling.substringDominatedPool.files.length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El umbral versionado es explícito (SUBSTRING_DOMINANCE = 0,8 sobre el total de assert.* del archivo) y excluye además los specs con import dinámico de producción, que el scratchpad contaba como 'sin runtime'.",
  },
  {
    row: "A0-08-SUBSTRING",
    section: "§8.2",
    metric: "tests en el pool dominado por substring",
    historical: 1264,
    baseline: 796,
    compute: () => coupling.substringDominatedPool.tests,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Consecuencia del umbral explícito (0,8) y de la exclusión de los specs con import dinámico de producción: los tests siguen a sus archivos, de modo que la diferencia es la misma que la de la cifra de archivos.",
  },
  // ── §9.2 / §9.3 referencias a paths ───────────────────────────────────────
  {
    row: "A0-09-PATHS",
    section: "§9.3",
    metric: "referencias literales a paths del repo desde test/**",
    historical: 3229,
    baseline: 3597,
    compute: () => paths.totals.occurrences,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El censo versionado declara su gramática: literal entre comillas cuya primera componente es una raíz real del repo (server|frontend|shared|drizzle|scripts|test|docs|.github). Reconoce también paths de docs/** y .github/**, que el scratchpad no recogía, de ahí el total mayor.",
  },
  {
    row: "A0-09-PATHS",
    section: "§9.3",
    metric: "paths únicos referenciados",
    historical: 732,
    baseline: 834,
    compute: () => paths.totals.uniquePaths,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Misma gramática ampliada que el total de referencias: al reconocer docs/** y .github/**, aparecen paths únicos que el censo original no recogía. La diferencia es de alcance declarado, no del árbol.",
  },
  {
    row: "A0-09-PATHS",
    section: "§9.3",
    metric: "paths únicos inexistentes",
    historical: 109,
    baseline: 145,
    compute: () => paths.totals.missingPaths,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La existencia se resuelve contra el árbol tracked distinguiendo archivo de directorio; el scratchpad no declaraba ese criterio. La mayoría sigue siendo legítima (assertions de ausencia e inputs sintéticos, §9.3); el subconjunto peligroso se mide aparte, abajo.",
  },
  {
    row: "A0-09-PATHS",
    section: "§9.2",
    metric: "paths muertos en requiredTestEvidence del registro IDOR",
    historical: 11,
    compute: () =>
      staleRegistryEvidence(
        corpus,
        "test/architecture/security/security-cross-tenant-idor-contract.test.ts",
        "requiredTestEvidence",
      ).length,
    resolution: "REPRODUCED",
    guard: NON_INCREASING,
    // P0 abierto (TG-R02). Sólo puede bajar; TEST-GLOBAL-02 lo lleva a 0.
    motive:
      "Invariante de no-regresión: una entrada muerta más en un registro de evidencia de seguridad exige revisión humana inmediata.",
  },
  // ── §11 prueba negativa ───────────────────────────────────────────────────
  {
    row: "A0-11-MUTATION",
    section: "§11",
    metric: "specs con harness de mutación en memoria",
    historical: 9,
    baseline: 15,
    compute: () =>
      classification.specs.filter((spec) => spec.hasMutationHarness).length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La detección versionada es textual (mutación de una variable de source por `.replace(`) y alcanza 2 archivos que el recuento manual de §11 no listaba: el histórico 9 pasó a 11 al reclasificar. Es una cota superior honesta: el criterio de §11 —mutar, evaluar y exigir rojo— sólo se confirma por lectura. Desde 01B el programa añadió harnesses reales: IDOR (02, #1763), runner Playwright (03, #1765), redacción de logs (04, #1766) y configuración de cookies de sesión en env.ts (04); el árbol vigente produce 15. Crecimiento intencional, re-anclado sin ampliar la tolerancia ni excluir ningún spec del detector.",
  },
  {
    row: "A0-11-MUTATION",
    section: "§11",
    metric: "specs con assert.rejects(",
    historical: 46,
    compute: () => filesMatching(corpus, specs, /assert\.rejects\(/).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Volumen de prueba negativa; debe poder crecer (04 lo aumenta).",
  },
  {
    row: "A0-11-MUTATION",
    section: "§11",
    metric: "specs con assert.throws(",
    historical: 22,
    compute: () => filesMatching(corpus, specs, /assert\.throws\(/).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Volumen de prueba negativa, no congelable.",
  },
  {
    row: "A0-11-MUTATION",
    section: "§11",
    metric: "specs con assert.doesNotMatch(",
    historical: 90,
    compute: () =>
      filesMatching(corpus, specs, /assert\.doesNotMatch\(/).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Volumen de prueba negativa, no congelable.",
  },
  {
    row: "A0-11-MUTATION",
    section: "§11",
    metric: "specs con assert.equal(x, false)",
    historical: 267,
    baseline: 246,
    compute: () =>
      filesMatching(corpus, specs, /assert\.equal\([^,]+,\s*false\)/).length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La forma versionada exige el literal `false` en la misma línea de la llamada; las escritas en varias líneas no se cuentan. Diferencia de definición, no del árbol.",
  },
  {
    row: "A0-11-MUTATION",
    section: "§11",
    metric: "tests nombrados con semántica fail-closed",
    historical: 130,
    baseline: 180,
    compute: () =>
      classification.specs.reduce(
        (sum, spec) => sum + spec.failClosedTestNames.length,
        0,
      ),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El vocabulario versionado es explícito y bilingüe (fail-closed, mutación, nunca, rechaza, rompe, refuses, breaks) y por eso reconoce más nombres que el recuento original. Como el criterio está escrito, la cifra es auditable.",
  },
  // ── §13 determinismo ──────────────────────────────────────────────────────
  {
    row: "A0-13-ENV",
    section: "§13",
    metric: "specs que mutan process.env",
    historical: 11,
    compute: () =>
      classification.specs.filter((spec) => spec.mutatesProcessEnv).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Señal de determinismo, acotada a orden intra-archivo (§13.2).",
  },
  {
    row: "A0-13-ENV",
    section: "§13.2",
    metric: "specs que mutan process.env sin restaurar",
    historical: 8,
    baseline: 3,
    compute: () =>
      classification.specs.filter(
        (spec) => spec.mutatesProcessEnv && !spec.restoresProcessEnv,
      ).length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La detección de restauración versionada acepta `delete process.env.X` o un bloque `finally`; el conteo histórico no declaraba su criterio. La cifra vigente que produce el tooling es 3, y las 8 del Anexo corresponden a la lectura manual: la diferencia es de definición, y el hallazgo de §13.2 (riesgo acotado a intra-archivo) no cambia.",
  },
  {
    row: "A0-13-READERS",
    section: "§13.1",
    metric: "specs con lector propio",
    historical: 283,
    baseline: 281,
    compute: () =>
      classification.specs.filter((spec) => spec.definesOwnReader).length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "A.0 ya declara que un grep simple devuelve 281; el tooling reproduce exactamente esa cifra auditable, no la derivada del scratchpad. Diferencia declarada: 2 archivos.",
  },
  {
    row: "A0-13-READERS",
    section: "§13.1",
    metric: "specs que definen su propio walker de árbol",
    historical: 18,
    baseline: 17,
    compute: () => ownReaderFiles("walk"),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Mismo caso: A.0 declara que el grep simple devuelve 17. El tooling reproduce la cifra auditable.",
  },
  {
    row: "A0-13-READERS",
    section: "§13.1",
    metric: "specs que normalizan CRLF a mano",
    historical: 295,
    baseline: 279,
    compute: () =>
      classification.specs.filter((spec) => spec.normalizesCrlf).length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Mismo caso: A.0 declara que el grep simple devuelve 279. El tooling reproduce la cifra auditable.",
  },
  {
    row: "A0-13-READERS",
    section: "§13.1",
    metric: "specs que leen filesystem sin normalizar CRLF",
    historical: 36,
    baseline: 136,
    compute: () =>
      classification.specs.filter(
        (spec) => spec.readsFilesystem && !spec.normalizesCrlf,
      ).length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El tooling define 'lee filesystem' como importar node:fs (la señal de §7.1, 410 archivos); el scratchpad usaba un subconjunto no declarado. Con la definición escrita, la cifra vigente es mayor y recomputable.",
  },
  {
    row: "A0-13-READERS",
    section: "§13.1",
    metric: "specs que definen su propio lector read",
    historical: 216,
    compute: () => ownReaderFiles("read"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "05A debe reducirlo migrando al lector canónico.",
  },
  {
    row: "A0-13-READERS",
    section: "§13.1",
    metric: "specs que definen su propio lector readSource",
    historical: 65,
    compute: () => ownReaderFiles("readSource"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "05A debe reducirlo migrando al lector canónico.",
  },
  // ── §20 censos congelados ─────────────────────────────────────────────────
  {
    row: "A0-20-FROZEN",
    section: "§20",
    metric: "assertions de censo congelado (.length, n) — archivo completo",
    historical: 498,
    compute: () => countOccurrences(corpus, specs, /\.length,\s*[0-9]+/g),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Cifra operativa de TEST-GLOBAL-11 (TG-A13). Debe bajar cuando 11 consolide: banda, no igualdad.",
  },
  {
    row: "A0-20-FROZEN",
    section: "§20",
    metric: "archivos con assertions de censo congelado",
    historical: 134,
    compute: () => filesMatching(corpus, specs, /\.length,\s*[0-9]+/).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Mismo motivo que la cifra de assertions.",
  },
  {
    row: "A0-20-REGISTRIES",
    section: "§20",
    metric: "specs con registry literal declarado en el propio test",
    historical: 75,
    baseline: 106,
    compute: () =>
      filesMatching(corpus, specs, /const\s+[A-Z][A-Z0-9_]*\s*(?::[^=]+)?=\s*\[/)
        .length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La forma versionada reconoce el registry tipado (`const X: T[] = [`) además del literal desnudo, de modo que detecta más archivos que el censo original. Ampliar la detección de un patrón que TEST-GLOBAL-11 debe auditar es conservador, no laxo.",
  },
  // ── §14–§16, §19, §22, §23 capas y ownership ──────────────────────────────
  {
    row: "A0-14-LAYERS",
    section: "§14",
    metric: "porcentaje de test/unit/domain que toca filesystem",
    historical: 3,
    baseline: 4,
    compute: () => filesystemShare("test/unit/domain"),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "1 de 27 archivos redondea a 4 % con redondeo aritmético; el Anexo truncaba. El hecho —`unit/domain` es el modelo a seguir— no cambia.",
  },
  {
    row: "A0-14-LAYERS",
    section: "§14",
    metric: "porcentaje de test/unit/ui que toca filesystem",
    historical: 96,
    baseline: 97,
    compute: () => filesystemShare("test/unit/ui"),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "158 de 163 archivos es 96,9 %, que el tooling redondea a 97 % mientras el Anexo truncaba a 96 %. Diferencia de redondeo declarada: el hallazgo —unit/ui es la carpeta más acoplada al source— no cambia.",
  },
  {
    row: "A0-14-LAYERS",
    section: "§14",
    metric: "porcentaje de test/unit/application que toca filesystem",
    historical: 48,
    compute: () => filesystemShare("test/unit/application"),
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Proporción por capa: describe la naturaleza de unit/application (§14), no un límite contractual.",
  },
  {
    row: "A0-15-INTEGRATION",
    section: "§15",
    metric: "specs de integración",
    historical: 58,
    compute: () => specsUnder("test/integration").length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "TEST-GLOBAL-09 debe aumentarlo poblando repositorios y servicios externos: congelarlo sería contradictorio.",
  },
  {
    row: "A0-15-INTEGRATION",
    section: "§15",
    metric: "tests de integración",
    historical: 590,
    baseline: 615,
    compute: () =>
      classification.specs
        .filter((spec) => spec.path.startsWith("test/integration/"))
        .reduce((sum, spec) => sum + spec.tests, 0),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El tooling cuenta `test(` de primer nivel por línea (el criterio de §6.1, 4.530); el recuento original de §15 incluía además subtests anidados. Criterio declarado y uniforme en todo este censo.",
  },
  {
    row: "A0-15-INTEGRATION",
    section: "§15",
    metric:
      "controllers de integración con forma real de integración (de 56)",
    historical: 52,
    compute: () =>
      classification.specs.filter(
        (spec) =>
          spec.path.startsWith("test/integration/adapters/controllers/") &&
          (spec.usesHttpInjection ||
            spec.usesDynamicImport ||
            spec.executesRuntime),
      ).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Los 4 restantes son estáticos y están mal ubicados (§15); su corrección no pertenece a 01B.",
  },
  {
    row: "A0-16-GUARDS",
    section: "§16",
    metric: "guards de arquitectura que leen filesystem",
    historical: 93,
    compute: () =>
      classification.specs.filter(
        (spec) =>
          spec.path.startsWith("test/architecture/") && spec.readsFilesystem,
      ).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Correcto por diseño: el árbol es el objeto del contrato (§16). Este PR añade guards que también lo leen.",
  },
  {
    row: "A0-19-UI",
    section: "§19",
    metric: "specs de test/unit/ui que leen source",
    historical: 158,
    compute: () =>
      classification.specs.filter(
        (spec) =>
          spec.path.startsWith("test/unit/ui/") && spec.readsFilesystem,
      ).length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Foco de remediación de 07 y 08: debe bajar.",
  },
  {
    row: "A0-22-STATUS",
    section: "§22",
    metric: "assertions de status 2xx (200 y 201)",
    historical: 312,
    baseline: 316,
    compute: () => statusAssertions("200") + statusAssertions("201"),
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "La gramática versionada cuenta `status`/`statusCode` seguidos del código en la misma assertion; captura 4 casos de 200 que el censo original no recogía. El hallazgo de §22 —el error-path domina— se conserva y se verifica aparte.",
  },
  {
    row: "A0-23-OWNERSHIP",
    section: "§23",
    metric: "archivos de test que referencian frontend/src/lib/api.ts",
    historical: 45,
    compute: () =>
      ownership.entries.find(
        (entry) => entry.productionFile === "frontend/src/lib/api.ts",
      )?.guards.length ?? 0,
    resolution: "REPRODUCED",
    guard: BAND,
    motive:
      "Dato central de §23: renombrar un símbolo aquí rompe 45 archivos. Debe poder bajar.",
  },
  {
    row: "A0-23-OWNERSHIP",
    section: "§23",
    metric: "archivos de producción con ownership difuso (>= 11 guards)",
    historical: 50,
    baseline: 56,
    compute: () => ownership.diffusedFiles.length,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "El censo versionado cuenta la referencia literal al path desde cualquier spec, criterio escrito y uniforme; el scratchpad usaba un emparejamiento más estrecho no recuperable. La conclusión de §23 se refuerza, no se debilita.",
  },
  {
    row: "A0-23-OWNERSHIP",
    section: "§23",
    metric: "nombres de test duplicados entre archivos",
    historical: 11,
    compute: () => ownership.duplicateTestNames.length,
    resolution: "REPRODUCED",
    guard: BAND,
    motive: "Duplicación textual despreciable (§23); no es un invariante.",
  },
  {
    row: "A0-23-OWNERSHIP",
    section: "§23",
    metric: "archivos de producción referenciados por algún spec",
    historical: 411,
    baseline: 385,
    compute: () => ownership.totals.referencedProductionFiles,
    resolution: "RECLASSIFIED",
    guard: BAND,
    motive:
      "Misma causa que el ownership difuso: el criterio de referencia está declarado (cita literal del path desde cualquier spec) y es uniforme, mientras el del scratchpad no es recuperable. La conclusión de §23 se refuerza.",
  },
];

/**
 * Cifras de A.0 que NO se reproducen desde el árbol porque dependen de
 * ejecutar la suite, el coverage o GitHub. No se simulan aquí: se declara el
 * comando del repositorio que las produce (`AGENTS.md` §6: no inventar
 * equivalentes, no inferir PASSED).
 */
const EXECUTION_DERIVED_METRICS: readonly {
  readonly row: string;
  readonly section: string;
  readonly metric: string;
  readonly command: string;
  readonly reason: string;
}[] = [
  {
    row: "A0-EXEC-RUNNER",
    section: "§3, §6.1",
    metric: "4.590 entradas del runner, 4.580 pass, 1 skipped",
    command: "pnpm test",
    reason:
      "Incluye subtests anidados y entradas de nivel archivo que sólo existen durante la ejecución.",
  },
  {
    row: "A0-EXEC-FAILED",
    section: "§3, §10.2",
    metric: "9 FAILED = 8 launcher win32 + 1 DB",
    command: "pnpm test",
    reason:
      "Depende de plataforma (grupo A) y de la precondición de DB (grupo B); estado PRE-03 de §31.0.",
  },
  {
    row: "A0-EXEC-SECURITY",
    section: "§9.1, §17",
    metric: "134 tests de architecture/security",
    command:
      'node --experimental-strip-types --test "test/architecture/security/*.test.ts"',
    reason:
      "Cifra del runner sobre una corrida concreta: ninguna lectura estática del árbol puede producirla.",
  },
  {
    row: "A0-EXEC-COVERAGE",
    section: "§21.1",
    metric: "tabla de coverage vacía; 226 archivos en la corrida completa",
    command: "pnpm test:coverage",
    reason: "Instrumentación de runtime; no hay señal equivalente en el árbol.",
  },
  {
    row: "A0-EXEC-TIME",
    section: "§24, §3.5",
    metric: "tiempos observados (26.422 ms, 298,7 ms, 146.129 ms, 1.864 ms)",
    command: "pnpm test",
    reason:
      "HISTORICAL_EXECUTION_EVIDENCE: dependen del host y del momento; A.0 prohíbe leerlas como cifra estable.",
  },
  {
    row: "A0-24-PARETO",
    section: "§24",
    metric:
      "Pareto y ranking de entradas caras (50 % en 33, 80 % en 130, 133,6 s agregados)",
    command:
      'node --experimental-strip-types --experimental-specifier-resolution=node --test --test-reporter=tap "test/**/*.test.ts" > run.tap' +
      " · luego analyzeTapOutput(readFileSync('run.tap', 'utf8')) de test/helpers/census/tap-performance.ts",
    reason:
      "Se deriva de la duración por entrada de una corrida concreta, host y momento dependientes (HISTORICAL_EXECUTION_EVIDENCE, §24). Ninguna lectura del árbol puede producir un wall time: por eso queda EXECUTION_DERIVED, no REPRODUCIBLE_FROM_REPO. Lo que sí se versiona es el PROCESADOR (test/helpers/census/tap-performance.ts, criterio de aceptación de 01B, TG-A08): parseTapEntries/paretoAnalysis recomputan duración por entrada, ranking y umbrales 50 %/80 % de cualquier captura TAP real, con prueba positiva y negativa en el contrato de censo (§31.2). Una corrida distinta puede legítimamente devolver 33/130/133,6 s u otro valor sin que eso invalide el procesador: el dato cambia con el host, el procedimiento no.",
  },
  {
    row: "A0-27-PROJECTION",
    section: "§27",
    metric: "proyección de coste al duplicar el tamaño del proyecto",
    command: "derivación aritmética sobre las cifras de §6.3 de este censo",
    reason:
      "No es una medición sino una extrapolación (×2 sobre el ratio vigente). Se reclasifica como DERIVED_FROM_CENSUS: sus entradas —LOC de producción, LOC de test, specs— ya son reproducibles aquí, y el crecimiento observado 517→562 / 4.019→4.530 pertenece a una revisión pasada del árbol, irrecuperable desde HEAD.",
  },
  {
    row: "A0-EXEC-CI",
    section: "§3, §29",
    metric: "Backend CI = success en los baselines",
    command: "gh run list --branch main",
    reason: "Estado remoto de GitHub, dependiente del momento.",
  },
];

/** Filas de A.0 clasificadas `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE`. */
const AUDIT_DERIVED_ROWS: readonly string[] = [
  "A0-06-FOLDERS",
  "A0-06-RATIOS",
  "A0-06-SUPPORT",
  "A0-07-BUCKETS",
  "A0-07-ORACLE",
  "A0-08-SUBSTRING",
  "A0-09-PATHS",
  "A0-11-MUTATION",
  "A0-12-DOUBLES",
  "A0-13-ENV",
  "A0-13-READERS",
  "A0-14-LAYERS",
  "A0-15-INTEGRATION",
  "A0-16-GUARDS",
  "A0-19-UI",
  "A0-20-REGISTRIES",
  "A0-22-STATUS",
  "A0-23-OWNERSHIP",
  "A0-24-PARETO",
  "A0-27-PROJECTION",
];

/** Filas `REPRODUCIBLE_*` de A.0 que este censo recomputa desde el árbol. */
const REPRODUCIBLE_ROWS: readonly string[] = [
  "A0-06-VOLUME",
  "A0-06-ABSENCES",
  "A0-07-RAW",
  "A0-20-FROZEN",
];

const LEDGER_REPORT: readonly LedgerReport[] = CENSUS_LEDGER.map(evaluateEntry);

test("censo 01B: el tooling versionado calcula cada cifra desde el árbol", () => {
  assert.ok(
    CENSUS_LEDGER.length > 0,
    "el libro mayor del censo no puede estar vacío",
  );

  for (const measured of LEDGER_REPORT) {
    assert.equal(
      Number.isInteger(measured.current),
      true,
      `${measured.metric}: la cifra vigente debe ser un entero calculado`,
    );
    assert.ok(
      measured.current >= 0,
      `${measured.metric}: una cifra de censo no puede ser negativa`,
    );
  }
});

test("censo 01B: cada guard se cumple según su clase declarada", () => {
  const violations = CENSUS_LEDGER.map((entry, index) =>
    guardViolation(entry, LEDGER_REPORT[index]!),
  ).filter((violation): violation is string => violation !== null);

  assert.deepEqual(violations, []);
});

test("censo 01B: toda cifra reclasificada declara diferencia y razón verificable", () => {
  const violations = CENSUS_LEDGER.map(declarationViolation).filter(
    (violation): violation is string => violation !== null,
  );

  assert.deepEqual(violations, []);
  assert.deepEqual(ledgerViolations(CENSUS_LEDGER), []);

  for (const measured of LEDGER_REPORT) {
    if (measured.resolution !== "RECLASSIFIED") {
      continue;
    }

    assert.notEqual(
      measured.declaredDifference,
      0,
      `${measured.metric}: histórico ${measured.historical}, vigente reproducido ${measured.anchor}`,
    );
  }
});

test("censo 01B: ninguna cifra congelada lo está sin poder de revisión", () => {
  const frozen = CENSUS_LEDGER.filter(
    (entry) => entry.guard.kind === "FROZEN_EXACT",
  );

  assert.ok(frozen.length > 0, "el censo declara al menos un invariante");

  for (const entry of frozen) {
    assert.equal(
      entry.historical,
      0,
      `${entry.metric}: sólo se congelan invariantes en 0 (§31.2, fila Congelable)`,
    );
    assert.equal(
      entry.resolution,
      "REPRODUCED",
      `${entry.metric}: un invariante congelado no puede estar reclasificado`,
    );
  }

  for (const entry of CENSUS_LEDGER) {
    if (entry.guard.kind !== "TOLERANCE_BAND") {
      continue;
    }

    assert.ok(
      entry.guard.tolerance > 0 && entry.guard.tolerance <= 0.5,
      `${entry.metric}: la banda debe ser una tolerancia real, no un pase libre`,
    );
  }
});

test("censo 01B: no queda ninguna métrica de A.0/A.4 sin resolución", () => {
  const ledgerRows = new Set(CENSUS_LEDGER.map((entry) => entry.row));
  const executionRows = new Set(
    EXECUTION_DERIVED_METRICS.map((entry) => entry.row),
  );
  const pending = [...AUDIT_DERIVED_ROWS, ...REPRODUCIBLE_ROWS].filter(
    (row) => !ledgerRows.has(row) && !executionRows.has(row),
  );

  assert.deepEqual(
    pending,
    [],
    "cada fila de A.0 queda reproducida, reclasificada o declarada como derivada de ejecución",
  );

  for (const row of ledgerRows) {
    assert.ok(
      AUDIT_DERIVED_ROWS.includes(row) || REPRODUCIBLE_ROWS.includes(row),
      `${row}: el libro mayor no puede contener filas ajenas a A.0`,
    );
  }

  for (const entry of EXECUTION_DERIVED_METRICS) {
    assert.ok(
      entry.command.trim().length > 0 && entry.reason.trim().length >= 40,
      `${entry.metric}: una métrica de ejecución declara su comando y su razón`,
    );
    assert.equal(
      ledgerRows.has(entry.row),
      false,
      `${entry.row}: una métrica no puede resolverse dos veces`,
    );
  }
});

test("censo 01B: las cuatro capacidades de A.4 están versionadas y ejercidas", () => {
  // classify
  assert.equal(classification.specs.length, volumes.specs);
  assert.ok(
    classification.specs.every(
      (spec) => spec.path.startsWith("test/") && spec.path.endsWith(".test.ts"),
    ),
  );

  // coupling
  assert.equal(coupling.totals.files, classification.specs.length);
  assert.deepEqual(
    [...ORACLE_CLASSES].sort(),
    Object.keys(coupling.byClass).sort(),
  );

  // ownership
  assert.ok(ownership.entries.length > 0);
  assert.ok(ownership.supportConsumers.length >= 12);

  // stale-paths
  assert.ok(paths.references.length > 0);
  assert.equal(
    paths.missing.every((reference) => !reference.exists),
    true,
  );
});

test("censo 01B: las clasificaciones particionan la suite sin pérdida", () => {
  const bucketTotal = Object.values(classification.byBucket).reduce(
    (sum, count) => sum + count,
    0,
  );
  const oracleFiles = Object.values(coupling.byClass).reduce(
    (sum, entry) => sum + entry.files,
    0,
  );
  const oracleTests = Object.values(coupling.byClass).reduce(
    (sum, entry) => sum + entry.tests,
    0,
  );
  const folderFileTotal = classification.byFolder.reduce(
    (sum, folder) => sum + folder.files,
    0,
  );

  assert.equal(bucketTotal, classification.specs.length);
  assert.equal(oracleFiles, classification.specs.length);
  assert.equal(oracleTests, classification.totals.tests);
  assert.equal(folderFileTotal, classification.specs.length);
  assert.equal(
    volumes.testFiles,
    volumes.specs + volumes.supportFiles,
    "el inventario de test/** se parte en specs y soporte sin resto",
  );
  assert.equal(
    ownership.distribution.reduce((sum, bucket) => sum + bucket.files, 0),
    ownership.totals.referencedProductionFiles,
    "la distribución de ownership cubre todos los archivos referenciados",
  );
});

test("censo 01B: A0-24-PARETO tiene una ruta de recomputación real, no sólo declarada", () => {
  // El finding de Codex sobre este contrato exigía más que texto conceptual
  // ("... + procesamiento de la salida"): la recomputación tiene que ser un
  // comando ejecutable de verdad. Esta prueba lo ejecuta: corre una porción
  // pequeña y estable de la suite con `--test-reporter=tap` y pasa la salida
  // real al procesador versionado. No se congelan cifras de tiempo (§24,
  // §31.2): sólo se verifica que la ruta completa — correr con TAP, parsear,
  // rankear, calcular Pareto — funciona sobre una corrida de verdad.
  let tap: string;
  // `NODE_TEST_CONTEXT` marks THIS process as a node:test child; inheriting
  // it would make the spawned run detect a (harmless) nested invocation and
  // skip actually running, producing empty TAP output.
  const childEnv = { ...process.env };

  delete childEnv.NODE_TEST_CONTEXT;

  try {
    tap = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--experimental-specifier-resolution=node",
        "--test",
        "--test-reporter=tap",
        "test/unit/pricing/*.test.ts",
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: childEnv },
    );
  } catch (error) {
    tap = (error as { stdout?: string }).stdout ?? "";
  }

  assert.ok(tap.length > 0, "la corrida real de TAP no puede estar vacía");

  const result = analyzeTapOutput(tap);

  assert.ok(result.entries.length > 0);
  assert.ok(result.totalDurationMs > 0);
  assert.ok(result.entriesFor50Percent >= 1);
  assert.ok(result.entriesFor50Percent <= result.entries.length);
  assert.ok(result.entriesFor80Percent >= result.entriesFor50Percent);
  assert.ok(result.entriesFor80Percent <= result.entries.length);

  // Ranking realmente ordenado por duración descendente.
  for (let index = 1; index < result.entries.length; index += 1) {
    assert.ok(
      result.entries[index - 1]!.durationMs >= result.entries[index]!.durationMs,
    );
  }
});

test("censo 01B: los hallazgos cualitativos del rector siguen vigentes", () => {
  // §7.3: el acoplamiento candidato se concentra en una sola carpeta.
  const [densest] = coupling.candidateConcentration;

  assert.ok(densest !== undefined, "el pool de candidatos no puede estar vacío");
  assert.equal(densest.folder, "test/unit/ui");

  // §22: el error-path domina sobre el happy path en la frontera HTTP.
  const happyPath = statusAssertions("200") + statusAssertions("201");
  const errorPath = ["400", "401", "403", "404", "409", "426", "429", "500"]
    .map(statusAssertions)
    .reduce((sum, count) => sum + count, 0);

  assert.ok(
    errorPath > happyPath,
    "§22: la suite debe seguir asertando más error-path que happy path",
  );

  // §23: el ownership difuso sigue siendo el freno real al refactor.
  assert.ok(
    ownership.diffusedFiles.length >= 40,
    `§23: ownership difuso (>= ${DIFFUSED_OWNERSHIP_THRESHOLD} guards) por debajo de lo auditado`,
  );

  // §8.2: el umbral de dominancia de substring está declarado y es efectivo.
  assert.equal(SUBSTRING_DOMINANCE, 0.8);
  assert.ok(coupling.substringDominatedPool.files.length > 0);
});
