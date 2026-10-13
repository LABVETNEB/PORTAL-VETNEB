import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { useAdminDashboardNavigation, useClinicDashboardNavigation } from "./DashboardNavigationProvider";
import {
  getStageModuleSnapshot,
  publishStageModule,
  subscribeStageModule,
  type StageModuleSnapshot,
  type StageSurface,
} from "@/lib/dashboard/navigation/stageModule";

/**
 * Stage owner side: publish the module the stage shows while it is mounted.
 * A layout effect, so the chrome re-renders in the same frame as the stage.
 */
export function usePublishStageModule(
  surface: StageSurface,
  value: string | null,
  enabled = true,
): void {
  useLayoutEffect(
    () => (enabled ? publishStageModule(surface, value) : undefined),
    [surface, value, enabled],
  );
}

/** The module a stage owner published, or `undefined` when none is mounted. */
function usePublishedStageModule(surface: StageSurface): StageModuleSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => subscribeStageModule(surface, listener),
    [surface],
  );
  return useSyncExternalStore(
    subscribe,
    () => getStageModuleSnapshot(surface),
    () => undefined,
  );
}

/**
 * Chrome side: the owner's module, or `undefined` when no owner is mounted.
 * The owner is the navigation machine and this is its `display` (admin since
 * PR-NAV-03, clinic since PR-NAV-04). While the clinic display is a full
 * route, the chrome still follows what that route's stage publishes as it
 * hands over (PR-NAV-05). It reads the search params: call it under a boundary.
 */
export function useStageModule(surface: StageSurface): StageModuleSnapshot {
  const adminNavigation = useAdminDashboardNavigation();
  const clinicNavigation = useClinicDashboardNavigation();
  const published = usePublishedStageModule(surface);
  if (surface === "admin") return adminNavigation === null ? undefined : adminNavigation.module;
  if (clinicNavigation?.hub) return null;
  return clinicNavigation?.module ?? published;
}

export function useAdminStageModule(): StageModuleSnapshot {
  const adminNavigation = useAdminDashboardNavigation();
  return adminNavigation === null ? undefined : adminNavigation.module;
}

/**
 * Clinic full routes only, whose band renders outside any boundary and cannot
 * read the search params: what the route's stage publishes while it hands over.
 */
export function useClinicStageModule(): StageModuleSnapshot {
  return usePublishedStageModule("clinic");
}
