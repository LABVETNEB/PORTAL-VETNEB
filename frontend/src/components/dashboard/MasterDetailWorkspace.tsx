import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MasterDetailWorkspaceProps = {
  master: ReactNode;
  detail: ReactNode;
  emptyDetail?: ReactNode;
  selectedId?: string | null;
  className?: string;
};

export function MasterDetailWorkspace({
  master,
  detail,
  emptyDetail,
  selectedId,
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
    >
      <div
        aria-label="Panel maestro"
        className="min-w-0 overflow-hidden rounded-lg border border-vetneb-line/80 bg-card/95 shadow-sm"
      >
        <div className="max-h-none min-w-0 overflow-x-hidden overflow-y-visible xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
          {master}
        </div>
      </div>

      <div
        aria-label="Panel de detalle"
        className="min-w-0 overflow-hidden rounded-lg border border-vetneb-line/80 bg-card/95 shadow-sm"
      >
        {hasSelection ? detail : emptyDetail ?? detail}
      </div>
    </section>
  );
}
