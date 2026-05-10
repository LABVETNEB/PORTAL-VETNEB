import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { UploadReportModal } from "@/components/dashboard/UploadReportModal";
import { ReportDownloadButton } from "@/components/dashboard/ReportDownloadButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReports } from "@/lib/api";
import {
  getReportStatusLabel,
  getReportStatusVariant,
  formatDate,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Informes — Portal VETNEB",
  robots: { index: false, follow: false },
};

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "uploaded", label: "Subido" },
  { value: "processing", label: "Procesando" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
];

async function getReportsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function InformesPage() {
  const reports = await getReports(await getReportsRequestOptions());

  return (
    <>
      <DashboardTopbar
        title="Informes"
        subtitle="Gestión de informes médicos veterinarios"
      />
      <main className="dashboard-main">
        <div className="flex justify-end">
          <UploadReportModal />
        </div>

        <div className="surface-note-info">
          Lectura conectada a <code>GET /api/reports</code>.
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="Buscar por paciente o tipo de estudio..."
                className="sm:max-w-sm"
                aria-label="Buscar informes"
              />
              <select
                className="field-select sm:w-56"
                aria-label="Filtrar por estado"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Informes ({reports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Tipo de estudio</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length ? (
                  reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono text-xs text-gray-400">
                        #{report.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {report.patientName ?? "—"}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {report.studyType ?? "—"}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {report.clinicName ?? `Clínica #${report.clinicId}`}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatDate(report.uploadDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getReportStatusVariant(report.status)}>
                          {getReportStatusLabel(report.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ReportDownloadButton
                          reportId={report.id}
                          hasStoragePath={Boolean(report.storagePath)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-gray-500"
                    >
                      No hay informes disponibles.
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


