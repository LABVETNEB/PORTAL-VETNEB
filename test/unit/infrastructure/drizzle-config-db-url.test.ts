import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { readSourceFile } from "../../helpers/tracked-source-files.ts";

const { resolveDrizzleDbUrl } = await import(
  "../../../scripts/db/resolve-drizzle-db-url.mjs"
);

const URL_A = "postgresql://synthetic_a:pw_a@127.0.0.1:1/db_a";
const URL_B = "postgresql://synthetic_b:pw_b@127.0.0.1:1/db_b";
const ROOT = resolve(import.meta.dirname, "../../..");
const CONFIG_PATH = join(ROOT, "drizzle.config.ts");

function assertThrowsWithoutLeak(fn: () => unknown, secrets: string[]) {
  assert.throws(fn, (error: unknown) => {
    const message = (error as Error).message;
    for (const secret of secrets) {
      assert.ok(!message.includes(secret), "error message must not echo values");
    }
    return true;
  });
}

test("DRZ-01: both variables absent fails closed", () => {
  assert.throws(() => resolveDrizzleDbUrl({}, {}), /Falta/);
});

test("DRZ-02: only SUPABASE_DB_URL is returned", () => {
  assert.equal(resolveDrizzleDbUrl({ SUPABASE_DB_URL: URL_A }, {}), URL_A);
});

test("DRZ-03: only DATABASE_URL is returned", () => {
  assert.equal(resolveDrizzleDbUrl({ DATABASE_URL: URL_A }, {}), URL_A);
});

test("DRZ-04: both variables equal is accepted (CI shape)", () => {
  assert.equal(
    resolveDrizzleDbUrl({ SUPABASE_DB_URL: URL_A, DATABASE_URL: URL_A }, {}),
    URL_A,
  );
});

test("DRZ-05: both variables different fails without leaking values", () => {
  assertThrowsWithoutLeak(
    () =>
      resolveDrizzleDbUrl({ SUPABASE_DB_URL: URL_A, DATABASE_URL: URL_B }, {}),
    [URL_A, URL_B, "pw_a", "pw_b"],
  );
});

test("DRZ-06: explicit DATABASE_URL is not displaced by .env SUPABASE_DB_URL", () => {
  assert.equal(
    resolveDrizzleDbUrl({ DATABASE_URL: URL_A }, { SUPABASE_DB_URL: URL_B }),
    URL_A,
  );
});

test("DRZ-07: explicit SUPABASE_DB_URL is not displaced by .env DATABASE_URL", () => {
  assert.equal(
    resolveDrizzleDbUrl({ SUPABASE_DB_URL: URL_A }, { DATABASE_URL: URL_B }),
    URL_A,
  );
});

test("DRZ-08: explicit empty variable does not fall back to .env", () => {
  assert.throws(
    () =>
      resolveDrizzleDbUrl(
        { DATABASE_URL: "" },
        { SUPABASE_DB_URL: URL_B, DATABASE_URL: URL_B },
      ),
    /Falta/,
  );
});

test("DRZ-09: .env alone with conflicting variables fails closed", () => {
  assertThrowsWithoutLeak(
    () =>
      resolveDrizzleDbUrl({}, { SUPABASE_DB_URL: URL_A, DATABASE_URL: URL_B }),
    [URL_A, URL_B],
  );
});

test("DRZ-10: .env alone with one variable is accepted", () => {
  assert.equal(resolveDrizzleDbUrl({}, { DATABASE_URL: URL_B }), URL_B);
});

test("DRZ-11: invalid scheme or garbage is rejected without echo", () => {
  const bad = "mysql://user:secret_pw@127.0.0.1:1/db";
  assertThrowsWithoutLeak(
    () => resolveDrizzleDbUrl({ DATABASE_URL: bad }, {}),
    [bad, "secret_pw"],
  );
  const garbage = "not a url secret_pw";
  assertThrowsWithoutLeak(
    () => resolveDrizzleDbUrl({ DATABASE_URL: garbage }, {}),
    [garbage, "secret_pw"],
  );
});

test("DRZ-12: surrounding whitespace is trimmed", () => {
  assert.equal(
    resolveDrizzleDbUrl({ DATABASE_URL: `  ${URL_A}\n` }, {}),
    URL_A,
  );
});

test("DRZ-13: inputs are not mutated", () => {
  const proc = { DATABASE_URL: URL_A };
  const dot = { SUPABASE_DB_URL: URL_B };
  const before = process.env.DATABASE_URL;
  resolveDrizzleDbUrl(proc, dot);
  assert.deepEqual(proc, { DATABASE_URL: URL_A });
  assert.deepEqual(dot, { SUPABASE_DB_URL: URL_B });
  assert.equal(process.env.DATABASE_URL, before);
});

test("DRZ-14: drizzle.config.ts has no override and uses the resolver", () => {
  const source = readSourceFile("drizzle.config.ts");
  assert.ok(!/override\s*:\s*true/.test(source));
  assert.ok(!/dotenv\.config\(/.test(source));
  assert.ok(source.includes("resolveDrizzleDbUrl"));
  assert.ok(source.includes("./scripts/db/resolve-drizzle-db-url.mjs"));
});

function loadConfigInSubprocess(
  dotenvContent: string | null,
  extraEnv: Record<string, string>,
  preloadDotenv = false,
) {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...extraEnv,
  };
  const configHref = JSON.stringify(pathToFileURL(CONFIG_PATH).href);
  const script = `
const { mkdtempSync, writeFileSync, rmSync } = process.getBuiltinModule("node:fs");
const { tmpdir } = process.getBuiltinModule("node:os");
const { join } = process.getBuiltinModule("node:path");
const { createRequire } = process.getBuiltinModule("node:module");
const dir = mkdtempSync(join(tmpdir(), "drz-config-"));
try {
  if (${JSON.stringify(dotenvContent)} !== null) {
    writeFileSync(join(dir, ".env"), ${JSON.stringify(dotenvContent)});
  }
  process.chdir(dir);
  if (${preloadDotenv}) {
    createRequire(${configHref})("dotenv").config();
  }
  const m = await import(${configHref});
  process.stdout.write(m.default.dbCredentials.url);
} finally {
  process.chdir(tmpdir());
  rmSync(dir, { recursive: true, force: true });
}`;
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    { env, encoding: "utf8" },
  );
}

test("DRZ-15a: subprocess keeps the explicit URL over a conflicting .env", () => {
  const result = loadConfigInSubprocess(`SUPABASE_DB_URL=${URL_B}\n`, {
    DATABASE_URL: URL_A,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, URL_A);
});

test("DRZ-15b: subprocess reads .env when no explicit variable exists", () => {
  const result = loadConfigInSubprocess(`DATABASE_URL=${URL_B}\n`, {});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, URL_B);
});

test("DRZ-15c: subprocess exits non-zero on conflicting explicit variables", () => {
  const result = loadConfigInSubprocess(null, {
    SUPABASE_DB_URL: URL_A,
    DATABASE_URL: URL_B,
  });
  assert.notEqual(result.status, 0);
  assert.ok(!result.stderr.includes("pw_a"));
  assert.ok(!result.stderr.includes("pw_b"));
});

test("DRZ-15d: drizzle-kit CLI preloads .env; a mixed explicit/.env pair fails closed", () => {
  const result = loadConfigInSubprocess(
    `SUPABASE_DB_URL=${URL_B}\n`,
    { DATABASE_URL: URL_A },
    true,
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /destinos distintos/);
  assert.ok(!result.stdout.includes(URL_B));
  assert.ok(!result.stderr.includes("pw_b"));
});

test("DRZ-15e: drizzle-kit CLI preload keeps one explicit URL over the same-name .env value", () => {
  const result = loadConfigInSubprocess(
    `DATABASE_URL=${URL_B}\n`,
    { DATABASE_URL: URL_A },
    true,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, URL_A);
});

test("DRZ-16: backend CI keeps both DB variables identical", () => {
  const workflow = readSourceFile(".github/workflows/backend-ci.yml");
  const database = [...workflow.matchAll(/^\s+DATABASE_URL:\s*(\S+)/gm)].map(
    (match) => match[1],
  );
  const supabase = [...workflow.matchAll(/^\s+SUPABASE_DB_URL:\s*(\S+)/gm)].map(
    (match) => match[1],
  );
  assert.ok(database.length > 0);
  assert.deepEqual(database, supabase);
});
