import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  packageManager?: string;
  pnpm?: unknown;
};

const PINNED_PNPM_VERSION = "11.13.0";

const PNPM_WORKFLOW_FILES = [
  ".github/workflows/backend-ci.yml",
  ".github/workflows/frontend-ci.yml",
  ".github/workflows/qga-governance.yml",
] as const;

const SECURITY_OVERRIDE_LINES = [
  '  "brace-expansion@<1.1.16": "1.1.16"',
  '  "brace-expansion@>=2.0.0 <2.1.2": "2.1.2"',
  '  "brace-expansion@>=3.0.0 <5.0.7": "5.0.7"',
  '  esbuild: "0.28.1"',
  '  "fast-uri@<3.1.4": "3.1.4"',
  '  "fast-uri@>=4.0.0 <4.1.1": "4.1.1"',
  '  "find-my-way@<=9.6.0": "9.7.0"',
  '  "sharp@<0.35.0": "0.35.3"',
  '  "postcss@<8.5.10": "8.5.14"',
  '  "ws@>=8.0.0 <8.20.1": "8.20.1"',
  '  js-yaml: "5.2.1"',
] as const;

function readTextFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function readPackageJson(): PackageJson {
  return JSON.parse(readTextFile("package.json")) as PackageJson;
}

function assertContains(source: string, expected: string): void {
  assert.ok(source.includes(expected), `expected file to contain: ${expected}`);
}

function assertNotContains(source: string, unexpected: string): void {
  assert.ok(!source.includes(unexpected), `expected file not to contain: ${unexpected}`);
}

function assertOrdered(source: string, expectedItems: readonly string[]): void {
  let lastIndex = -1;

  for (const item of expectedItems) {
    const index = source.indexOf(item);

    assert.notEqual(index, -1, `expected file to contain: ${item}`);
    assert.ok(index > lastIndex, `expected ordered item: ${item}`);

    lastIndex = index;
  }
}

test("package.json pins the expected package manager", () => {
  const packageJson = readPackageJson();

  assert.equal(packageJson.packageManager, `pnpm@${PINNED_PNPM_VERSION}`);
});

test("package.json no longer carries pnpm configuration (moved to pnpm-workspace.yaml)", () => {
  const packageJson = readPackageJson();

  assert.equal(packageJson.pnpm, undefined);
});

test("every pnpm workflow pins the same pnpm version", () => {
  for (const workflowFile of PNPM_WORKFLOW_FILES) {
    const workflow = readTextFile(...workflowFile.split("/"));

    assertContains(workflow, `version: ${PINNED_PNPM_VERSION}`);
    assertNotContains(workflow, "version: 10.8.1");
  }
});

test("pnpm-workspace.yaml keeps every security override exactly", () => {
  const workspace = readTextFile("pnpm-workspace.yaml");

  assertContains(workspace, 'packages:\n  - "frontend"');
  assertContains(workspace, `overrides:\n${SECURITY_OVERRIDE_LINES.join("\n")}`);
});

test("pnpm-workspace.yaml preserves the build-script policy for argon2 and esbuild", () => {
  const workspace = readTextFile("pnpm-workspace.yaml");

  assertContains(
    workspace,
    "allowBuilds:\n  argon2: false\n  esbuild: false\n  sharp: false\n  unrs-resolver: false",
  );

  const allowBuildsIndex = workspace.indexOf("allowBuilds:");
  const allowBuildsBlock = workspace
    .slice(allowBuildsIndex)
    .split(/\n(?=\S)/, 1)[0];

  assertNotContains(allowBuildsBlock, ": true");
  assertNotContains(workspace, "ignoredBuiltDependencies");
});

test("Backend CI keeps both dependency audits mandatory and blocking", () => {
  const workflow = readTextFile(".github", "workflows", "backend-ci.yml");

  assertContains(
    workflow,
    "      - name: Dependency security audit\n        run: |\n          pnpm audit --prod\n          pnpm audit",
  );
  assertNotContains(workflow, "continue-on-error");
  assertNotContains(workflow, "|| true");
});

test("Backend CI uses the pinned pnpm and Node toolchain", () => {
  const workflow = readTextFile(".github", "workflows", "backend-ci.yml");

  assertContains(workflow, "permissions:\n  contents: read");
  assertContains(
    workflow,
    "concurrency:\n  group: backend-ci-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true",
  );
  assertContains(workflow, "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7");
  assertContains(workflow, "uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6.0.9");
  assertContains(workflow, "uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7");
  assertNotContains(workflow, "uses: actions/checkout@v7");
  assertNotContains(workflow, "uses: pnpm/action-setup@v6");
  assertNotContains(workflow, "uses: actions/setup-node@v7");
  assertContains(workflow, `version: ${PINNED_PNPM_VERSION}`);
  assertContains(workflow, "node-version: 24");
  assertContains(workflow, "cache: pnpm");
  assertContains(workflow, "cache-dependency-path: pnpm-lock.yaml");
  assertContains(workflow, "run: pnpm install --frozen-lockfile");
});

test("Backend CI installs dependencies after toolchain setup", () => {
  const workflow = readTextFile(".github", "workflows", "backend-ci.yml");

  assertOrdered(workflow, [
    "      - name: Setup pnpm\n        uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6.0.9",
    "      - name: Setup Node.js\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7",
    "      - name: Install dependencies\n        run: pnpm install --frozen-lockfile",
  ]);
});
