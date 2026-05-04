import type { Metadata } from "next";
import Link from "next/link";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { MOCK_DASHBOARD_STATS, MOCK_REPORTS, MOCK_FIELD_VISITS } from "@/lib/mock-data";
import { getReportStatusLabel, getReportStatusVariant, getFieldVisitStatusLabel, getFieldVisitStatusVariant, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard — Portal VETNEB",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  const recentReports = MOCK_REPORTS.slice(0, 3);
  const recentVisits = MOCK_FIELD_VISITS.slice(0, 3);

  return (
    <>
      <DashboardTopbar
        title="Dashboard"
        subtitle="Resumen operativo"
      />
      <main className="flex-1 p-6 space-y-6">
        {/* Banner de desarrollo */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <strong>Modo demo:</strong> Los datos mostrados son mock data. La
          autenticación real se integrará en un próximo PR.
        </div>

        {/* Stats */}
        <StatsCards stats={MOCK_DASHBOARD_STATS} />

        {/* Actividad reciente */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informes recientes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base">Informes recientes</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.dashboardInformes}>Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReports.map((report) => (
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
                  <Badge variant={getReportStatusVariant(report.status)} className="ml-2 shrink-0">
                    {getReportStatusLabel(report.status)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Visitas recientes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base">Visitas de campo</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.dashboardLogisticaVisitas}>Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentVisits.map((visit) => (
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
                  <Badge variant={getFieldVisitStatusVariant(visit.status)} className="ml-2 shrink-0">
                    {getFieldVisitStatusLabel(visit.status)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Accesos rápidos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Informes", href: ROUTES.dashboardInformes, icon: "📋" },
                { label: "Visitas", href: ROUTES.dashboardLogisticaVisitas, icon: "🚐" },
                { label: "Rutas", href: ROUTES.dashboardLogisticaRutas, icon: "🗺️" },
                { label: "Admin", href: ROUTES.dashboardAdmin, icon: "🔧" },
              ].map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="outline"
                  className="h-16 flex-col gap-1"
                >
                  <Link href={item.href}>
                    <span className="text-xl" aria-hidden="true">{item.icon}</span>
                    <span className="text-xs">{item.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
