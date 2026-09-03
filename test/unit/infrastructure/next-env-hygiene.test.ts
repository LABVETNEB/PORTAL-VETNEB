import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const NEXT_ENV_PATH = "frontend/next-env.d.ts";
const PLAYWRIGHT_CONFIG_PATH = "frontend/playwright.config.ts";
const NEXT_ENV_HYGIENE_HELPER_PATH =
  "frontend/e2e/helpers/restore-next-env-hygiene.mjs";
const COHORT_RUNNER_PATH = "frontend/e2e/scripts/run-cohort.mjs";
const DEV_ROUTES_REFERENCE = "./.next/dev/types/routes.d.ts";
const PRODUCTION_ROUTES_REFERENCE = "./.next/types/routes.d.ts";
const DEV_ROOT_PARAMS_REFERENCE = "./.next/dev/types/root-params.d.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend next-env.d.ts keeps the production route type reference", () => {
  const source = read(NEXT_ENV_PATH);

  assert.ok(
    source.includes(PRODUCTION_ROUTES_REFERENCE),
    "next-env.d.ts must reference .next/types/routes.d.ts",
  );
  assert.equal(
    source.includes(DEV_ROUTES_REFERENCE),
    false,
    "next-env.d.ts must not reference .next/dev/types/routes.d.ts",
  );
  assert.equal(
    source.includes(DEV_ROOT_PARAMS_REFERENCE),
    false,
    "next-env.d.ts must not reference .next/dev/types/root-params.d.ts: " +
      "the Next.js >= 16.3 dev import is restored away, never committed",
  );
});

test("Playwright has a next-env hygiene teardown", () => {
  const config = read(PLAYWRIGHT_CONFIG_PATH);
  const helper = read(NEXT_ENV_HYGIENE_HELPER_PATH);

  assert.match(
    config,
    /globalTeardown:\s*"\.\/e2e\/helpers\/restore-next-env-hygiene\.mjs"/,
    "Playwright must restore next-env.d.ts after E2E runs",
  );
  assert.ok(
    helper.includes(DEV_ROUTES_REFERENCE),
    "next-env hygiene helper must detect the dev route type reference",
  );
  assert.ok(
    helper.includes(PRODUCTION_ROUTES_REFERENCE),
    "next-env hygiene helper must restore the production route type reference",
  );
  assert.ok(
    helper.includes(DEV_ROOT_PARAMS_REFERENCE),
    "next-env hygiene helper must detect the dev root-params import added by Next.js >= 16.3",
  );
});

test("the cohort runner restores next-env hygiene outside Playwright's budget", () => {
  const runner = read(COHORT_RUNNER_PATH);

  assert.ok(
    runner.includes(
      'import { restoreNextEnvHygiene } from "../helpers/restore-next-env-hygiene.mjs";',
    ),
    "the runner must own the same hygiene helper as the Playwright teardown",
  );
  assert.match(
    runner,
    /try\s*\{\s*return runPlaywright\(selection, extraArgs\);\s*\}\s*finally\s*\{[\s\S]*?await restoreNextEnvHygiene\(\);/,
    "globalTeardown is billed against globalTimeout: a timed-out run skips it, " +
      "so the restore must also run after the Playwright process exits",
  );
});

test("next-env hygiene helper normalizes a dev route reference", async () => {
  const helperUrl = pathToFileURL(
    resolve(process.cwd(), NEXT_ENV_HYGIENE_HELPER_PATH),
  ).href;
  const helper = await import(helperUrl);
  const tempDir = mkdtempSync(join(tmpdir(), "vetneb-next-env-"));
  const tempNextEnvPath = join(tempDir, "next-env.d.ts");

  try {
    writeFileSync(
      tempNextEnvPath,
      [
        '/// <reference types="next" />',
        '/// <reference types="next/image-types/global" />',
        `import "${DEV_ROUTES_REFERENCE}";`,
        "",
      ].join("\n"),
      "utf8",
    );

    await helper.restoreNextEnvHygiene({ nextEnvPath: tempNextEnvPath });

    assert.equal(
      readFileSync(tempNextEnvPath, "utf8"),
      [
        '/// <reference types="next" />',
        '/// <reference types="next/image-types/global" />',
        `import "${PRODUCTION_ROUTES_REFERENCE}";`,
        "",
      ].join("\n"),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Next.js 16.3 mutates next-env.d.ts with BOTH the dev route reference and a
// brand-new dev root-params import. Restoring only the first left the file
// dirty and the source-hygiene gate red on a file no commit touched.
test("next-env hygiene helper restores a combined Next.js 16.3 mutation", async () => {
  const helperUrl = pathToFileURL(
    resolve(process.cwd(), NEXT_ENV_HYGIENE_HELPER_PATH),
  ).href;
  const helper = await import(helperUrl);
  const tempDir = mkdtempSync(join(tmpdir(), "vetneb-next-env-"));
  const tempNextEnvPath = join(tempDir, "next-env.d.ts");

  const expected = [
    '/// <reference types="next" />',
    '/// <reference types="next/image-types/global" />',
    `import "${PRODUCTION_ROUTES_REFERENCE}";`,
    "",
    "// NOTE: This file should not be edited",
    "",
  ].join("\n");

  try {
    writeFileSync(
      tempNextEnvPath,
      [
        '/// <reference types="next" />',
        '/// <reference types="next/image-types/global" />',
        `import "${DEV_ROUTES_REFERENCE}";`,
        `import "${DEV_ROOT_PARAMS_REFERENCE}";`,
        "",
        "// NOTE: This file should not be edited",
        "",
      ].join("\n"),
      "utf8",
    );

    await helper.restoreNextEnvHygiene({ nextEnvPath: tempNextEnvPath });

    const restored = readFileSync(tempNextEnvPath, "utf8");

    assert.equal(
      restored.includes(DEV_ROUTES_REFERENCE),
      false,
      "the dev route reference must not survive the restore",
    );
    assert.equal(
      restored.includes(DEV_ROOT_PARAMS_REFERENCE),
      false,
      "the dev root-params import must not survive the restore",
    );
    assert.ok(
      restored.includes(`import "${PRODUCTION_ROUTES_REFERENCE}";`),
      "the canonical production route reference must remain",
    );
    assert.equal(
      restored,
      expected,
      "the restore must remove the whole generated line, leaving no blank residue",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("next-env hygiene restore is idempotent", async () => {
  const helperUrl = pathToFileURL(
    resolve(process.cwd(), NEXT_ENV_HYGIENE_HELPER_PATH),
  ).href;
  const helper = await import(helperUrl);

  const mutated = [
    '/// <reference types="next" />',
    '/// <reference types="next/image-types/global" />',
    `import "${DEV_ROUTES_REFERENCE}";`,
    `import "${DEV_ROOT_PARAMS_REFERENCE}";`,
    "",
  ].join("\n");

  const once = helper.restoreNextEnvSource(mutated);
  const twice = helper.restoreNextEnvSource(once);

  assert.equal(twice, once, "applying the restore twice must not change it further");

  const tempDir = mkdtempSync(join(tmpdir(), "vetneb-next-env-"));
  const tempNextEnvPath = join(tempDir, "next-env.d.ts");

  try {
    writeFileSync(tempNextEnvPath, mutated, "utf8");

    await helper.restoreNextEnvHygiene({ nextEnvPath: tempNextEnvPath });
    const afterFirst = readFileSync(tempNextEnvPath, "utf8");

    await helper.restoreNextEnvHygiene({ nextEnvPath: tempNextEnvPath });
    const afterSecond = readFileSync(tempNextEnvPath, "utf8");

    assert.equal(afterSecond, afterFirst, "a second restore pass must be a no-op on disk");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
