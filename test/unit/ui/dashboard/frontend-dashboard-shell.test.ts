import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_LAYOUT_PATH = "frontend/src/app/dashboard/layout.tsx";
const PRIVATE_DASHBOARD_SHELL_PATH =
  "frontend/src/components/dashboard/PrivateDashboardShell.tsx";
const DASHBOARD_SHELL_ROUTER_PATH =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard layout delegates private shell composition to private dashboard shell", () => {
  const source = read(DASHBOARD_LAYOUT_PATH);

  assert.ok(source.includes('import { PrivateDashboardShell } from "@/components/dashboard/PrivateDashboardShell";'));
  assert.ok(source.includes("export default function DashboardLayout"));
  assert.ok(source.includes("children: React.ReactNode;"));
  assert.ok(source.includes("<PrivateDashboardShell>{children}</PrivateDashboardShell>"));
});

test("private dashboard shell keeps children and delegates role routing to dashboard shell router", () => {
  const source = read(PRIVATE_DASHBOARD_SHELL_PATH);

  assert.ok(source.includes('import type { ReactNode } from "react";'));
  assert.ok(source.includes('import { DashboardShellRouter } from "./DashboardShellRouter";'));
  assert.ok(source.includes("export type PrivateDashboardShellProps"));
  assert.ok(source.includes("children: ReactNode;"));
  assert.ok(source.includes("export function PrivateDashboardShell({"));
  assert.ok(source.includes("<DashboardShellRouter>{children}</DashboardShellRouter>"));
});

test("dashboard shell router renders a no-sidebar horizontal app shell column", () => {
  const source = read(DASHBOARD_SHELL_ROUTER_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { useSelectedLayoutSegment } from "next/navigation";'));
  assert.ok(source.includes("const selectedSegment = useSelectedLayoutSegment();"));
  assert.ok(source.includes('const isAdminDashboard = selectedSegment === "admin";'));
  assert.ok(source.includes("data-vetneb-app-shell-surface={surface}"));

  // PR-2: the vertical sidebar is no longer the primary navigation; the shell is
  // a full-width vertical column that reserves no lateral aside.
  assert.ok(source.includes("flex flex-col h-dvh overflow-hidden"));
  assert.equal(source.includes("<AdminDashboardSidebar />"), false);
  assert.equal(source.includes("<ClinicDashboardSidebar />"), false);
});
