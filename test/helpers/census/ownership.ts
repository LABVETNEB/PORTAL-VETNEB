import {
  type CensusCorpus,
  filesUnder,
  specFiles,
  testSupportFiles,
} from "./corpus.ts";

/**
 * Ownership diffusion (TEST-GLOBAL-01B, versioned equivalent of the
 * unversioned `ownership.mjs` of Anexo A.4).
 *
 * Answers §23: how many spec files point at each production file, and
 * therefore how many of them a legitimate refactor has to edit. It also
 * censuses the consumers of shared test support (§6.4, §12.1) and the
 * duplicate test names of §23, from the tracked tree only.
 */

const PRODUCTION_ROOTS = [
  "server/",
  "frontend/src/",
  "shared/",
  "drizzle/",
  "scripts/",
] as const;

const PRODUCTION_FILE = /\.(ts|tsx|js|mjs|css|sql)$/;

/** Buckets of §23; a file belongs to the first bucket whose bound it meets. */
export const OWNERSHIP_BUCKETS = [
  { label: "1", max: 1 },
  { label: "2-3", max: 3 },
  { label: "4-6", max: 6 },
  { label: "7-10", max: 10 },
  { label: "11-20", max: 20 },
  { label: "21+", max: Number.POSITIVE_INFINITY },
] as const;

export type OwnershipEntry = {
  readonly productionFile: string;
  readonly guards: readonly string[];
};

export type SupportConsumers = {
  readonly supportFile: string;
  readonly lines: number;
  readonly consumers: readonly string[];
};

export type OwnershipCensus = {
  /** Production files referenced by at least one spec, most guarded first. */
  readonly entries: readonly OwnershipEntry[];
  readonly distribution: readonly {
    readonly label: string;
    readonly files: number;
  }[];
  readonly diffusedFiles: readonly string[];
  readonly supportConsumers: readonly SupportConsumers[];
  readonly duplicateTestNames: readonly {
    readonly name: string;
    readonly files: readonly string[];
  }[];
  readonly totals: {
    readonly referencedProductionFiles: number;
    readonly references: number;
  };
};

/** Threshold of §23 above which ownership is considered diffused. */
export const DIFFUSED_OWNERSHIP_THRESHOLD = 11;

function isProductionFile(path: string): boolean {
  return (
    PRODUCTION_ROOTS.some((root) => path.startsWith(root)) &&
    PRODUCTION_FILE.test(path)
  );
}

function testNames(source: string): string[] {
  return [...source.matchAll(/^\s*test\(\s*["'`]([^"'`]+)["'`]/gm)].map(
    (match) => match[1] ?? "",
  );
}

/** Ownership census over the tracked corpus. */
export function ownershipCensus(corpus: CensusCorpus): OwnershipCensus {
  const specs = specFiles(corpus);
  const productionFiles = corpus.files.filter(isProductionFile);
  const guardsByFile = new Map<string, Set<string>>();
  const namesByFile = new Map<string, string[]>();
  let references = 0;

  for (const spec of specs) {
    const source = corpus.read(spec);

    namesByFile.set(spec, testNames(source));

    for (const productionFile of productionFiles) {
      if (!source.includes(productionFile)) {
        continue;
      }

      const guards = guardsByFile.get(productionFile) ?? new Set<string>();

      guards.add(spec);
      guardsByFile.set(productionFile, guards);
      references += 1;
    }
  }

  const entries: OwnershipEntry[] = [...guardsByFile.entries()]
    .map(([productionFile, guards]) => ({
      productionFile,
      guards: [...guards].sort(),
    }))
    .sort(
      (left, right) =>
        right.guards.length - left.guards.length ||
        left.productionFile.localeCompare(right.productionFile),
    );

  const distribution = OWNERSHIP_BUCKETS.map((bucket, index) => {
    const lowerBound = index === 0 ? 1 : OWNERSHIP_BUCKETS[index - 1]!.max + 1;

    return {
      label: bucket.label,
      files: entries.filter(
        (entry) =>
          entry.guards.length >= lowerBound && entry.guards.length <= bucket.max,
      ).length,
    };
  });

  const duplicates = new Map<string, Set<string>>();

  for (const [spec, names] of namesByFile) {
    for (const name of names) {
      const holders = duplicates.get(name) ?? new Set<string>();

      holders.add(spec);
      duplicates.set(name, holders);
    }
  }

  return {
    entries,
    distribution,
    diffusedFiles: entries
      .filter((entry) => entry.guards.length >= DIFFUSED_OWNERSHIP_THRESHOLD)
      .map((entry) => entry.productionFile)
      .sort(),
    supportConsumers: supportConsumerCensus(corpus),
    duplicateTestNames: [...duplicates.entries()]
      .filter(([, holders]) => holders.size > 1)
      .map(([name, holders]) => ({ name, files: [...holders].sort() }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    totals: {
      referencedProductionFiles: entries.length,
      references,
    },
  };
}

/** §6.4 / §12.1: which specs import each shared support module. */
export function supportConsumerCensus(
  corpus: CensusCorpus,
): readonly SupportConsumers[] {
  const supportModules = testSupportFiles(corpus).filter((file) =>
    /^test\/(helpers|fixtures|factories|mocks)\/.+\.ts$/.test(file),
  );
  const testTree = filesUnder(corpus, "test").filter((file) =>
    file.endsWith(".ts"),
  );

  return supportModules
    .map((supportFile) => {
      const moduleName = supportFile.replace(/^test\//, "").replace(/\.ts$/, "");
      const consumers = testTree.filter(
        (file) => file !== supportFile && corpus.read(file).includes(moduleName),
      );

      return {
        supportFile,
        lines: corpus.read(supportFile).split("\n").length - 1,
        consumers: consumers.sort(),
      };
    })
    .sort((left, right) => left.supportFile.localeCompare(right.supportFile));
}

/** §19: how many spec references each production destination prefix takes. */
export function readDestinationCensus(
  corpus: CensusCorpus,
  prefixes: readonly string[],
): readonly { readonly prefix: string; readonly references: number }[] {
  if (!Array.isArray(prefixes) || prefixes.length === 0) {
    throw new TypeError("at least one destination prefix is required");
  }

  const specs = specFiles(corpus);

  return prefixes
    .map((prefix) => {
      let references = 0;

      for (const spec of specs) {
        const source = corpus.read(spec);

        for (const match of source.matchAll(
          /["'`]((?:server|frontend|shared|drizzle|scripts)\/[A-Za-z0-9._\-/]+)["'`]/g,
        )) {
          if ((match[1] ?? "").startsWith(prefix)) {
            references += 1;
          }
        }
      }

      return { prefix, references };
    })
    .sort((left, right) => right.references - left.references);
}
