"use client";

import { AlertCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  supportText?: string;
  tone?: "warning" | "critical";
  className?: string;
};

export function ErrorState({
  title = "No se pudo completar la acción",
  message,
  onRetry,
  supportText,
  tone = "critical",
  className,
}: ErrorStateProps) {
  const isWarning = tone === "warning";
  const Icon = isWarning ? AlertTriangle : AlertCircle;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-4 sm:flex-row sm:items-start sm:justify-between",
        isWarning
          ? "border-amber-500/25 bg-amber-500/8 text-amber-700"
          : "border-destructive/25 bg-destructive/8 text-destructive",
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
          <p
            className={cn(
              "text-sm",
              isWarning ? "text-amber-700/88" : "text-destructive/88",
            )}
          >
            {message}
          </p>
          {supportText ? (
            <p
              className={cn(
                "mt-1 text-xs",
                isWarning ? "text-amber-600/75" : "text-destructive/65",
              )}
            >
              {supportText}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className={cn(
            "shrink-0 focus-visible:ring-2",
            isWarning
              ? "border-amber-500/30 text-amber-700 hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-700"
              : "border-destructive/30 text-destructive hover:border-destructive/45 hover:bg-destructive/10 hover:text-destructive",
          )}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
