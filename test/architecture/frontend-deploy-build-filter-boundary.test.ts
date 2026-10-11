import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { posix } from "node:path";
import { listTrackedFiles, readSourceFile } from "../helpers/tracked-source-files.ts";

// C1 -- deploy boundary of the production frontend.
//
// The Render service that serves the public site auto-deploys only when a
// commit on main changes a path matched by its Build Filters (Included Paths
// below, Ignored Paths empty). The service builds from the repository root
// with `pnpm install --frozen-lockfile && pnpm -C frontend build`, so
// everything that build consumes has to live under one of those patterns. A
// build input outside them is a false negative: the change merges, CI is
// green and production silently keeps the previous artifact.
//
// The filters live in the Render dashboard, not in the repository. This file
// is the versioned copy of that contract: changing a pattern here and
// changing it in Render are one operation, done together.
//
// Every check runs over a repository snapshot (tracked paths + a text
// lookup), never over a hardcoded file list, so new files are covered
// without touching this guard. The same checks run over in-memory overlays
// of that snapshot at the bottom of the file to prove that each violation is
// detected and that unrelated changes are not; no file on disk is mutated.

const RENDER_INCLUDED_PATHS = [
  "frontend/**",
  "shared/**",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
  ".pnpmrc",
] as const;

const RENDER_IGNORED_PATHS: readonly string[] = [];

// Paths that deploy on Render but that the heavy frontend job of
// frontend-ci.yml does not react to. Pre-existing CI gap, out of scope for a
// test-only change: closing it belongs to a ci-only PR that adds both paths
// to the detector and empties this ledger in the same change. The ledger is
// exact, so the gap can neither grow nor be closed without this guard
// noticing.
const KNOWN_CI_DETECTOR_GAP: readonly string[] = [".npmrc", ".pnpmrc"];

const FRONTEND_ROOT = "frontend";
const FRONTEND_MANIFEST = "frontend/package.json";
const FRONTEND_TSCONFIG = "frontend/tsconfig.json";
const FRONTEND_NEXT_CONFIG = "frontend/next.config.ts";
const ROOT_MANIFEST = "package.json";
const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const FRONTEND_CI_WORKFLOW = ".github/workflows/frontend-ci.yml";

// Typechecked by `next build` through the tsconfig include, never bundled.
const TYPECHECK_ONLY_PREFIX = "frontend/e2e/";

const SCRIPT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const STYLE_FILE = /\.css$/;

// Root files that change the build environment or the install without being
// imported by anything: runtime version pins, package-manager hooks and
// alternative lockfiles, patch directories, platform blueprints and the
// browserslist lookup that PostCSS resolves upwards from frontend/.
const BUILD_ENVIRONMENT_INPUTS: readonly RegExp[] = [
  /^\.nvmrc$/,
  /^\.node-version$/,
  /^\.tool-versions$/,
  /^\.bun-version$/,
  /^\.?pnpmfile\.[cm]js$/,
  /^patches\//,
  /^render\.ya?ml$/,
  /^\.browserslistrc$/,
  /^\.yarnrc(?:\.yml)?$/,
  /^(?:yarn\.lock|package-lock\.json|npm-shrinkwrap\.json|bun\.lockb?)$/,
];

const INSTALL_LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"] as const;
const BUILD_LIFECYCLE_SCRIPTS = ["prebuild", "build", "postbuild"] as const;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const require = createRequire(import.meta.url);
const { load: loadYaml } = require("js-yaml") as {
  load: (document: string) => unknown;
};

type RepositorySnapshot = {
  readonly paths: readonly string[];
  readonly textOf: (path: string) => string;
};

type FrontendEdge = {
  readonly from: string;
  readonly specifier: string;
  readonly resolved: string;
};

type JsonObject = Record<string, unknown>;

function captureRepository(): RepositorySnapshot {
  return { paths: listTrackedFiles(), textOf: readSourceFile };
}

function overlay(
  base: RepositorySnapshot,
  changes: Readonly<Record<string, string>>,
): RepositorySnapshot {
  const paths = [...new Set([...base.paths, ...Object.keys(changes)])].sort();

  return {
    paths,
    textOf: (path) => changes[path] ?? base.textOf(path),
  };
}

// Render documents `?` and `*` as never crossing `/` and `**` as spanning
// zero or more directories (render.com/docs/monorepo-support). This is an
// approximation of those documented semantics, not Render's matcher.
function patternToRegExp(pattern: string): RegExp {
  let body = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;

    if (char === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        body += "(?:[^/]+/)*";
        index += 2;
      } else {
        body += ".*";
        index += 1;
      }
    } else if (char === "*") {
      body += "[^/]*";
    } else if (char === "?") {
      body += "[^/]";
    } else {
      body += /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
    }
  }

  return new RegExp(`^${body}$`);
}

const INCLUDED_MATCHERS = RENDER_INCLUDED_PATHS.map(patternToRegExp);
const IGNORED_MATCHERS = RENDER_IGNORED_PATHS.map(patternToRegExp);

function triggersDeploy(path: string): boolean {
  return (
    !IGNORED_MATCHERS.some((matcher) => matcher.test(path)) &&
    INCLUDED_MATCHERS.some((matcher) => matcher.test(path))
  );
}

// A target is covered when a change to it deploys: either the path itself
// matches, or it is a directory whose whole content does.
function isCovered(target: string): boolean {
  if (target === "." || target === "" || target.startsWith("..")) {
    return false;
  }

  return triggersDeploy(target) || triggersDeploy(`${target}/_`);
}

function resolveFrom(directory: string, reference: string): string {
  const resolved = posix.normalize(posix.join(directory, reference));

  return resolved.length > 1 && resolved.endsWith("/") ? resolved.slice(0, -1) : resolved;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

// Same extraction technique as shared-dependency-boundary.test.ts: patterns
// anchored to real import/export/require syntax, not a substring scan.
function extractModuleSpecifiers(code: string): string[] {
  const specifiers: string[] = [];

  for (const match of code.matchAll(
    /^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm,
  )) {
    specifiers.push(match[1]!);
  }

  for (const match of code.matchAll(/^[ \t]*import\s*["']([^"']+)["']/gm)) {
    specifiers.push(match[1]!);
  }

  for (const match of code.matchAll(
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  )) {
    specifiers.push(match[1]!);
  }

  return specifiers;
}

// Bundled sources can reach a file without importing it (a filesystem call,
// `new URL(..., import.meta.url)`, a config option), so every relative path
// literal counts there, whatever the call around it.
function extractRelativeLiterals(code: string): string[] {
  return [...code.matchAll(/(["'`])(\.{1,2}\/[^"'`\s]*)\1/g)].map((match) => match[2]!);
}

function extractStyleReferences(code: string): string[] {
  return [
    ...code.matchAll(
      /(?:@(?:import|config|source|plugin|reference)\s+|url\(\s*)["']?([^"')\s;]+)/g,
    ),
  ]
    .map((match) => match[1]!)
    .filter((reference) => reference.startsWith(".") || reference.includes("/../"));
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function collectFrontendEdges(snapshot: RepositorySnapshot): FrontendEdge[] {
  const edges: FrontendEdge[] = [];

  for (const file of snapshot.paths) {
    if (!file.startsWith(`${FRONTEND_ROOT}/`)) {
      continue;
    }

    let references: string[];

    if (STYLE_FILE.test(file)) {
      references = extractStyleReferences(snapshot.textOf(file));
    } else if (SCRIPT_FILE.test(file)) {
      const code = snapshot.textOf(file);
      references = file.startsWith(TYPECHECK_ONLY_PREFIX)
        ? extractModuleSpecifiers(code).filter(isRelative)
        : [...extractModuleSpecifiers(code).filter(isRelative), ...extractRelativeLiterals(code)];
    } else {
      continue;
    }

    for (const specifier of new Set(references)) {
      edges.push({
        from: file,
        specifier,
        resolved: resolveFrom(posix.dirname(file), specifier),
      });
    }
  }

  return edges;
}

// G1 -- relative imports and path literals of the frontend.
function findUncoveredFrontendEdges(snapshot: RepositorySnapshot): string[] {
  return collectFrontendEdges(snapshot)
    .filter((edge) => !isCovered(edge.resolved))
    .map(
      (edge) =>
        `G1 ${edge.from} references "${edge.specifier}", which resolves to "${edge.resolved}" outside the Render Included Paths`,
    );
}

// G2 -- build-environment and install inputs.
function findUncoveredEnvironmentInputs(snapshot: RepositorySnapshot): string[] {
  return snapshot.paths
    .filter(
      (path) =>
        BUILD_ENVIRONMENT_INPUTS.some((input) => input.test(path)) && !triggersDeploy(path),
    )
    .map(
      (path) =>
        `G2 ${path} changes the build environment or the install but is outside the Render Included Paths`,
    );
}

function parseManifest(snapshot: RepositorySnapshot, path: string): JsonObject {
  return asObject(JSON.parse(snapshot.textOf(path)));
}

function parseWorkspace(snapshot: RepositorySnapshot): JsonObject {
  return asObject(loadYaml(snapshot.textOf(WORKSPACE_MANIFEST)));
}

// G3 -- workspace shape, local dependency protocols and patches.
function findWorkspaceDrift(snapshot: RepositorySnapshot): string[] {
  const violations: string[] = [];
  const workspace = parseWorkspace(snapshot);
  const packages = asStrings(workspace.packages);

  if (packages.length !== 1 || packages[0] !== FRONTEND_ROOT) {
    violations.push(
      `G3 ${WORKSPACE_MANIFEST} must declare exactly the "${FRONTEND_ROOT}" package, found ${JSON.stringify(packages)}`,
    );
  }

  const rootManifest = parseManifest(snapshot, ROOT_MANIFEST);
  const frontendManifest = parseManifest(snapshot, FRONTEND_MANIFEST);
  const rootPnpm = asObject(rootManifest.pnpm);
  const versionMaps: Array<[string, string, JsonObject]> = [
    [WORKSPACE_MANIFEST, ".", asObject(workspace.overrides)],
    [ROOT_MANIFEST, ".", asObject(rootPnpm.overrides)],
  ];

  for (const field of DEPENDENCY_FIELDS) {
    versionMaps.push([ROOT_MANIFEST, ".", asObject(rootManifest[field])]);
    versionMaps.push([FRONTEND_MANIFEST, FRONTEND_ROOT, asObject(frontendManifest[field])]);
  }

  for (const [owner, directory, versions] of versionMaps) {
    for (const [name, version] of Object.entries(versions)) {
      const local = typeof version === "string" ? /^(?:link|file|portal):(.+)$/.exec(version) : null;

      if (local && !isCovered(resolveFrom(directory, local[1]!))) {
        violations.push(
          `G3 ${owner} resolves "${name}" from "${version}", a local path outside the Render Included Paths`,
        );
      }
    }
  }

  const patchSources: Array<[string, JsonObject]> = [
    [WORKSPACE_MANIFEST, asObject(workspace.patchedDependencies)],
    [ROOT_MANIFEST, asObject(rootPnpm.patchedDependencies)],
    [WORKSPACE_MANIFEST, { pnpmfile: workspace.pnpmfile, patchesDir: workspace.patchesDir }],
  ];

  for (const [owner, entries] of patchSources) {
    for (const [name, location] of Object.entries(entries)) {
      if (typeof location === "string" && !isCovered(resolveFrom(".", location))) {
        violations.push(
          `G3 ${owner} points "${name}" at "${location}", outside the Render Included Paths`,
        );
      }
    }
  }

  return violations;
}

// G4 -- scripts that run during `pnpm install` and `pnpm -C frontend build`.
function findUncoveredScriptInputs(snapshot: RepositorySnapshot): string[] {
  const violations: string[] = [];
  const tracked = new Set(snapshot.paths);
  const frontendScripts = asObject(parseManifest(snapshot, FRONTEND_MANIFEST).scripts);

  if (typeof frontendScripts.build !== "string") {
    violations.push(`G4 ${FRONTEND_MANIFEST} must define the "build" script the Render Build Command runs`);
  }

  const lifecycles: Array<[string, string, readonly string[]]> = [
    [ROOT_MANIFEST, ".", INSTALL_LIFECYCLE_SCRIPTS],
    [FRONTEND_MANIFEST, FRONTEND_ROOT, [...INSTALL_LIFECYCLE_SCRIPTS, ...BUILD_LIFECYCLE_SCRIPTS]],
  ];

  for (const [manifest, directory, names] of lifecycles) {
    const scripts = asObject(parseManifest(snapshot, manifest).scripts);

    for (const name of names) {
      const command = scripts[name];

      if (typeof command !== "string") {
        continue;
      }

      for (const token of command.split(/[\s"'=;&|()<>]+/)) {
        if (token === "" || token.startsWith("-") || token.startsWith("@")) {
          continue;
        }

        const resolved = resolveFrom(directory, token);
        const pathLike = token.includes("/") || tracked.has(resolved);

        if (pathLike && !isCovered(resolved)) {
          violations.push(
            `G4 ${manifest} script "${name}" uses "${token}", which resolves to "${resolved}" outside the Render Included Paths`,
          );
        }
      }
    }
  }

  return violations;
}

// G5 -- roots and inheritance of the Next.js project configuration. The
// imports and path literals of next.config.ts itself are covered by G1.
function findUncoveredProjectRoots(snapshot: RepositorySnapshot): string[] {
  const violations: string[] = [];

  if (!snapshot.paths.includes(FRONTEND_NEXT_CONFIG)) {
    violations.push(`G5 ${FRONTEND_NEXT_CONFIG} is missing: the Next.js config location is part of this contract`);
  }

  const tsconfig = parseManifest(snapshot, FRONTEND_TSCONFIG);
  const options = asObject(tsconfig.compilerOptions);
  const entries: Array<[string, string]> = [];

  for (const inherited of asStrings(tsconfig.extends)) {
    if (inherited.startsWith(".")) {
      entries.push(["extends", inherited]);
    }
  }

  for (const key of ["baseUrl", "rootDir", "rootDirs", "typeRoots"] as const) {
    for (const value of asStrings(options[key])) {
      entries.push([`compilerOptions.${key}`, value]);
    }
  }

  for (const targets of Object.values(asObject(options.paths))) {
    for (const value of asStrings(targets)) {
      entries.push(["compilerOptions.paths", value]);
    }
  }

  for (const key of ["include", "files"] as const) {
    for (const value of asStrings(tsconfig[key])) {
      entries.push([key, value]);
    }
  }

  for (const reference of Array.isArray(tsconfig.references) ? tsconfig.references : []) {
    for (const value of asStrings(asObject(reference).path)) {
      entries.push(["references", value]);
    }
  }

  for (const [key, value] of entries) {
    const resolved = resolveFrom(FRONTEND_ROOT, value.split("*")[0]!);

    if (!isCovered(resolved)) {
      violations.push(
        `G5 ${FRONTEND_TSCONFIG} ${key} "${value}" resolves to "${resolved}" outside the Render Included Paths`,
      );
    }
  }

  return violations;
}

function detectorPaths(snapshot: RepositorySnapshot): string[] | null {
  const alternation = /^[ \t]*((?:[^\s|()]+\|)+[^\s|()]+)\)[ \t]*$/m.exec(
    snapshot.textOf(FRONTEND_CI_WORKFLOW),
  );

  if (!alternation) {
    return null;
  }

  // A shell `case` star crosses `/`, so `dir/*` there is `dir/**` in Render.
  return alternation[1]!
    .split("|")
    .map((path) => (path.endsWith("/*") ? `${path.slice(0, -1)}**` : path));
}

function ciDetectorGap(snapshot: RepositorySnapshot): string[] {
  const detected = detectorPaths(snapshot) ?? [];

  return RENDER_INCLUDED_PATHS.filter((path) => !detected.includes(path));
}

// G6 -- the CI impact detector and the Render contract describe one graph.
function findCiDetectorDrift(snapshot: RepositorySnapshot): string[] {
  const detected = detectorPaths(snapshot);

  if (!detected) {
    return [`G6 ${FRONTEND_CI_WORKFLOW} no longer exposes the frontend impact detector this guard compares against`];
  }

  const violations = detected
    .filter(
      (path) =>
        !path.startsWith(".github/") &&
        !(RENDER_INCLUDED_PATHS as readonly string[]).includes(path),
    )
    .map(
      (path) =>
        `G6 ${FRONTEND_CI_WORKFLOW} treats "${path}" as frontend impact but the Render Included Paths would not deploy it`,
    );
  const gap = ciDetectorGap(snapshot);

  if (JSON.stringify(gap) !== JSON.stringify(KNOWN_CI_DETECTOR_GAP)) {
    violations.push(
      `G6 paths that deploy on Render without frontend CI impact are ${JSON.stringify(gap)}, expected the known gap ${JSON.stringify(KNOWN_CI_DETECTOR_GAP)}`,
    );
  }

  return violations;
}

function auditSnapshot(snapshot: RepositorySnapshot): string[] {
  return [
    ...findUncoveredFrontendEdges(snapshot),
    ...findUncoveredEnvironmentInputs(snapshot),
    ...findWorkspaceDrift(snapshot),
    ...findUncoveredScriptInputs(snapshot),
    ...findUncoveredProjectRoots(snapshot),
    ...findCiDetectorDrift(snapshot),
  ];
}

function withJsonEdit(
  snapshot: RepositorySnapshot,
  path: string,
  edit: (document: JsonObject) => void,
): RepositorySnapshot {
  const document = parseManifest(snapshot, path);

  edit(document);

  return overlay(snapshot, { [path]: `${JSON.stringify(document, null, 2)}\n` });
}

function assertSingleViolation(violations: string[], expected: RegExp): void {
  assert.equal(
    violations.length,
    1,
    `expected exactly one violation, got ${JSON.stringify(violations)}`,
  );
  assert.match(violations[0]!, expected);
}

const repository = captureRepository();

// -- 1 - The contract itself --------------------------------------------------

test("Render build filter contract is the seven Included Paths with no Ignored Paths", () => {
  assert.deepEqual(
    [...RENDER_INCLUDED_PATHS],
    [
      "frontend/**",
      "shared/**",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".npmrc",
      ".pnpmrc",
    ],
  );
  assert.deepEqual(RENDER_IGNORED_PATHS, []);
});

test("every Included Path still matches at least one tracked file", () => {
  for (const [index, pattern] of RENDER_INCLUDED_PATHS.entries()) {
    assert.ok(
      repository.paths.some((path) => INCLUDED_MATCHERS[index]!.test(path)),
      `Included Path "${pattern}" matches no tracked file: the contract and the repository structure have drifted`,
    );
  }
});

test("the documented glob semantics separate covered from independent paths", () => {
  for (const path of [
    "frontend/src/app/layout.tsx",
    "frontend/public/theme-init.js",
    "frontend/next.config.ts",
    "shared/session-cookie-names.ts",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".npmrc",
    ".pnpmrc",
  ]) {
    assert.equal(triggersDeploy(path), true, `${path} must trigger a frontend deploy`);
  }

  for (const path of [
    "docs/audit/navigation.md",
    "server/index.ts",
    "test/architecture/toolchain-contract.test.ts",
    "drizzle/0001_initial.sql",
    ".github/workflows/frontend-ci.yml",
    "AGENTS.md",
    "tsconfig.json",
    "frontend-notes/package.json",
    "docs/package.json",
  ]) {
    assert.equal(triggersDeploy(path), false, `${path} must not trigger a frontend deploy`);
  }
});

// -- 2 - The repository honours the contract ----------------------------------

test("the frontend dependency scan is not vacuous", () => {
  const edges = collectFrontendEdges(repository);

  assert.ok(edges.length > 0, "no relative reference was found under frontend/");
  assert.ok(
    edges.some((edge) => !edge.resolved.startsWith(`${FRONTEND_ROOT}/`)),
    "the scan must observe the frontend edge that leaves frontend/ (shared/**); resolving zero external edges means the resolver is blind",
  );
});

test("G1 every relative import and path literal of the frontend resolves inside the Included Paths", () => {
  assert.deepEqual(findUncoveredFrontendEdges(repository), []);
});

test("G2 no build-environment or install input lives outside the Included Paths", () => {
  assert.deepEqual(findUncoveredEnvironmentInputs(repository), []);
});

test("G3 the workspace declares only the frontend package and no uncovered local dependency or patch", () => {
  assert.deepEqual(findWorkspaceDrift(repository), []);
});

test("G4 install and build lifecycle scripts consume nothing outside the Included Paths", () => {
  assert.deepEqual(findUncoveredScriptInputs(repository), []);
});

test("G5 the Next.js project configuration inherits and roots nothing outside the Included Paths", () => {
  assert.deepEqual(findUncoveredProjectRoots(repository), []);
});

test("G6 the frontend CI impact detector never claims a path Render would not deploy", () => {
  assert.deepEqual(findCiDetectorDrift(repository), []);
});

test("G6 known gap: .npmrc and .pnpmrc deploy on Render without frontend CI impact", (t) => {
  const gap = ciDetectorGap(repository);

  assert.deepEqual(gap, [...KNOWN_CI_DETECTOR_GAP]);
  t.diagnostic(
    `OPEN GAP (ci-only follow-up): ${JSON.stringify(gap)} trigger a Render deploy but not the heavy frontend job of ${FRONTEND_CI_WORKFLOW}`,
  );
});

// -- 3 - Negative proof: each violation is detected, alone --------------------
// In-memory overlays of the real snapshot. The baseline is clean (section 2),
// so the single violation asserted here is the mutation and nothing else.

test("negative proof: the unmutated repository yields zero violations", () => {
  assert.deepEqual(auditSnapshot(repository), []);
});

test("negative proof: a frontend import into server/** is detected", () => {
  const target = "frontend/src/proxy.ts";
  const mutated = overlay(repository, {
    [target]: `${repository.textOf(target)}\nimport { ENV } from "../../server/lib/env";\n`,
  });

  assertSingleViolation(auditSnapshot(mutated), /^G1 frontend\/src\/proxy\.ts .*"server\/lib\/env"/);
});

test("negative proof: a frontend path literal reaching docs/** without an import is detected", () => {
  const target = FRONTEND_NEXT_CONFIG;
  const mutated = overlay(repository, {
    [target]: `${repository.textOf(target)}\nexport const changelog = new URL("../docs/ops/changelog.md", import.meta.url);\n`,
  });

  assertSingleViolation(auditSnapshot(mutated), /^G1 frontend\/next\.config\.ts .*"docs\/ops\/changelog\.md"/);
});

test("negative proof: a stylesheet import leaving frontend/** is detected", () => {
  const mutated = overlay(repository, {
    "frontend/src/styles/external.css": '@import "../../../docs/brand/tokens.css";\n',
  });

  assertSingleViolation(auditSnapshot(mutated), /^G1 frontend\/src\/styles\/external\.css .*"docs\/brand\/tokens\.css"/);
});

test("negative proof: a new .nvmrc at the repository root is detected", () => {
  const mutated = overlay(repository, { ".nvmrc": "24\n" });

  assertSingleViolation(auditSnapshot(mutated), /^G2 \.nvmrc /);
});

test("negative proof: a frontend tsconfig extending the root tsconfig is detected", () => {
  const mutated = withJsonEdit(repository, FRONTEND_TSCONFIG, (tsconfig) => {
    tsconfig.extends = "../tsconfig.json";
  });

  assertSingleViolation(auditSnapshot(mutated), /^G5 frontend\/tsconfig\.json extends "\.\.\/tsconfig\.json"/);
});

test("negative proof: a file: dependency outside the contract is detected", () => {
  const mutated = withJsonEdit(repository, FRONTEND_MANIFEST, (manifest) => {
    manifest.dependencies = {
      ...asObject(manifest.dependencies),
      "vetneb-contracts": "file:../server/contracts",
    };
  });

  assertSingleViolation(auditSnapshot(mutated), /^G3 frontend\/package\.json resolves "vetneb-contracts"/);
});

test("negative proof: a second workspace package is detected", () => {
  const mutated = overlay(repository, {
    [WORKSPACE_MANIFEST]: repository
      .textOf(WORKSPACE_MANIFEST)
      .split('  - "frontend"\n')
      .join('  - "frontend"\n  - "packages/*"\n'),
  });

  assertSingleViolation(auditSnapshot(mutated), /^G3 pnpm-workspace\.yaml must declare exactly/);
});

test("negative proof: a root postinstall script running code outside the contract is detected", () => {
  const mutated = withJsonEdit(repository, ROOT_MANIFEST, (manifest) => {
    manifest.scripts = {
      ...asObject(manifest.scripts),
      postinstall: "node scripts/generate-frontend-contracts.mjs",
    };
  });

  assertSingleViolation(auditSnapshot(mutated), /^G4 package\.json script "postinstall" uses "scripts\/generate-frontend-contracts\.mjs"/);
});

test("negative proof: a CI detector path that Render would not deploy is detected", () => {
  const workflow = repository.textOf(FRONTEND_CI_WORKFLOW);
  const mutated = overlay(repository, {
    [FRONTEND_CI_WORKFLOW]: workflow.split("frontend/*|shared/*|").join("frontend/*|shared/*|contracts/*|"),
  });

  assert.notEqual(mutated.textOf(FRONTEND_CI_WORKFLOW), workflow, "the detector mutation did not apply");
  assertSingleViolation(auditSnapshot(mutated), /^G6 .*"contracts\/\*\*" as frontend impact/);
});

// -- 4 - Negative proof: independent changes stay green -----------------------

test("negative proof: a new audit document does not trip the guard", () => {
  const mutated = overlay(repository, {
    "docs/audit/build-filter-notes.md": "# Notes\n\nSee ../../server/index.ts and .nvmrc.\n",
  });

  assert.deepEqual(auditSnapshot(mutated), []);
});

test("negative proof: an independent backend module does not trip the guard", () => {
  const mutated = overlay(repository, {
    "server/lib/independent-module.ts": 'import { ENV } from "./env.ts";\n\nexport const flag = ENV.nodeEnv;\n',
  });

  assert.deepEqual(auditSnapshot(mutated), []);
});

test("negative proof: a legitimate change inside frontend/** does not trip the guard", () => {
  const mutated = overlay(repository, {
    "frontend/src/lib/build-filter-sample.ts":
      'import { THEME_INIT_SCRIPT_PATH } from "./theme";\nimport { SESSION } from "../../../shared/session-cookie-names";\n\nexport const sample = [THEME_INIT_SCRIPT_PATH, SESSION];\n',
    "frontend/public/extra.js": "console.log('extra');\n",
  });

  assert.deepEqual(auditSnapshot(mutated), []);
});
