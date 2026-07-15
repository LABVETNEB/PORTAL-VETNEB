import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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

const REPO_ROOT = process.cwd();
const SOURCE_FILE_PATTERN = /\.(cjs|cts|js|mjs|mts|ts)$/;

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
