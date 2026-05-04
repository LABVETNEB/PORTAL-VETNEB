import type { Metadata } from "next";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MOCK_ROUTE_METRICS, MOCK_ROUTE_PLANS } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Métricas de logística — Portal VETNEB",
  robots: { index: false, follow: false },
};

export default function MetricasPage() {
  const totalStops = MOCK_ROUTE_METRICS.reduce(
    (sum, m) => sum + m.totalStops,
    0,
  );
  const completedStops = MOCK_ROUTE_METRICS.reduce(
    (sum, m) => sum + m.completedStops,
    0,
  );
  const avgCompliance =
    MOCK_ROUTE_METRICS.length > 0
      ? Math.round(
          MOCK_ROUTE_METRICS.reduce((sum, m) => sum + m.complianceRate, 0) /
            MOCK_ROUTE_METRICS.length,
        )
      : 0;
  const avgDuration =
    MOCK_ROUTE_METRICS.filter((m) => m.averageDurationMinutes !== null)
      .length > 0
      ? Math.round(
          MOCK_ROUTE_METRICS.filter(
            (m) => m.averageDurationMinutes !== null,
          ).reduce((sum, m) => sum + (m.averageDurationMinutes ?? 0), 0) /
            MOCK_ROUTE_METRICS.filter((m) => m.averageDurationMinutes !== null)
              .length,
        )
      : null;

  return (
    <>
      <DashboardTopbar
        title="Métricas de logística"
        subtitle="Cumplimiento, SLA y reportes operativos"
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">
          <strong>Mock data:</strong> Se conectará con{" "}
          <code>GET /api/logistics/route-plans/:id/metrics</code>.
        </div>

        {/* KPIs globales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                {MOCK_ROUTE_METRICS.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Métricas por plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métricas por plan de ruta</CardTitle>
            <CardDescription>
              Detalle de cumplimiento por cada plan ejecutado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {MOCK_ROUTE_METRICS.map((metric) => {
              const plan = MOCK_ROUTE_PLANS.find(
                (p) => p.id === metric.routePlanId,
              );
              return (
                <div
                  key={metric.routePlanId}
                  className="border border-gray-100 rounded-lg p-4 space-y-3"
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
                  {/* Barra de progreso */}
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
            })}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
