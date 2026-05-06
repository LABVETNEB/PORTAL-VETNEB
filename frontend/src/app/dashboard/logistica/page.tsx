import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import {
  getLogisticsFieldVisits,
  getRoutePlans,
} from "@/lib/api";
import {
  getFieldVisitStatusLabel,
  getFieldVisitStatusVariant,
  getRoutePlanStatusLabel,
  getRoutePlanStatusVariant,
  formatDate,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Logística — Portal VETNEB",
  robots: { index: false, follow: false },
};

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function LogisticaPage() {
  const requestOptions = await getLogisticsRequestOptions();
  const [fieldVisits, routePlans] = await Promise.all([
    getLogisticsFieldVisits(requestOptions),
    getRoutePlans(requestOptions),
  ]);

  const activeVisits = fieldVisits.filter(
    (v) => v.status === "in_progress" || v.status === "scheduled",
  );
  const activePlans = routePlans.filter(
    (p) => p.status === "in_progress" || p.status === "released",
  );

  return (
    <>
      <DashboardTopbar
        title="Logística"
        subtitle="Visitas de campo y planes de ruta"
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Visitas activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {activeVisits.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Planes activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {activePlans.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Visitas totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {fieldVisits.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Visitas de campo",
              href: ROUTES.dashboardLogisticaVisitas,
              icon: "🚐",
              description: "Seguimiento de visitas programadas y en curso.",
              count: fieldVisits.length,
            },
            {
              title: "Planes de ruta",
              href: ROUTES.dashboardLogisticaRutas,
              icon: "🗺️",
              description: "Planificación y gestión de rutas de entrega.",
              count: routePlans.length,
            },
            {
              title: "Métricas",
              href: ROUTES.dashboardLogisticaMetricas,
              icon: "📊",
              description: "Cumplimiento, SLA y reportes operativos.",
              count: null,
            },
          ].map((module) => (
            <Card
              key={module.href}
              className="border-gray-100 hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="text-3xl mb-2" aria-hidden="true">
                  {module.icon}
                </div>
                <CardTitle className="text-base">{module.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-500">{module.description}</p>
                {module.count !== null && (
                  <p className="text-2xl font-bold text-gray-900">
                    {module.count}
                  </p>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={module.href}>Ver módulo</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Visitas recientes</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={ROUTES.dashboardLogisticaVisitas}>Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fieldVisits.slice(0, 4).map((visit) => (
              <div
                key={visit.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {visit.address ?? "Sin dirección"} ·{" "}
                    {formatDate(visit.scheduledAt)}
                  </p>
                </div>
                <Badge
                  variant={getFieldVisitStatusVariant(visit.status)}
                  className="ml-2 shrink-0"
                >
                  {getFieldVisitStatusLabel(visit.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Planes de ruta</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={ROUTES.dashboardLogisticaRutas}>Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {routePlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {plan.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {plan.completedStops}/{plan.totalStops} paradas ·{" "}
                    {formatDate(plan.plannedDate)}
                  </p>
                </div>
                <Badge
                  variant={getRoutePlanStatusVariant(plan.status)}
                  className="ml-2 shrink-0"
                >
                  {getRoutePlanStatusLabel(plan.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
