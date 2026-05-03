import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import * as schema from "../drizzle/schema.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const schemaPath = path.join(repoRoot, "drizzle", "schema.ts");
const migrationsRoot = path.join(repoRoot, "drizzle");
const testDir = path.join(repoRoot, "test");
const currentTestFile = path.normalize(__filename);

const expectedEnumExports = [
  "FIELD_VISIT_SOURCE_TYPES",
  "FIELD_VISIT_STATUSES",
  "VISIT_LOCATION_GEO_QUALITIES",
  "ROUTE_PLAN_STATUSES",
  "ROUTE_PLANNING_MODES",
  "ROUTE_PLAN_OBJECTIVES",
  "ROUTE_PLAN_CREATED_BY_TYPES",
  "ROUTE_STOP_STATUSES",
  "ROUTE_EVENT_TYPES",
  "ROUTE_EVENT_SOURCES",
  "SLA_POLICY_SCOPES",
  "SLA_TARGET_TYPES",
  "SLA_INSTANCE_STATUSES",
] as const;

const expectedTypeExports = [
  "FieldVisitSourceType",
  "FieldVisitStatus",
  "VisitLocationGeoQuality",
  "RoutePlanStatus",
  "RoutePlanningMode",
  "RoutePlanObjective",
  "RoutePlanCreatedByType",
  "RouteStopStatus",
  "RouteEventType",
  "RouteEventSource",
  "RouteEventPayload",
  "SlaPolicyScope",
  "SlaTargetType",
  "SlaInstanceStatus",
] as const;

const expectedTableExports = [
  { exportName: "fieldVisits", tableName: "field_visits" },
  { exportName: "visitLocations", tableName: "visit_locations" },
  { exportName: "timeWindows", tableName: "time_windows" },
  { exportName: "routePlans", tableName: "route_plans" },
  { exportName: "routeStops", tableName: "route_stops" },
  { exportName: "routeEvents", tableName: "route_events" },
  { exportName: "slaPolicies", tableName: "sla_policies" },
  { exportName: "slaInstances", tableName: "sla_instances" },
] as const;

const expectedMigrationPrefixes = ["0017", "0018", "0019", "0020", "0021"] as const;

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(entryPath);
      }

      return [entryPath];
    }),
  );

  return files.flat();
}

function assertSourceIncludes(source: string, needle: string): void {
  assert.ok(source.includes(needle), `Expected source to include ${needle}`);
}

test("logistics schema exports remain available from drizzle/schema.ts", () => {
  for (const exportName of expectedEnumExports) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(schema, exportName),
      `Expected schema runtime export ${exportName}`,
    );
  }

  for (const { exportName } of expectedTableExports) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(schema, exportName),
      `Expected schema table export ${exportName}`,
    );
  }
});

test("logistics enum literal suites remain complete", () => {
  assert.deepEqual(schema.FIELD_VISIT_SOURCE_TYPES, [
    "report",
    "study_tracking_case",
    "manual",
  ]);

  assert.deepEqual(schema.FIELD_VISIT_STATUSES, [
    "pending",
    "scheduled",
    "in_progress",
    "done",
    "canceled",
    "no_show",
  ]);

  assert.deepEqual(schema.VISIT_LOCATION_GEO_QUALITIES, [
    "exact",
    "approx",
    "missing",
    "ambiguous",
  ]);

  assert.deepEqual(schema.ROUTE_PLAN_STATUSES, [
    "draft",
    "planned",
    "released",
    "in_progress",
    "completed",
    "canceled",
  ]);

  assert.deepEqual(schema.ROUTE_PLANNING_MODES, ["manual", "heuristic"]);

  assert.deepEqual(schema.ROUTE_PLAN_OBJECTIVES, ["distance", "time", "sla"]);

  assert.deepEqual(schema.ROUTE_PLAN_CREATED_BY_TYPES, [
    "system",
    "admin",
    "clinic",
  ]);

  assert.deepEqual(schema.ROUTE_STOP_STATUSES, [
    "pending",
    "arrived",
    "departed",
    "skipped",
    "done",
    "no_show",
    "canceled",
  ]);

  assert.deepEqual(schema.ROUTE_EVENT_TYPES, [
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

  assert.deepEqual(schema.ROUTE_EVENT_SOURCES, [
    "system",
    "admin",
    "clinic",
    "mobile",
  ]);

  assert.deepEqual(schema.SLA_POLICY_SCOPES, ["global", "clinic"]);

  assert.deepEqual(schema.SLA_TARGET_TYPES, [
    "field_visit",
    "route_plan",
    "route_stop",
    "study_tracking_case",
  ]);

  assert.deepEqual(schema.SLA_INSTANCE_STATUSES, [
    "active",
    "paused",
    "breached",
    "resolved",
    "canceled",
  ]);
});

test("logistics schema declarations remain present in source", async () => {
  const source = await readFile(schemaPath, "utf8");

  for (const typeName of expectedTypeExports) {
    assertSourceIncludes(source, `export type ${typeName}`);
  }

  for (const { exportName, tableName } of expectedTableExports) {
    assertSourceIncludes(source, `export const ${exportName}`);
    assertSourceIncludes(source, `"${tableName}"`);
  }
});

test("logistics migrations 0017 through 0021 remain present and cover the schema suite", async () => {
  const migrationFiles = (await walkFiles(migrationsRoot))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  const migrationBaseNames = migrationFiles.map((fileName) =>
    path.basename(fileName),
  );

  for (const prefix of expectedMigrationPrefixes) {
    assert.ok(
      migrationBaseNames.some((fileName) => fileName.startsWith(prefix)),
      `Expected migration file with prefix ${prefix}`,
    );
  }

  const logisticsMigrationFiles = migrationFiles.filter((fileName) => {
    const baseName = path.basename(fileName);

    return expectedMigrationPrefixes.some((prefix) =>
      baseName.startsWith(prefix),
    );
  });

  const migrationSources = await Promise.all(
    logisticsMigrationFiles.map((fileName) => readFile(fileName, "utf8")),
  );

  const combinedMigrationSource = migrationSources.join("\n");

  for (const { tableName } of expectedTableExports) {
    assertSourceIncludes(combinedMigrationSource, tableName);
  }
});

test("pre-existing native logistics schema tests remain in the suite", async () => {
  const testFiles = (await walkFiles(testDir))
    .filter((fileName) => fileName.endsWith(".test.ts"))
    .filter((fileName) => path.normalize(fileName) !== currentTestFile);

  const testSources = await Promise.all(
    testFiles.map((fileName) => readFile(fileName, "utf8")),
  );

  const combinedTestSource = testSources.join("\n");

  for (const { exportName } of expectedTableExports) {
    assertSourceIncludes(combinedTestSource, exportName);
  }
});
