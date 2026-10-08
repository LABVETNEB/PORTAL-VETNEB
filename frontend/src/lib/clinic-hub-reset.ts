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
//
// The full-route stage is an owner that HANDS OVER: every destination leaves its
// route for `/dashboard`, whose controller replaces it on the commit. It hears
// each request but keeps the latest one for that next owner; otherwise A then B
// before A's commit left the new controller on A.
const moduleActivateListeners = new Map<ClinicModuleActivateListener, boolean>();
const moduleActivateObservers = new Set<ClinicModuleActivateListener>();

const LATE_ACTIVATION_MAX_AGE_MS = 5_000;
let unheardActivation: { moduleId: string; at: number } | null = null;

export function requestClinicModuleActivate(moduleId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  moduleActivateObservers.forEach((observer) => observer(moduleId));
  let settled = false;
  moduleActivateListeners.forEach((handsOver, listener) => {
    listener(moduleId);
    if (!handsOver) settled = true;
  });
  unheardActivation = settled ? null : { moduleId, at: performance.now() };
}

export function subscribeClinicModuleActivate(
  listener: ClinicModuleActivateListener,
  { handsOver = false }: { readonly handsOver?: boolean } = {},
): () => void {
  moduleActivateListeners.set(listener, handsOver);
  if (!handsOver) {
    const late = unheardActivation;
    unheardActivation = null;
    if (late && performance.now() - late.at <= LATE_ACTIVATION_MAX_AGE_MS) {
      listener(late.moduleId);
    }
  }
  return () => moduleActivateListeners.delete(listener);
}

/** Back/Forward before the commit supersedes the intent kept for the next owner. */
export function relinquishClinicModuleActivateHandOver(): void {
  unheardActivation = null;
}

/** Mirror every clinic module request without taking a stage owner's role. */
export function observeClinicModuleActivate(
  observer: ClinicModuleActivateListener,
): () => void {
  moduleActivateObservers.add(observer);
  return () => moduleActivateObservers.delete(observer);
}
