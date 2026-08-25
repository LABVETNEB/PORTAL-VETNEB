"use client";

import { useId, type ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { WorkspaceHeader } from "@/features/dashboard/presentation/layout";

type DashboardModuleWorkspaceProps = {
  title: string;
  description?: string;
  moduleId: string;
  /**
   * Optional "back to overview" control. The clinic workspace omits it — module
   * navigation is owned by the shared `DashboardMobileNav` (<768px) or the B07/B08
   * lateral band (>=768px), and there is no hub
   * to return to. Admin still provides it to fold back into its module hub.
   */
  onBack?: () => void;
  children: ReactNode;
};

export function DashboardModuleWorkspace({
  title,
  description,
  moduleId,
  onBack,
  children,
}: DashboardModuleWorkspaceProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <section
      className="flex min-h-0 flex-1 flex-col dashboard-workspace-enter"
      data-dashboard-module-workspace={moduleId}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <WorkspaceHeader
        title={title}
        titleId={titleId}
        description={description}
        descriptionId={description ? descriptionId : undefined}
        leadingAction={
          onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Vista general"
              data-dashboard-module-back-button="true"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium text-muted-foreground dashboard-btn-interactive hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 shrink-0"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              <span>Vista general</span>
            </button>
          ) : null
        }
      />
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col pt-4"
        data-dashboard-module-viewport={moduleId}
      >
        {children}
      </div>
    </section>
  );
}
