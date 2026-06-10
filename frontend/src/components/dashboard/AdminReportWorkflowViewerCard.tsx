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
  getAdminStudyTrackingCases,
  updateAdminStudyTrackingCase,
  type AdminStudyTrackingCaseSummary,
  type AdminStudyTrackingStage,
} from "@/lib/api";

const PAGE_LIMIT = 20;

const WORKFLOW_STAGES: Array<{
  value: AdminStudyTrackingStage;
  label: string;
}> = [
  { value: "reception", label: "Recepción de muestra" },
  { value: "processing", label: "Procesamiento" },
  { value: "evaluation", label: "Evaluación" },
  { value: "report_development", label: "Desarrollo de informe" },
  { value: "delivered", label: "Informe disponible / Publicado" },
];

function getStageLabel(stage: AdminStudyTrackingStage) {
  return WORKFLOW_STAGES.find((option) => option.value === stage)?.label ?? stage;
}

function getStageVariant(
  stage: AdminStudyTrackingStage,
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
  const [trackingCases, setTrackingCases] = useState<AdminStudyTrackingCaseSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyTrackingCaseId, setBusyTrackingCaseId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkflow = useCallback(async (nextOffset: number) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const snapshot = await getAdminStudyTrackingCases({
        limit: PAGE_LIMIT + 1,
        offset: nextOffset,
      });
      setTrackingCases(snapshot.trackingCases.slice(0, PAGE_LIMIT));
      setHasMore(snapshot.trackingCases.length > PAGE_LIMIT);
    } catch (error) {
      setTrackingCases([]);
      setHasMore(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el seguimiento de estudios.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflow(offset);
  }, [loadWorkflow, offset]);

  async function handleStageChange(
    trackingCase: AdminStudyTrackingCaseSummary,
    stage: AdminStudyTrackingStage,
  ) {
    if (stage === trackingCase.currentStage || busyTrackingCaseId !== null) {
      return;
    }

    setBusyTrackingCaseId(trackingCase.id);
    setErrorMessage(null);

    try {
      const response = await updateAdminStudyTrackingCase(trackingCase.id, {
        currentStage: stage,
      });
      setTrackingCases((current) =>
        current.map((item) =>
          item.id === trackingCase.id ? response.trackingCase : item,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo cambiar la etapa.",
      );
    } finally {
      setBusyTrackingCaseId(null);
    }
  }

  async function handleSpecialStainChange(trackingCase: AdminStudyTrackingCaseSummary) {
    if (busyTrackingCaseId !== null) {
      return;
    }

    setBusyTrackingCaseId(trackingCase.id);
    setErrorMessage(null);

    try {
      const response = await updateAdminStudyTrackingCase(trackingCase.id, {
        specialStainRequired: !trackingCase.specialStainRequired,
      });
      setTrackingCases((current) =>
        current.map((item) =>
          item.id === trackingCase.id ? response.trackingCase : item,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la tinción especial.",
      );
    } finally {
      setBusyTrackingCaseId(null);
    }
  }

  return (
    <Card className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Seguimiento de informes</CardTitle>
          <CardDescription>
            Fuente única de etapas y alertas clínicas para admin, clínica y particular
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
          <div role="alert" className="clinical-alert-warning mx-6 mt-4 px-4 py-3 text-sm">
            {errorMessage}
          </div>
        ) : null}
        <div className="dashboard-table-responsive">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clínica</TableHead>
              <TableHead>Reporte / token</TableHead>
              <TableHead>Fechas clave</TableHead>
              <TableHead>Etapa actual</TableHead>
              <TableHead>Alerta tinción especial</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="clinical-table-state">
                  Cargando seguimientos...
                </TableCell>
              </TableRow>
            ) : trackingCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="clinical-table-state">
                  No hay seguimientos disponibles.
                </TableCell>
              </TableRow>
            ) : (
              trackingCases.map((trackingCase) => {
                const busy = busyTrackingCaseId === trackingCase.id;

                return (
                  <TableRow key={trackingCase.id}>
                    <TableCell className="text-sm text-vetneb-ink">
                      Clínica #{trackingCase.clinicId}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium text-vetneb-ink">
                        Reporte:{" "}
                        {typeof trackingCase.reportId === "number"
                          ? `#${trackingCase.reportId}`
                          : "Sin vínculo"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Token particular:{" "}
                        {typeof trackingCase.particularTokenId === "number"
                          ? `#${trackingCase.particularTokenId}`
                          : "Sin vínculo"}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <p>
                        Entrega en laboratorio:{" "}
                        {formatReportDate(
                          trackingCase.labReceivedAt ?? trackingCase.receptionAt,
                        )}
                      </p>
                      <p>Actualizado: {formatReportDate(trackingCase.updatedAt)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStageVariant(trackingCase.currentStage)}>
                        {getStageLabel(trackingCase.currentStage)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {trackingCase.specialStainRequired ? (
                        <Badge variant="secondary">Solicitud de tinción especial</Badge>
                      ) : (
                        <Badge variant="outline">Sin alerta</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[270px] items-center gap-2">
                        <label
                          className="sr-only"
                          htmlFor={`workflow-stage-${trackingCase.id}`}
                        >
                          Cambiar etapa
                        </label>
                        <select
                          id={`workflow-stage-${trackingCase.id}`}
                          value={trackingCase.currentStage}
                          onChange={(event) =>
                            void handleStageChange(
                              trackingCase,
                              event.target.value as AdminStudyTrackingStage,
                            )
                          }
                          disabled={busy}
                          className="field-select h-9 text-xs"
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
                          onClick={() => void handleSpecialStainChange(trackingCase)}
                        >
                          {trackingCase.specialStainRequired ? "Resolver" : "Solicitar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
        <div className="dashboard-table-pagination px-6 pb-5 text-sm text-muted-foreground">
          <span>
            Mostrando hasta {PAGE_LIMIT} seguimientos
            {offset > 0 ? ` desde el registro ${offset + 1}` : ""}
          </span>
          <div className="dashboard-table-pagination-controls">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
            >
              Anterior
            </Button>
            <span
              className="dashboard-pagination-context"
              aria-live="polite"
              aria-atomic="true"
            >
              {offset > 0 ? `Desde ${offset + 1}` : "Pág. 1"}
            </span>
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
