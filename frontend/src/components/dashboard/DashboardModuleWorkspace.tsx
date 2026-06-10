"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type DashboardModuleWorkspaceProps = {
  title: string;
  description?: string;
  moduleId: string;
  onBack: () => void;
  children: ReactNode;
};

export function DashboardModuleWorkspace({
  title,
  description,
  moduleId,
  onBack,
  children,
}: DashboardModuleWorkspaceProps) {
  return (
    <section
      className="flex h-full min-h-0 flex-col dashboard-workspace-enter"
      data-dashboard-module-workspace={moduleId}
      aria-label={title}
    >
      <div className="dashboard-workspace-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a módulos"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card/95 px-3 text-sm font-semibold text-foreground shadow-sm dashboard-btn-interactive hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a módulos</span>
          </button>
          <div className="min-w-0">
            <h2 className="dashboard-section-heading truncate">{title}</h2>
            {description ? (
              <p className="dashboard-section-description truncate">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        {children}
      </div>
    </section>
  );
}
