import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Building2, FileText, KeyRound, Map, Route } from "lucide-react";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";
import { ClinicPublicProfileCard } from "@/components/dashboard/ClinicPublicProfileCard";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import {
  getDashboardStats,
  getLogisticsFieldVisits,
  getReports,
} from "@/lib/api";
import {
  getReportStatusLabel,
  getReportStatusVariant,
  getFieldVisitStatusLabel,
  getFieldVisitStatusVariant,
  formatDate,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard Clínica — Portal VETNEB",
  robots: { index: false, follow: false },
};

async function getDashboardRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function DashboardPage() {
  const requestOptions = await getDashboardRequestOptions();
  const stats = await getDashboardStats(requestOptions);
  let reports: Awaited<ReturnType<typeof getReports>> = [];
  let reportsLoadError = false;
  let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];
  let visitsLoadError = false;

  await Promise.all([
    (async () => {
      try {
        reports = await getReports(requestOptions, undefined, {
          throwOnError: true,
        });
      } catch {
        reportsLoadError = true;
      }
    })(),
    (async () => {
      try {
        visits = await getLogisticsFieldVisits(requestOptions, {
          throwOnError: true,
        });
      } catch {
        visitsLoadError = true;
      }
    })(),
  ]);

  const recentReports = reports.slice(0, 3);
  const recentVisits = visits.slice(0, 3);

  return (
    <>
      <DashboardTopbar title="Dashboard Clínica" subtitle="Resumen operativo clínica" />
      <main className="dashboard-main">
        <section className="surface-note-info" aria-labelledby="dashboard-operational-priority">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-vetneb-navy/80">
                Estado operativo clínica
              </p>
              <p
                id="dashboard-operational-priority"
                className="mt-1 text-sm font-medium text-vetneb-navy"
              >
                Priorice informes pendientes y visitas activas para sostener continuidad diagnóstica.
              </p>
              <p className="mt-1 text-xs text-vetneb-navy/80">
                Lectura conectada a datos operativos clinic-scoped del backend. Esta superficie usa solo sesión clínica.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[20rem]">
              <div className="dashboard-kpi-pill" data-tone="critical">
                <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                  Informes pendientes
                </p>
                <p className="mt-1 text-lg font-bold leading-none">
                  {stats?.pendingReports ?? "—"}
                </p>
              </div>
              <div className="dashboard-kpi-pill" data-tone="focus">
                <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                  Visitas activas
                </p>
                <p className="mt-1 text-lg font-bold leading-none">
                  {stats?.activeVisits ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="dashboard-metrics-heading">
          <h2 id="dashboard-metrics-heading" className="dashboard-section-heading">
            Métricas operativas
          </h2>
          <p className="dashboard-section-description">
            Vista rápida de informes, pendientes y actividad logística del día.
          </p>
          <div className="mt-4">
            <StatsCards stats={stats} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="dashboard-surface">
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div>
                <CardTitle className="text-base">Informes recientes</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Últimos estudios cargados y su estado actual.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.dashboardInformes}>Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {reportsLoadError ? (
                <p role="alert" className="surface-empty text-amber-700">
                  No se pudieron cargar los informes recientes. Intente nuevamente.
                </p>
              ) : recentReports.length ? (
                recentReports.map((report) => (
                  <div
                    key={report.id}
                    className="dashboard-list-row"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-vetneb-ink">
                        {report.patientName ?? "Sin nombre"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.studyType} · {formatDate(report.uploadDate)}
                      </p>
                    </div>
                    <Badge
                      variant={getReportStatusVariant(report.status)}
                      className="ml-2 shrink-0"
                    >
                      {getReportStatusLabel(report.status)}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="surface-empty">
                  No hay informes recientes disponibles.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="dashboard-surface">
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div>
                <CardTitle className="text-base">Visitas de campo</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Programación logística con seguimiento en curso.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.dashboardLogisticaVisitas}>Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {visitsLoadError ? (
                <p role="alert" className="surface-empty text-amber-700">
                  No se pudieron cargar las visitas de campo recientes. Intente nuevamente.
                </p>
              ) : recentVisits.length ? (
                recentVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="dashboard-list-row"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-vetneb-ink">
                        {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                  No hay visitas de campo recientes disponibles.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="dashboard-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
            <p className="text-xs text-muted-foreground">
              Acciones frecuentes para operación clínica diaria.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {[
                { label: "Informes", href: ROUTES.dashboardInformes, icon: FileText },
                {
                  label: "Visitas",
                  href: ROUTES.dashboardLogisticaVisitas,
                  icon: Route,
                },
                {
                  label: "Rutas",
                  href: ROUTES.dashboardLogisticaRutas,
                  icon: Map,
                },
                {
                  label: "Tokens",
                  href: `${ROUTES.dashboard}#clinic-particular-tokens`,
                  icon: KeyRound,
                },
                {
                  label: "Perfil",
                  href: `${ROUTES.dashboard}#clinic-public-profile`,
                  icon: Building2,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                <Button
                  key={item.href}
                  asChild
                  variant="outline"
                  className="h-16 flex-col gap-1 rounded-lg"
                >
                  <Link href={item.href}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs">{item.label}</span>
                  </Link>
                </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <ClinicPublicProfileCard />
        <ClinicParticularTokensCard />
      </main>
    </>
  );
}


