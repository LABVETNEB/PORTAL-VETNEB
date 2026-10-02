import type { ReactNode } from "react";
import { WorkspaceScaffold } from "@/features/dashboard/presentation/layout";

/**
 * CMP-06 — Full clinic routes use the same structural stage/workspace/viewport
 * chain as the module dashboard, without adding its desktop-only workspace header.
 */
export function ClinicFullRouteModuleStage({
  moduleId,
  children,
}: {
  readonly moduleId: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      data-dashboard-module-stage="true"
      data-clinic-dashboard-stage="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
    >
      <WorkspaceScaffold kind="full-route" moduleId={moduleId} collection={children} />
    </div>
  );
}
