import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HERO_PATH = "frontend/src/components/dashboard/DashboardHubHero.tsx";
const HUB_PATH = "frontend/src/components/dashboard/DashboardModuleHub.tsx";
const CLINIC_CONTROLLER_PATH =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const ADMIN_CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── Hero component: presentational and accessible ────────────────────────────

test("DashboardHubHero exports a typed presentational hero component", () => {
  const source = read(HERO_PATH);

  assert.ok(source.includes("export type DashboardHubHeroProps"));
  assert.ok(source.includes("export type DashboardHubHeroMetric"));
  assert.ok(source.includes("export type DashboardHubHeroStatusTone"));
  assert.ok(source.includes("export function DashboardHubHero("));
  assert.ok(source.includes('variant: "clinic" | "admin";'));
  assert.ok(source.includes("metrics: DashboardHubHeroMetric[];"));
});

test("DashboardHubHero keeps hub-hero landmark, heading id and metric/action contracts", () => {
  const source = read(HERO_PATH);

  assert.ok(source.includes("data-dashboard-hub-hero={variant}"));
  assert.ok(source.includes('aria-labelledby="dashboard-hub-hero-title"'));
  assert.ok(source.includes('id="dashboard-hub-hero-title"'));
  assert.ok(source.includes("metrics.map((metric) =>"));
  assert.ok(source.includes("onClick={onPrimaryAction}"));
  assert.ok(source.includes("focus-visible:ring-2"));
});

test("DashboardHubHero does not fetch data or import server/public surfaces", () => {
  const source = read(HERO_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes('from "@/lib/api"'), false);
  assert.equal(source.includes('from "@/app/api'), false);
  assert.equal(source.includes('from "next/headers"'), false);
  assert.equal(source.includes("@/components/public/"), false);
  assert.equal(source.toLowerCase().includes("middleware"), false);
});

test("DashboardHubHero stores or renders no sensitive identifiers", () => {
  const source = read(HERO_PATH).toLowerCase();

  for (const forbidden of [
    "session",
    "auth",
    "cookie",
    "token",
    "password",
    "secret",
    "jwt",
    "bearer",
    "hash",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `hero must not reference ${forbidden}`,
    );
  }
});

// ── Module hub: optional hero slot above cards ───────────────────────────────

test("DashboardModuleHub accepts an optional hero slot and keeps module-card contracts", () => {
  const source = read(HUB_PATH);

  assert.ok(source.includes("hero?: ReactNode;"));
  assert.ok(source.includes("hero,"));
  assert.ok(source.includes("{hero ? <div>{hero}</div> : null}"));
  assert.ok(source.includes('data-dashboard-module-hub="true"'));
  assert.ok(source.includes("data-dashboard-module-card={card.moduleId}"));
});

// ── Clinic controller wiring ─────────────────────────────────────────────────

test("clinic controller renders a clinic hero with live operational metrics", () => {
  const source = read(CLINIC_CONTROLLER_PATH);

  assert.ok(source.includes('import { DashboardHubHero } from "./DashboardHubHero";'));
  assert.ok(source.includes('variant="clinic"'));
  assert.ok(source.includes("value: pendingReports,"));
  assert.ok(source.includes("value: activeVisits,"));
  assert.ok(source.includes('onPrimaryAction={() => activateModule("operaciones")}'));
  assert.ok(source.includes("hero={clinicHero}"));
  assert.equal(source.includes('variant="admin"'), false);
});

// ── Admin controller wiring ──────────────────────────────────────────────────

test("admin controller renders an admin control hero with audit metrics and system status", () => {
  const source = read(ADMIN_CONTROLLER_PATH);

  assert.ok(source.includes('import { DashboardHubHero } from "@/components/dashboard/DashboardHubHero";'));
  assert.ok(source.includes('variant="admin"'));
  assert.ok(source.includes("auditEntriesCount: number;"));
  assert.ok(source.includes("eventTypesCount: number;"));
  assert.ok(source.includes("value: auditEntriesCount,"));
  assert.ok(source.includes("value: eventTypesCount,"));
  assert.ok(source.includes("statusLabel={systemStatusLabel}"));
  assert.ok(source.includes('onPrimaryAction={() => activateModule("admin")}'));
  assert.ok(source.includes("hero={adminHero}"));
  assert.equal(source.includes('variant="clinic"'), false);
});

test("admin page forwards live audit counts to the workspace controller", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes("auditEntriesCount={auditEntries.length}"));
  assert.ok(source.includes("eventTypesCount={Object.keys(eventCounts).length}"));
});

// ── Scope invariant: no new dependency surfaced by this feature ──────────────

test("hero feature does not register itself as a dependency", () => {
  const rootPkg = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  const frontendPkg = readFileSync(
    resolve(process.cwd(), "frontend/package.json"),
    "utf8",
  );

  assert.equal(rootPkg.includes("DashboardHubHero"), false);
  assert.equal(frontendPkg.includes("DashboardHubHero"), false);
});
