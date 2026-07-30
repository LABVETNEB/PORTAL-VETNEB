import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
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
