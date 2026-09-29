import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const ROUTES_PATH = "frontend/src/lib/routes.ts";

test("frontend route registry defines public routes centrally", () => {
  const source = read(ROUTES_PATH);

  assert.ok(source.includes("export const ROUTES = {"));
  assert.ok(source.includes('home: "/",'));
  assert.ok(source.includes('servicios: "/servicios",'));
  assert.ok(source.includes('profesionales: "/profesionales",'));
  assert.ok(source.includes('clinicas: "/clinicas",'));
  assert.ok(source.includes('particulares: "/particulares",'));
  assert.ok(source.includes('contacto: "/contacto",'));
  assert.ok(source.includes('precios: "/precios",'));
  assert.ok(source.includes('login: "/login",'));
  assert.ok(source.includes("} as const;"));
  assert.ok(source.includes("export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];"));
});

test("frontend route registry keeps public route allowlist explicit", () => {
  const source = read(ROUTES_PATH);

  assert.ok(source.includes("export const PUBLIC_ROUTES: AppRoute[] = ["));
  assert.ok(source.includes("ROUTES.home,"));
  assert.ok(source.includes("ROUTES.servicios,"));
  assert.ok(source.includes("ROUTES.profesionales,"));
  assert.ok(source.includes("ROUTES.clinicas,"));
  assert.ok(source.includes("ROUTES.particulares,"));
  assert.ok(source.includes("ROUTES.contacto,"));
  assert.ok(source.includes("ROUTES.precios,"));
  assert.ok(source.includes("ROUTES.login,"));
});

test("frontend route registry defines dashboard routes centrally", () => {
  const source = read(ROUTES_PATH);

  assert.ok(source.includes('dashboard: "/dashboard",'));
  assert.ok(source.includes('dashboardInformes: "/dashboard/informes",'));
  assert.ok(source.includes('dashboardLogistica: "/dashboard/logistica",'));
  assert.ok(source.includes('dashboardLogisticaVisitas: "/dashboard/logistica/visitas",'));
  assert.ok(source.includes('dashboardLogisticaRutas: "/dashboard/logistica/rutas",'));
  assert.ok(source.includes('dashboardLogisticaMetricas: "/dashboard/logistica/metricas",'));
  assert.ok(source.includes('dashboardAdmin: "/dashboard/admin",'));
});

test("frontend route registry keeps dashboard route allowlist explicit", () => {
  const source = read(ROUTES_PATH);

  assert.ok(source.includes("export const DASHBOARD_ROUTES: AppRoute[] = ["));
  assert.ok(source.includes("ROUTES.dashboard,"));
  assert.ok(source.includes("ROUTES.dashboardInformes,"));
  assert.ok(source.includes("ROUTES.dashboardLogistica,"));
  assert.ok(source.includes("ROUTES.dashboardLogisticaVisitas,"));
  assert.ok(source.includes("ROUTES.dashboardLogisticaRutas,"));
  assert.ok(source.includes("ROUTES.dashboardLogisticaMetricas,"));
  assert.ok(source.includes("ROUTES.dashboardAdmin,"));
});

test("frontend route registry identifies only real dashboard routes", () => {
  const source = read(ROUTES_PATH);

  assert.ok(source.includes("export function isDashboardRoute(pathname: string): boolean"));
  assert.ok(source.includes("pathname === ROUTES.dashboard"));
  assert.ok(source.includes("pathname.startsWith(`${ROUTES.dashboard}/`)"));
  assert.equal(source.includes('pathname.startsWith("/dashboard")'), false);
  assert.equal(source.includes('return pathname.startsWith("/dashboard");'), false);
});
