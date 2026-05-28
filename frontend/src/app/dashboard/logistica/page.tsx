import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  BarChart3,
  MapPinned,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  let fieldVisits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];
  let fieldVisitsLoadError = false;
  let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];
  let routePlansLoadError = false;

  await Promise.all([
    (async () => {
      try {
        fieldVisits = await getLogisticsFieldVisits(requestOptions, {
          throwOnError: true,
        });
      } catch {
        fieldVisitsLoadError = true;
      }
    })(),
    (async () => {
      try {
        routePlans = await getRoutePlans(requestOptions, {
          throwOnError: true,
        });
      } catch {
        routePlansLoadError = true;
      }
    })(),
  ]);

  const activeVisits = fieldVisits.filter(
    (v) => v.status === "in_progress" || v.status === "scheduled",
  );
  const activePlans = routePlans.filter(
    (p) => p.status === "in_progress" || p.status === "released",
  );
  const logisticsModules = [
    {
      title: "Visitas de campo",
      href: ROUTES.dashboardLogisticaVisitas,
      icon: Truck,
      description: "Seguimiento de visitas programadas y en curso.",
      count: fieldVisits.length,
    },
    {
      title: "Planes de ruta",
      href: ROUTES.dashboardLogisticaRutas,
      icon: MapPinned,
      description: "Planificación y gestión de rutas de entrega.",
      count: routePlans.length,
    },
    {
      title: "Métricas",
      href: ROUTES.dashboardLogisticaMetricas,
      icon: BarChart3,
      description: "Cumplimiento, SLA y reportes operativos.",
      count: null,
    },
  ] satisfies Array<{
    title: string;
    href: string;
    icon: LucideIcon;
    description: string;
    count: number | null;
  }>;

  return (
    <>
      <DashboardTopbar
        title="Logística"
        subtitle="Visitas de campo y planes de ruta"
      />
      <main className="dashboard-main">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="dashboard-metric-card p-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visitas activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-vetneb-ink">
                {activeVisits.length}
              </p>
            </CardContent>
          </Card>
          <Card className="dashboard-metric-card p-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Planes activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-vetneb-ink">
                {activePlans.length}
              </p>
            </CardContent>
          </Card>
          <Card className="dashboard-metric-card p-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visitas totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-vetneb-ink">
                {fieldVisits.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {logisticsModules.map((module) => {
            const Icon = module.icon;

            return (
              <Card key={module.href} className="dashboard-surface h-full">
                <CardHeader>
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-vetneb-teal/25 bg-vetneb-teal/10 text-vetneb-teal"
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {module.description}
                  </p>
                  {module.count !== null && (
                    <p className="text-2xl font-bold text-vetneb-ink">
                      {module.count}
                    </p>
                  )}
                  <PublicRouteControl
                    href={module.href}
                    variant="bare"
                    className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-card/95 px-3 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgba(15,45,62,0.05)] transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-vetneb-teal/45 hover:bg-accent/70 hover:text-accent-foreground"
                  >
                    Ver módulo
                  </PublicRouteControl>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="dashboard-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Visitas recientes</CardTitle>
            <PublicRouteControl
              href={ROUTES.dashboardLogisticaVisitas}
              variant="bare"
              className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground/80 transition-[background-color,color] duration-150 hover:bg-accent/70 hover:text-accent-foreground"
            >
              Ver todas
            </PublicRouteControl>
          </CardHeader>
          <CardContent className="space-y-3">
            {fieldVisitsLoadError ? (
              <p role="alert" className="clinical-alert-warning">
                No se pudieron cargar las visitas recientes. Intente nuevamente.
              </p>
            ) : fieldVisits.length ? (
              fieldVisits.slice(0, 4).map((visit) => (
                <div
                  key={visit.id}
                  className="dashboard-list-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-vetneb-ink">
                      {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
              ))
            ) : (
              <p className="surface-empty">
                No hay visitas recientes disponibles.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Planes de ruta</CardTitle>
            <PublicRouteControl
              href={ROUTES.dashboardLogisticaRutas}
              variant="bare"
              className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground/80 transition-[background-color,color] duration-150 hover:bg-accent/70 hover:text-accent-foreground"
            >
              Ver todos
            </PublicRouteControl>
          </CardHeader>
          <CardContent className="space-y-3">
            {routePlansLoadError ? (
              <p role="alert" className="clinical-alert-warning">
                No se pudieron cargar los planes de ruta recientes. Intente nuevamente.
              </p>
            ) : routePlans.length ? (
              routePlans.map((plan) => (
                <div
                  key={plan.id}
                  className="dashboard-list-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-vetneb-ink">
                      {plan.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
              ))
            ) : (
              <p className="surface-empty">
                No hay planes de ruta disponibles.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
