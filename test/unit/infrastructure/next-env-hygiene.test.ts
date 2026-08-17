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
