import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROUTE_PLAN_CREATED_BY_TYPES,
  ROUTE_PLAN_OBJECTIVES,
  ROUTE_PLAN_STATUSES,
  ROUTE_PLANNING_MODES,
  ROUTE_STOP_STATUSES,
  routePlans,
  routeStops,
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

test("route plan statuses conserva el lifecycle base MVP", () => {
  assert.deepEqual(ROUTE_PLAN_STATUSES, [
    "draft",
    "planned",
    "released",
    "in_progress",
    "completed",
    "canceled",
  ]);

  assertNormalizedUniqueValues(ROUTE_PLAN_STATUSES, "ROUTE_PLAN_STATUSES");
});

test("route planning modes conserva los modos MVP permitidos", () => {
  assert.deepEqual(ROUTE_PLANNING_MODES, ["manual", "heuristic"]);

  assertNormalizedUniqueValues(ROUTE_PLANNING_MODES, "ROUTE_PLANNING_MODES");
});

test("route plan objectives conserva los objetivos MVP permitidos", () => {
  assert.deepEqual(ROUTE_PLAN_OBJECTIVES, ["distance", "time", "sla"]);

  assertNormalizedUniqueValues(ROUTE_PLAN_OBJECTIVES, "ROUTE_PLAN_OBJECTIVES");
});

test("route plan created by types conserva actores internos permitidos", () => {
  assert.deepEqual(ROUTE_PLAN_CREATED_BY_TYPES, [
    "system",
    "admin",
    "clinic",
  ]);

  assertNormalizedUniqueValues(
    ROUTE_PLAN_CREATED_BY_TYPES,
    "ROUTE_PLAN_CREATED_BY_TYPES",
  );
});

test("route stop statuses conserva estados operativos base", () => {
  assert.deepEqual(ROUTE_STOP_STATUSES, [
    "pending",
    "arrived",
    "departed",
    "skipped",
    "done",
    "no_show",
    "canceled",
  ]);

  assertNormalizedUniqueValues(ROUTE_STOP_STATUSES, "ROUTE_STOP_STATUSES");
});

test("logistics schema exports route plans and route stops tables", () => {
  assert.equal(typeof routePlans, "object");
  assert.equal(typeof routeStops, "object");
});

test("logistics route plans and stops migration creates base schema", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0019_logistics_route_plans_stops.sql",
    ),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "route_plans"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "route_stops"/);
  assert.match(migration, /"clinic_id" integer NOT NULL/);
  assert.match(migration, /"service_date" timestamp NOT NULL/);
  assert.match(migration, /"status" varchar\(32\) DEFAULT 'draft' NOT NULL/);
  assert.match(migration, /"planning_mode" varchar\(32\) DEFAULT 'manual' NOT NULL/);
  assert.match(migration, /"objective" varchar\(32\) DEFAULT 'distance' NOT NULL/);
  assert.match(migration, /"total_planned_km" real DEFAULT 0 NOT NULL/);
  assert.match(migration, /"total_planned_min" integer DEFAULT 0 NOT NULL/);
  assert.match(migration, /"created_by_type" varchar\(32\) DEFAULT 'system' NOT NULL/);
  assert.match(migration, /"route_plan_id" integer NOT NULL/);
  assert.match(migration, /"field_visit_id" integer NOT NULL/);
  assert.match(migration, /"sequence" integer NOT NULL/);
  assert.match(migration, /"planned_km_from_prev" real DEFAULT 0 NOT NULL/);
  assert.match(migration, /"planned_min_from_prev" integer DEFAULT 0 NOT NULL/);
  assert.match(migration, /"status" varchar\(32\) DEFAULT 'pending' NOT NULL/);
});

test("logistics route plans and stops migration creates tenant and sequence indexes", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0019_logistics_route_plans_stops.sql",
    ),
    "utf8",
  );

  assert.match(migration, /route_plans_clinic_id_idx/);
  assert.match(migration, /route_plans_clinic_service_date_idx/);
  assert.match(migration, /route_plans_clinic_status_idx/);
  assert.match(migration, /route_plans_clinic_planning_mode_idx/);
  assert.match(migration, /route_stops_route_plan_id_idx/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "route_stops_route_plan_sequence_idx"/);
  assert.match(migration, /route_stops_field_visit_id_idx/);
  assert.match(migration, /route_stops_route_plan_status_idx/);
});

test("logistics route plans and stops migration creates ownership foreign keys", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0019_logistics_route_plans_stops.sql",
    ),
    "utf8",
  );

  assert.match(migration, /route_plans_clinic_id_clinics_id_fk/);
  assert.match(migration, /route_stops_route_plan_id_route_plans_id_fk/);
  assert.match(migration, /route_stops_field_visit_id_field_visits_id_fk/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE NO ACTION/);
});

test("logistics route plans and stops migration is registered in drizzle journal", () => {
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
    (item) => item.tag === "0019_logistics_route_plans_stops",
  );

  assert.ok(entry, "journal debe registrar 0019_logistics_route_plans_stops");
  assert.equal(entry?.idx, 19);
});
