// Cross-component signal so the mobile bottom-nav "Inicio" can return the admin
// workspace controller to the hub synchronously. The controller renders the
// active module from local state (set instantly, ahead of the async URL push),
// so a fast Hub→module→Inicio round trip can leave the controller stranded on
// the previous module when the bottom-nav navigation collapses into a same-URL
// no-op (the in-flight module push is cancelled before it commits, so
// `useSearchParams` never changes and the reconciliation effect never runs).
// Publishing this signal lets the controller drop back to the hub regardless of
// the URL navigation state. Only the mobile bottom-nav "Inicio" published it;
// that slot is retired (pre-C05 mobile space), so the reset has no producer
// left and is kept as a contracted signal.

type AdminHubResetListener = () => void;

const hubResetListeners = new Set<AdminHubResetListener>();

/** Ask the admin workspace controller to return to the hub immediately. */
export function requestAdminHubReset(): void {
  if (typeof window === "undefined") {
    return;
  }
  hubResetListeners.forEach((listener) => listener());
}

export function subscribeAdminHubReset(
  listener: AdminHubResetListener,
): () => void {
  hubResetListeners.add(listener);
  return () => hubResetListeners.delete(listener);
}

// The mobile bottom-nav module destinations also navigate via `router.push`, but
// that URL push is async and, under load, can lag well past the navigation —
// leaving the controller stranded on the previous module because its
// `useSearchParams` reconciliation effect only runs once the URL commits. The
// hub cards never show this because `activateModule` sets the active module from
// local state synchronously, ahead of the URL. Mirror that: publish the target
// module so the controller activates it synchronously (optimistically) while the
// URL catches up in the background. Every in-dashboard module destination
// publishes (mobile bar, lateral band, app-bar search, overview links, kebab):
// the commit waits on the whole server render, so a destination that skipped
// the signal left the stage on the previous module until it landed. The
// navigation chrome does not listen here: it renders the module the controller
// publishes (`lib/dashboard/navigation/stageModule.ts`).

// SINGLE FLIGHT. Every committed router state writes one history entry, so two
// module pushes in flight left either [A, B, C] (B committed on its own: Back
// landed on the module the user had abandoned) or [A, C], depending on payload
// timing. The controller therefore claims a request that arrives while its
// previous navigation is still in flight: the caller does not navigate, and the
// controller replaces the in-flight entry with the latest module once that
// navigation lands. History is always [A, C].

/** Returns `true` to claim the navigation of this request. */
type AdminModuleActivateListener = (moduleId: string) => boolean | void;

const moduleActivateListeners = new Set<AdminModuleActivateListener>();

// The bar can hydrate before the controller subscribes: a tap in that window
// used to be dropped, and the controller then resolved its own landing over the
// user's navigation. Hand the latest unheard request to the first subscriber,
// only while it is fresh.
const LATE_ACTIVATION_MAX_AGE_MS = 5_000;
let unheardActivation: { moduleId: string; at: number } | null = null;

/**
 * Ask the admin workspace controller to open a module immediately. `true` means
 * the controller claimed the navigation: the caller must not navigate.
 */
export function requestAdminModuleActivate(moduleId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (moduleActivateListeners.size === 0) {
    unheardActivation = { moduleId, at: performance.now() };
    return false;
  }
  let claimed = false;
  moduleActivateListeners.forEach((listener) => {
    if (listener(moduleId) === true) claimed = true;
  });
  return claimed;
}

export function subscribeAdminModuleActivate(
  listener: AdminModuleActivateListener,
): () => void {
  moduleActivateListeners.add(listener);
  const late = unheardActivation;
  unheardActivation = null;
  if (late && performance.now() - late.at <= LATE_ACTIVATION_MAX_AGE_MS) {
    listener(late.moduleId);
  }
  return () => moduleActivateListeners.delete(listener);
}
