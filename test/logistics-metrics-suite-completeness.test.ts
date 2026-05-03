import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("logistics metrics suite keeps required test files", () => {
  const requiredTestFiles = [
    "test/logistics-metrics.test.ts",
    "test/logistics-sla-compliance.test.ts",
    "test/logistics-route-event-aggregation.test.ts",
  ];

  for (const file of requiredTestFiles) {
    assert.equal(existsSync(resolve(repoRoot, file)), true, `${file} must exist`);
  }
});

test("logistics metrics suite keeps route compliance coverage", () => {
  const testFile = readRepoFile("test/logistics-metrics.test.ts");

  const requiredCoverage = [
    "calculateRouteDistanceCompliance",
    "calculateKmPerCompletedVisit",
    "classifyTimeWindowCompliance",
    "summarizeWindowCompliance",
    "calculateBasicRouteComplianceMetrics",
  ];

  for (const symbol of requiredCoverage) {
    assert.match(testFile, new RegExp(symbol), `${symbol} must stay covered`);
  }
});

test("logistics metrics suite keeps SLA compliance coverage", () => {
  const testFile = readRepoFile("test/logistics-sla-compliance.test.ts");

  const requiredCoverage = [
    "classifySlaCompliance",
    "summarizeSlaCompliance",
    "active",
    "paused",
    "breached",
    "resolved",
    "canceled",
    "missing_due_date",
  ];

  for (const marker of requiredCoverage) {
    assert.match(testFile, new RegExp(marker), `${marker} must stay covered`);
  }
});

test("logistics metrics suite keeps route event aggregation coverage", () => {
  const testFile = readRepoFile("test/logistics-route-event-aggregation.test.ts");

  const requiredCoverage = [
    "summarizeRouteEvents",
    "getRouteEventBoundariesByRoutePlan",
    "getRouteEventBoundariesByRouteStop",
    "calculateDurationBetweenRouteEvents",
    "route.started",
    "route.completed",
    "stop.arrived",
    "stop.departed",
  ];

  for (const marker of requiredCoverage) {
    assert.match(testFile, new RegExp(marker), `${marker} must stay covered`);
  }
});

test("logistics metrics module keeps public helper exports", () => {
  const metricsFile = readRepoFile("server/lib/logistics/metrics.ts");

  const requiredExports = [
    "export function calculateBasicRouteComplianceMetrics",
    "export function classifySlaCompliance",
    "export function summarizeSlaCompliance",
    "export function summarizeRouteEvents",
    "export function getRouteEventBoundariesByRoutePlan",
    "export function getRouteEventBoundariesByRouteStop",
    "export function calculateDurationBetweenRouteEvents",
  ];

  for (const exportedSymbol of requiredExports) {
    assert.match(
      metricsFile,
      new RegExp(exportedSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${exportedSymbol} must stay exported`,
    );
  }
});
