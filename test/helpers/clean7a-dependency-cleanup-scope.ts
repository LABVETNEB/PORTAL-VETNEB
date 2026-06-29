import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLEAN7A_DEPENDENCY_FILES = new Set([
  "frontend/package.json",
  "pnpm-lock.yaml",
]);

const CLEAN7A_REMOVED_DEPENDENCIES = [
  "@tanstack/react-query",
  "@tanstack/react-table",
  "echarts",
  "echarts-for-react",
  "react-hook-form",
] as const;

const RADIX_DEPENDENCIES_LEFT_UNTOUCHED = [
  "@radix-ui/react-avatar",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-label",
  "@radix-ui/react-select",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toast",
  "@radix-ui/react-tooltip",
] as const;

const UNKNOWN_DEV_DEPENDENCIES_LEFT_UNTOUCHED = [
  "@eslint/eslintrc",
  "@next/eslint-plugin-next",
] as const;

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readJson(relativePath: string): PackageJson {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8")) as PackageJson;
}

function readText(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function gitDiffNameOnly(paths: string[]): string[] {
  return execFileSync("git", ["diff", "--name-only", "--", ...paths], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
}

export function isClean7aAllowedDependencyFile(file: string): boolean {
  return CLEAN7A_DEPENDENCY_FILES.has(file);
}

export function assertClean7aDependencyCleanupScope(): void {
  const changedPackageFiles = gitDiffNameOnly([
    "package.json",
    "frontend/package.json",
    "pnpm-lock.yaml",
    "frontend/pnpm-lock.yaml",
  ]);

  assert.deepEqual(
    changedPackageFiles.sort(),
    [...CLEAN7A_DEPENDENCY_FILES].sort(),
    "PR-CLEAN7A may only modify frontend/package.json and pnpm-lock.yaml among dependency manifests",
  );

  const frontendPkg = readJson("frontend/package.json");
  const dependencies = frontendPkg.dependencies ?? {};
  const devDependencies = frontendPkg.devDependencies ?? {};

  for (const dependency of CLEAN7A_REMOVED_DEPENDENCIES) {
    assert.equal(
      dependencies[dependency],
      undefined,
      `PR-CLEAN7A must remove only the approved unused dependency ${dependency}`,
    );
  }

  for (const dependency of RADIX_DEPENDENCIES_LEFT_UNTOUCHED) {
    assert.ok(
      dependencies[dependency],
      `PR-CLEAN7A must not remove Radix dependency ${dependency}`,
    );
  }

  for (const dependency of UNKNOWN_DEV_DEPENDENCIES_LEFT_UNTOUCHED) {
    assert.ok(
      devDependencies[dependency],
      `PR-CLEAN7A must not remove UNKNOWN tooling dependency ${dependency}`,
    );
  }

  const implementationNote = readText("docs/implementation/frontend-unused-deps-clean7a.md");
  assert.ok(implementationNote.includes("PR-CLEAN7A"));
  for (const dependency of CLEAN7A_REMOVED_DEPENDENCIES) {
    assert.ok(
      implementationNote.includes(dependency),
      `PR-CLEAN7A implementation note must mention ${dependency}`,
    );
  }
}

export function isClean7aAllowedDependencyChange(file: string): boolean {
  if (!isClean7aAllowedDependencyFile(file)) {
    return false;
  }

  assertClean7aDependencyCleanupScope();
  return true;
}
