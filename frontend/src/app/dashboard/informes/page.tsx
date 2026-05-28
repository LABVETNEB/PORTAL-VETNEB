import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ReportDownloadButton } from "@/components/dashboard/ReportDownloadButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getReports, searchReports } from "@/lib/api";
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

type InformesPageSearchParams = {
  query?: string | string[];
  status?: string | string[];
  studyType?: string | string[];
};

function normalizeSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeStatusFilter(value: string) {
  if (statusOptions.some((option) => option.value === value)) {
    return value;
  }

  return "";
}

async function getReportsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams?: Promise<InformesPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = normalizeSearchParamValue(resolvedSearchParams.query).trim();
  const status = normalizeStatusFilter(
    normalizeSearchParamValue(resolvedSearchParams.status),
  );
  const studyType = normalizeSearchParamValue(resolvedSearchParams.studyType).trim();
  const requestOptions = await getReportsRequestOptions();
  let reports: Awaited<ReturnType<typeof getReports>> = [];
  let reportsLoadError = false;

  try {
    reports = query
      ? await searchReports(
          {
            query,
            status: status || undefined,
            studyType: studyType || undefined,
          },
          requestOptions,
          { throwOnError: true },
        )
      : await getReports(
          requestOptions,
          {
            status: status || undefined,
          },
          { throwOnError: true },
        );
  } catch {
    reportsLoadError = true;
  }

  return (
    <>
      <DashboardTopbar
        title="Informes"
        subtitle="Consulta de informes médicos veterinarios"
      />
      <main className="dashboard-main">
        <Card className="dashboard-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form method="get" className="flex flex-col gap-3 sm:flex-row">
              <Input
                name="query"
                defaultValue={query}
                placeholder="Buscar por paciente o tipo de estudio..."
                className="sm:max-w-sm"
                aria-label="Buscar informes"
              />
              <select
                name="status"
                defaultValue={status}
                className="field-select sm:w-56"
                aria-label="Filtrar por estado"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Filtrar
                </Button>
                <PublicRouteControl
                  href="/dashboard/informes"
                  replace
                  variant="bare"
                  className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground/80 transition-[background-color,color] duration-150 hover:bg-accent/70 hover:text-accent-foreground"
                >
                  Limpiar
                </PublicRouteControl>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="dashboard-surface">
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
                {reportsLoadError ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      role="alert"
                      className="clinical-table-state clinical-alert-warning"
                    >
                      No se pudieron cargar los informes. Intente nuevamente.
                    </TableCell>
                  </TableRow>
                ) : reports.length ? (
                  reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{report.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {report.patientName ?? "—"}
                      </TableCell>
                      <TableCell className="text-vetneb-ink/75">
                        {report.studyType ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-vetneb-ink/75">
                        {report.clinicName ?? `Clínica #${report.clinicId}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
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
                      className="clinical-table-state"
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
