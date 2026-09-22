import { type CensusCorpus, specFiles } from "./corpus.ts";

/**
 * Literal path references and their staleness (TEST-GLOBAL-01B, versioned
 * equivalent of the unversioned `stale-paths.mjs` of Anexo A.4).
 *
 * §9.3 censuses every repo-shaped path written as a string literal inside
 * `test/**` and checks it against the tracked tree. Most missing paths are
 * legitimate — absence assertions of retired shims, synthetic inputs to pure
 * classifiers — so the census separates the dangerous subset of §9.2: paths
 * held inside a registry that nothing dereferences, where nothing detects
 * that they are broken.
 */

const REPO_ROOTS = [
  "server",
  "frontend",
  "shared",
  "drizzle",
  "scripts",
  "test",
  "docs",
  ".github",
] as const;

const PATH_LITERAL =
  /["'`]((?:server|frontend|shared|drizzle|scripts|test|docs|\.github)\/[A-Za-z0-9._\-/]*[A-Za-z0-9._-])["'`]/g;

export type PathReference = {
  readonly path: string;
  readonly referencedBy: readonly string[];
  readonly occurrences: number;
  readonly exists: boolean;
};

export type StalePathCensus = {
  readonly references: readonly PathReference[];
  readonly missing: readonly PathReference[];
  readonly totals: {
    readonly occurrences: number;
    readonly uniquePaths: number;
    readonly missingPaths: number;
  };
};

/** Census of every literal repo path referenced from `test/**`. */
export function stalePathCensus(corpus: CensusCorpus): StalePathCensus {
  const tracked = new Set(corpus.files);
  const trackedDirectories = new Set<string>();

  for (const file of corpus.files) {
    const segments = file.split("/");

    for (let index = 1; index < segments.length; index += 1) {
      trackedDirectories.add(segments.slice(0, index).join("/"));
    }
  }

  const byPath = new Map<
    string,
    { referencedBy: Set<string>; occurrences: number }
  >();
  let occurrences = 0;

  for (const spec of specFiles(corpus)) {
    for (const match of corpus.read(spec).matchAll(PATH_LITERAL)) {
      const path = match[1] ?? "";

      if (!REPO_ROOTS.some((root) => path.startsWith(`${root}/`))) {
        continue;
      }

      const entry = byPath.get(path) ?? {
        referencedBy: new Set<string>(),
        occurrences: 0,
      };

      entry.referencedBy.add(spec);
      entry.occurrences += 1;
      byPath.set(path, entry);
      occurrences += 1;
    }
  }

  // Precedence matters: an extensionless tracked file (e.g. `.github/CODEOWNERS`)
  // must be resolved as a tracked file first. Falling back to "does it look
  // like a file" before checking the tracked set misclassifies it as missing.
  const references: PathReference[] = [...byPath.entries()]
    .map(([path, entry]) => ({
      path,
      referencedBy: [...entry.referencedBy].sort(),
      occurrences: entry.occurrences,
      exists: tracked.has(path) || trackedDirectories.has(path),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const missing = references.filter((reference) => !reference.exists);

  return {
    references,
    missing,
    totals: {
      occurrences,
      uniquePaths: references.length,
      missingPaths: missing.length,
    },
  };
}

/**
 * §9.2: paths declared inside a registry literal of `registryFile` that no
 * longer exist in the tracked tree. This is the dangerous subset — a stale
 * entry here means a security-evidence registry that nothing dereferences.
 */
export function staleRegistryEvidence(
  corpus: CensusCorpus,
  registryFile: string,
  fieldName: string,
): readonly string[] {
  if (typeof fieldName !== "string" || fieldName.trim() === "") {
    throw new TypeError("a registry field name is required");
  }

  const source = corpus.read(registryFile);
  const tracked = new Set(corpus.files);
  const stale = new Set<string>();
  const fieldPattern = new RegExp(
    `${fieldName}\\s*:\\s*\\[([^\\]]*)\\]`,
    "g",
  );

  for (const match of source.matchAll(fieldPattern)) {
    for (const literal of (match[1] ?? "").matchAll(
      /["'`]([A-Za-z0-9._\-/]+)["'`]/g,
    )) {
      const path = literal[1] ?? "";

      if (path.includes("/") && !tracked.has(path)) {
        stale.add(path);
      }
    }
  }

  return [...stale].sort();
}
