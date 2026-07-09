import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "drizzle",
  "migrations",
  "0030_login_rate_limits_metadata.sql",
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
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

test("login_rate_limits metadata migration exists with safe columns and indexes", () => {
  assert.ok(existsSync(migrationPath), "missing 0030_login_rate_limits_metadata.sql");

  const source = readText(migrationPath);
  assert.match(source, /ALTER TABLE "login_rate_limits"/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS "surface" varchar\(32\)/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS "identifier_hash" text/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS "ip_hash" text/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS "key_version" varchar\(16\)/);
  assert.match(source, /login_rate_limits_surface_identifier_idx/);
  assert.match(source, /login_rate_limits_surface_identifier_ip_idx/);
  assert.doesNotMatch(source, /identifier"\s+text/i);
  assert.doesNotMatch(source, /ip_address/i);
});

test("login_rate_limits metadata migration is registered in drizzle journal", () => {
  const journal = JSON.parse(readText(journalPath)) as {
    entries?: Array<{ tag?: string }>;
  };
  const tags = new Set((journal.entries ?? []).map((entry) => entry.tag));

  assert.ok(
    tags.has("0030_login_rate_limits_metadata"),
    "journal missing 0030_login_rate_limits_metadata",
  );
});

test("drizzle schema keeps login_rate_limits metadata contract", () => {
  const schemaSource = readText(schemaPath);

  assert.match(schemaSource, /pgTable\(\s*"login_rate_limits"/);
  assert.match(schemaSource, /surface:\s+varchar\("surface",\s*\{\s*length:\s*32\s*\}\)/);
  assert.match(schemaSource, /identifierHash:\s+text\("identifier_hash"\)/);
  assert.match(schemaSource, /ipHash:\s+text\("ip_hash"\)/);
  assert.match(schemaSource, /keyVersion:\s+varchar\("key_version",\s*\{\s*length:\s*16\s*\}\)/);
});
