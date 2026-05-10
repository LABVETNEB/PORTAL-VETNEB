import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_TOPBAR_PATH = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const STATS_CARDS_PATH = "frontend/src/components/dashboard/StatsCards.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard topbar keeps route-registry logout action and UI dependencies", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("<Link href={ROUTES.login}>Cerrar sesión</Link>"));
  assert.equal(source.includes('href="/login"'), false);
});

test("dashboard topbar keeps typed title and optional subtitle props", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes("interface DashboardTopbarProps"));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("subtitle?: string;"));
  assert.ok(source.includes("export function DashboardTopbar({ title, subtitle }: DashboardTopbarProps)"));
  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{subtitle && ("));
  assert.ok(source.includes("{subtitle}"));
});

test("dashboard topbar keeps protected dashboard header shell", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes('<header className="sticky top-0 z-40'));
  assert.ok(source.includes("Clínica Demo"));
  assert.ok(source.includes("CL"));
  assert.ok(source.includes('<Button asChild variant="outline" size="sm">'));
});

test("stats cards keep DashboardStats typing and UI dependencies", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes('import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";'));
  assert.ok(source.includes('import { Skeleton } from "@/components/ui/skeleton";'));
  assert.ok(source.includes('import type { DashboardStats } from "@/types";'));
  assert.ok(source.includes("interface StatsCardsProps"));
  assert.ok(source.includes("stats: DashboardStats | null;"));
  assert.ok(source.includes("loading?: boolean;"));
});

test("stats cards keep dashboard metric configuration", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes("const statConfig = ["));
  assert.ok(source.includes('key: "totalReports" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Informes totales"'));
  assert.ok(source.includes('description: "Informes registrados"'));
  assert.ok(source.includes('key: "pendingReports" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Informes pendientes"'));
  assert.ok(source.includes('description: "En proceso o subidos"'));
  assert.ok(source.includes('key: "activeVisits" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Visitas activas"'));
  assert.ok(source.includes('description: "Programadas o en curso"'));
  assert.ok(source.includes('key: "activePlans" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Planes de ruta"'));
  assert.ok(source.includes('description: "Liberados o en curso"'));
});

test("stats cards keep four-card loading skeleton", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes("if (loading) {"));
  assert.ok(source.includes("Array.from({ length: 4 }).map((_, i) => ("));
  assert.ok(source.includes("<Skeleton"));
  assert.ok(source.includes("h-4 w-24"));
  assert.ok(source.includes("h-8 w-16 mb-1"));
  assert.ok(source.includes("h-3 w-32"));
});

test("stats cards render configured metrics with fallback and hidden icons", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes("statConfig.map((config) => ("));
  assert.ok(source.includes("<Card key={config.key}"));
  assert.ok(source.includes('<span aria-hidden="true">{config.icon}</span>'));
  assert.ok(source.includes("{config.label}"));
  assert.ok(source.includes("{stats ? stats[config.key] : \"—\"}"));
  assert.ok(source.includes("{config.description}"));
});
