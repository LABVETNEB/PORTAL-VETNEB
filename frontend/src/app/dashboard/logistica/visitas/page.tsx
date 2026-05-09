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
  const visits = await getLogisticsFieldVisits(
    await getLogisticsRequestOptions(),
  );

  return (
    <>
      <DashboardTopbar
        title="Visitas de campo"
        subtitle="Seguimiento de visitas programadas y en curso"
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
          Lectura conectada a <code>GET /api/logistics/field-visits</code>.
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <Card key={status} className="border-gray-100">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
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
                {visits.length ? (
                  visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-mono text-xs text-gray-400">
                        #{visit.id}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm max-w-[180px] truncate">
                        {visit.address ?? "—"}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatDateTime(visit.scheduledAt)}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {visit.completedAt
                          ? formatDateTime(visit.completedAt)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getFieldVisitStatusVariant(visit.status)}>
                          {getFieldVisitStatusLabel(visit.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400 text-xs max-w-[150px] truncate">
                        {visit.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-gray-500"
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
