import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

const CLEAN7A_DEPENDENCY_FILES = new Set([
  "frontend/package.json",
  "pnpm-lock.yaml",
]);

const CLEAN7A_MANIFEST_FILES = [
  "package.json",
  "frontend/package.json",
  "pnpm-lock.yaml",
  "frontend/pnpm-lock.yaml",
] as const;

const CLEAN7A_REMOVED_DEPENDENCIES = [
  "@tanstack/react-query",
  "@tanstack/react-table",
  "echarts",
  "echarts-for-react",
  "react-hook-form",
] as const;

const CLEAN7D_REMOVED_RADIX_DEPENDENCIES = [
  "@radix-ui/react-avatar",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-label",
  "@radix-ui/react-select",
  "@radix-ui/react-tabs",
] as const;

const RADIX_DEPENDENCIES_LEFT_UNTOUCHED = [
  "@radix-ui/react-dialog",
  "@radix-ui/react-separator",
  "@radix-ui/react-slot",
  "@radix-ui/react-toast",
  "@radix-ui/react-tooltip",
] as const;

const CLEAN7C_REMOVED_DEV_DEPENDENCIES = [
  "@eslint/eslintrc",
  "@next/eslint-plugin-next",
] as const;

export type Clean7aPackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type Clean7aDependencyCleanupScopeInput = {
  changedManifestFiles: readonly string[];
  baseFrontendPackage: Clean7aPackageJson;
  currentFrontendPackage: Clean7aPackageJson;
  implementationNote: string;
};

function parsePackageJson(
  source: string,
  label: string,
): Clean7aPackageJson {
  try {
    return JSON.parse(source) as Clean7aPackageJson;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo parsear ${label}: ${detail}`);
  }
}

function readCurrentPackageJson(relativePath: string): Clean7aPackageJson {
  return parsePackageJson(
    readFileSync(resolve(process.cwd(), relativePath), "utf8"),
    relativePath,
  );
}

function readText(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function gitDiffNameOnly(paths: readonly string[]): string[] {
  return execFileSync(
    "git",
    ["diff", "HEAD", "--name-only", "--", ...paths],
    {
      encoding: "utf8",
    },
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
}

function readBaseFrontendPackage(): Clean7aPackageJson {
  let source: string;

  try {
    source = execFileSync(
      "git",
      ["show", "HEAD:frontend/package.json"],
      {
        encoding: "utf8",
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo leer HEAD:frontend/package.json: ${detail}`,
    );
  }

  return parsePackageJson(source, "HEAD:frontend/package.json");
}

function dependencySectionsChanged(
  basePackage: Clean7aPackageJson,
  currentPackage: Clean7aPackageJson,
): boolean {
  const baseDependencies = basePackage.dependencies ?? {};
  const currentDependencies = currentPackage.dependencies ?? {};
  const baseDevDependencies = basePackage.devDependencies ?? {};
  const currentDevDependencies = currentPackage.devDependencies ?? {};

  return (
    !isDeepStrictEqual(baseDependencies, currentDependencies) ||
    !isDeepStrictEqual(baseDevDependencies, currentDevDependencies)
  );
}

function assertCurrentDependencyInvariants(
  currentFrontendPackage: Clean7aPackageJson,
  implementationNote: string,
): void {
  const dependencies = currentFrontendPackage.dependencies ?? {};
  const devDependencies = currentFrontendPackage.devDependencies ?? {};

  for (const dependency of CLEAN7A_REMOVED_DEPENDENCIES) {
    assert.equal(
      dependencies[dependency],
      undefined,
      `PR-CLEAN7A must keep removed dependency absent: ${dependency}`,
    );
  }

  for (const dependency of CLEAN7D_REMOVED_RADIX_DEPENDENCIES) {
    assert.equal(
      dependencies[dependency],
      undefined,
      `PR-CLEAN7D must keep removed Radix dependency absent: ${dependency}`,
    );
  }

  for (const dependency of RADIX_DEPENDENCIES_LEFT_UNTOUCHED) {
    assert.ok(
      dependencies[dependency],
      `PR-CLEAN7D must preserve active or deferred Radix dependency: ${dependency}`,
    );
  }

  for (const dependency of CLEAN7C_REMOVED_DEV_DEPENDENCIES) {
    assert.equal(
      devDependencies[dependency],
      undefined,
      `PR-CLEAN7C must keep removed ESLint dependency absent: ${dependency}`,
    );
  }

  assert.ok(
    implementationNote.includes("PR-CLEAN7A"),
    "CLEAN7A implementation note must mention PR-CLEAN7A",
  );

  for (const dependency of CLEAN7A_REMOVED_DEPENDENCIES) {
    assert.ok(
      implementationNote.includes(dependency),
      `PR-CLEAN7A implementation note must mention ${dependency}`,
    );
  }
}

export function assertClean7aDependencyCleanupScopeInput(
  input: Clean7aDependencyCleanupScopeInput,
): void {
  const changedManifestFiles = [...new Set(input.changedManifestFiles)].sort();

  const forbiddenManifestFiles = changedManifestFiles.filter(
    (file) => !CLEAN7A_DEPENDENCY_FILES.has(file),
  );

  assert.deepEqual(
    forbiddenManifestFiles,
    [],
    `CLEAN7A scope forbids manifest changes outside frontend/package.json and pnpm-lock.yaml: ${forbiddenManifestFiles.join(", ")}`,
  );

  const frontendPackageChanged = changedManifestFiles.includes(
    "frontend/package.json",
  );
  const rootLockfileChanged = changedManifestFiles.includes("pnpm-lock.yaml");
  const dependenciesChanged = dependencySectionsChanged(
    input.baseFrontendPackage,
    input.currentFrontendPackage,
  );

  if (dependenciesChanged) {
    assert.ok(
      frontendPackageChanged,
      "A dependencies/devDependencies change must include frontend/package.json",
    );
    assert.ok(
      rootLockfileChanged,
      "A dependencies/devDependencies change must include pnpm-lock.yaml",
    );
  } else {
    assert.equal(
      rootLockfileChanged,
      false,
      "pnpm-lock.yaml must not change when dependencies/devDependencies are unchanged",
    );
  }

  assertCurrentDependencyInvariants(
    input.currentFrontendPackage,
    input.implementationNote,
  );
}

export function isClean7aAllowedDependencyFile(file: string): boolean {
  return CLEAN7A_DEPENDENCY_FILES.has(file);
}

export function assertClean7aDependencyCleanupScope(): void {
  assertClean7aDependencyCleanupScopeInput({
    changedManifestFiles: gitDiffNameOnly(CLEAN7A_MANIFEST_FILES),
    baseFrontendPackage: readBaseFrontendPackage(),
    currentFrontendPackage: readCurrentPackageJson("frontend/package.json"),
    implementationNote: readText(
      "docs/implementation/frontend-unused-deps-clean7a.md",
    ),
  });
}

export function assertClean7aDependencyCleanupInvariants(): void {
  assertCurrentDependencyInvariants(
    readCurrentPackageJson("frontend/package.json"),
    readText("docs/implementation/frontend-unused-deps-clean7a.md"),
  );
}

export function isClean7aAllowedDependencyChange(file: string): boolean {
  if (!isClean7aAllowedDependencyFile(file)) {
    return false;
  }

  assertClean7aDependencyCleanupScope();
  return true;
}
