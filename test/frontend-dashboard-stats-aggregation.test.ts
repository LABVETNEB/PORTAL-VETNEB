import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend API client builds dashboard stats from live read helpers", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getDashboardStats("));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<DashboardStats>"));
  assert.ok(source.includes("const [reports, visits, routePlans] = await Promise.all(["));
  assert.ok(source.includes("getReports(options, undefined, { throwOnError: true }),"));
  assert.ok(source.includes("getLogisticsFieldVisits(options, { throwOnError: true }),"));
  assert.ok(source.includes("getRoutePlans(options, { throwOnError: true }),"));
});

test("frontend dashboard stats aggregate report counters explicitly", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("totalReports: reports.length,"));
  assert.ok(source.includes('pendingReports: reports.filter((report) => report.status !== "delivered")'));
  assert.ok(source.includes(".length,"));
});

test("frontend dashboard stats aggregate active logistics counters explicitly", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("activeVisits: visits.filter("));
  assert.ok(source.includes('visit.status === "scheduled" || visit.status === "in_progress",'));
  assert.ok(source.includes("activePlans: routePlans.filter("));
  assert.ok(source.includes('plan.status === "released" || plan.status === "in_progress",'));
});

test("frontend dashboard stats helper remains typed around dashboard snapshot", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("DashboardStats,"));
  assert.ok(source.includes("Promise<DashboardStats>"));
  assert.ok(source.includes("totalReports:"));
  assert.ok(source.includes("pendingReports:"));
  assert.ok(source.includes("activeVisits:"));
  assert.ok(source.includes("activePlans:"));
});
