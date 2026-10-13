// Input adapter of admin module navigation (PR-NAV-03).
//
// Every in-dashboard module destination — mobile bar, lateral band, app-bar
// search, overview links, kebab — asks here before navigating. The answer used
// to come from a listener bus that the workspace controller subscribed to, with
// its own copy of "is a navigation in flight" and a replay of the request the
// controller had not heard yet. The navigation machine now owns that decision
// (docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md §11.3):
// this file only hands the request to the mounted owner.
//
// `true` means the owner took the selection and the caller must not navigate:
// the machine navigates it (#5, #10, #16, #19), claims it for the flight
// already in the router (#29) or finds it already current. `false` means no
// owner can take it — none is mounted yet, or the machine would ignore it
// (BOOTING, FAILED, an unknown module) — and the caller keeps its own
// navigation, the same fallback that covers a click before hydration.
//
// NO IMPORTS, no DOM: the owner registers itself
// (`components/dashboard/DashboardNavigationProvider.tsx`).

export type AdminNavigationOwner = {
  /** `true` when the selection was dispatched to the machine. */
  readonly selectModule: (moduleId: string) => boolean;
  readonly selectHub: () => void;
};

let owner: AdminNavigationOwner | null = null;

/** The provider registers on mount; the returned function unregisters it. */
export function registerAdminNavigationOwner(next: AdminNavigationOwner): () => void {
  owner = next;
  return () => {
    if (owner === next) owner = null;
  };
}

/**
 * Ask the admin navigation owner to open a module. `true` means the owner
 * claimed the navigation: the caller must not navigate.
 */
export function requestAdminModuleActivate(moduleId: string): boolean {
  return owner === null ? false : owner.selectModule(moduleId);
}

/**
 * Contracted signal of the retired mobile "Inicio" slot; it has no producer
 * left. The machine rejects a hub selection on the admin surface (#6).
 */
export function requestAdminHubReset(): void {
  owner?.selectHub();
}
