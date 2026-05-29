import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "drizzle",
  "migrations",
  "0029_admin_users_email_identifier.sql",
);
const journalPath = resolve(
  process.cwd(),
  "drizzle",
  "migrations",
  "meta",
  "_journal.json",
);
const schemaPath = resolve(process.cwd(), "drizzle", "schema.ts");

function readText(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

test("admin email login migration exists with email column and unique index", () => {
  assert.ok(
    existsSync(migrationPath),
    "missing 0029_admin_users_email_identifier.sql",
  );

  const source = readText(migrationPath);
  assert.match(source, /ALTER TABLE "admin_users"/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS "email" varchar\(255\)/);
  assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_lower_uidx"/);
  assert.match(source, /ON "admin_users" \(lower\("email"\)\)/);
  assert.match(source, /WHERE "email" IS NOT NULL/);
});

test("admin email login migration is registered in drizzle journal", () => {
  const journal = JSON.parse(readText(journalPath)) as {
    entries?: Array<{ tag?: string }>;
  };

  assert.ok(Array.isArray(journal.entries), "_journal.json must define entries");
  assert.ok(
    journal.entries?.some(
      (entry) => entry.tag === "0029_admin_users_email_identifier",
    ),
    "drizzle journal must register 0029_admin_users_email_identifier",
  );
});

test("drizzle schema keeps admin_users email column contract", () => {
  const schemaSource = readText(schemaPath);
  assert.match(schemaSource, /pgTable\("admin_users"/);
  assert.match(schemaSource, /email:\s+varchar\("email",\s*\{\s*length:\s*255\s*\}\)/);
});
