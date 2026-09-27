import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Tracked-file inventory for architecture scans (E2E-STAB-006).
 *
 * Repo-wide audits must operate on files that actually belong to the
 * repository (`git ls-files`) instead of walking the filesystem. A raw walk
 * descends into auxiliary trees that are not part of the codebase —
 * `.claude/worktrees/**` (full repo copies), `playwright-report/`,
 * `test-results/`, editor caches — and produces false offenders. Anything
 * tracked by git is always inventoried, so a dangerous tracked file can never
 * hide behind an exclusion list.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_FILE_PATTERN = /\.(cjs|cts|js|mjs|mts|ts)$/;
const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

let cachedTrackedFiles: readonly string[] | null = null;

/** Every git-tracked path, repo-relative with forward slashes, sorted. */
export function listTrackedFiles(): string[] {
  if (!cachedTrackedFiles) {
    const stdout = execFileSync("git", ["ls-files", "-z"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    cachedTrackedFiles = stdout.split("\0").filter(Boolean).sort();
  }

  return [...cachedTrackedFiles];
}

/**
 * Git-tracked JS/TS source files under `directory` (repo-relative, "." for
 * the whole repo). Paths staged as deleted are skipped so audits never read
 * a file that no longer exists in the working tree.
 */
export function listTrackedSourceFiles(directory = "."): string[] {
  const prefix =
    directory === "." ? "" : `${directory.replace(/\\/g, "/").replace(/\/+$/, "")}/`;

  return listTrackedFiles().filter(
    (file) =>
      file.startsWith(prefix) &&
      SOURCE_FILE_PATTERN.test(file) &&
      existsSync(resolve(REPO_ROOT, file)),
  );
}

/** CRLF → LF. The only line-ending normalization of the suite (TG-R16). */
export function normalizeLineEndings(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("line-ending normalization requires a string");
  }

  return text.replace(/\r\n/g, "\n");
}

function toRepoRelativePath(path: string): string {
  if (typeof path !== "string" || path.trim() === "") {
    throw new TypeError("source path must be a non-empty repo-relative string");
  }

  const normalized = path.replace(/\\/g, "/");

  if (isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`source path must be repo-relative, not absolute: ${path}`);
  }

  if (
    normalized
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`source path must be a normalized repo-relative path: ${path}`);
  }

  return normalized;
}

export type SourceReaderDependencies = {
  /** Repo-relative tracked paths with forward slashes; evaluated on first read. */
  readonly trackedFiles: () => Iterable<string>;
  /** Raw UTF-8 contents of a repo-relative path. */
  readonly readFile: (repoRelativePath: string) => string;
};

/**
 * Canonical source reader (TEST-GLOBAL-05A). Accepts a repo-relative path
 * (backslashes normalized), refuses anything that is not a git-tracked file,
 * reads UTF-8, normalizes CRLF exactly once and memoizes the result for the
 * lifetime of the reader. Every failure is an explicit error: a path is never
 * degraded into an empty string.
 */
export function createSourceReader(
  dependencies: SourceReaderDependencies,
): (repoRelativePath: string) => string {
  const cache = new Map<string, string>();
  let tracked: ReadonlySet<string> | null = null;

  return (repoRelativePath: string): string => {
    const path = toRepoRelativePath(repoRelativePath);
    const cached = cache.get(path);

    if (cached !== undefined) {
      return cached;
    }

    tracked ??= new Set(dependencies.trackedFiles());

    if (!tracked.has(path)) {
      throw new Error(`source path is not a git-tracked file: ${path}`);
    }

    let raw: string;

    try {
      raw = dependencies.readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
        throw new Error(
          `tracked source file is missing from the working tree: ${path}`,
          { cause: error },
        );
      }

      throw error;
    }

    if (typeof raw !== "string") {
      throw new TypeError(`source reader must yield a string: ${path}`);
    }

    const text = normalizeLineEndings(raw);

    cache.set(path, text);

    return text;
  };
}

const readTrackedSource = createSourceReader({
  trackedFiles: listTrackedFiles,
  readFile: (path) => readFileSync(resolve(REPO_ROOT, path), "utf8"),
});

/**
 * Text of a git-tracked repo file, CRLF-normalized and cached per process.
 * The single implementation of "read a source file" for the suite. Contents
 * are a per-process snapshot: a test that rewrites a tracked file must not
 * read it back through this reader.
 */
export function readSourceFile(repoRelativePath: string): string {
  return readTrackedSource(repoRelativePath);
}

export type SourceFileWalkOptions = {
  extensions?: readonly string[];
  excludedDirectories?: readonly string[];
};

/**
 * Recursively lists files below an explicit root. Returned paths are
 * root-relative, slash-normalized and sorted.
 */
export function listSourceFiles(
  root: string,
  options: SourceFileWalkOptions = {},
): string[] {
  const absoluteRoot = resolve(root);

  if (!existsSync(absoluteRoot)) {
    throw new Error(`Source root does not exist: ${absoluteRoot}`);
  }

  const extensions = options.extensions
    ? new Set(
        options.extensions.map((extension) =>
          extension.startsWith(".") ? extension : `.${extension}`,
        ),
      )
    : null;
  const excludedDirectories = new Set([
    ...DEFAULT_EXCLUDED_DIRECTORIES,
    ...(options.excludedDirectories ?? []),
  ]);
  const files: string[] = [];

  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) {
          walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (
        extensions &&
        ![...extensions].some((extension) => entry.name.endsWith(extension))
      ) {
        continue;
      }

      files.push(relative(absoluteRoot, absolutePath).replace(/\\/g, "/"));
    }
  }

  walk(absoluteRoot);

  return files.sort();
}
