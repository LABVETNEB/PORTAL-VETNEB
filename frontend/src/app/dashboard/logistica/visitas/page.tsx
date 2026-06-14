import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLogisticsFieldVisits } from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import {
  getFieldVisitStatusLabel,
  getFieldVisitStatusVariant,
  formatDateTime,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Visitas de campo — Portal VETNEB",
  robots: { index: false, follow: false },
};

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function VisitasPage() {
  let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];
  let visitsLoadError = false;

  try {
    visits = await getLogisticsFieldVisits(
      await getLogisticsRequestOptions(),
      { throwOnError: true },
    );
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    visitsLoadError = true;
  }

  return (
    <>
      <DashboardTopbar
        title="Visitas de campo"
        subtitle="Seguimiento de visitas programadas y en curso"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              { status: "pending", label: "Pendientes" },
              { status: "scheduled", label: "Programadas" },
              { status: "in_progress", label: "En curso" },
              { status: "done", label: "Completadas" },
            ] as const
          ).map(({ status, label }) => {
            const count = visits.filter((v) => v.status === status).length;
            return (
              <Card key={status} className="dashboard-metric-card p-0">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-vetneb-ink">{count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="dashboard-surface">
          <CardHeader>
            <CardTitle className="text-base">
              Visitas ({visits.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Programada</TableHead>
                  <TableHead>Completada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitsLoadError ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      role="alert"
                      className="clinical-table-state clinical-alert-warning"
                    >
                      No se pudieron cargar las visitas de campo. Intente nuevamente.
                    </TableCell>
                  </TableRow>
                ) : visits.length ? (
                  visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{visit.id}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm text-vetneb-ink/75">
                        {visit.address ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(visit.scheduledAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {visit.completedAt
                          ? formatDateTime(visit.completedAt)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getFieldVisitStatusVariant(visit.status)}>
                          {getFieldVisitStatusLabel(visit.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                        {visit.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="clinical-table-state"
                    >
                      No hay visitas de campo disponibles.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
