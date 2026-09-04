import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard logistica defines non-indexable metadata and dependencies", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Logística — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  assert.ok(source.includes('import { ClinicFullRouteModuleStage } from "@/components/dashboard/ClinicFullRouteModuleStage";'));
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes('import { LogisticsCommandCenter } from "./LogisticsCommandCenter";'));
});

test("dashboard logistica forwards cookies and disables cache for live reads", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("async function getLogisticsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
});

test("dashboard logistica reads field visits and route plans through API helpers", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("export default async function LogisticaPage()"));
  assert.ok(source.includes("const requestOptions = await getLogisticsRequestOptions();"));
  assert.ok(source.includes("let fieldVisits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];"));
  assert.ok(source.includes("let fieldVisitsLoadError = false;"));
  assert.ok(source.includes("let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];"));
  assert.ok(source.includes("let routePlansLoadError = false;"));
  assert.ok(source.includes("await Promise.all(["));
  assert.ok(source.includes("getLogisticsFieldVisits(requestOptions, {"));
  assert.ok(source.includes("getRoutePlans(requestOptions, {"));
});

test("dashboard logistica computes active visits and active route plans explicitly", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes('<ClinicDashboardShell'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  assert.ok(source.includes("const activeVisits = fieldVisits.filter("));
  assert.ok(source.includes('v.status === "in_progress" || v.status === "scheduled"'));
  assert.ok(source.includes("const activePlans = routePlans.filter("));
  assert.ok(source.includes('p.status === "in_progress" || p.status === "released"'));
});

test("dashboard logistica composes command center in the full-route module stage", () => {
  const source = read(LOGISTICA_PAGE_PATH);
  // A05 (#1649) put the adaptive reservation root and the sticky-action ledger
  // var on this `<main>`; B10 (#B10) moved `<main>` itself into the shared
  // `ClinicDashboardShell`, which the route configures through props. The slice
  // therefore anchors on the shell mount — the element that opens the main
  // region for this route.
  const mainStart = source.indexOf('<ClinicDashboardShell');
  assert.ok(mainStart >= 0, "logistics hub must mount the shared clinic shell");
  assert.ok(
    source.includes("mainAdaptiveReservation"),
    "logistics hub keeps declaring main as the adaptive reservation root",
  );
  const mainSource = source.slice(mainStart);

  assert.ok(source.includes('<ClinicFullRouteModuleStage moduleId="logistica-full">'));
  assert.ok(source.includes("<LogisticsCommandCenter"));
  assert.ok(source.includes("headerActions={"));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaVisitas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaRutas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaMetricas}"));

  const order = [
    "<ClinicFullRouteModuleStage",
    "<LogisticsCommandCenter",
  ].map((marker) => mainSource.indexOf(marker));

  for (const index of order) {
    assert.ok(index >= 0, `main source must contain ordered marker at index ${index}`);
  }

  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    "logistics hub order must be: stage, command center",
  );
});

test("dashboard logistica passes all data props to LogisticsCommandCenter", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("fieldVisits={fieldVisits}"));
  assert.ok(source.includes("routePlans={routePlans}"));
  assert.ok(source.includes("fieldVisitsLoadError={fieldVisitsLoadError}"));
  assert.ok(source.includes("routePlansLoadError={routePlansLoadError}"));
});

test("dashboard logistica avoids direct client-side fetch literals", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes('"/api"'), false);
});

test("dashboard logistica does not use next/link or bare anchor tags for navigation", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('import Link from \'next/link\''), false);
  assert.equal(source.includes('<a href='), false);
});

test("dashboard logistica permits the dashboard route control but no public surface, middleware or auth", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(
    source.includes('@/components/public/') &&
      !source.includes('"@/components/public/PublicRouteControl"'),
    false,
  );
  assert.ok(source.includes('PublicRouteControl'));
  assert.equal(source.includes('from "next-auth"'), false);
  assert.equal(source.includes('middleware'), false);
});

test("dashboard logistica scope stays inside frontend dashboard", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(source.includes('from "@/app/api'), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("revalidatePath"), false);
  assert.equal(source.includes("revalidateTag"), false);
  assert.equal(source.includes("border-gray-100"), false);
  assert.equal(source.includes("border-gray-50"), false);
  assert.equal(source.includes("🚐"), false);
  assert.equal(source.includes("🗺"), false);
  assert.equal(source.includes("📊"), false);
});
