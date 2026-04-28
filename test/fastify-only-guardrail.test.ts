import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

function readText(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath: string) {
  return JSON.parse(readText(relativePath).replace(/^\uFEFF/, ""));
}

function walkFiles(relativeDir: string): string[] {
  const absoluteDir = join(repoRoot, relativeDir);
  const files: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...walkFiles(relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

test("backend Fastify-only no reintroduce runtime Express directo", () => {
  assert.equal(
    existsSync(join(repoRoot, "server/app.ts")),
    false,
    "server/app.ts no debe volver: el entrypoint backend es Fastify-only",
  );

  const forbiddenPatterns = [
    {
      label: "import directo de express",
      pattern: /\bfrom\s+["']express["']|\brequire\s*\(\s*["']express["']\s*\)/,
    },
    {
      label: "factory express()",
      pattern: /\bexpress\s*\(/,
    },
    {
      label: "factory Router()",
      pattern: /\bRouter\s*\(/,
    },
    {
      label: "montaje app.use()",
      pattern: /\bapp\.use\s*\(/,
    },
    {
      label: "namespace global Express",
      pattern: /\bnamespace\s+Express\b/,
    },
    {
      label: "tipos namespace Express.*",
      pattern: /\bExpress\./,
    },
  ];

  const violations: string[] = [];

  for (const file of walkFiles("server").filter((path) => path.endsWith(".ts"))) {
    const content = readText(file);

    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(content)) {
        violations.push(`${file}: ${label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("configuracion y documentacion declaran Fastify sin Express directo", () => {
  const packageJson = readJson("package.json");
  const forbiddenDirectPackages = [
    "express",
    "@types/express",
    "cookie-parser",
    "@types/cookie-parser",
    "cors",
    "@types/cors",
  ];

  for (const packageName of forbiddenDirectPackages) {
    assert.equal(
      packageName in (packageJson.dependencies ?? {}),
      false,
      `${packageName} no debe estar en dependencies directas`,
    );

    assert.equal(
      packageName in (packageJson.devDependencies ?? {}),
      false,
      `${packageName} no debe estar en devDependencies directas`,
    );
  }

  const tsconfig = readJson("tsconfig.json");
  const testTsconfig = readJson("test/tsconfig.json");

  assert.deepEqual(tsconfig.compilerOptions.types, ["node"]);
  assert.deepEqual(testTsconfig.compilerOptions.types, ["node"]);

  const readme = readText("README.md");

  assert.match(readme, /\bFastify\b/);
  assert.doesNotMatch(readme, /\bExpress\b/);
});