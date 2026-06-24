// Cross-component signal so the mobile bottom-nav "Inicio" can return the admin
// workspace controller to the hub synchronously. The controller renders the
// active module from local state (set instantly, ahead of the async URL push),
// so a fast Hub→module→Inicio round trip can leave the controller stranded on
// the previous module when the bottom-nav navigation collapses into a same-URL
// no-op (the in-flight module push is cancelled before it commits, so
// `useSearchParams` never changes and the reconciliation effect never runs).
// Publishing this signal lets the controller drop back to the hub regardless of
// the URL navigation state. Only the mobile bottom-nav publishes; desktop never
// does, so desktop behaviour is unchanged.

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
// URL catches up in the background. Only the mobile bottom-nav publishes, so
// desktop behaviour is unchanged.

type AdminModuleActivateListener = (moduleId: string) => void;

const moduleActivateListeners = new Set<AdminModuleActivateListener>();

/** Ask the admin workspace controller to open a module immediately. */
export function requestAdminModuleActivate(moduleId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  moduleActivateListeners.forEach((listener) => listener(moduleId));
}

export function subscribeAdminModuleActivate(
  listener: AdminModuleActivateListener,
): () => void {
  moduleActivateListeners.add(listener);
  return () => moduleActivateListeners.delete(listener);
}
