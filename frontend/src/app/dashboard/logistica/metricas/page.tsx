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
        <div className="surface-note-info">
          Lectura conectada a{" "}
          <code>GET /api/logistics/route-plans/:id/metrics</code>.
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Cumplimiento promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {avgCompliance}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Paradas completadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {completedStops}/{totalStops}
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Duración promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {avgDuration !== null ? `${avgDuration} min` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Planes analizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {routeMetrics.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métricas por plan de ruta</CardTitle>
            <CardDescription>
              Detalle de cumplimiento por cada plan ejecutado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {routePlansLoadError ? (
              <div role="alert" className="surface-empty text-amber-700">
                No se pudieron cargar los planes de ruta para métricas. Intente nuevamente.
              </div>
            ) : routeMetricsLoadError ? (
              <div role="alert" className="surface-empty text-amber-700">
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
                    className="space-y-3 rounded-xl border border-gray-100 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 text-sm">
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs">Total paradas</p>
                        <p className="font-semibold">{metric.totalStops}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Completadas</p>
                        <p className="font-semibold text-green-600">
                          {metric.completedStops}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Omitidas</p>
                        <p className="font-semibold text-amber-600">
                          {metric.skippedStops}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Sin presencia</p>
                        <p className="font-semibold text-red-600">
                          {metric.noShowStops}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
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
