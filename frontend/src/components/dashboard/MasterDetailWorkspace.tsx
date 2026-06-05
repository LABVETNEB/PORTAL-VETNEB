import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MasterDetailWorkspaceProps = {
  master: ReactNode;
  detail: ReactNode;
  emptyDetail?: ReactNode;
  selectedId?: string | null;
  workspaceLabel?: string;
  masterLabel?: string;
  detailLabel?: string;
  className?: string;
};

export function MasterDetailWorkspace({
  master,
  detail,
  emptyDetail,
  selectedId,
  workspaceLabel = "Workspace maestro detalle",
  masterLabel = "Panel maestro",
  detailLabel = "Panel de detalle",
  className,
}: MasterDetailWorkspaceProps) {
  const hasSelection = Boolean(selectedId);

  return (
    <section
      className={cn(
        "grid min-w-0 grid-cols-1 gap-4 overflow-x-hidden xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]",
        className,
      )}
      data-selected-id={selectedId ?? undefined}
      aria-label={workspaceLabel}
    >
      <div
        aria-label={masterLabel}
        className="min-w-0 overflow-hidden rounded-lg border border-vetneb-line/80 bg-card/95 shadow-sm"
      >
        <div className="max-h-none min-w-0 overflow-x-hidden overflow-y-visible xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
          {master}
        </div>
      </div>

      <div
        aria-label={detailLabel}
        data-detail-state={hasSelection ? "selected" : "empty"}
        className="min-w-0 overflow-hidden rounded-lg border border-vetneb-line/80 bg-card/95 shadow-sm"
      >
        <p className="sr-only" aria-live="polite">
          {hasSelection
            ? `Detalle seleccionado: ${selectedId}`
            : "Sin detalle seleccionado"}
        </p>
        {hasSelection ? detail : emptyDetail ?? detail}
      </div>
    </section>
  );
}
