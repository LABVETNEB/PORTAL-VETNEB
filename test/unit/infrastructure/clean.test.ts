import assert from "node:assert/strict";
import test from "node:test";

import {
  assertClean7aDependencyCleanupScopeInput,
  type Clean7aDependencyCleanupScopeInput,
  type Clean7aPackageJson,
} from "../../helpers/clean7a-dependency-cleanup-scope.ts";

const activeRadixDependencies = {
  "@radix-ui/react-dialog": "1.0.0",
  "@radix-ui/react-separator": "1.0.0",
  "@radix-ui/react-slot": "1.0.0",
  "@radix-ui/react-toast": "1.0.0",
  "@radix-ui/react-tooltip": "1.0.0",
} as const;

const implementationNote = [
  "PR-CLEAN7A",
  "@tanstack/react-query",
  "@tanstack/react-table",
  "echarts",
  "echarts-for-react",
  "react-hook-form",
].join("\n");

function packageFixture(
  overrides: Partial<Clean7aPackageJson> = {},
): Clean7aPackageJson {
  return {
    scripts: {
      build: "next build",
    },
    dependencies: {
      ...activeRadixDependencies,
      next: "16.2.7",
      react: "19.2.7",
    },
    devDependencies: {
      typescript: "5.9.3",
    },
    ...overrides,
  };
}

function scopeInput(
  overrides: Partial<Clean7aDependencyCleanupScopeInput> = {},
): Clean7aDependencyCleanupScopeInput {
  const baseFrontendPackage = packageFixture();

  return {
    changedManifestFiles: [],
    baseFrontendPackage,
    currentFrontendPackage: packageFixture(),
    implementationNote,
    ...overrides,
  };
}

function assertScopePasses(
  input: Clean7aDependencyCleanupScopeInput,
): void {
  assert.doesNotThrow(() => {
    assertClean7aDependencyCleanupScopeInput(input);
  });
}

function assertScopeFails(
  input: Clean7aDependencyCleanupScopeInput,
  expectedMessage: RegExp,
): void {
  assert.throws(
    () => {
      assertClean7aDependencyCleanupScopeInput(input);
    },
    expectedMessage,
  );
}

test("allows a scripts-only frontend package change without pnpm-lock.yaml", () => {
  assertScopePasses(
    scopeInput({
      changedManifestFiles: ["frontend/package.json"],
      currentFrontendPackage: packageFixture({
        scripts: {
          build: "next build",
          "e2e:extended": "playwright test e2e/example.spec.ts",
        },
      }),
    }),
  );
});

test("allows a dependencies change when frontend package and root lockfile both change", () => {
  assertScopePasses(
    scopeInput({
      changedManifestFiles: [
        "frontend/package.json",
        "pnpm-lock.yaml",
      ],
      currentFrontendPackage: packageFixture({
        dependencies: {
          ...activeRadixDependencies,
          next: "16.2.8",
          react: "19.2.7",
        },
      }),
    }),
  );
});

test("allows a devDependencies change when frontend package and root lockfile both change", () => {
  assertScopePasses(
    scopeInput({
      changedManifestFiles: [
        "frontend/package.json",
        "pnpm-lock.yaml",
      ],
      currentFrontendPackage: packageFixture({
        devDependencies: {
          typescript: "5.9.4",
        },
      }),
    }),
  );
});

test("rejects a dependencies change without pnpm-lock.yaml", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: ["frontend/package.json"],
      currentFrontendPackage: packageFixture({
        dependencies: {
          ...activeRadixDependencies,
          next: "16.2.8",
          react: "19.2.7",
        },
      }),
    }),
    /dependencies\/devDependencies change must include pnpm-lock\.yaml/,
  );
});

test("rejects a devDependencies change without pnpm-lock.yaml", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: ["frontend/package.json"],
      currentFrontendPackage: packageFixture({
        devDependencies: {
          typescript: "5.9.4",
        },
      }),
    }),
    /dependencies\/devDependencies change must include pnpm-lock\.yaml/,
  );
});

test("rejects pnpm-lock.yaml without a dependency change", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: ["pnpm-lock.yaml"],
    }),
    /pnpm-lock\.yaml must not change/,
  );
});

test("rejects scripts-only frontend package plus pnpm-lock.yaml", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: [
        "frontend/package.json",
        "pnpm-lock.yaml",
      ],
      currentFrontendPackage: packageFixture({
        scripts: {
          build: "next build",
          test: "playwright test",
        },
      }),
    }),
    /pnpm-lock\.yaml must not change/,
  );
});

test("rejects a root package.json change", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: ["package.json"],
    }),
    /forbids manifest changes outside/,
  );
});

test("rejects a frontend-local lockfile change", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: ["frontend/pnpm-lock.yaml"],
    }),
    /forbids manifest changes outside/,
  );
});

test("ignores dependency property order when values are unchanged", () => {
  const baseFrontendPackage = packageFixture({
    dependencies: {
      next: "16.2.7",
      react: "19.2.7",
      ...activeRadixDependencies,
    },
  });

  const currentFrontendPackage = packageFixture({
    dependencies: {
      ...activeRadixDependencies,
      react: "19.2.7",
      next: "16.2.7",
    },
  });

  assertScopePasses(
    scopeInput({
      changedManifestFiles: ["frontend/package.json"],
      baseFrontendPackage,
      currentFrontendPackage,
    }),
  );
});

test("detects a dependency version change as a real dependency mutation", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: ["frontend/package.json"],
      baseFrontendPackage: packageFixture({
        dependencies: {
          ...activeRadixDependencies,
          next: "16.2.7",
          react: "19.2.7",
        },
      }),
      currentFrontendPackage: packageFixture({
        dependencies: {
          ...activeRadixDependencies,
          next: "16.2.8",
          react: "19.2.7",
        },
      }),
    }),
    /dependencies\/devDependencies change must include pnpm-lock\.yaml/,
  );
});

test("preserves CLEAN removed-dependency invariants", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: [
        "frontend/package.json",
        "pnpm-lock.yaml",
      ],
      currentFrontendPackage: packageFixture({
        dependencies: {
          ...activeRadixDependencies,
          next: "16.2.7",
          react: "19.2.7",
          "@tanstack/react-query": "5.0.0",
        },
      }),
    }),
    /must keep removed dependency absent/,
  );
});

test("preserves CLEAN active Radix dependency invariants", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: [
        "frontend/package.json",
        "pnpm-lock.yaml",
      ],
      currentFrontendPackage: packageFixture({
        dependencies: {
          "@radix-ui/react-separator": "1.0.0",
          "@radix-ui/react-slot": "1.0.0",
          "@radix-ui/react-toast": "1.0.0",
          "@radix-ui/react-tooltip": "1.0.0",
          next: "16.2.7",
          react: "19.2.7",
        },
      }),
    }),
    /must preserve active or deferred Radix dependency/,
  );
});

test("preserves CLEAN removed devDependency invariants", () => {
  assertScopeFails(
    scopeInput({
      changedManifestFiles: [
        "frontend/package.json",
        "pnpm-lock.yaml",
      ],
      currentFrontendPackage: packageFixture({
        devDependencies: {
          typescript: "5.9.3",
          "@eslint/eslintrc": "3.0.0",
        },
      }),
    }),
    /must keep removed ESLint dependency absent/,
  );
});
