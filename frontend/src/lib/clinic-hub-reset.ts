// Input adapter of clinic module navigation (PR-NAV-04).
//
// Every in-dashboard module destination asks here before navigating. The
// navigation machine owns the answer
// (docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md §11.3): this
// file hands the request to the mounted owner, registered by
// `components/dashboard/DashboardNavigationProvider.tsx`.
//
// `true` means the owner took the selection and the caller must not navigate:
// the machine navigates it, claims it for the flight already in the router
// (#29) or finds it already current. `false` means no owner can take it — none
// is mounted yet, or the machine would ignore it (BOOTING, FAILED, an unknown
// module) — and the caller keeps its own navigation.
//
// NO IMPORTS, no DOM beyond the hand-over below.

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

/** Returns `true` to claim the navigation of this request (see SINGLE FLIGHT). */
type ClinicModuleActivateListener = (moduleId: string) => boolean | void;

// HAND-OVER OF THE FULL ROUTES, kept until PR-NAV-05. The full-route stage is not
// a view of the machine yet: it listens here to swap to the destination's
// pending workspace on the request, and never claims. Everything below this
// line other than the call to the owner serves that stage only, including the
// replay of a request no stage owner heard, which has no listener left since
// the workspace controller stopped subscribing.
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

/** `true` means the navigation owner took the selection: the caller must not navigate. */
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
  return (owner?.selectModule(moduleId) ?? false) || claimed;
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
