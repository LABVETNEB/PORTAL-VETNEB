"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceScaffold } from "@/features/dashboard/presentation/layout";
import { CLINIC_MODULE_NAV_LABELS } from "@/features/dashboard/config";
import { useClinicDashboardNavigation } from "./DashboardNavigationProvider";
import { LoadingState } from "./LoadingState";
import { usePublishStageModule } from "./useStageModule";

// STALLED: the navigation outlived its budget and nothing in the router says
// whether it will ever land. A zero-height anchor with the notice laid over
// what follows it, so showing or dismissing it never changes the height the
// workspace measures. The retry is a document navigation to the same target.
function FullRouteNavigationStalledNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="relative z-[3] h-0 shrink-0">
      <div
        role="status"
        data-dashboard-navigation-stalled="true"
        className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-500/25 bg-card px-3 py-1.5 text-xs text-amber-700 shadow-sm"
      >
        <p className="min-w-0 flex-1 basis-56">
          <span className="font-semibold">El módulo está tardando en cargar.</span> Podés esperar o
          reintentar la carga.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="h-7 shrink-0 border-amber-500/30 px-2 text-xs text-amber-700 hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-700 focus-visible:ring-2"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}

/**
 * CMP-06 — Full clinic routes use the same structural stage/workspace/viewport
 * chain as the module dashboard, without adding its desktop-only workspace header.
 *
 * View of the clinic stage on a full route. It decides nothing about
 * navigation: the route's own content is on stage while the navigation
 * machine's `display` is this route, and the destination's pending workspace
 * while it is anything else — a module chosen on the band, whose `/dashboard`
 * server render can take seconds, or the entry a Back/Forward is heading to.
 * The owner (`components/dashboard/DashboardNavigationProvider.tsx`) holds the
 * URL, history, the budget and the claim of a second choice.
 */
export function ClinicFullRouteModuleStage({
  moduleId,
  children,
}: {
  readonly moduleId: string;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const navigation = useClinicDashboardNavigation();
  const leaving = navigation !== null && navigation.route !== pathname;
  const leavingTo = leaving ? navigation.module : null;

  // The band of a full route reads what the stage publishes. Only while
  // leaving for a module: on its own module the band already knows it from the
  // route.
  usePublishStageModule("clinic", leavingTo, leavingTo !== null);

  const pendingLabel = leavingTo
    ? CLINIC_MODULE_NAV_LABELS.find((entry) => entry.moduleId === leavingTo)?.label
    : undefined;

  return (
    <div
      data-dashboard-module-stage="true"
      data-clinic-dashboard-stage="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
    >
      {navigation?.stalled ? <FullRouteNavigationStalledNotice onRetry={navigation.retry} /> : null}
      <WorkspaceScaffold
        kind="full-route"
        moduleId={leavingTo ?? moduleId}
        collection={
          leaving ? <LoadingState label={`Cargando ${pendingLabel ?? "el módulo"}`} /> : children
        }
      />
    </div>
  );
}
