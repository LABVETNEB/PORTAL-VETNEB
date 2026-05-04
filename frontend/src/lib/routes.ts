/**
 * Rutas del frontend — Portal VETNEB
 * Centraliza todas las rutas para evitar strings hardcodeados.
 */

export const ROUTES = {
  // Públicas
  home: "/",
  servicios: "/servicios",
  profesionales: "/profesionales",
  clinicas: "/clinicas",
  contacto: "/contacto",
  login: "/login",

  // Dashboard (privado)
  dashboard: "/dashboard",
  dashboardInformes: "/dashboard/informes",
  dashboardLogistica: "/dashboard/logistica",
  dashboardLogisticaVisitas: "/dashboard/logistica/visitas",
  dashboardLogisticaRutas: "/dashboard/logistica/rutas",
  dashboardLogisticaMetricas: "/dashboard/logistica/metricas",
  dashboardAdmin: "/dashboard/admin",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

// Rutas públicas (no requieren autenticación)
export const PUBLIC_ROUTES: AppRoute[] = [
  ROUTES.home,
  ROUTES.servicios,
  ROUTES.profesionales,
  ROUTES.clinicas,
  ROUTES.contacto,
  ROUTES.login,
];

// Rutas del dashboard (requieren autenticación)
export const DASHBOARD_ROUTES: AppRoute[] = [
  ROUTES.dashboard,
  ROUTES.dashboardInformes,
  ROUTES.dashboardLogistica,
  ROUTES.dashboardLogisticaVisitas,
  ROUTES.dashboardLogisticaRutas,
  ROUTES.dashboardLogisticaMetricas,
  ROUTES.dashboardAdmin,
];

export function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard");
}
