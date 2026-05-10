"use client";

import { useState } from "react";

import { getReportDownloadUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ReportDownloadButtonProps = {
  reportId: number;
  hasStoragePath: boolean;
};

export function ReportDownloadButton({
  reportId,
  hasStoragePath,
}: ReportDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload() {
    if (!hasStoragePath || isLoading) {
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const url = await getReportDownloadUrl(reportId);

      if (!url) {
        setErrorMessage("Informe no disponible para descarga.");
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo obtener el enlace de descarga.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-primary hover:text-primary"
        disabled={!hasStoragePath || isLoading}
        title={hasStoragePath ? "Descargar informe" : "Informe no disponible aún"}
        onClick={handleDownload}
      >
        {isLoading
          ? "Preparando..."
          : hasStoragePath
            ? "Descargar"
            : "No disponible"}
      </Button>

      {errorMessage ? (
        <span className="max-w-40 text-right text-[11px] text-red-600" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
