"use client";

import { RefreshCw, RotateCw } from "lucide-react";
import { unstable_isUnrecognizedActionError } from "next/navigation";

import { Button } from "@/components/ui/button";

// "outdated": the server no longer knows the Server Action this tab calls. Its
// id belongs to the build that rendered the tab, so calling it again cannot
// succeed; only the current document carries the current id.
export type PageRequestFailure = "outdated" | "failed";

export function classifyPageRequestFailure(error: unknown): PageRequestFailure {
  return unstable_isUnrecognizedActionError(error) ? "outdated" : "failed";
}

const FAILURE_MESSAGE: Record<PageRequestFailure, string> = {
  outdated: "Hay una versión nueva del portal.",
  failed: "No se pudo cargar la página pedida.",
};

const ACTION_CLASS_NAME =
  "h-7 shrink-0 border-amber-500/30 px-2 text-xs text-amber-700 hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-700 focus-visible:ring-2";

type PageRequestRecoveryProps = {
  failure: PageRequestFailure;
  onRetry: () => void;
  /** What a reload keeps and what it discards on this surface. */
  reloadNotice: string;
};

// A zero-height anchor in the flow with the notice laid over what follows it:
// it takes no room, so the measured rows canvas keeps its height and showing
// or dismissing the notice never changes the page size. The reload only ever
// runs from its own click: nothing here schedules it.
export function PageRequestRecovery({ failure, onRetry, reloadNotice }: PageRequestRecoveryProps) {
  return (
    <div className="relative z-[3] h-0 shrink-0">
      <div
        role="alert"
        data-page-request-recovery={failure}
        className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-500/25 bg-card px-3 py-1.5 text-xs text-amber-700 shadow-sm"
      >
        <p className="min-w-0 flex-1 basis-56">
          <span className="font-semibold">{FAILURE_MESSAGE[failure]}</span> {reloadNotice}
        </p>
        <div className="flex shrink-0 gap-2">
          {failure === "failed" ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry} className={ACTION_CLASS_NAME}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reintentar
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-page-request-reload="true"
            onClick={() => window.location.reload()}
            className={ACTION_CLASS_NAME}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Recargar página
          </Button>
        </div>
      </div>
    </div>
  );
}
