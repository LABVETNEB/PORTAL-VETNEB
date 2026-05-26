"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminReportWorkflow,
  updateAdminReportSpecialStain,
  updateAdminReportWorkflowStage,
  type AdminReportWorkflowItem,
  type AdminReportWorkflowStage,
} from "@/lib/api";

const PAGE_LIMIT = 20;

const WORKFLOW_STAGES: Array<{
  value: AdminReportWorkflowStage;
  label: string;
}> = [
  { value: "sample_received", label: "Recepción de muestra" },
  { value: "processing", label: "Procesamiento" },
  { value: "evaluation", label: "Evaluación" },
  { value: "report_development", label: "Desarrollo de informe" },
  { value: "delivered", label: "Entrega" },
];

function getStageLabel(stage: AdminReportWorkflowStage) {
  return WORKFLOW_STAGES.find((option) => option.value === stage)?.label ?? stage;
}

function getStageVariant(
  stage: AdminReportWorkflowStage,
): "default" | "secondary" | "outline" {
  if (stage === "delivered") return "default";
  if (stage === "report_development" || stage === "evaluation") {
    return "secondary";
  }
  return "outline";
}

function formatReportDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function AdminReportWorkflowViewerCard() {
  const [reports, setReports] = useState<AdminReportWorkflowItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkflow = useCallback(async (nextOffset: number) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const snapshot = await getAdminReportWorkflow({
        limit: PAGE_LIMIT,
        offset: nextOffset,
      });
      setReports(snapshot.reports);
      setHasMore(snapshot.pagination.hasMore);
    } catch (error) {
      setReports([]);
      setHasMore(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el seguimiento de informes.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflow(offset);
  }, [loadWorkflow, offset]);

  async function handleStageChange(
    report: AdminReportWorkflowItem,
    stage: AdminReportWorkflowStage,
  ) {
    if (stage === report.workflowStage || busyReportId !== null) {
      return;
    }

    setBusyReportId(report.id);
    setErrorMessage(null);

    try {
      const response = await updateAdminReportWorkflowStage(report.id, stage);
      setReports((current) =>
        current.map((item) => (item.id === report.id ? response.report : item)),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cambiar la etapa.",
      );
    } finally {
      setBusyReportId(null);
    }
  }

  async function handleSpecialStainChange(report: AdminReportWorkflowItem) {
    if (busyReportId !== null) {
      return;
    }

    setBusyReportId(report.id);
    setErrorMessage(null);

    try {
      const response = await updateAdminReportSpecialStain(
        report.id,
        !report.specialStainRequested,
      );
      setReports((current) =>
        current.map((item) => (item.id === report.id ? response.report : item)),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la tinción especial.",
      );
    } finally {
      setBusyReportId(null);
    }
  }

  return (
    <Card className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Seguimiento de informes</CardTitle>
          <CardDescription>
            Etapas globales del informe y solicitudes manuales de tinción especial
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadWorkflow(offset)}
          disabled={isLoading}
        >
          Actualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {errorMessage ? (
          <div role="alert" className="clinical-alert-warning mx-6 px-4 py-3 text-sm">
            {errorMessage}
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clínica</TableHead>
              <TableHead>Paciente / informe</TableHead>
              <TableHead>Tipo de estudio</TableHead>
              <TableHead>Fecha de carga / recepción</TableHead>
              <TableHead>Etapa actual</TableHead>
              <TableHead>Alerta tinción especial</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="clinical-table-state">
                  Cargando informes...
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="clinical-table-state">
                  No hay informes disponibles para seguimiento.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => {
                const busy = busyReportId === report.id;

                return (
                  <TableRow key={report.id}>
                    <TableCell className="text-sm text-vetneb-ink">
                      {report.clinicName ?? `Clínica #${report.clinicId}`}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium text-vetneb-ink">
                        {report.patientName ?? "Sin paciente informado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.fileName ?? `Informe #${report.id}`}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.studyType ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatReportDate(report.uploadDate ?? report.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStageVariant(report.workflowStage)}>
                        {getStageLabel(report.workflowStage)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.specialStainRequested ? (
                        <Badge variant="secondary">Solicitada</Badge>
                      ) : (
                        <Badge variant="outline">Sin alerta</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[270px] items-center gap-2">
                        <label className="sr-only" htmlFor={`workflow-stage-${report.id}`}>
                          Cambiar etapa
                        </label>
                        <select
                          id={`workflow-stage-${report.id}`}
                          value={report.workflowStage}
                          onChange={(event) =>
                            void handleStageChange(
                              report,
                              event.target.value as AdminReportWorkflowStage,
                            )
                          }
                          disabled={busy}
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                        >
                          {WORKFLOW_STAGES.map((stage) => (
                            <option key={stage.value} value={stage.value}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleSpecialStainChange(report)}
                        >
                          {report.specialStainRequested ? "Resolver" : "Solicitar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-6 pb-5 text-sm text-muted-foreground">
          <span>
            Mostrando hasta {PAGE_LIMIT} informes
            {offset > 0 ? ` desde el registro ${offset + 1}` : ""}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || !hasMore}
              onClick={() => setOffset(offset + PAGE_LIMIT)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
