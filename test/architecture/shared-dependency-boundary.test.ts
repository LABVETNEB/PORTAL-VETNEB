import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { listTrackedSourceFiles } from "../helpers/tracked-source-files.ts";

// WBR-16 (VET-17) -- `shared/**` dependency boundary.
//
// Root uses `zod ^3.25.76`, frontend uses `zod ^4`. Today neither version
// reaches `shared/**`: `shared/session-cookie-names.ts` is deliberately
// dependency-free (see its own header comment) because it is imported by
// both the backend bundle (esbuild) and the Next proxy, which are separately
// built/deployed. If a future module under `shared/**` ever imported `zod`
// (or any other runtime dependency), the two consumers would silently
// resolve it against whichever installation each bundler picks, coupling one
// shared module to two divergent majors. The roadmap decision (WBR-16,
// field 7) is to NOT unify zod versions for this -- the cost of a major-version
// migration in two packages outweighs a benefit that is currently zero -- and
// instead to protect the boundary itself: `shared/**` stays free of every
// runtime dependency, whatever that dependency happens to be. Zod is the
// motivating case, not the only one the guard has to catch.
//
// The census is git-tracked and directory-driven (`listTrackedSourceFiles`,
// already used by other repo-wide architecture guards), never a hardcoded
// file list, so a new file dropped into `shared/**` tomorrow is covered
// automatically without touching this test.
//
// The boundary is stricter than "no zod": nothing under `shared/**` may
// import a bare package specifier (any external npm dependency), a Node
// builtin (`node:*` -- this module must also stay portable to a browser
// bundle, per its own header comment), or reach outside the `shared/`
// directory into `server/**` or `frontend/**` via a relative path. Only
// relative imports that resolve back inside `shared/**` are allowed. `import
// type` is included: a type-only edge still couples the module to whichever
// package's types get resolved, and the roadmap's DONE criterion is about
// `shared/**` "adquiriendo dependencias" architecturally, not only at
// runtime.

const SHARED_ROOT = "shared";
const REPO_ROOT = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// Same extraction technique as
// test/architecture/dashboard-presentation-import-boundaries.test.ts: static
// patterns anchored to real import/export/require/dynamic-import syntax, not
// a raw substring scan (which would also flag specifiers mentioned only in a
// comment, as this very file's header does).
function extractModuleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  for (const match of source.matchAll(
    /^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm,
  )) {
    specifiers.push(match[1]!);
  }

  for (const match of source.matchAll(/^[ \t]*import\s*["']([^"']+)["']/gm)) {
    specifiers.push(match[1]!);
  }

  for (const match of source.matchAll(
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  )) {
    specifiers.push(match[1]!);
  }

  return specifiers;
}

type SpecifierVerdict =
  | { kind: "internal" }
  | { kind: "forbidden-builtin" }
  | { kind: "forbidden-external" }
  | { kind: "forbidden-escape"; resolved: string };

// The only admissible specifier shape: relative, and resolving to a path
// that stays inside `shared/`. Everything else -- a bare package name, a
// Node builtin, or a relative path that climbs out of `shared/` into
// `server/**`/`frontend/**`/repo root -- is forbidden.
function classifySpecifier(
  specifier: string,
  fromRelativeFile: string,
): SpecifierVerdict {
  if (specifier.startsWith("node:")) {
    return { kind: "forbidden-builtin" };
  }

  if (!specifier.startsWith(".")) {
    return { kind: "forbidden-external" };
  }

  const resolved = relative(
    REPO_ROOT,
    resolve(resolve(REPO_ROOT, fromRelativeFile, ".."), specifier),
  ).replace(/\\/g, "/");

  if (resolved === SHARED_ROOT || resolved.startsWith(`${SHARED_ROOT}/`)) {
    return { kind: "internal" };
  }

  return { kind: "forbidden-escape", resolved };
}

function assertFileIsDependencyFree(relativePath: string): void {
  const source = readSource(relativePath);

  for (const specifier of extractModuleSpecifiers(source)) {
    const verdict = classifySpecifier(specifier, relativePath);

    assert.equal(
      verdict.kind,
      "internal",
      verdict.kind === "forbidden-builtin"
        ? `${relativePath} imports the Node builtin "${specifier}": shared/** must stay portable to a browser bundle and dependency-free (WBR-16, VET-17)`
        : verdict.kind === "forbidden-external"
          ? `${relativePath} imports "${specifier}": shared/** must not acquire any runtime dependency (WBR-16, VET-17); the zod version divergence between root (^3.25.76) and frontend (^4) is exactly the risk this guard exists to prevent`
          : verdict.kind === "forbidden-escape"
            ? `${relativePath} imports "${specifier}", which resolves to "${(verdict as { resolved: string }).resolved}": shared/** must not reach into server/** or frontend/** (or any path outside shared/)`
            : "",
    );
  }
}

// -- 1 - Census: dynamic, git-tracked, never hardcoded -----------------------

test("shared/** dependency-boundary guard discovers files dynamically via the tracked-source census", () => {
  const files = listTrackedSourceFiles(SHARED_ROOT);

  assert.ok(
    files.length > 0,
    "shared/** must contain at least one tracked source file; an empty census would pass vacuously",
  );

  for (const file of files) {
    assert.ok(
      file.startsWith(`${SHARED_ROOT}/`),
      `census file ${file} must live under ${SHARED_ROOT}/`,
    );
  }
});

// -- 2 - Every tracked file under shared/** is dependency-free ---------------

test("every file under shared/** stays free of external packages, Node builtins, and backend/frontend escapes", () => {
  const files = listTrackedSourceFiles(SHARED_ROOT);

  for (const file of files) {
    assertFileIsDependencyFree(file);
  }
});

test("shared/** currently has zero external runtime dependencies (SHARED_EXTERNAL_DEPENDENCY_COUNT = 0)", () => {
  const files = listTrackedSourceFiles(SHARED_ROOT);
  let externalDependencyCount = 0;

  for (const file of files) {
    for (const specifier of extractModuleSpecifiers(readSource(file))) {
      const verdict = classifySpecifier(specifier, file);
      if (verdict.kind !== "internal") {
        externalDependencyCount += 1;
      }
    }
  }

  assert.equal(externalDependencyCount, 0);
});

// -- 3 - Negative proof: the classifier detects every forbidden shape --------
// Proven in memory, against synthetic specifiers -- no file on disk is
// mutated, per the roadmap's explicit prohibition on touching shared/**
// runtime content for this block.

test("negative proof: an import of zod is detected as a forbidden external dependency", () => {
  const verdict = classifySpecifier("zod", `${SHARED_ROOT}/session-cookie-names.ts`);
  assert.equal(verdict.kind, "forbidden-external");
});

test("negative proof: an import of an unrelated external package is detected", () => {
  const verdict = classifySpecifier(
    "lodash",
    `${SHARED_ROOT}/session-cookie-names.ts`,
  );
  assert.equal(verdict.kind, "forbidden-external");
});

test("negative proof: a Node builtin import is detected as forbidden", () => {
  const verdict = classifySpecifier(
    "node:crypto",
    `${SHARED_ROOT}/session-cookie-names.ts`,
  );
  assert.equal(verdict.kind, "forbidden-builtin");
});

test("negative proof: a relative import escaping into server/** is detected", () => {
  const verdict = classifySpecifier(
    "../server/lib/env.ts",
    `${SHARED_ROOT}/session-cookie-names.ts`,
  );
  assert.equal(verdict.kind, "forbidden-escape");
});

test("negative proof: a relative import escaping into frontend/** is detected", () => {
  const verdict = classifySpecifier(
    "../frontend/src/proxy.ts",
    `${SHARED_ROOT}/session-cookie-names.ts`,
  );
  assert.equal(verdict.kind, "forbidden-escape");
});

test("negative proof: a type-only external import is detected (type-only is not exempt)", () => {
  const source = 'import type { ZodSchema } from "zod";\n';
  const specifiers = extractModuleSpecifiers(source);

  assert.deepEqual(specifiers, ["zod"]);
  assert.equal(
    classifySpecifier(specifiers[0]!, `${SHARED_ROOT}/session-cookie-names.ts`)
      .kind,
    "forbidden-external",
  );
});

test("negative proof: a relative import that stays inside shared/** is admitted", () => {
  const verdict = classifySpecifier(
    "./another-shared-module.ts",
    `${SHARED_ROOT}/session-cookie-names.ts`,
  );
  assert.equal(verdict.kind, "internal");
});

test("negative proof: dependency-free content produces zero flagged specifiers", () => {
  const source = readSource(`${SHARED_ROOT}/session-cookie-names.ts`);
  const specifiers = extractModuleSpecifiers(source);

  assert.equal(specifiers.length, 0);
});

// -- 4 - The decision to defer zod unification is registered -----------------
//
// This used to also assert against the roadmap document's own prose, but
// docs/implementation/global-white-box-audit-remediation-roadmap.md is
// intentionally never committed (its own metadata declares "sin commit"
// pending approval), so that file does not exist on a clean CI checkout and
// the assertion failed with ENOENT on every run. The durable, committed
// record of the dependency-free contract this guard enforces is the header
// below, not the roadmap.

test("shared/session-cookie-names.ts documents the dependency-free contract that motivates this guard", () => {
  const source = readSource(`${SHARED_ROOT}/session-cookie-names.ts`);

  assert.match(
    source,
    /must stay dependency-free/,
    "shared/session-cookie-names.ts must document the dependency-free contract this guard enforces",
  );
});

test("shared-dependency-boundary guard source stays ascii only", () => {
  const source = readFileSync(
    resolve(REPO_ROOT, "test/architecture/shared-dependency-boundary.test.ts"),
    "utf8",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `shared-dependency-boundary source must stay ascii-only at index ${index}`,
    );
  }
});
