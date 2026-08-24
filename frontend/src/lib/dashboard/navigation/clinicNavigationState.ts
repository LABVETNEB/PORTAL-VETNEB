/**
 * Clinic module navigation state machine — the single authority over which URL
 * commit the workspace is allowed to obey.
 *
 * The clinic stage swaps modules OPTIMISTICALLY: a tap publishes an activation
 * signal and the workspace changes before `router.push` commits the matching
 * URL. That leaves a sub-second window in which a SUPERSEDED navigation can
 * still commit, so every commit has to be classified as "the one I asked for"
 * or "the stale one I already replaced".
 *
 * That classification used to live inline in the controller and decided whether
 * a new intention was a no-op by comparing it against `currentUrlModule` — the
 * last CONFIRMED url. While a navigation is in flight that value still holds the
 * PREVIOUS module, so a new intention whose target happened to equal it was
 * misread as "nothing to do" and CLEARED the pending intent that was guarding
 * the in-flight navigation. The stale commit then had nothing to stop it and
 * reopened the module the user had just navigated away from.
 *
 * Two rules fix that, and both are expressed here rather than in the component:
 *
 *   1. A NEW intention always supersedes the previous one. The `confirmedUrl`
 *      shortcut is only sound when NOTHING is pending; while something is in
 *      flight that reference is stale by construction.
 *
 *   2. Ignoring a stale commit is not enough. Dropping it keeps the workspace
 *      right but leaves the URL — and therefore `DashboardMobileNav`, which
 *      derives `aria-current` from `useSearchParams` — pointing at the module
 *      that lost. The stale commit must be RECONCILED back to the winning
 *      intention, so url, controller, bar and `aria-current` converge.
 *
 * NO IMPORTS, no DOM, no module state, no timers. Module ids are plain strings
 * and the default module and base path are parameters, which is what keeps this
 * file free of the `@/` alias and directly testable from `test/unit/ui`.
 *
 * @see test/unit/ui/dashboard/dashboard-clinic-navigation-state.test.ts
 */

export type ClinicNavigationIntent = {
  /** Module the user last asked for, still waiting for its URL commit. */
  readonly target: string;
};

export type ClinicNavigationState = {
  /** Module of the last URL commit actually observed. */
  readonly confirmedUrlModule: string;
  /** Newest intention not yet confirmed by a URL commit. */
  readonly pendingIntent: ClinicNavigationIntent | null;
};

export type ClinicUrlCommitOutcome = {
  readonly state: ClinicNavigationState;
  /**
   * Module the workspace must show, or `null` to keep the optimistic one
   * because this commit is the superseded navigation.
   */
  readonly activeModule: string | null;
  /**
   * Module whose canonical URL must be re-asserted with `router.replace`, or
   * `null` when url and state already agree. Never more than one replace per
   * pending intent: the replace produces a matching commit, which consumes it.
   */
  readonly reconcileTo: string | null;
};

/**
 * Record a synchronous navigation intention (module activation or hub reset).
 *
 * The only case that is genuinely a no-op is "nothing in flight AND the url
 * already shows the target". Anything else arms the intent, because the newest
 * intention is by definition the one the user meant.
 */
export function recordClinicNavigationIntent(
  state: ClinicNavigationState,
  target: string,
): ClinicNavigationState {
  if (state.pendingIntent === null && state.confirmedUrlModule === target) {
    return state;
  }

  return { confirmedUrlModule: state.confirmedUrlModule, pendingIntent: { target } };
}

/**
 * Classify an observed URL commit.
 *
 * - no pending intent          -> external navigation (deep link, Back/Forward,
 *                                 restore). Obey it.
 * - commit matches the intent  -> the navigation landed. Consume the intent and
 *                                 obey it; url and state now agree.
 * - commit differs             -> the superseded navigation landed late. Keep
 *                                 the optimistic workspace and re-assert the
 *                                 intent's url so nothing is left diverged.
 */
export function applyClinicUrlCommit(
  state: ClinicNavigationState,
  nextModule: string,
): ClinicUrlCommitOutcome {
  const intent = state.pendingIntent;

  if (intent !== null && nextModule !== intent.target) {
    return {
      state: { confirmedUrlModule: nextModule, pendingIntent: intent },
      activeModule: null,
      reconcileTo: intent.target,
    };
  }

  return {
    state: { confirmedUrlModule: nextModule, pendingIntent: null },
    activeModule: nextModule,
    reconcileTo: null,
  };
}

/**
 * Canonical clinic url for a module.
 *
 * The operational default has NO query: `/dashboard` is the url the "Inicio"
 * control already links to, so reconciling to the default must land on exactly
 * that string instead of inventing a second spelling of the same surface.
 */
export function clinicModuleHref(
  basePath: string,
  defaultModule: string,
  target: string,
): string {
  return target === defaultModule ? basePath : `${basePath}?module=${target}`;
}
