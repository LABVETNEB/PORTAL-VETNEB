import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "drizzle",
  "migrations",
  "0022_login_failed_attempts.sql",
);
const journalPath = resolve(
  process.cwd(),
  "drizzle",
  "migrations",
  "meta",
  "_journal.json",
);
const schemaPath = resolve(process.cwd(), "drizzle", "schema.ts");

function readText(path: string) {
  return readFileSync(path, "utf8");
}

test("login_failed_attempts migration exists with table and indexes", () => {
  assert.ok(existsSync(migrationPath), "missing 0022_login_failed_attempts.sql");

  const source = readText(migrationPath);
  assert.match(source, /CREATE TABLE IF NOT EXISTS "login_failed_attempts"/);
  assert.match(source, /"surface" varchar\(32\) NOT NULL/);
  assert.match(source, /"reason" varchar\(64\) NOT NULL/);
  assert.match(source, /"created_at" timestamp DEFAULT now\(\) NOT NULL/);
  assert.match(source, /login_failed_attempts_surface_created_at_idx/);
  assert.match(source, /login_failed_attempts_ip_created_at_idx/);
  assert.match(source, /login_failed_attempts_reason_created_at_idx/);
});

test("login_failed_attempts migration is registered in drizzle journal", () => {
  const journal = JSON.parse(readText(journalPath)) as {
    entries?: Array<{ tag?: string }>;
  };
  const tags = new Set((journal.entries ?? []).map((entry) => entry.tag));
  assert.ok(
    tags.has("0022_login_failed_attempts"),
    "journal missing 0022_login_failed_attempts",
  );
});

test("drizzle schema keeps login_failed_attempts table contract", () => {
  const schemaSource = readText(schemaPath);
  assert.match(schemaSource, /pgTable\(\s*"login_failed_attempts"/);
});
