import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbLogisticsSource = readFileSync(
  resolve(process.cwd(), "server", "db-logistics.ts"),
  "utf8",
);

test("logistics DB helpers define bounded pagination defaults", () => {
  assert.match(dbLogisticsSource, /export const LOGISTICS_DEFAULT_LIMIT = 50/);
  assert.match(dbLogisticsSource, /export const LOGISTICS_MAX_LIMIT = 100/);
  assert.match(dbLogisticsSource, /export function normalizeLogisticsLimit/);
  assert.match(dbLogisticsSource, /export function normalizeLogisticsOffset/);
  assert.match(dbLogisticsSource, /Math\.min\(value, maxLimit\)/);
  assert.match(dbLogisticsSource, /return 0/);
});

test("logistics DB helpers expose tenant-scoped field visit operations", () => {
  assert.match(dbLogisticsSource, /export async function createFieldVisit/);
  assert.match(dbLogisticsSource, /export async function getFieldVisitById/);
  assert.match(dbLogisticsSource, /export async function getClinicScopedFieldVisit/);
  assert.match(dbLogisticsSource, /export async function listClinicFieldVisits/);
  assert.match(dbLogisticsSource, /export async function updateClinicScopedFieldVisit/);

  assert.match(dbLogisticsSource, /eq\(fieldVisits\.clinicId, clinicId\)/);
  assert.match(dbLogisticsSource, /eq\(fieldVisits\.clinicId, params\.clinicId\)/);
});

test("logistics DB helpers enforce clinic ownership before location writes", () => {
  assert.match(dbLogisticsSource, /export async function upsertVisitLocationForClinicVisit/);
  assert.match(dbLogisticsSource, /export async function getVisitLocationForClinicVisit/);
  assert.match(dbLogisticsSource, /db\.transaction\(async \(tx\) =>/);
  assert.match(dbLogisticsSource, /eq\(fieldVisits\.id, input\.fieldVisitId\)/);
  assert.match(dbLogisticsSource, /eq\(fieldVisits\.clinicId, input\.clinicId\)/);
  assert.match(dbLogisticsSource, /return undefined/);
});

test("logistics DB helpers enforce clinic ownership before time-window writes", () => {
  assert.match(dbLogisticsSource, /export async function createTimeWindowForClinicVisit/);
  assert.match(dbLogisticsSource, /export async function listTimeWindowsForClinicVisit/);
  assert.match(dbLogisticsSource, /eq\(timeWindows\.fieldVisitId, fieldVisitId\)/);
  assert.match(dbLogisticsSource, /eq\(fieldVisits\.clinicId, clinicId\)/);
});

test("logistics DB helpers keep time-window validation centralized", () => {
  assert.match(dbLogisticsSource, /assertValidTimeWindowRange\(input\.windowStart, input\.windowEnd\)/);
  assert.match(dbLogisticsSource, /normalizeTimeWindowTimezone\(input\.timezone\)/);
});

test("logistics DB helpers keep field visit queries paginated and deterministic", () => {
  assert.match(dbLogisticsSource, /normalizeLogisticsLimit\(params\.limit\)/);
  assert.match(dbLogisticsSource, /normalizeLogisticsOffset\(params\.offset\)/);
  assert.match(dbLogisticsSource, /orderBy\(desc\(fieldVisits\.createdAt\), desc\(fieldVisits\.id\)\)/);
});
