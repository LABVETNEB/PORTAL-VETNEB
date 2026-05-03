import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FIELD_VISIT_SOURCE_TYPES,
  FIELD_VISIT_STATUSES,
  VISIT_LOCATION_GEO_QUALITIES,
  fieldVisits,
  visitLocations,
} from "../drizzle/schema.ts";

function assertNormalizedUniqueValues(
  values: readonly string[],
  label: string,
) {
  const unique = new Set(values);

  assert.equal(unique.size, values.length, `${label} no debe repetir valores`);

  for (const value of values) {
    assert.equal(typeof value, "string");
    assert.equal(value.trim(), value, `${label} no debe contener espacios`);
    assert.equal(value.length > 0, true, `${label} no debe contener vacíos`);
    assert.match(
      value,
      /^[a-z_]+$/,
      `${label} debe usar valores snake_case normalizados`,
    );
  }
}

test("logistics field visit source types conserva el contrato MVP", () => {
  assert.deepEqual(FIELD_VISIT_SOURCE_TYPES, [
    "report",
    "study_tracking_case",
    "manual",
  ]);

  assertNormalizedUniqueValues(
    FIELD_VISIT_SOURCE_TYPES,
    "FIELD_VISIT_SOURCE_TYPES",
  );
});

test("logistics field visit statuses conserva el contrato MVP", () => {
  assert.deepEqual(FIELD_VISIT_STATUSES, [
    "pending",
    "scheduled",
    "in_progress",
    "done",
    "canceled",
    "no_show",
  ]);

  assertNormalizedUniqueValues(FIELD_VISIT_STATUSES, "FIELD_VISIT_STATUSES");
});

test("visit location geo qualities conserva el contrato MVP", () => {
  assert.deepEqual(VISIT_LOCATION_GEO_QUALITIES, [
    "exact",
    "approx",
    "missing",
    "ambiguous",
  ]);

  assertNormalizedUniqueValues(
    VISIT_LOCATION_GEO_QUALITIES,
    "VISIT_LOCATION_GEO_QUALITIES",
  );
});

test("logistics schema exports field visits and visit locations tables", () => {
  assert.equal(typeof fieldVisits, "object");
  assert.equal(typeof visitLocations, "object");
});

test("logistics field visits migration creates tenant-first schema", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0017_logistics_field_visits.sql",
    ),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "field_visits"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "visit_locations"/);
  assert.match(migration, /"clinic_id" integer NOT NULL/);
  assert.match(migration, /"source_type" varchar\(40\) DEFAULT 'manual' NOT NULL/);
  assert.match(migration, /"status" varchar\(32\) DEFAULT 'pending' NOT NULL/);
  assert.match(migration, /"geo_quality" varchar\(32\) DEFAULT 'missing' NOT NULL/);
  assert.match(migration, /"lat" real/);
  assert.match(migration, /"lng" real/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE NO ACTION/);
  assert.match(migration, /field_visits_clinic_id_idx/);
  assert.match(migration, /field_visits_clinic_status_idx/);
  assert.match(migration, /field_visits_clinic_priority_created_at_idx/);
  assert.match(migration, /field_visits_clinic_source_idx/);
  assert.match(migration, /visit_locations_field_visit_id_idx/);
});

test("logistics migration is registered in drizzle journal", () => {
  const journal = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "meta",
      "_journal.json",
    ),
    "utf8",
  );

  const parsed = JSON.parse(journal) as {
    entries?: Array<{ idx?: number; tag?: string }>;
  };

  const entry = parsed.entries?.find(
    (item) => item.tag === "0017_logistics_field_visits",
  );

  assert.ok(entry, "journal debe registrar 0017_logistics_field_visits");
  assert.equal(entry?.idx, 17);
});
