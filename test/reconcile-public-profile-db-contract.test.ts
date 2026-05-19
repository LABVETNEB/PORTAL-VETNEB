import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SCRIPT_PATH = "scripts/db/reconcile-public-profile-db.mjs";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("public profile reconciliation script keeps required table and extension contracts", () => {
  const source = read(SCRIPT_PATH);
  const normalized = source.replace(/\s+/g, " ");

  assert.ok(
    normalized.includes("CREATE EXTENSION IF NOT EXISTS unaccent"),
    "El script debe mantener CREATE EXTENSION IF NOT EXISTS unaccent.",
  );
  assert.ok(
    normalized.includes("CREATE EXTENSION IF NOT EXISTS pg_trgm"),
    "El script debe mantener CREATE EXTENSION IF NOT EXISTS pg_trgm.",
  );
  assert.ok(
    normalized.includes("CREATE TABLE IF NOT EXISTS clinic_public_profiles"),
    "El script debe mantener CREATE TABLE IF NOT EXISTS clinic_public_profiles.",
  );
  assert.ok(
    normalized.includes("CREATE TABLE IF NOT EXISTS clinic_public_search"),
    "El script debe mantener CREATE TABLE IF NOT EXISTS clinic_public_search.",
  );
});

test("public profile reconciliation script enforces address and map columns in both public tables", () => {
  const source = read(SCRIPT_PATH);
  const normalized = source.replace(/\s+/g, " ");

  assert.ok(
    normalized.includes(
      "ALTER TABLE clinic_public_profiles ADD COLUMN IF NOT EXISTS public_address varchar(160)",
    ),
    "El script debe agregar public_address en clinic_public_profiles con ALTER TABLE IF NOT EXISTS.",
  );
  assert.ok(
    normalized.includes(
      "ALTER TABLE clinic_public_profiles ADD COLUMN IF NOT EXISTS map_link varchar(2048)",
    ),
    "El script debe agregar map_link en clinic_public_profiles con ALTER TABLE IF NOT EXISTS.",
  );
  assert.ok(
    normalized.includes(
      "ALTER TABLE clinic_public_search ADD COLUMN IF NOT EXISTS public_address varchar(160)",
    ),
    "El script debe agregar public_address en clinic_public_search con ALTER TABLE IF NOT EXISTS.",
  );
  assert.ok(
    normalized.includes(
      "ALTER TABLE clinic_public_search ADD COLUMN IF NOT EXISTS map_link varchar(2048)",
    ),
    "El script debe agregar map_link en clinic_public_search con ALTER TABLE IF NOT EXISTS.",
  );
});

test("public profile reconciliation script seeds new columns in clinic_public_search", () => {
  const source = read(SCRIPT_PATH);
  const normalized = source.replace(/\s+/g, " ");

  assert.ok(
    normalized.includes(
      "INSERT INTO clinic_public_search ( clinic_id, display_name, avatar_storage_path, about_text, specialty_text, services_text, email, phone, public_address, map_link, locality, country, is_public, has_required_public_fields, is_search_eligible, profile_quality_score, search_text, updated_at )",
    ),
    "El INSERT INTO clinic_public_search debe incluir public_address y map_link.",
  );
  assert.ok(
    normalized.includes("c.contact_phone, NULL, NULL, NULL, NULL, false"),
    "El SELECT del INSERT debe incluir NULL, NULL para public_address y map_link.",
  );
});

test("public profile reconciliation script verifies new columns in information_schema checks", () => {
  const source = read(SCRIPT_PATH);
  const normalized = source.replace(/\s+/g, " ");

  assert.ok(
    normalized.includes(
      "table_name = 'clinic_public_search' AND column_name IN ( 'has_required_public_fields', 'is_search_eligible', 'profile_quality_score', 'public_address', 'map_link' )",
    ),
    "El check final debe contemplar public_address y map_link en clinic_public_search.",
  );
  assert.ok(
    normalized.includes(
      "table_name = 'clinic_public_profiles' AND column_name IN ( 'public_address', 'map_link' )",
    ),
    "El check final debe contemplar public_address y map_link en clinic_public_profiles.",
  );
});
