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


test("logistics DB helpers expose tenant-scoped route plan operations", () => {
  assert.match(dbLogisticsSource, /export type CreateRoutePlanInput/);
  assert.match(dbLogisticsSource, /export type ListRoutePlansParams/);
  assert.match(dbLogisticsSource, /export async function createRoutePlan/);
  assert.match(dbLogisticsSource, /export async function getClinicScopedRoutePlan/);
  assert.match(dbLogisticsSource, /export async function listClinicRoutePlans/);
  assert.match(dbLogisticsSource, /export async function updateClinicScopedRoutePlan/);

  assert.match(dbLogisticsSource, /eq\(routePlans\.clinicId, clinicId\)/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.clinicId, params\.clinicId\)/);
  assert.match(dbLogisticsSource, /orderBy\(desc\(routePlans\.serviceDate\), desc\(routePlans\.id\)\)/);
});

test("logistics DB helpers expose clinic-owned route stop operations", () => {
  assert.match(dbLogisticsSource, /export type CreateRouteStopInput/);
  assert.match(dbLogisticsSource, /export type UpdateRouteStopInput/);
  assert.match(dbLogisticsSource, /export async function createRouteStopForClinicRoutePlan/);
  assert.match(dbLogisticsSource, /export async function listRouteStopsForClinicRoutePlan/);
  assert.match(dbLogisticsSource, /export async function updateClinicScopedRouteStop/);
});

test("logistics DB helpers verify clinic ownership before route stop writes", () => {
  assert.match(dbLogisticsSource, /db\.transaction\(async \(tx\) =>/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.id, input\.routePlanId\)/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.clinicId, input\.clinicId\)/);
  assert.match(dbLogisticsSource, /eq\(fieldVisits\.id, input\.fieldVisitId\)/);
  assert.match(dbLogisticsSource, /eq\(fieldVisits\.clinicId, input\.clinicId\)/);
  assert.match(dbLogisticsSource, /return undefined/);
});

test("logistics DB helpers keep route stops clinic scoped through route plans", () => {
  assert.match(dbLogisticsSource, /innerJoin\(\s*routePlans,\s*eq\(routeStops\.routePlanId, routePlans\.id\),\s*\)/);
  assert.match(dbLogisticsSource, /eq\(routeStops\.routePlanId, routePlanId\)/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.clinicId, clinicId\)/);
  assert.match(dbLogisticsSource, /eq\(routeStops\.id, id\)/);
});


test("logistics DB helpers define guarded route plan lifecycle transitions", () => {
  assert.match(dbLogisticsSource, /export const ROUTE_PLAN_LIFECYCLE_ACTIONS/);
  assert.match(dbLogisticsSource, /export const ROUTE_PLAN_LIFECYCLE_TRANSITIONS/);
  assert.match(dbLogisticsSource, /release:\s*{\s*from: \["draft", "planned"\],\s*to: "released"/);
  assert.match(dbLogisticsSource, /start:\s*{\s*from: \["released"\],\s*to: "in_progress"/);
  assert.match(dbLogisticsSource, /complete:\s*{\s*from: \["in_progress"\],\s*to: "completed"/);
  assert.match(dbLogisticsSource, /cancel:\s*{\s*from: \["draft", "planned", "released", "in_progress"\],\s*to: "canceled"/);
});

test("logistics DB helpers transition route plan status only inside clinic scope", () => {
  assert.match(dbLogisticsSource, /export async function transitionClinicScopedRoutePlanStatus/);
  assert.match(dbLogisticsSource, /db\.transaction\(async \(tx\) =>/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.id, id\)/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.clinicId, clinicId\)/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.status, routePlan\.status\)/);
  assert.match(dbLogisticsSource, /reason: "invalid_transition"/);
  assert.match(dbLogisticsSource, /reason: "not_found"/);
});


test("logistics DB helpers expose route event append-only operations", () => {
  assert.match(dbLogisticsSource, /export type CreateRouteEventInput/);
  assert.match(dbLogisticsSource, /export type ListRouteEventsParams/);
  assert.match(dbLogisticsSource, /export async function createRouteEvent/);
  assert.match(dbLogisticsSource, /export async function listClinicRouteEvents/);
  assert.match(dbLogisticsSource, /export async function listRouteEventsForClinicRoutePlan/);
  assert.match(dbLogisticsSource, /export async function listIncrementalClinicRouteEvents/);
});

test("logistics DB helpers verify clinic ownership before route event writes", () => {
  assert.match(dbLogisticsSource, /eq\(routePlans\.id, input\.routePlanId\)/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.clinicId, input\.clinicId\)/);
  assert.match(dbLogisticsSource, /innerJoin\(\s*routePlans,\s*eq\(routeStops\.routePlanId, routePlans\.id\),\s*\)/);
  assert.match(dbLogisticsSource, /eq\(routeStops\.id, input\.routeStopId\)/);
  assert.match(dbLogisticsSource, /eq\(routePlans\.clinicId, input\.clinicId\)/);
  assert.match(dbLogisticsSource, /return undefined/);
});

test("logistics DB helpers keep route event reads clinic scoped and incremental", () => {
  assert.match(dbLogisticsSource, /eq\(routeEvents\.clinicId, params\.clinicId\)/);
  assert.match(dbLogisticsSource, /gt\(routeEvents\.id, params\.afterId\)/);
  assert.match(dbLogisticsSource, /orderBy\(asc\(routeEvents\.id\)\)/);
  assert.match(dbLogisticsSource, /normalizeLogisticsLimit\(params\.limit\)/);
  assert.match(dbLogisticsSource, /listClinicRouteEvents\(\{\s*clinicId,\s*afterId,\s*limit,\s*offset: 0,\s*\}\)/);
});

test("logistics DB helpers support route event route-plan scoped reads", () => {
  assert.match(dbLogisticsSource, /const routePlan = await getClinicScopedRoutePlan\(routePlanId, clinicId\)/);
  assert.match(dbLogisticsSource, /if \(!routePlan\) \{\s*return \[\];\s*\}/);
  assert.match(dbLogisticsSource, /routePlanId,/);
});

test("logistics DB helpers generate heuristic route plans transactionally", () => {
  assert.match(dbLogisticsSource, /buildHeuristicRoutePlan/);
  assert.match(dbLogisticsSource, /export type GenerateHeuristicRoutePlanInput/);
  assert.match(dbLogisticsSource, /export type GenerateHeuristicRoutePlanResult/);
  assert.match(dbLogisticsSource, /export async function generateHeuristicRoutePlan/);
  assert.match(dbLogisticsSource, /normalizeGenerateHeuristicFieldVisitIds/);
  assert.match(dbLogisticsSource, /inArray\(fieldVisits\.id, fieldVisitIds\)/);
  assert.match(dbLogisticsSource, /leftJoin\(\s*visitLocations,\s*eq\(visitLocations\.fieldVisitId, fieldVisits\.id\),\s*\)/);
  assert.match(dbLogisticsSource, /inArray\(timeWindows\.fieldVisitId, fieldVisitIds\)/);
  assert.match(dbLogisticsSource, /planningMode: "heuristic"/);
  assert.match(dbLogisticsSource, /status: "planned"/);
  assert.match(dbLogisticsSource, /tx\s*\.\s*insert\(routePlans\)/);
  assert.match(dbLogisticsSource, /tx\s*\.\s*insert\(routeStops\)/);
});

test("logistics DB heuristic generation reports invalid clinic-scoped inputs without partial writes", () => {
  assert.match(dbLogisticsSource, /reason: "no_visits"/);
  assert.match(dbLogisticsSource, /reason: "field_visits_not_found"/);
  assert.match(dbLogisticsSource, /missingFieldVisitIds/);
  assert.match(dbLogisticsSource, /reason: "route_plan_not_created"/);
});

test("logistics DB helpers expose tenant-scoped SLA read helpers", () => {
  assert.ok(dbLogisticsSource.includes("export type ListActiveClinicSlaPoliciesParams"));
  assert.ok(dbLogisticsSource.includes("export type ListClinicSlaInstancesParams"));
  assert.ok(dbLogisticsSource.includes("export type SlaPolicy = typeof slaPolicies.$inferSelect"));
  assert.ok(dbLogisticsSource.includes("export type SlaInstance = typeof slaInstances.$inferSelect"));
  assert.ok(dbLogisticsSource.includes("export async function listActiveClinicSlaPolicies"));
  assert.ok(dbLogisticsSource.includes("export async function listClinicSlaInstances"));
});

test("logistics DB SLA reads stay clinic scoped, active and paginated", () => {
  assert.ok(dbLogisticsSource.includes("eq(slaPolicies.isActive, true)"));
  assert.ok(dbLogisticsSource.includes("eq(slaPolicies.clinicId, params.clinicId)"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.clinicId, params.clinicId)"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.status, params.status)"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.targetType, params.targetType)"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.targetId, params.targetId)"));
  assert.ok(dbLogisticsSource.includes("normalizeLogisticsLimit(params.limit)"));
  assert.ok(dbLogisticsSource.includes("normalizeLogisticsOffset(params.offset)"));
  assert.ok(dbLogisticsSource.includes("orderBy(asc(slaInstances.dueAt), asc(slaInstances.id))"));
});

test("logistics DB helpers expose tenant-scoped SLA summary helper", () => {
  assert.ok(dbLogisticsSource.includes("export type ClinicSlaSummary = {"));
  assert.ok(dbLogisticsSource.includes("export async function getClinicSlaSummary"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.clinicId, clinicId)"));
  assert.ok(dbLogisticsSource.includes("groupBy(slaInstances.status)"));
  assert.ok(dbLogisticsSource.includes("sql<number>\`cast(count(*) as int)\`"));
});

test("logistics DB SLA summary returns all known status buckets", () => {
  assert.ok(dbLogisticsSource.includes("total: 0"));
  assert.ok(dbLogisticsSource.includes("active: 0"));
  assert.ok(dbLogisticsSource.includes("paused: 0"));
  assert.ok(dbLogisticsSource.includes("breached: 0"));
  assert.ok(dbLogisticsSource.includes("resolved: 0"));
  assert.ok(dbLogisticsSource.includes("canceled: 0"));
  assert.ok(dbLogisticsSource.includes("summary.total += count"));
  assert.ok(dbLogisticsSource.includes("summary[row.status] = count"));
});

test("logistics DB helpers expose overdue active SLA instance reads", () => {
  assert.ok(dbLogisticsSource.includes("export type ListOverdueActiveClinicSlaInstancesParams"));
  assert.ok(dbLogisticsSource.includes("export async function listOverdueActiveClinicSlaInstances"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.clinicId, params.clinicId)"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.status, \"active\")"));
  assert.ok(dbLogisticsSource.includes("lte(slaInstances.dueAt, params.dueAtOrBefore)"));
});

test("logistics DB overdue SLA reads stay paginated, deterministic and optionally target-scoped", () => {
  assert.ok(dbLogisticsSource.includes("normalizeLogisticsLimit(params.limit)"));
  assert.ok(dbLogisticsSource.includes("normalizeLogisticsOffset(params.offset)"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.targetType, params.targetType)"));
  assert.ok(dbLogisticsSource.includes("orderBy(asc(slaInstances.dueAt), asc(slaInstances.id))"));
});

test("logistics DB helpers expose SLA breach marking helper", () => {
  assert.ok(dbLogisticsSource.includes("export type MarkOverdueActiveClinicSlaInstancesBreachedParams"));
  assert.ok(dbLogisticsSource.includes("export async function markOverdueActiveClinicSlaInstancesBreached"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.clinicId, params.clinicId)"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.status, \"active\")"));
  assert.ok(dbLogisticsSource.includes("lte(slaInstances.dueAt, params.dueAtOrBefore)"));
});

test("logistics DB SLA breach marking updates only overdue active instances", () => {
  assert.ok(dbLogisticsSource.includes("status: \"breached\""));
  assert.ok(dbLogisticsSource.includes("breachedAt: params.breachedAt"));
  assert.ok(dbLogisticsSource.includes("updatedAt: params.breachedAt"));
  assert.ok(dbLogisticsSource.includes("eq(slaInstances.targetType, params.targetType)"));
  assert.ok(dbLogisticsSource.includes(".update(slaInstances)"));
  assert.ok(dbLogisticsSource.includes(".returning()"));
});
