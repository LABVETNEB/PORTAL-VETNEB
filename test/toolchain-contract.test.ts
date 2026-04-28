import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  packageManager?: string;
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

  assertContains(workflow, "uses: pnpm/action-setup@v4");
  assertContains(workflow, "version: 10.8.1");
  assertContains(workflow, "uses: actions/setup-node@v4");
  assertContains(workflow, "node-version: 24");
  assertContains(workflow, "cache: pnpm");
  assertContains(workflow, "run: pnpm install --frozen-lockfile");
});

test("Backend CI installs dependencies after toolchain setup", () => {
  const workflow = readTextFile(".github", "workflows", "backend-ci.yml");

  assertOrdered(workflow, [
    "      - name: Setup pnpm\n        uses: pnpm/action-setup@v4",
    "      - name: Setup Node.js\n        uses: actions/setup-node@v4",
    "      - name: Install dependencies\n        run: pnpm install --frozen-lockfile",
  ]);
});
