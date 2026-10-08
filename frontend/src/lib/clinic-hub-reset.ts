type ClinicHubResetListener = () => void;

const hubResetListeners = new Set<ClinicHubResetListener>();

export function requestClinicHubReset(): void {
  if (typeof window === "undefined") {
    return;
  }
  hubResetListeners.forEach((listener) => listener());
}

export function subscribeClinicHubReset(
  listener: ClinicHubResetListener,
): () => void {
  hubResetListeners.add(listener);
  return () => hubResetListeners.delete(listener);
}

type ClinicModuleActivateListener = (moduleId: string) => void;

// Stage owners (the workspace controller on `/dashboard`, the full-route stage
// elsewhere) listen; navigation chrome (lateral band, mobile bar) only observes.
// Chrome used to listen too, so a tap after the band hydrated but before the
// controller subscribed counted as heard and was lost for the stage: the item
// moved, the workspace stayed. Same model as the admin bus.
const moduleActivateListeners = new Set<ClinicModuleActivateListener>();
const moduleActivateObservers = new Set<ClinicModuleActivateListener>();

const LATE_ACTIVATION_MAX_AGE_MS = 5_000;
let unheardActivation: { moduleId: string; at: number } | null = null;

export function requestClinicModuleActivate(moduleId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  moduleActivateObservers.forEach((observer) => observer(moduleId));
  if (moduleActivateListeners.size === 0) {
    unheardActivation = { moduleId, at: performance.now() };
    return;
  }
  moduleActivateListeners.forEach((listener) => listener(moduleId));
}

export function subscribeClinicModuleActivate(
  listener: ClinicModuleActivateListener,
): () => void {
  moduleActivateListeners.add(listener);
  const late = unheardActivation;
  unheardActivation = null;
  if (late && performance.now() - late.at <= LATE_ACTIVATION_MAX_AGE_MS) {
    listener(late.moduleId);
  }
  return () => moduleActivateListeners.delete(listener);
}

/** Mirror every clinic module request without taking a stage owner's role. */
export function observeClinicModuleActivate(
  observer: ClinicModuleActivateListener,
): () => void {
  moduleActivateObservers.add(observer);
  return () => moduleActivateObservers.delete(observer);
}
