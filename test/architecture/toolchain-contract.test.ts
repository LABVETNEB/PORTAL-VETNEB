import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  packageManager?: string;
};

type ExecutableUse = {
  line: number;
  repository: string;
  ref: string;
  reference: string;
};

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

function executableUses(source: string): ExecutableUse[] {
  const uses: ExecutableUse[] = [];
  let blockScalarIndent: number | null = null;

  source.split("\n").forEach((line, index) => {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (blockScalarIndent !== null) {
      if (indent > blockScalarIndent) return;
      blockScalarIndent = null;
    }

    const pair = line.match(/^\s*(?:-\s*)?([A-Za-z0-9_.-]+):(?:\s*(.*))?$/);
    if (pair && /^(?:\||>)(?:[-+])?$/.test((pair[2] ?? "").trim())) {
      blockScalarIndent = indent;
    }

    const match = line.match(/^\s*(?:-\s*)?uses:\s*([^#\s]+)/);
    if (!match) return;

    const reference = match[1];
    const atIndex = reference.lastIndexOf("@");
    assert.notEqual(atIndex, -1, `expected executable uses to include @: ${reference}`);

    uses.push({
      line: index + 1,
      repository: reference.slice(0, atIndex),
      ref: reference.slice(atIndex + 1),
      reference,
    });
  });

  return uses;
}

function assertExecutableUsesPinned(source: string, expectedRepositories: readonly string[]): void {
  const uses = executableUses(source);

  assert.deepEqual(
    uses.map((entry) => entry.repository),
    expectedRepositories,
  );

  for (const entry of uses) {
    assert.match(entry.ref, /^[0-9a-f]{40}$/, `mutable executable ref at line ${entry.line}: ${entry.reference}`);
  }
}

function assertNoLegacyMutableActionTags(source: string): void {
  for (const legacyReference of [
    "actions/checkout@v7",
    "actions/setup-node@v6",
    "pnpm/action-setup@v4",
  ]) {
    assert.ok(!source.includes(legacyReference), `legacy mutable reference remains: ${legacyReference}`);
  }
}

function assertExecutableUseOrder(source: string, expectedRepositories: readonly string[]): void {
  const uses = executableUses(source);
  let lastLine = -1;

  for (const repository of expectedRepositories) {
    const entry = uses.find((candidate) => candidate.repository === repository);
    assert.ok(entry, `expected executable uses for ${repository}`);
    assert.ok(entry.line > lastLine, `expected executable uses order for ${repository}`);
    lastLine = entry.line;
  }
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

  assert.equal(packageJson.packageManager, "pnpm@10.8.1");
});

test("Backend CI uses the pinned pnpm and Node toolchain", () => {
  const workflow = readTextFile(".github", "workflows", "backend-ci.yml");

  assertContains(workflow, "permissions:\n  contents: read");
  assertContains(
    workflow,
    "concurrency:\n  group: backend-ci-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true",
  );
  assertExecutableUsesPinned(workflow, [
    "actions/checkout",
    "pnpm/action-setup",
    "actions/setup-node",
  ]);
  assertNoLegacyMutableActionTags(workflow);
  assertContains(workflow, "version: 10.8.1");
  assertContains(workflow, "node-version: 24");
  assertContains(workflow, "cache: pnpm");
  assertContains(workflow, "cache-dependency-path: pnpm-lock.yaml");
  assertContains(workflow, "run: pnpm install --frozen-lockfile");
});

test("Backend CI installs dependencies after toolchain setup", () => {
  const workflow = readTextFile(".github", "workflows", "backend-ci.yml");

  assertExecutableUseOrder(workflow, [
    "pnpm/action-setup",
    "actions/setup-node",
  ]);
  assertOrdered(workflow, [
    "      - name: Setup pnpm",
    "      - name: Setup Node.js",
    "      - name: Install dependencies\n        run: pnpm install --frozen-lockfile",
  ]);
});

test("executable uses parser ignores block scalar legacy-looking strings", () => {
  const fixture = `steps:
  - run: |
      uses: actions/checkout@v7
  - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567 # v7
`;

  assert.deepEqual(executableUses(fixture).map((entry) => entry.reference), [
    "actions/checkout@0123456789abcdef0123456789abcdef01234567",
  ]);
});

test("executable uses parser rejects mutable refs", () => {
  for (const reference of ["actions/checkout@v7", "actions/checkout@main"]) {
    assert.throws(
      () => assertExecutableUsesPinned(`steps:\n  - uses: ${reference}\n`, ["actions/checkout"]),
      /mutable executable ref/,
    );
  }
});
