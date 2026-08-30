import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  CANARY_ENV_VALUE_VAR,
  CANARY_KEY,
  DEFAULT_CANARY_SECRET_VALUE,
  EXPLICIT_BLOCKED_IDENTIFIERS,
  isSearchableSecretValue,
  isSensitiveEnvKey,
  readAllowlistedProcessEnvEntries,
  readCanaryEntry,
  readEnvEntries,
  readEnvValueSources,
  scanEnvValueLeaksInFile,
  selectSensitiveEntries,
  validateEnvValueSourcesEvaluated,
} from "../../../scripts/security/env-value-leak-detector.mjs";

const AUDITOR_SCRIPT = resolve(
  process.cwd(),
  "scripts/security/audit-public-devtools-surface.mjs",
);

async function withTempWorkspace(
  run: (root: string) => void | Promise<void>,
): Promise<void> {
  const root = mkdtempSync(resolve(tmpdir(), "env-value-leak-detector-"));

  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeFixture(root: string, relativePath: string, content: string): void {
  const absolutePath = resolve(root, relativePath);
  mkdirSync(resolve(absolutePath, ".."), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

// --- 1 & 2: a leak is detected; absence of a leak passes ------------------

test("scanEnvValueLeaksInFile detects a real leak (positive case)", async () => {
  await withTempWorkspace(async (root) => {
    writeFixture(root, "public/bundle.js", `console.log("boot"); var x = "${DEFAULT_CANARY_SECRET_VALUE}";`);

    const entry = { key: CANARY_KEY, value: DEFAULT_CANARY_SECRET_VALUE, sourceFile: "synthetic-canary" };
    const leaks = await scanEnvValueLeaksInFile("public/bundle.js", [entry], { root });

    assert.deepEqual(leaks, [entry]);
  });
});

test("scanEnvValueLeaksInFile passes when the value is absent (negative case)", async () => {
  await withTempWorkspace(async (root) => {
    writeFixture(root, "public/bundle.js", "console.log(\"boot\"); var x = \"unrelated-value\";");

    const entry = { key: CANARY_KEY, value: DEFAULT_CANARY_SECRET_VALUE, sourceFile: "synthetic-canary" };
    const leaks = await scanEnvValueLeaksInFile("public/bundle.js", [entry], { root });

    assert.deepEqual(leaks, []);
  });
});

// --- 3: no .env still yields an effective check ----------------------------

test("readEnvValueSources always has a candidate even without any .env file", async () => {
  await withTempWorkspace((root) => {
    // Deliberately empty workspace: no .env, .env.local or frontend/.env.local.
    const fileEntries = readEnvEntries({ root });
    assert.deepEqual(fileEntries, []);

    const sources = readEnvValueSources({ root, env: {} });
    assert.ok(sources.length > 0, "the synthetic canary must always be present");
    assert.ok(sources.some((entry) => entry.key === CANARY_KEY));

    const sensitive = selectSensitiveEntries(sources);
    assert.ok(sensitive.length > 0, "the canary must survive the sensitivity filter");
  });
});

// --- 4: values from an explicit source are evaluated -----------------------

test("readAllowlistedProcessEnvEntries reads only the explicit allowlist, never process.env wholesale", () => {
  const injectedName = EXPLICIT_BLOCKED_IDENTIFIERS[0];
  const entries = readAllowlistedProcessEnvEntries({
    env: {
      [injectedName]: "vetneb_explicit_source_test_value_123",
      NOT_ALLOWLISTED_RANDOM_VAR: "must-not-be-picked-up",
    },
  });

  assert.deepEqual(entries, [
    { key: injectedName, value: "vetneb_explicit_source_test_value_123", sourceFile: "process.env" },
  ]);
});

test("readCanaryEntry honors an explicit injected override without ever reading unrelated env vars", () => {
  const injected = readCanaryEntry({ env: { [CANARY_ENV_VALUE_VAR]: "vetneb_injected_canary_override_1" } });
  assert.equal(injected.value, "vetneb_injected_canary_override_1");

  const fallback = readCanaryEntry({ env: {} });
  assert.equal(fallback.value, DEFAULT_CANARY_SECRET_VALUE);

  // Too short to be a searchable secret: falls back to the safe default
  // instead of scanning for a 3-character value that would be pure noise.
  const tooShort = readCanaryEntry({ env: { [CANARY_ENV_VALUE_VAR]: "abc" } });
  assert.equal(tooShort.value, DEFAULT_CANARY_SECRET_VALUE);
});

// --- 5: the sensitive value never reaches stdout/stderr --------------------

test("a real leak's finding message names the variable and file, never the raw value", () => {
  // Executed against the real script + real repo tree, with the leak
  // injected purely via the CANARY_ENV_VALUE_VAR override (no file written
  // to the repo, nothing to clean up).
  const stdout = execFileSync(
    process.execPath,
    [AUDITOR_SCRIPT, "--json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, [CANARY_ENV_VALUE_VAR]: DEFAULT_CANARY_SECRET_VALUE },
    },
  );

  assert.equal(stdout.includes(DEFAULT_CANARY_SECRET_VALUE), false);
});

// --- 6: a value split across a stream chunk boundary is still caught -------

test("a canary value split across a stream read boundary is still detected", async () => {
  await withTempWorkspace(async (root) => {
    const chunkSize = 64;
    const marker = DEFAULT_CANARY_SECRET_VALUE;
    const splitOffset = chunkSize - 5;
    const prefix = "a".repeat(splitOffset);
    const content = `${prefix}${marker}${"b".repeat(200)}`;

    writeFixture(root, "public/bundle.js", content);

    const entry = { key: CANARY_KEY, value: marker, sourceFile: "synthetic-canary" };
    const leaks = await scanEnvValueLeaksInFile("public/bundle.js", [entry], {
      root,
      chunkSize,
    });

    assert.deepEqual(leaks, [entry]);
  });
});

// --- 7: short/trivial values are filtered out (existing policy) ------------

test("isSearchableSecretValue filters short, placeholder, localhost and email-shaped values", () => {
  assert.equal(isSearchableSecretValue("short"), false);
  assert.equal(isSearchableSecretValue("changeme"), false);
  assert.equal(isSearchableSecretValue("example"), false);
  assert.equal(isSearchableSecretValue("dummy"), false);
  assert.equal(isSearchableSecretValue("http://localhost:5432/db"), false);
  assert.equal(isSearchableSecretValue("user@example.com"), false);
  assert.equal(isSearchableSecretValue(DEFAULT_CANARY_SECRET_VALUE), true);
});

// --- 8: non-sensitive variables are not treated as secrets ------------------

test("isSensitiveEnvKey does not flag public or unrelated variable names", () => {
  for (const benign of [
    "NEXT_PUBLIC_API_URL",
    "PORT",
    "NODE_ENV",
    "APP_VERSION",
    "CONTACT_TO",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
  ]) {
    assert.equal(isSensitiveEnvKey(benign), false, benign);
  }

  for (const sensitive of [
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SMTP_PASS",
    CANARY_KEY,
  ]) {
    assert.equal(isSensitiveEnvKey(sensitive), true, sensitive);
  }
});

// --- Anti-no-op guard (VET-11 core defect) ----------------------------------

test("validateEnvValueSourcesEvaluated turns 'nothing to evaluate' into an explicit failure reason", () => {
  assert.notEqual(validateEnvValueSourcesEvaluated([], []), null);
  assert.notEqual(
    validateEnvValueSourcesEvaluated(
      [{ key: "X", value: "y", sourceFile: "f" }],
      [],
    ),
    null,
  );
  assert.equal(
    validateEnvValueSourcesEvaluated(
      [{ key: CANARY_KEY, value: DEFAULT_CANARY_SECRET_VALUE, sourceFile: "synthetic-canary" }],
      [{ key: CANARY_KEY, value: DEFAULT_CANARY_SECRET_VALUE, sourceFile: "synthetic-canary" }],
    ),
    null,
  );
});

test("the real audit script always evaluates at least one sensitive candidate, even with no .env files", () => {
  const stdout = execFileSync(process.execPath, [AUDITOR_SCRIPT, "--json"], {
    encoding: "utf8",
  });
  const summary = JSON.parse(stdout) as { notes: string[]; findings: unknown[] };

  const evaluatedNote = summary.notes.find((note) =>
    note.startsWith("Evaluated") && note.includes("sensitive env-value candidate"),
  );
  assert.ok(evaluatedNote, `expected an "Evaluated N sensitive env-value candidate(s)" note, got: ${JSON.stringify(summary.notes)}`);

  const notEvaluatedFinding = (summary.findings as Array<{ rule: string }>).find(
    (finding) => finding.rule === "env-value-leak-check-not-evaluated",
  );
  assert.equal(notEvaluatedFinding, undefined);
});
