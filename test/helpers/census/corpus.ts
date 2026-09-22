import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listTrackedFiles } from "../tracked-source-files.ts";

/**
 * Census corpus (TEST-GLOBAL-01B).
 *
 * Single source of truth for every census of the program: the git-tracked
 * tree, read through `listTrackedFiles()`. No network, no `.env`, no
 * temporary files, no runtime import of production code. The same git
 * revision always produces the same corpus, so every census built on top of
 * it is reproducible from the tree alone.
 *
 * The corpus is an injectable interface on purpose: the fail-closed contract
 * exercises the same census functions against synthetic in-memory corpora, so
 * detection power is proven instead of assumed.
 */

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

export type CensusCorpus = {
  /** Repo-relative paths, forward slashes, sorted, deduplicated. */
  readonly files: readonly string[];
  /** Text of a corpus file, with CRLF normalized to LF. */
  read(path: string): string;
};

/** Repo-relative path with forward slashes and no trailing slash. */
export function normalizePath(path: string): string {
  if (typeof path !== "string" || path.trim() === "") {
    throw new TypeError("census path must be a non-empty string");
  }

  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Directory prefix usable with `startsWith`; "." means the whole tree. */
export function directoryPrefix(directory: string): string {
  const normalized = normalizePath(directory);

  return normalized === "." ? "" : `${normalized}/`;
}

/** Newline count, the definition `wc -l` and A.3c `SumLoc` both use. */
export function countLines(text: string): number {
  if (typeof text !== "string") {
    throw new TypeError("census line count requires a string");
  }

  return text.split("\n").length - 1;
}

/** A line-scoped matcher: global flags would carry `lastIndex` across calls. */
function lineMatcher(pattern: RegExp): RegExp {
  if (!(pattern instanceof RegExp)) {
    throw new TypeError("a RegExp pattern is required");
  }

  return new RegExp(pattern.source, pattern.flags.replace(/g/g, ""));
}

function sortedUnique(paths: readonly string[]): readonly string[] {
  return [...new Set(paths.map((path) => normalizePath(path)))].sort();
}

/**
 * Resolves a relative import specifier written inside `fromPath` to a
 * repo-relative path. Returns `null` for a non-relative specifier (a package
 * import), so a caller never mistakes a bare package name for a repo path.
 * Shared by every census module that needs to tell a real import apart from
 * a string that merely mentions a module name (§13.1, §23).
 */
export function resolveRelativeSpecifier(
  fromPath: string,
  specifier: string,
): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const segments = normalizePath(fromPath).split("/").slice(0, -1);

  for (const segment of specifier.split("/")) {
    if (segment === "." || segment === "") {
      continue;
    }

    if (segment === "..") {
      if (segments.length === 0) {
        return null;
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

const IMPORT_SPECIFIER = new RegExp(
  [
    '\\bfrom\\s+["\'`]([^"\'`]+)["\'`]', // import ... from "spec"
    '\\brequire\\s*\\(\\s*["\'`]([^"\'`]+)["\'`]\\s*\\)', // require("spec")
    '\\bimport\\s*\\(\\s*["\'`]([^"\'`]+)["\'`]\\s*\\)', // import("spec")
    '\\bimport\\s+["\'`]([^"\'`]+)["\'`]', // import "spec" (side-effect)
  ].join("|"),
  "g",
);

/**
 * Every module specifier a file imports through a real `import`/`require`
 * statement (static, side-effect, dynamic or CommonJS). A string that merely
 * names a module — a path literal passed to a helper, a comment, test data —
 * never matches this pattern, unlike a plain substring search.
 */
export function importSpecifiers(source: string): readonly string[] {
  if (typeof source !== "string") {
    throw new TypeError("import specifier extraction requires a string");
  }

  const specifiers: string[] = [];

  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    specifiers.push(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
  }

  return specifiers;
}

/** Corpus backed by the git-tracked tree. Files are read lazily and cached. */
export function createTrackedCorpus(): CensusCorpus {
  const files = sortedUnique(listTrackedFiles());
  const known = new Set(files);
  const cache = new Map<string, string>();

  return {
    files,
    read(path: string): string {
      const normalized = normalizePath(path);

      if (!known.has(normalized)) {
        throw new Error(`file is not part of the census corpus: ${normalized}`);
      }

      const cached = cache.get(normalized);

      if (cached !== undefined) {
        return cached;
      }

      const text = readFileSync(resolve(REPO_ROOT, normalized), "utf8").replace(
        /\r\n/g,
        "\n",
      );

      cache.set(normalized, text);

      return text;
    },
  };
}

/** Corpus backed by literal contents. Used by the fail-closed contract. */
export function createInMemoryCorpus(
  entries: Readonly<Record<string, string>>,
): CensusCorpus {
  if (entries === null || typeof entries !== "object") {
    throw new TypeError("in-memory corpus requires an object of file entries");
  }

  const contents = new Map<string, string>();

  for (const [path, text] of Object.entries(entries)) {
    if (typeof text !== "string") {
      throw new TypeError(`corpus entry ${path} must hold string contents`);
    }

    contents.set(normalizePath(path), text.replace(/\r\n/g, "\n"));
  }

  return {
    files: [...contents.keys()].sort(),
    read(path: string): string {
      const normalized = normalizePath(path);
      const text = contents.get(normalized);

      if (text === undefined) {
        throw new Error(`file is not part of the census corpus: ${normalized}`);
      }

      return text;
    },
  };
}

function assertCorpus(corpus: CensusCorpus): void {
  if (
    corpus === null ||
    typeof corpus !== "object" ||
    !Array.isArray(corpus.files) ||
    typeof corpus.read !== "function"
  ) {
    throw new TypeError("a census corpus with files and read() is required");
  }
}

/** Corpus files under `directory` ("." for the whole tree), sorted. */
export function filesUnder(
  corpus: CensusCorpus,
  directory = ".",
): readonly string[] {
  assertCorpus(corpus);

  const prefix = directoryPrefix(directory);

  return corpus.files.filter((file) => file.startsWith(prefix));
}

/** Executable specs: `*.test.ts` under `test/`. */
export function specFiles(corpus: CensusCorpus): readonly string[] {
  return filesUnder(corpus, "test").filter((file) => file.endsWith(".test.ts"));
}

/** Support files under `test/` that are not executable specs. */
export function testSupportFiles(corpus: CensusCorpus): readonly string[] {
  return filesUnder(corpus, "test").filter(
    (file) => !file.endsWith(".test.ts"),
  );
}

const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|mjs|mts)$/;

/** Production-shaped source files under `directory`. */
export function sourceFilesUnder(
  corpus: CensusCorpus,
  directory: string,
): readonly string[] {
  return filesUnder(corpus, directory).filter((file) =>
    SOURCE_FILE_PATTERN.test(file),
  );
}

/** Total newline count across `files`. */
export function totalLines(
  corpus: CensusCorpus,
  files: readonly string[],
): number {
  assertCorpus(corpus);

  let total = 0;

  for (const file of files) {
    total += countLines(corpus.read(file));
  }

  return total;
}

/** Files whose contents match `pattern` (the `grep -l` census form). */
export function filesMatching(
  corpus: CensusCorpus,
  files: readonly string[],
  pattern: RegExp,
): readonly string[] {
  assertCorpus(corpus);

  const matcher = lineMatcher(pattern);

  return files.filter((file) => matcher.test(corpus.read(file)));
}

/** Occurrences of `pattern` across `files` (the `grep -o` census form). */
export function countOccurrences(
  corpus: CensusCorpus,
  files: readonly string[],
  pattern: RegExp,
): number {
  assertCorpus(corpus);

  if (!(pattern instanceof RegExp)) {
    throw new TypeError("a RegExp pattern is required");
  }

  if (!pattern.global) {
    throw new TypeError("occurrence counting requires a global RegExp");
  }

  let total = 0;

  for (const file of files) {
    total += [...corpus.read(file).matchAll(pattern)].length;
  }

  return total;
}

/** Lines matching `pattern` across `files` (the `grep -c` census form). */
export function countMatchingLines(
  corpus: CensusCorpus,
  files: readonly string[],
  pattern: RegExp,
): number {
  assertCorpus(corpus);

  const matcher = lineMatcher(pattern);
  let total = 0;

  for (const file of files) {
    for (const line of corpus.read(file).split("\n")) {
      if (matcher.test(line)) {
        total += 1;
      }
    }
  }

  return total;
}
