"use client";

import { useId, type ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { WorkspaceScaffold } from "@/features/dashboard/presentation/layout";

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
    <WorkspaceScaffold
      kind="module"
      moduleId={moduleId}
      titleId={titleId}
      descriptionId={description ? descriptionId : undefined}
      title={title}
      description={description}
      collection={children}
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
  );
}
