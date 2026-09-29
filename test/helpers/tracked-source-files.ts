import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

let cachedIndexPaths: readonly string[] | null = null;
let cachedTrackedFiles: readonly string[] | null = null;

const SHA1_BYTES = 20;
const INDEX_ENTRY_FIXED_BYTES = 40 + SHA1_BYTES + 2;
const INDEX_EXTENDED_FLAG = 0x4000;
const INDEX_NAME_MASK = 0x0fff;
const GITLINK_OR_FILE_MODES = new Set([0o100644, 0o100755, 0o120000, 0o160000]);

/**
 * Paths of a git index file (`.git/index`), in index order, exactly as
 * `git ls-files -z` prints them. Spawning git once per test process is the
 * dominant cost of the canonical reader on Windows, so the index is parsed in
 * process. Every entry is validated structurally (bounds, NUL terminator,
 * name length, file mode) and the extension chain must end exactly at the
 * trailing hash. Returns `null` for anything this parser does not fully
 * understand (unknown version, split or sparse index, any inconsistency): the
 * caller then asks git itself, so an unsupported index can never yield a
 * partial inventory.
 */
export function parseGitIndexPaths(index: Uint8Array): string[] | null {
  const bytes = Buffer.from(index.buffer, index.byteOffset, index.byteLength);

  if (bytes.length < 12 + SHA1_BYTES || bytes.toString("latin1", 0, 4) !== "DIRC") {
    return null;
  }

  const version = bytes.readUInt32BE(4);
  const count = bytes.readUInt32BE(8);
  const body = bytes.length - SHA1_BYTES;

  if (![2, 3, 4].includes(version)) {
    return null;
  }

  // Names are copied NUL-separated into one buffer and decoded once: one
  // string per entry is the dominant cost of reading the index in-process.
  let names = Buffer.allocUnsafe(body);
  let written = 0;
  let previousStart = 0;
  let previousLength = 0;
  let offset = 12;

  for (let entry = 0; entry < count; entry += 1) {
    if (offset + INDEX_ENTRY_FIXED_BYTES > body) {
      return null;
    }

    const mode = bytes.readUInt32BE(offset + 24);
    const flags = bytes.readUInt16BE(offset + 40 + SHA1_BYTES);
    let cursor = offset + INDEX_ENTRY_FIXED_BYTES;

    if (!GITLINK_OR_FILE_MODES.has(mode)) {
      return null;
    }

    if (flags & INDEX_EXTENDED_FLAG) {
      if (version < 3) {
        return null;
      }
      cursor += 2;
    }

    let keep = 0;

    if (version === 4) {
      if (cursor >= body) {
        return null;
      }
      let byte = bytes[cursor++] as number;
      let strip = byte & 0x7f;
      while (byte & 0x80) {
        if (cursor >= body) {
          return null;
        }
        byte = bytes[cursor++] as number;
        strip = (strip + 1) * 128 + (byte & 0x7f);
      }
      if (strip > previousLength) {
        return null;
      }
      keep = previousLength - strip;
    }

    const end = bytes.indexOf(0, cursor);
    if (end < 0 || end >= body) {
      return null;
    }

    const length = keep + end - cursor;
    const declared = flags & INDEX_NAME_MASK;
    if (declared !== INDEX_NAME_MASK && declared !== length) {
      return null;
    }

    if (written + length + 1 > names.length) {
      const grown = Buffer.allocUnsafe(Math.max(names.length * 2, written + length + 1));
      names.copy(grown, 0, 0, written);
      names = grown;
    }

    names.copy(names, written, previousStart, previousStart + keep);
    bytes.copy(names, written + keep, cursor, end);
    previousStart = written;
    previousLength = length;
    written += length;
    names[written++] = 0;
    offset = version === 4 ? end + 1 : offset + ((cursor - offset + length + 8) & ~7);
  }

  for (let cursor = offset; cursor < body; ) {
    if (cursor + 8 > body) {
      return null;
    }

    const signature = bytes.toString("latin1", cursor, cursor + 4);
    const firstSignatureByte = bytes[cursor] as number;

    // A lowercase first signature byte marks a mandatory Git index
    // extension. This parser does not implement mandatory extensions, so it
    // must fail closed and let the caller fall back to git.
    if (
      signature === "link" ||
      signature === "sdir" ||
      (firstSignatureByte >= 0x61 && firstSignatureByte <= 0x7a)
    ) {
      return null;
    }

    cursor += 8 + bytes.readUInt32BE(cursor + 4);
    if (cursor > body) {
      return null;
    }
  }

  return count === 0 ? [] : names.toString("utf8", 0, written - 1).split("\0");
}

function readIndexPaths(): string[] | null {
  if (process.env.GIT_DIR || process.env.GIT_INDEX_FILE || process.env.GIT_WORK_TREE) {
    return null;
  }

  try {
    if (!statSync(resolve(REPO_ROOT, ".git")).isDirectory()) {
      return null;
    }

    return parseGitIndexPaths(readFileSync(resolve(REPO_ROOT, ".git", "index")));
  } catch {
    return null;
  }
}

/**
 * `git ls-files -z` itself: the reference the in-process parser must match.
 * `node:child_process` is resolved on first use: most test processes never
 * need it and a static import costs every one of them its load time.
 */
export function gitLsFiles(): string[] {
  const { execFileSync } = process.getBuiltinModule("node:child_process");
  const stdout = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  return stdout.split("\0").filter(Boolean);
}

/** Tracked paths in index order, read once per process. */
function trackedPaths(): readonly string[] {
  cachedIndexPaths ??= readIndexPaths() ?? gitLsFiles();

  return cachedIndexPaths;
}

/** Every git-tracked path, repo-relative with forward slashes, sorted. */
export function listTrackedFiles(): string[] {
  cachedTrackedFiles ??= [...trackedPaths()].sort();

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
  trackedFiles: trackedPaths,
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
