// Input adapter of clinic module navigation (PR-NAV-04, PR-NAV-05).
//
// Every in-dashboard module destination asks here before navigating, on
// `/dashboard` and on its full routes alike. The navigation machine owns the
// answer (docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md
// §11.3): this file only hands the request to the mounted owner, registered by
// `components/dashboard/DashboardNavigationProvider.tsx`.
//
// `true` means the owner took the selection and the caller must not navigate:
// the machine navigates it, claims it for the flight already in the router
// (#29) or finds it already current. `false` means no owner can take it — none
// is mounted yet, or the machine would ignore it (BOOTING, FAILED, an unknown
// module) — and the caller keeps its own navigation.
//
// NO IMPORTS, no DOM: the owner registers itself.

export type ClinicNavigationOwner = {
  /** `true` when the selection was dispatched to the machine. */
  readonly selectModule: (moduleId: string) => boolean;
  readonly selectHub: () => void;
};

let owner: ClinicNavigationOwner | null = null;

/** The provider registers on mount; the returned function unregisters it. */
export function registerClinicNavigationOwner(next: ClinicNavigationOwner): () => void {
  owner = next;
  return () => {
    if (owner === next) owner = null;
  };
}

/** The hub as a destination: SELECT_HUB (#7). No control of the product emits it yet. */
export function requestClinicHubReset(): void {
  owner?.selectHub();
}

/** `true` means the navigation owner took the selection: the caller must not navigate. */
export function requestClinicModuleActivate(moduleId: string): boolean {
  return owner === null ? false : owner.selectModule(moduleId);
}
