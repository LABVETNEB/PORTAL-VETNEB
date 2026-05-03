import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROUTE_EVENT_SOURCES,
  ROUTE_EVENT_TYPES,
  routeEvents,
} from "../drizzle/schema.ts";

function assertUniqueValues(values: readonly string[], label: string) {
  const unique = new Set(values);

  assert.equal(unique.size, values.length, `${label} must not repeat values`);

  for (const value of values) {
    assert.equal(typeof value, "string");
    assert.equal(value.trim(), value, `${label} must not contain edge spaces`);
    assert.equal(value.length > 0, true, `${label} must not contain blanks`);
  }
}

function assertRouteEventTypeValues(values: readonly string[]) {
  assertUniqueValues(values, "ROUTE_EVENT_TYPES");

  for (const value of values) {
    assert.match(
      value,
      /^(route|stop)\.[a-z_]+$/,
      "ROUTE_EVENT_TYPES must use domain.action format",
    );
  }
}

function assertSnakeCaseValues(values: readonly string[], label: string) {
  assertUniqueValues(values, label);

  for (const value of values) {
    assert.match(value, /^[a-z_]+$/, `${label} must use snake_case values`);
  }
}

test("route event types keep MVP operational event contract", () => {
  assert.deepEqual(ROUTE_EVENT_TYPES, [
    "route.created",
    "route.released",
    "route.started",
    "stop.arrived",
    "stop.departed",
    "stop.skipped",
    "stop.no_show",
    "route.completed",
    "route.canceled",
    "route.replanned",
  ]);

  assertRouteEventTypeValues(ROUTE_EVENT_TYPES);
});

test("route event sources keep MVP source contract", () => {
  assert.deepEqual(ROUTE_EVENT_SOURCES, [
    "system",
    "admin",
    "clinic",
    "mobile",
  ]);

  assertSnakeCaseValues(ROUTE_EVENT_SOURCES, "ROUTE_EVENT_SOURCES");
});

test("logistics schema exports route events table", () => {
  assert.equal(typeof routeEvents, "object");
});

test("logistics route events migration creates base schema", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0020_logistics_route_events.sql",
    ),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "route_events"/);
  assert.match(migration, /"clinic_id" integer NOT NULL/);
  assert.match(migration, /"route_plan_id" integer/);
  assert.match(migration, /"route_stop_id" integer/);
  assert.match(migration, /"event_type" varchar\(64\) NOT NULL/);
  assert.match(migration, /"event_time" timestamp NOT NULL/);
  assert.match(migration, /"payload" jsonb/);
  assert.match(migration, /"lat" real/);
  assert.match(migration, /"lng" real/);
  assert.match(migration, /"source" varchar\(32\) DEFAULT 'system' NOT NULL/);
});

test("logistics route events migration creates tenant-first indexes", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0020_logistics_route_events.sql",
    ),
    "utf8",
  );

  assert.match(migration, /route_events_clinic_id_idx/);
  assert.match(migration, /route_events_clinic_event_time_idx/);
  assert.match(migration, /route_events_clinic_route_plan_event_time_idx/);
  assert.match(migration, /route_events_route_stop_event_time_idx/);
  assert.match(migration, /route_events_event_type_idx/);
});

test("logistics route events migration creates ownership foreign keys", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "drizzle",
      "migrations",
      "0020_logistics_route_events.sql",
    ),
    "utf8",
  );

  assert.match(migration, /route_events_clinic_id_clinics_id_fk/);
  assert.match(migration, /route_events_route_plan_id_route_plans_id_fk/);
  assert.match(migration, /route_events_route_stop_id_route_stops_id_fk/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE NO ACTION/);
});

test("logistics route events migration is registered in drizzle journal", () => {
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
    (item) => item.tag === "0020_logistics_route_events",
  );

  assert.ok(entry, "journal must register 0020_logistics_route_events");
  assert.equal(entry?.idx, 20);
});
