import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  assertPlainProps,
  evaluate,
  exportedFunction,
  parseTsx,
  renderedUnder,
  tagName,
} from "./dashboard-source-oracle.ts";

const DASHBOARD_TOPBAR_PATH = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const STATS_CARDS_PATH = "frontend/src/components/dashboard/StatsCards.tsx";

// TEST-GLOBAL-07 (G06-D15): while `loading` the component returns the skeleton
// grid — every rendered Skeleton comes from a loop over an executed length-4
// array — and once loaded no Skeleton renders. The literal `if (loading) {`
// stays present under `if (false)` (C.15.1 M-D14).
function statsCardsLoading(source: string) {
  const component = exportedFunction(parseTsx(source, STATS_CARDS_PATH), "StatsCards");
  const skeletons = (loading: boolean) =>
    renderedUnder(component, new Map([["loading", loading]])).filter(
      (rendered) => tagName(rendered.element) === "Skeleton",
    );

  assertPlainProps(component, ["loading"]);

  const loops = new Set<ts.CallExpression>();
  for (const { element } of skeletons(true)) {
    let node: ts.Node = element;

    while (
      node !== component &&
      !(
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "map"
      )
    ) {
      node = node.parent;
    }

    if (ts.isCallExpression(node)) loops.add(node);
  }

  return {
    loadingSkeletonCards: [...loops].map((loop) => {
      const receiver = ts.isPropertyAccessExpression(loop.expression)
        ? evaluate(loop.expression.expression, {})
        : undefined;
      return Array.isArray(receiver) ? receiver.length : "not an array";
    }),
    loadedSkeletons: skeletons(false).length,
  };
}

test("dashboard topbar keeps route-registry logout action and UI dependencies", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("Cerrar sesión"));
  assert.equal(source.includes('import Link from "next/link";'), false);
  assert.equal(source.includes('href="/login"'), false);
});

test("dashboard topbar keeps typed title and optional subtitle props", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes("interface DashboardTopbarProps"));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("subtitle?: string;"));
  assert.ok(
    source.includes('notifications?: "admin" | "clinic" | "particular" | false;'),
  );
  assert.ok(source.includes("notifications = false,"));
  assert.ok(source.includes("export function DashboardTopbar({"));
  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{subtitle && ("));
  assert.ok(source.includes("{subtitle}"));
});

test("dashboard topbar renders notifications bell for configured dashboard surface", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(
    source.includes(
      'import { DashboardNotificationsBell } from "./DashboardNotificationsBell";',
    ),
  );
  assert.ok(
    source.includes(
      "{notifications ? <DashboardNotificationsBell surface={notifications} /> : null}",
    ),
  );
});

test("dashboard topbar keeps protected dashboard header shell without mock session chip", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes('<header'));
  assert.ok(source.includes("sticky top-0 z-40"));
  assert.ok(source.includes('variant="bare"'));
  assert.ok(source.includes("border border-input bg-card/95"));
  assert.equal(source.includes("Usuario mock"), false);
  assert.equal(source.includes("Clínica Demo"), false);
  assert.equal(source.includes(">CL<"), false);
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
  assert.ok(source.includes('className="dashboard-metric-card overflow-hidden p-0"'));
  assert.ok(source.includes("<Skeleton"));
  assert.ok(source.includes("h-4 w-24"));
  assert.ok(source.includes("h-8 w-16 mb-1"));
  assert.ok(source.includes("h-3 w-32"));
  assert.deepEqual(statsCardsLoading(source), { loadingSkeletonCards: [4], loadedSkeletons: 0 });

  const neverLoading = source.replace("if (loading) {", () => "if (false)\nif (loading) {");
  assert.notEqual(neverLoading, source);
  assert.deepEqual(statsCardsLoading(neverLoading), { loadingSkeletonCards: [], loadedSkeletons: 0 });
});

test("stats cards render configured metrics with fallback and hidden icons", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes("statConfig.map((config) => ("));
  assert.ok(source.includes("key={config.key}"));
  assert.ok(source.includes("<config.icon className=\"h-4 w-4\" />"));
  assert.ok(source.includes("dashboard-metric-card overflow-hidden p-0"));
  assert.ok(source.includes("clinical-pill"));
  assert.ok(source.includes("{config.label}"));
  assert.ok(source.includes("{stats ? stats[config.key] : \"—\"}"));
  assert.ok(source.includes("{config.description}"));
});
