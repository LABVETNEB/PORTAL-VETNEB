import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { useAdminDashboardNavigation } from "./DashboardNavigationProvider";
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
 * On the admin surface the owner is the navigation machine and this is its
 * `display` (PR-NAV-03); the clinic surface still reads the published stage.
 * It reads the search params for the admin display: call it under a boundary.
 */
export function useStageModule(surface: StageSurface): StageModuleSnapshot {
  const adminNavigation = useAdminDashboardNavigation();
  const published = usePublishedStageModule(surface);
  if (surface === "admin") return adminNavigation === null ? undefined : adminNavigation.module;
  return published;
}

export function useAdminStageModule(): StageModuleSnapshot {
  const adminNavigation = useAdminDashboardNavigation();
  return adminNavigation === null ? undefined : adminNavigation.module;
}

/** Clinic only: no part of the admin navigation is read here. */
export function useClinicStageModule(): StageModuleSnapshot {
  return usePublishedStageModule("clinic");
}
