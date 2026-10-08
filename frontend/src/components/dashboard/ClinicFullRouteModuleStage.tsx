"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WorkspaceScaffold } from "@/features/dashboard/presentation/layout";
import {
  CLINIC_MODULE_NAV_LABELS,
  parseClinicModule,
  type ClinicModule,
} from "@/features/dashboard/config";
import {
  relinquishClinicModuleActivateHandOver,
  subscribeClinicModuleActivate,
} from "@/lib/clinic-hub-reset";
import { LoadingState } from "./LoadingState";
import { usePublishStageModule } from "./useStageModule";

/**
 * CMP-06 — Full clinic routes use the same structural stage/workspace/viewport
 * chain as the module dashboard, without adding its desktop-only workspace header.
 *
 * STAGE OWNER OF THE ACTIVATION. Every band destination leaves this route for
 * `/dashboard`, whose server render can take seconds. No owner heard the
 * activation here, so the route's content stayed on stage for the whole wait
 * and the click looked dropped. The stage swaps to the destination's pending
 * workspace on the signal; the commit replaces the page, and Back/Forward
 * restores the route's own content. It hands the latest destination over to the
 * controller that replaces it, so A then B before A's commit never lands on A.
 */
export function ClinicFullRouteModuleStage({
  moduleId,
  children,
}: {
  readonly moduleId: string;
  readonly children: ReactNode;
}) {
  const [leavingTo, setLeavingTo] = useState<ClinicModule | null>(null);

  useEffect(
    () =>
      subscribeClinicModuleActivate(
        (target) => {
          const parsed = parseClinicModule(target);
          if (parsed) setLeavingTo(parsed);
        },
        { handsOver: true },
      ),
    [],
  );

  useEffect(() => {
    const stay = () => {
      relinquishClinicModuleActivateHandOver();
      setLeavingTo(null);
    };
    window.addEventListener("popstate", stay);
    return () => window.removeEventListener("popstate", stay);
  }, []);

  // Only while leaving: on its own module the route's band and bar already
  // know it from the route.
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
      <WorkspaceScaffold
        kind="full-route"
        moduleId={leavingTo ?? moduleId}
        collection={
          leavingTo ? <LoadingState label={`Cargando ${pendingLabel ?? leavingTo}`} /> : children
        }
      />
    </div>
  );
}
