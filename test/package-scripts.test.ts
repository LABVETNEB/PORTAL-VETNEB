import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
};

function readPackageJson(): PackageJson {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as PackageJson;
}

const requiredScripts: Record<string, string> = {
  typecheck: "tsc --noEmit",
  "typecheck:test": "tsc -p ./test/tsconfig.json --noEmit",
  test: "node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts",
  build: "esbuild server/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js",
  "validate:local": "pnpm typecheck && pnpm typecheck:test && pnpm test && pnpm build",
};

test("package scripts expose required validation commands", () => {
  const scripts = readPackageJson().scripts ?? {};

  for (const [name, expected] of Object.entries(requiredScripts)) {
    assert.equal(scripts[name], expected, `script ${name} must stay stable`);
  }
});

test("validate:local keeps local gates in required order", () => {
  const scripts = readPackageJson().scripts ?? {};
  const validateLocal = scripts["validate:local"] ?? "";

  assert.deepEqual(validateLocal.split(" && "), [
    "pnpm typecheck",
    "pnpm typecheck:test",
    "pnpm test",
    "pnpm build",
  ]);
});
