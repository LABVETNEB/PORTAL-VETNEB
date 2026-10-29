// Input adapter of admin module navigation (PR-NAV-03).
//
// Every in-dashboard module destination — mobile bar, lateral band, app-bar
// search, overview links, kebab — asks here before navigating. The answer used
// to come from a listener bus that the workspace controller subscribed to, with
// its own copy of "is a navigation in flight" and a replay of the request the
// controller had not heard yet. The navigation machine now owns that decision
// (docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md §11.3):
// this file hands the request to the mounted owner, or holds the latest early
// selection until the owner can take it.
//
// `true` means the owner took the selection or will receive it on registration;
// the caller must not navigate. A mounted owner can still decline an invalid
// selection or a failed state, returning `false` for the caller's fallback.
//
// No DOM: the owner registers itself
// (`components/dashboard/DashboardNavigationProvider.tsx`).

export type AdminNavigationOwner = {
  /** `true` when the selection was dispatched to the machine. */
  readonly selectModule: (moduleId: string) => boolean;
  readonly selectHub: () => void;
};

let owner: AdminNavigationOwner | null = null;
let pendingModule: string | null = null;

/** The provider registers on mount; the returned function unregisters it. */
export function registerAdminNavigationOwner(next: AdminNavigationOwner): () => void {
  owner = next;
  const early = pendingModule;
  pendingModule = null;
  if (early !== null) next.selectModule(early);
  return () => {
    if (owner === next) owner = null;
  };
}

/**
 * Ask the admin navigation owner to open a module. A pre-owner request replaces
 * any earlier one and is delivered once before the initial restore drains.
 */
export function requestAdminModuleActivate(moduleId: string): boolean {
  if (owner !== null) {
    pendingModule = null;
    return owner.selectModule(moduleId);
  }
  pendingModule = moduleId;
  return true;
}

/**
 * Contracted signal of the retired mobile "Inicio" slot; it has no producer
 * left. The machine rejects a hub selection on the admin surface (#6).
 */
export function requestAdminHubReset(): void {
  owner?.selectHub();
}
