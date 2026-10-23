"use client";

import { useId, useState } from "react";
import { Download, Eye } from "lucide-react";

import { getReportDownloadUrl, getReportPreviewUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ReportAction = "preview" | "download";

type ReportFileActionsProps = {
  reportId: number | null;
  hasFile?: boolean;
  scope?: "clinic" | "admin";
  align?: "start" | "end";
  onPreview?: (trigger: HTMLElement) => Promise<void>;
  onDownload?: () => Promise<void>;
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
  onPreview,
  onDownload,
}: ReportFileActionsProps) {
  const [loadingAction, setLoadingAction] = useState<ReportAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const actionIds = useId();

  const unavailableLabel = getUnavailableLabel(reportId, hasFile);
  const unavailableTitle = unavailableLabel ?? "Informe no disponible.";
  const isAvailable = unavailableLabel === null;
  const isLoading = loadingAction !== null;
  const alignClass =
    align === "start" ? "items-start text-left" : "items-end text-right";
  const buttonsAlignClass = align === "start" ? "justify-start" : "justify-end";

  async function openReport(action: ReportAction, trigger?: HTMLElement) {
    if (!isAvailable || isLoading || typeof reportId !== "number") {
      return;
    }

    setErrorMessage(null);
    setLoadingAction(action);

    try {
      if (action === "preview" && onPreview && trigger) {
        await onPreview(trigger);
        return;
      }
      if (action === "download" && onDownload) {
        await onDownload();
        return;
      }
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
          aria-busy={loadingAction === "preview"}
          title={isAvailable ? "Ver informe" : unavailableTitle}
          aria-label={isAvailable ? "Ver informe" : unavailableTitle}
          aria-labelledby={`${actionIds}-preview`}
          aria-describedby={isAvailable ? undefined : `${actionIds}-unavailable`}
          onClick={(event) => void openReport("preview", event.currentTarget)}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span id={`${actionIds}-preview`}>{loadingAction === "preview" ? "Abriendo..." : "Ver informe"}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-primary hover:text-primary"
          disabled={!isAvailable || isLoading}
          aria-busy={loadingAction === "download"}
          title={isAvailable ? "Descargar informe" : unavailableTitle}
          aria-label={isAvailable ? "Descargar informe" : unavailableTitle}
          aria-labelledby={`${actionIds}-download`}
          aria-describedby={isAvailable ? undefined : `${actionIds}-unavailable`}
          onClick={() => void openReport("download")}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span id={`${actionIds}-download`}>{loadingAction === "download" ? "Preparando..." : "Descargar"}</span>
        </Button>
      </div>

      {!isAvailable ? (
        <span id={`${actionIds}-unavailable`} className="max-w-48 text-[11px] text-muted-foreground">
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
