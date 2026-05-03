import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SLA_INSTANCE_STATUSES,
  SLA_POLICY_SCOPES,
  SLA_TARGET_TYPES,
  slaInstances,
  slaPolicies,
} from "../drizzle/schema.ts";

function assertNormalizedUniqueValues(
  values: readonly string[],
  label: string,
) {
  const unique = new Set(values);

  assert.equal(unique.size, values.length, `${label} must not repeat values`);

  for (const value of values) {
    assert.equal(typeof value, "string");
    assert.equal(value.trim(), value, `${label} must not contain edge spaces`);
    assert.equal(value.length > 0, true, `${label} must not contain blanks`);
    assert.match(value, /^[a-z_]+$/, `${label} must use snake_case values`);
  }
}

test("SLA policy scopes keep MVP scope contract", () => {
  assert.deepEqual(SLA_POLICY_SCOPES, ["global", "clinic"]);

  assertNormalizedUniqueValues(SLA_POLICY_SCOPES, "SLA_POLICY_SCOPES");
});

test("SLA target types keep MVP target contract", () => {
  assert.deepEqual(SLA_TARGET_TYPES, [
    "field_visit",
    "route_plan",
    "route_stop",
    "study_tracking_case",
  ]);

  assertNormalizedUniqueValues(SLA_TARGET_TYPES, "SLA_TARGET_TYPES");
});

test("SLA instance statuses keep MVP lifecycle contract", () => {
  assert.deepEqual(SLA_INSTANCE_STATUSES, [
    "active",
    "paused",
    "breached",
    "resolved",
    "canceled",
  ]);

  assertNormalizedUniqueValues(
    SLA_INSTANCE_STATUSES,
    "SLA_INSTANCE_STATUSES",
  );
});

test("logistics schema exports SLA policies and instances tables", () => {
  assert.equal(typeof slaPolicies, "object");
  assert.equal(typeof slaInstances, "object");
});

test("logistics SLA migration creates policies and instances base schema", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "drizzle", "migrations", "0021_logistics_sla.sql"),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "sla_policies"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "sla_instances"/);
  assert.match(migration, /"clinic_id" integer/);
  assert.match(migration, /"name" varchar\(255\) NOT NULL/);
  assert.match(migration, /"scope" varchar\(32\) DEFAULT 'global' NOT NULL/);
  assert.match(migration, /"target_type" varchar\(64\) NOT NULL/);
  assert.match(migration, /"due_minutes" integer NOT NULL/);
  assert.match(migration, /"is_active" boolean DEFAULT true NOT NULL/);
  assert.match(migration, /"status" varchar\(32\) DEFAULT 'active' NOT NULL/);
  assert.match(migration, /"target_id" integer NOT NULL/);
  assert.match(migration, /"started_at" timestamp NOT NULL/);
  assert.match(migration, /"due_at" timestamp NOT NULL/);
  assert.match(migration, /"paused_at" timestamp/);
  assert.match(migration, /"breached_at" timestamp/);
  assert.match(migration, /"resolved_at" timestamp/);
  assert.match(migration, /"canceled_at" timestamp/);
  assert.match(migration, /"metadata" jsonb/);
});

test("logistics SLA migration creates validation checks in the correct tables", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "drizzle", "migrations", "0021_logistics_sla.sql"),
    "utf8",
  );

  const policiesStart = migration.indexOf('CREATE TABLE IF NOT EXISTS "sla_policies"');
  const instancesStart = migration.indexOf('CREATE TABLE IF NOT EXISTS "sla_instances"');
  const dueMinutesCheck = migration.indexOf('CHECK ("due_minutes" > 0)');
  const dueAfterStartedCheck = migration.indexOf('CHECK ("due_at" > "started_at")');

  assert.ok(policiesStart >= 0);
  assert.ok(instancesStart > policiesStart);
  assert.ok(dueMinutesCheck > policiesStart);
  assert.ok(dueMinutesCheck < instancesStart);
  assert.ok(dueAfterStartedCheck > instancesStart);
});

test("logistics SLA migration creates tenant-first indexes", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "drizzle", "migrations", "0021_logistics_sla.sql"),
    "utf8",
  );

  assert.match(migration, /sla_policies_clinic_id_idx/);
  assert.match(migration, /sla_policies_scope_target_type_idx/);
  assert.match(migration, /sla_policies_clinic_target_type_idx/);
  assert.match(migration, /sla_policies_active_idx/);
  assert.match(migration, /sla_instances_clinic_id_idx/);
  assert.match(migration, /sla_instances_clinic_status_idx/);
  assert.match(migration, /sla_instances_clinic_due_at_idx/);
  assert.match(migration, /sla_instances_clinic_target_idx/);
  assert.match(migration, /sla_instances_policy_id_idx/);
});

test("logistics SLA migration creates ownership foreign keys", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "drizzle", "migrations", "0021_logistics_sla.sql"),
    "utf8",
  );

  assert.match(migration, /sla_policies_clinic_id_clinics_id_fk/);
  assert.match(migration, /sla_instances_clinic_id_clinics_id_fk/);
  assert.match(migration, /sla_instances_policy_id_sla_policies_id_fk/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE NO ACTION/);
  assert.match(migration, /ON DELETE SET NULL ON UPDATE NO ACTION/);
});

test("logistics SLA migration is registered in drizzle journal", () => {
  const journal = readFileSync(
    resolve(process.cwd(), "drizzle", "migrations", "meta", "_journal.json"),
    "utf8",
  );

  const parsed = JSON.parse(journal) as {
    entries?: Array<{ idx?: number; tag?: string }>;
  };

  const entry = parsed.entries?.find(
    (item) => item.tag === "0021_logistics_sla",
  );

  assert.ok(entry, "journal must register 0021_logistics_sla");
  assert.equal(entry?.idx, 21);
});
