import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoutePlanMetrics, getRoutePlans } from "@/lib/api";

export const metadata: Metadata = {
  title: "Métricas de logística — Portal VETNEB",
  robots: { index: false, follow: false },
};

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function MetricasPage() {
  const requestOptions = await getLogisticsRequestOptions();
  let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];
  let routePlansLoadError = false;
  let routeMetrics: Awaited<ReturnType<typeof getRoutePlanMetrics>> = [];
  let routeMetricsLoadError = false;

  try {
    routePlans = await getRoutePlans(requestOptions, {
      throwOnError: true,
    });
  } catch {
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
    } catch {
      routeMetricsLoadError = true;
    }
  }

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
      />
      <main className="dashboard-main">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="dashboard-metric-card p-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cumplimiento promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-vetneb-ink">
                {avgCompliance}%
              </p>
            </CardContent>
          </Card>
          <Card className="dashboard-metric-card p-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paradas completadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-vetneb-ink">
                {completedStops}/{totalStops}
              </p>
            </CardContent>
          </Card>
          <Card className="dashboard-metric-card p-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Duración promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-vetneb-ink">
                {avgDuration !== null ? `${avgDuration} min` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="dashboard-metric-card p-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Planes analizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-vetneb-ink">
                {routeMetrics.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="dashboard-surface">
          <CardHeader>
            <CardTitle className="text-base">Métricas por plan de ruta</CardTitle>
            <CardDescription>
              Detalle de cumplimiento por cada plan ejecutado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-vetneb-ink">
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
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Total paradas</p>
                        <p className="font-semibold">{metric.totalStops}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Completadas</p>
                        <p className="font-semibold text-vetneb-teal">
                          {metric.completedStops}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Omitidas</p>
                        <p className="font-semibold text-vetneb-amber">
                          {metric.skippedStops}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sin presencia</p>
                        <p className="font-semibold text-destructive">
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
          </CardContent>
        </Card>
      </main>
    </>
  );
}
