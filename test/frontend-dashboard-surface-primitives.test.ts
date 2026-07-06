import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SURFACE_BADGE_PATH =
  "frontend/src/features/dashboard/presentation/surfaces/DashboardStatusBadge.tsx";
const SURFACES_INDEX_PATH =
  "frontend/src/features/dashboard/presentation/surfaces/index.ts";
const STATUS_BADGE_PATH = "frontend/src/components/dashboard/StatusBadge.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("PR-PRES-5 surfaces boundary re-exports StatusBadge from the canonical primitive", () => {
  const source = read(SURFACE_BADGE_PATH);

  assert.ok(
    source.includes(
      'from "@/components/dashboard/StatusBadge"',
    ),
    "DashboardStatusBadge must re-export from the canonical StatusBadge primitive",
  );
  assert.ok(
    source.includes("StatusBadge,"),
    "surfaces entry must expose the StatusBadge component",
  );
  assert.ok(
    source.includes("type StatusBadgeProps,"),
    "surfaces entry must expose the StatusBadgeProps type",
  );
});

test("PR-PRES-5 surfaces re-export does not reimplement the primitive or reach data layer", () => {
  const source = read(SURFACE_BADGE_PATH);

  // Pure re-export: no local component definition, no direct data-layer import.
  assert.equal(source.includes("function StatusBadge("), false);
  assert.equal(source.includes('from "@/lib/api"'), false);
});

test("PR-PRES-5 surfaces barrel wires the StatusBadge entry", () => {
  const source = read(SURFACES_INDEX_PATH);

  assert.ok(source.includes('export * from "./DashboardStatusBadge";'));
});

test("PR-PRES-5 canonical StatusBadge stays in place (re-export target preserved)", () => {
  const source = read(STATUS_BADGE_PATH);

  assert.ok(source.includes("export function StatusBadge("));
  assert.ok(source.includes("export type StatusBadgeProps = {"));
});
