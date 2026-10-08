import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
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

/** Chrome side: the owner's module, or `undefined` when no owner is mounted. */
export function useStageModule(surface: StageSurface): StageModuleSnapshot {
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

export function useAdminStageModule(): StageModuleSnapshot {
  return useStageModule("admin");
}

export function useClinicStageModule(): StageModuleSnapshot {
  return useStageModule("clinic");
}
