"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";

import { getReportDownloadUrl, getReportPreviewUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ReportAction = "preview" | "download";

type ReportFileActionsProps = {
  reportId: number | null;
  hasFile?: boolean;
  scope?: "clinic" | "admin";
  align?: "start" | "end";
};

function getUnavailableLabel(reportId: number | null, hasFile: boolean) {
  if (typeof reportId !== "number") {
    return "Informe no disponible.";
  }

  if (!hasFile) {
    return "Archivo no disponible.";
  }

  return null;
}

export function ReportFileActions({
  reportId,
  hasFile = true,
  scope = "clinic",
  align = "end",
}: ReportFileActionsProps) {
  const [loadingAction, setLoadingAction] = useState<ReportAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const unavailableLabel = getUnavailableLabel(reportId, hasFile);
  const unavailableTitle = unavailableLabel ?? "Informe no disponible.";
  const isAvailable = unavailableLabel === null;
  const isLoading = loadingAction !== null;
  const alignClass =
    align === "start" ? "items-start text-left" : "items-end text-right";
  const buttonsAlignClass = align === "start" ? "justify-start" : "justify-end";

  async function openReport(action: ReportAction) {
    if (!isAvailable || isLoading || typeof reportId !== "number") {
      return;
    }

    setErrorMessage(null);
    setLoadingAction(action);

    try {
      const url =
        action === "preview"
          ? await getReportPreviewUrl(reportId, { scope })
          : await getReportDownloadUrl(reportId, { scope });

      if (!url) {
        setErrorMessage(
          action === "preview"
            ? "Informe no disponible para visualizar."
            : "Informe no disponible para descarga.",
        );
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : action === "preview"
            ? "No se pudo obtener el enlace de visualización."
            : "No se pudo obtener el enlace de descarga.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${alignClass}`}>
      <div className={`flex flex-wrap gap-2 ${buttonsAlignClass}`}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-primary hover:text-primary"
          disabled={!isAvailable || isLoading}
          title={isAvailable ? "Ver informe" : unavailableTitle}
          aria-label={isAvailable ? "Ver informe" : unavailableTitle}
          onClick={() => void openReport("preview")}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {loadingAction === "preview" ? "Abriendo..." : "Ver informe"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-primary hover:text-primary"
          disabled={!isAvailable || isLoading}
          title={isAvailable ? "Descargar informe" : unavailableTitle}
          aria-label={isAvailable ? "Descargar informe" : unavailableTitle}
          onClick={() => void openReport("download")}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {loadingAction === "download" ? "Preparando..." : "Descargar"}
        </Button>
      </div>

      {!isAvailable ? (
        <span className="max-w-48 text-[11px] text-muted-foreground">
          {unavailableLabel}
        </span>
      ) : null}

      {errorMessage ? (
        <span className="max-w-48 text-[11px] text-red-600" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}

export function ReportDownloadButton(
  props: Omit<ReportFileActionsProps, "align">,
) {
  return <ReportFileActions {...props} align="end" />;
}
