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

/** Returns `true` to claim the navigation of this request (see SINGLE FLIGHT). */
type ClinicModuleActivateListener = (moduleId: string) => boolean | void;

// Stage owners (the workspace controller on `/dashboard`, the full-route stage
// elsewhere) listen; navigation chrome does not touch this bus, it renders the
// module the owner publishes (`lib/dashboard/navigation/stageModule.ts`).
// Chrome used to listen too, so a tap after the band hydrated but before the
// controller subscribed counted as heard and was lost for the stage: the item
// moved, the workspace stayed. Same model as the admin bus.
//
// The full-route stage is an owner that HANDS OVER: every destination leaves its
// route for `/dashboard`, whose controller replaces it on the commit. It hears
// each request but keeps the latest one for that next owner; otherwise A then B
// before A's commit left the new controller on A. It never claims: its
// destinations leave the route, and the router discards a pending cross-route
// navigation that a newer one supersedes.
//
// SINGLE FLIGHT. Every committed router state writes one history entry, so two
// module pushes in flight left either [A, B, C] (B committed on its own: Back
// landed on the module the user had abandoned) or [A, C], depending on payload
// timing. The controller therefore claims a request that arrives while its
// previous navigation is still in flight: the caller does not navigate, and the
// controller replaces the in-flight entry with the latest module once that
// navigation lands. History is always [A, C].
const moduleActivateListeners = new Map<ClinicModuleActivateListener, boolean>();

const LATE_ACTIVATION_MAX_AGE_MS = 5_000;
let unheardActivation: { moduleId: string; at: number } | null = null;

// Back/Forward commits the restored entry inside the router's own popstate
// listener, so an owner subscribing during that dispatch was mounted by the
// traversal: it supersedes the kept destination, and the stage that kept it is
// unmounted before its own popstate listener runs. Holds without the Navigation
// API, where `subscribeHistoryTraversal` cannot drop it earlier.
function isHistoryTraversalDispatch(): boolean {
  return typeof window !== "undefined" && window.event?.type === "popstate";
}

/** `true` means a stage owner claimed the navigation: the caller must not navigate. */
export function requestClinicModuleActivate(moduleId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  let settled = false;
  let claimed = false;
  moduleActivateListeners.forEach((handsOver, listener) => {
    if (listener(moduleId) === true && !handsOver) claimed = true;
    if (!handsOver) settled = true;
  });
  unheardActivation = settled ? null : { moduleId, at: performance.now() };
  return claimed;
}

export function subscribeClinicModuleActivate(
  listener: ClinicModuleActivateListener,
  { handsOver = false }: { readonly handsOver?: boolean } = {},
): () => void {
  moduleActivateListeners.set(listener, handsOver);
  if (!handsOver) {
    const late = unheardActivation;
    unheardActivation = null;
    if (
      late &&
      !isHistoryTraversalDispatch() &&
      performance.now() - late.at <= LATE_ACTIVATION_MAX_AGE_MS
    ) {
      listener(late.moduleId);
    }
  }
  return () => moduleActivateListeners.delete(listener);
}

/** Back/Forward before the commit supersedes the intent kept for the next owner. */
export function relinquishClinicModuleActivateHandOver(): void {
  unheardActivation = null;
}
