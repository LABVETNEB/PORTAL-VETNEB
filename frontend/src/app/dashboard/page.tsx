import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
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
  const [stats, reports, visits] = await Promise.all([
    getDashboardStats(requestOptions),
    getReports(requestOptions),
    getLogisticsFieldVisits(requestOptions),
  ]);

  const recentReports = reports.slice(0, 3);
  const recentVisits = visits.slice(0, 3);

  return (
    <>
      <DashboardTopbar title="Dashboard Clínica" subtitle="Resumen operativo clínica" />
      <main className="dashboard-main">
        <div className="surface-note-info">
          Lectura conectada a datos operativos clinic-scoped del backend. Esta superficie usa solo sesión clínica.
        </div>

        <StatsCards stats={stats} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base">Informes recientes</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.dashboardInformes}>Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReports.length ? (
                recentReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {report.patientName ?? "Sin nombre"}
                      </p>
                      <p className="text-xs text-gray-400">
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base">Visitas de campo</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.dashboardLogisticaVisitas}>Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentVisits.length ? (
                recentVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      </p>
                      <p className="text-xs text-gray-400">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Informes", href: ROUTES.dashboardInformes, icon: "📋" },
                {
                  label: "Visitas",
                  href: ROUTES.dashboardLogisticaVisitas,
                  icon: "🚐",
                },
                {
                  label: "Rutas",
                  href: ROUTES.dashboardLogisticaRutas,
                  icon: "🗺️",
                },
                {
                  label: "Tokens",
                  href: "#clinic-particular-tokens",
                  icon: "🔐",
                },
                {
                  label: "Perfil",
                  href: "#clinic-public-profile",
                  icon: "🏥",
                },
              ].map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="outline"
                  className="h-16 flex-col gap-1 rounded-xl"
                >
                  <Link href={item.href}>
                    <span className="text-xl" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="text-xs">{item.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <ClinicPublicProfileCard />
        <ClinicParticularTokensCard />
      </main>
    </>
  );
}


