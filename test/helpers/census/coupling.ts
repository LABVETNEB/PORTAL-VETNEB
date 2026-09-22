import { type CensusCorpus } from "./corpus.ts";
import {
  type CensusClassification,
  type SpecClassification,
  classifyCorpus,
} from "./classify.ts";

/**
 * Oracle-power classification (TEST-GLOBAL-01B, versioned equivalent of the
 * unversioned `coupling.mjs` of Anexo A.4).
 *
 * The criterion is §7.3: a spec is classified by **what its assertions
 * prove**, not by the physical signal of reading the filesystem. Reading the
 * tree is correct by design for an architecture guard (§16) and accidental
 * for a spec that asserts browser behaviour through substrings of a `.tsx`
 * (§19). The output of the `ACCIDENTAL_COUPLING_CANDIDATE` class is a **pool
 * to adjudicate** in TEST-GLOBAL-06, never confirmed debt (§7.4).
 */

export type OracleClass =
  | "RUNTIME_BEHAVIOURAL"
  | "ACCIDENTAL_COUPLING_CANDIDATE"
  | "LEGITIMATE_GUARD"
  | "MIXED"
  | "LEGITIMATE_STATIC_CONTRACT"
  | "UNKNOWN_REQUIRES_REVIEW";

export const ORACLE_CLASSES: readonly OracleClass[] = [
  "RUNTIME_BEHAVIOURAL",
  "ACCIDENTAL_COUPLING_CANDIDATE",
  "LEGITIMATE_GUARD",
  "MIXED",
  "LEGITIMATE_STATIC_CONTRACT",
  "UNKNOWN_REQUIRES_REVIEW",
];

/** Substring share above which a filesystem-only oracle is substring-driven. */
export const SUBSTRING_DOMINANCE = 0.8;

const AUTO_DISCOVERY = /readdirSync|listSourceFiles|listTrackedFiles|listTrackedSourceFiles|globSync/;
const FAIL_CLOSED_ASSERTION =
  /assert\.deepEqual\(\s*[A-Za-z0-9_.]+\s*,\s*\[\s*\]|assert\.equal\([A-Za-z0-9_.]+\.length\s*,\s*0\)|assert\.doesNotMatch\(|assert\.equal\([^,]+,\s*false\)/;
const STATIC_ARTIFACT =
  /\.(sql|ya?ml|json|css|md|mjs|cjs|toml|ps1|bat)\b|drizzle\/migrations|\.github\/workflows|next\.config|eslint\.config|package\.json|tsconfig/;
const BEHAVIOURAL_MARKER =
  /estado vac|empty state|loading|focus|foco|hover|navegaci|navigation|interact|feedback|polish|animation|transition|scroll|click|render/i;

export type CoupledSpec = {
  readonly path: string;
  readonly folder: string;
  readonly tests: number;
  readonly oracleClass: OracleClass;
  readonly substringRatio: number;
  readonly autoDiscovery: boolean;
  readonly failClosed: boolean;
};

export type CouplingCensus = {
  readonly specs: readonly CoupledSpec[];
  readonly byClass: Readonly<
    Record<OracleClass, { readonly files: number; readonly tests: number }>
  >;
  /** `ACCIDENTAL_COUPLING_CANDIDATE` concentration, densest folder first. */
  readonly candidateConcentration: readonly {
    readonly folder: string;
    readonly files: number;
  }[];
  /** §8.2 pool: substring-dominated oracles that exercise no runtime. */
  readonly substringDominatedPool: {
    readonly files: readonly string[];
    readonly tests: number;
  };
  readonly rawSignals: Readonly<Record<string, number>>;
  readonly totals: {
    readonly files: number;
    readonly tests: number;
  };
};

export type OracleSignals = {
  /** Walks the tree and fails closed, so a new offender breaks it (§16). */
  readonly autoDiscoveryGuard: boolean;
  /** Asserts over an artifact whose text is itself the deliverable (§7.4). */
  readonly staticArtifactTarget: boolean;
  /** Claims browser behaviour: render, focus, navigation, state (§19). */
  readonly behaviouralClaims: boolean;
};

/** Oracle signals of a spec, derived from its text alone. */
export function deriveOracleSignals(source: string): OracleSignals {
  const behaviouralClaims = BEHAVIOURAL_MARKER.test(source);

  return {
    autoDiscoveryGuard:
      AUTO_DISCOVERY.test(source) && FAIL_CLOSED_ASSERTION.test(source),
    staticArtifactTarget: STATIC_ARTIFACT.test(source) && !behaviouralClaims,
    behaviouralClaims,
  };
}

/** Oracle class of a single already-classified spec. */
export function classifyOracle(
  spec: SpecClassification,
  signals: OracleSignals,
): OracleClass {
  const source = {
    runtime: spec.executesRuntime || spec.usesHttpInjection,
    filesystem: spec.readsFilesystem,
  };

  if (source.runtime && source.filesystem) {
    return "MIXED";
  }

  if (source.runtime) {
    return "RUNTIME_BEHAVIOURAL";
  }

  if (!source.filesystem) {
    return spec.usesDynamicImport || spec.usesChildProcess
      ? "RUNTIME_BEHAVIOURAL"
      : "UNKNOWN_REQUIRES_REVIEW";
  }

  if (signals.autoDiscoveryGuard) {
    return "LEGITIMATE_GUARD";
  }

  if (signals.staticArtifactTarget) {
    return "LEGITIMATE_STATIC_CONTRACT";
  }

  if (spec.substringRatio >= SUBSTRING_DOMINANCE && signals.behaviouralClaims) {
    return "ACCIDENTAL_COUPLING_CANDIDATE";
  }

  return spec.substringRatio >= SUBSTRING_DOMINANCE
    ? "LEGITIMATE_STATIC_CONTRACT"
    : "UNKNOWN_REQUIRES_REVIEW";
}

/** Oracle-power census over the whole corpus. */
export function couplingCensus(
  corpus: CensusCorpus,
  classification: CensusClassification = classifyCorpus(corpus),
): CouplingCensus {
  const specs: CoupledSpec[] = [];
  const byClass = Object.fromEntries(
    ORACLE_CLASSES.map((oracleClass) => [oracleClass, { files: 0, tests: 0 }]),
  ) as Record<OracleClass, { files: number; tests: number }>;
  const candidateFolders = new Map<string, number>();
  const substringPool: string[] = [];
  let substringPoolTests = 0;

  for (const spec of classification.specs) {
    const source = corpus.read(spec.path);
    const signals = deriveOracleSignals(source);
    const oracleClass = classifyOracle(spec, signals);

    byClass[oracleClass].files += 1;
    byClass[oracleClass].tests += spec.tests;

    if (oracleClass === "ACCIDENTAL_COUPLING_CANDIDATE") {
      candidateFolders.set(
        spec.folder,
        (candidateFolders.get(spec.folder) ?? 0) + 1,
      );
    }

    if (
      spec.substringRatio >= SUBSTRING_DOMINANCE &&
      !spec.executesRuntime &&
      !spec.usesHttpInjection &&
      !spec.usesDynamicImport
    ) {
      substringPool.push(spec.path);
      substringPoolTests += spec.tests;
    }

    specs.push({
      path: spec.path,
      folder: spec.folder,
      tests: spec.tests,
      oracleClass,
      substringRatio: spec.substringRatio,
      autoDiscovery: signals.autoDiscoveryGuard,
      failClosed: FAIL_CLOSED_ASSERTION.test(source),
    });
  }

  return {
    specs,
    byClass,
    candidateConcentration: [...candidateFolders.entries()]
      .map(([folder, files]) => ({ folder, files }))
      .sort(
        (left, right) =>
          right.files - left.files || left.folder.localeCompare(right.folder),
      ),
    substringDominatedPool: {
      files: substringPool.sort(),
      tests: substringPoolTests,
    },
    rawSignals: rawCouplingSignals(corpus, classification),
    totals: {
      files: classification.specs.length,
      tests: classification.totals.tests,
    },
  };
}

/** §7.1 raw signal census: files carrying each physical coupling marker. */
export function rawCouplingSignals(
  corpus: CensusCorpus,
  classification: CensusClassification = classifyCorpus(corpus),
): Record<string, number> {
  const signals: Record<string, RegExp> = {
    "node:fs": /from\s+["']node:fs/,
    readFileSync: /readFileSync/,
    existsSync: /existsSync/,
    readdirSync: /readdirSync/,
    "node:child_process": /node:child_process/,
    statSync: /statSync/,
    "js-yaml": /js-yaml/,
    createRequire: /createRequire|node:module/,
  };
  const counts: Record<string, number> = {};

  for (const [signal, pattern] of Object.entries(signals)) {
    counts[signal] = classification.specs.filter((spec) =>
      pattern.test(corpus.read(spec.path)),
    ).length;
  }

  return counts;
}
