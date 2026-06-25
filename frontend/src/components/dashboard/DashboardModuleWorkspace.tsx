"use client";

import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";

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
      className="flex min-h-0 flex-1 flex-col dashboard-workspace-enter"
      data-dashboard-module-workspace={moduleId}
      aria-label={title}
    >
      <div className="dashboard-workspace-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Vista general"
            data-dashboard-module-back-button="true"
            className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium text-muted-foreground dashboard-btn-interactive hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 shrink-0"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            <span>Vista general</span>
          </button>
          <div className="min-w-0">
            <h2 className="dashboard-section-heading truncate">{title}</h2>
            {description ? (
              <p className="dashboard-section-description truncate">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col pt-4"
        data-dashboard-module-viewport={moduleId}
      >
        {children}
      </div>
    </section>
  );
}
