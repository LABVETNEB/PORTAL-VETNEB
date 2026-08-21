import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardNavigationFrame } from "@/components/dashboard/DashboardNavigationFrame";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoutePlanMetrics, getRoutePlans } from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import { LogisticsBoundedCanvas } from "../LogisticsBoundedCanvas";

export const metadata: Metadata = {
  title: "Métricas de logística — Portal VETNEB",
  robots: { index: false, follow: false },
};

// getRoutePlanMetrics issues 1 backend request per visible route plan.
// Unlike rutas/visitas, this page must NOT inherit the backend route-plans
// default (50): that would fan out up to 50 parallel metrics requests per
// page load. These metrics-specific limits cap that fan-out independently
// of the backend route-plans default/max (parsePositiveInt(..., 50, 100)).
const METRICAS_DEFAULT_LIMIT = 12;
const METRICAS_MAX_LIMIT = 24;

type MetricasPageSearchParams = {
  offset?: string | string[];
  limit?: string | string[];
};

function normalizeSearchParamValue(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function normalizeOffset(value: string | string[] | undefined): number {
  const parsed = Number(normalizeSearchParamValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeLimit(value: string | string[] | undefined): number {
  const parsed = Number(normalizeSearchParamValue(value));
  if (!Number.isInteger(parsed) || parsed < 1) {
    return METRICAS_DEFAULT_LIMIT;
  }

  return Math.min(parsed, METRICAS_MAX_LIMIT);
}

function buildMetricasHref(offset: number, limit: number): string {
  return `/dashboard/logistica/metricas?offset=${offset}&limit=${limit}`;
}

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams?: Promise<MetricasPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const offset = normalizeOffset(resolvedSearchParams.offset);
  const limit = normalizeLimit(resolvedSearchParams.limit);
  // Adaptive default page size: when the URL carries no explicit limit, the
  // bounded canvas recomputes it from the measured viewport. For métricas
  // this also caps the per-plan metrics fan-out to what is actually visible.
  const hasExplicitLimit =
    normalizeSearchParamValue(resolvedSearchParams.limit).trim() !== "";

  const requestOptions = await getLogisticsRequestOptions();
  let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];
  let routePlansLoadError = false;
  let routeMetrics: Awaited<ReturnType<typeof getRoutePlanMetrics>> = [];
  let routeMetricsLoadError = false;

  try {
    routePlans = await getRoutePlans(requestOptions, { throwOnError: true }, {
      limit,
      offset,
    });
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    routePlansLoadError = true;
  }

  if (!routePlansLoadError && routePlans.length) {
    try {
      routeMetrics = (
        await Promise.all(
          routePlans.map((plan) =>
            getRoutePlanMetrics(plan.id, requestOptions, {
              throwOnError: true,
            }),
          ),
        )
      ).flat();
    } catch (error) {
      redirectToLoginOnUnauthorized(error);
      routeMetricsLoadError = true;
    }
  }

  // No `total` is exposed by the route-plans endpoint: page-full is the
  // only signal available, so `canGoNext` may false-positive on an
  // exact-multiple last page — same documented tradeoff as rutas/visitas
  // (docs/audit/clinic-logistics-full-routes-adaptive-contract-audit.md).
  const canGoPrevious = !routePlansLoadError && offset > 0;
  const canGoNext = !routePlansLoadError && routePlans.length === limit;
  const currentPage = Math.floor(offset / limit) + 1;
  const previousHref = buildMetricasHref(Math.max(0, offset - limit), limit);
  const nextHref = buildMetricasHref(offset + limit, limit);

  const totalStops = routeMetrics.reduce(
    (sum, metric) => sum + metric.totalStops,
    0,
  );
  const completedStops = routeMetrics.reduce(
    (sum, metric) => sum + metric.completedStops,
    0,
  );
  const avgCompliance =
    routeMetrics.length > 0
      ? Math.round(
          routeMetrics.reduce(
            (sum, metric) => sum + metric.complianceRate,
            0,
          ) / routeMetrics.length,
        )
      : 0;
  const metricsWithDuration = routeMetrics.filter(
    (metric) => metric.averageDurationMinutes !== null,
  );
  const avgDuration =
    metricsWithDuration.length > 0
      ? Math.round(
          metricsWithDuration.reduce(
            (sum, metric) => sum + (metric.averageDurationMinutes ?? 0),
            0,
          ) / metricsWithDuration.length,
        )
      : null;

  return (
    <>
      <DashboardTopbar
        title="Métricas de logística"
        subtitle="Cumplimiento, SLA y reportes operativos"
        notifications="clinic"
      />
      <DashboardNavigationFrame surface="clinic" module="logistica">
        <main className="dashboard-main">
          <div
            className="grid min-w-0 max-w-full grid-cols-2 gap-4 overflow-hidden md:grid-cols-4"
            data-dashboard-metric-strip="true"
          >
            <Card className="dashboard-metric-card p-0">
              <CardHeader className="min-w-0 max-w-full overflow-hidden pb-2">
                <CardTitle className="min-w-0 max-w-full overflow-hidden text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">
                  Cumplimiento promedio
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 max-w-full overflow-hidden">
                <p className="min-w-0 max-w-full overflow-hidden text-3xl font-bold text-vetneb-ink [overflow-wrap:anywhere]">
                  {avgCompliance}%
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-metric-card p-0">
              <CardHeader className="min-w-0 max-w-full overflow-hidden pb-2">
                <CardTitle className="min-w-0 max-w-full overflow-hidden text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">
                  Paradas completadas
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 max-w-full overflow-hidden">
                <p className="min-w-0 max-w-full overflow-hidden text-3xl font-bold text-vetneb-ink [overflow-wrap:anywhere]">
                  {completedStops}/{totalStops}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-metric-card p-0">
              <CardHeader className="min-w-0 max-w-full overflow-hidden pb-2">
                <CardTitle className="min-w-0 max-w-full overflow-hidden text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">
                  Duración promedio
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 max-w-full overflow-hidden">
                <p className="min-w-0 max-w-full overflow-hidden text-3xl font-bold text-vetneb-ink [overflow-wrap:anywhere]">
                  {avgDuration !== null ? `${avgDuration} min` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="dashboard-metric-card p-0">
              <CardHeader className="min-w-0 max-w-full overflow-hidden pb-2">
                <CardTitle className="min-w-0 max-w-full overflow-hidden text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">
                  Planes analizados
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 max-w-full overflow-hidden">
                <p className="min-w-0 max-w-full overflow-hidden text-3xl font-bold text-vetneb-ink [overflow-wrap:anywhere]">
                  {routeMetrics.length}
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
            Métricas calculadas sobre la página visible (máximo {limit} planes),
            no sobre el total general de rutas.
          </p>

          <Card className="dashboard-surface" data-dashboard-table-surface="true">
            <CardHeader className="shrink-0">
              <CardTitle className="text-base">Métricas por plan de ruta</CardTitle>
              <CardDescription data-dashboard-chrome-secondary="true">
                Detalle de cumplimiento por cada plan ejecutado
              </CardDescription>
              <p
                className="text-sm text-muted-foreground"
                data-dashboard-chrome-secondary="true"
              >
                Mostrando {routeMetrics.length} métricas de ruta · página {currentPage}
                {canGoNext ? " · puede haber más planes de ruta disponibles" : ""}
              </p>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <LogisticsBoundedCanvas
                canvas="metricas"
                basePath="/dashboard/logistica/metricas"
                hasExplicitLimit={hasExplicitLimit}
                currentLimit={limit}
                maxLimit={METRICAS_MAX_LIMIT}
                minLimit={1}
                rowFallbackPx={168}
              >
              {routePlansLoadError ? (
                <div role="alert" className="clinical-alert-warning">
                  No se pudieron cargar los planes de ruta para métricas. Intente nuevamente.
                </div>
              ) : routeMetricsLoadError ? (
                <div role="alert" className="clinical-alert-warning">
                  No se pudieron cargar las métricas de ruta. Intente nuevamente.
                </div>
              ) : routeMetrics.length ? (
                routeMetrics.map((metric) => {
                  const plan = routePlans.find(
                    (routePlan) => routePlan.id === metric.routePlanId,
                  );
                  return (
                    <div
                      key={metric.routePlanId}
                      className="surface-soft space-y-3"
                      data-logistics-metric-block="true"
                  data-dashboard-adaptive-row="true"
                    >
                      <div className="flex min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden">
                        <h3 className="min-w-0 max-w-full overflow-hidden text-sm font-semibold text-vetneb-ink [overflow-wrap:anywhere]">
                          {plan?.name ?? `Plan #${metric.routePlanId}`}
                        </h3>
                        <Badge
                          variant={
                            metric.complianceRate >= 90
                              ? "default"
                              : metric.complianceRate >= 60
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {metric.complianceRate}% cumplimiento
                        </Badge>
                      </div>
                      <div className="grid min-w-0 max-w-full grid-cols-2 gap-3 overflow-hidden text-sm md:grid-cols-4">
                        <div className="min-w-0 max-w-full overflow-hidden">
                          <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">Total paradas</p>
                          <p className="min-w-0 max-w-full overflow-hidden font-semibold [overflow-wrap:anywhere]">{metric.totalStops}</p>
                        </div>
                        <div className="min-w-0 max-w-full overflow-hidden">
                          <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">Completadas</p>
                          <p className="min-w-0 max-w-full overflow-hidden font-semibold text-vetneb-teal [overflow-wrap:anywhere]">
                            {metric.completedStops}
                          </p>
                        </div>
                        <div className="min-w-0 max-w-full overflow-hidden">
                          <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">Omitidas</p>
                          <p className="min-w-0 max-w-full overflow-hidden font-semibold text-vetneb-amber [overflow-wrap:anywhere]">
                            {metric.skippedStops}
                          </p>
                        </div>
                        <div className="min-w-0 max-w-full overflow-hidden">
                          <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">Sin presencia</p>
                          <p className="min-w-0 max-w-full overflow-hidden font-semibold text-destructive [overflow-wrap:anywhere]">
                            {metric.noShowStops}
                          </p>
                        </div>
                      </div>
                      <div className="clinical-progress h-2 w-full">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${metric.complianceRate}%` }}
                          role="progressbar"
                          aria-valuenow={metric.complianceRate}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Cumplimiento: ${metric.complianceRate}%`}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="surface-empty">
                  No hay métricas de ruta disponibles.
                </div>
              )}
              </LogisticsBoundedCanvas>
            </CardContent>
            <nav
              aria-label="Paginación de métricas de ruta"
              data-dashboard-pager="true"
              data-dashboard-adaptive-reserved-region="pager"
              className="dashboard-pager shrink-0 border-t border-vetneb-line/70"
            >
              <span data-dashboard-pager-prev="true" className="inline-flex">
                <PublicRouteControl
                  href={previousHref}
                  variant="bare"
                  disabled={!canGoPrevious}
                  aria-label="Página anterior"
                  className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </PublicRouteControl>
              </span>
              <span data-dashboard-pager-state="true" className="dashboard-pagination-context">
                Página {currentPage}
              </span>
              <span data-dashboard-pager-next="true" className="inline-flex">
                <PublicRouteControl
                  href={nextHref}
                  variant="bare"
                  disabled={!canGoNext}
                  aria-label="Página siguiente"
                  className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                </PublicRouteControl>
              </span>
            </nav>
          </Card>
        </main>
      </DashboardNavigationFrame>
    </>
  );
}
