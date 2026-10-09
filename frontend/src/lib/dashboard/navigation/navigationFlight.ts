/**
 * Budget of a stage owner's module navigation (SINGLE FLIGHT).
 *
 * The owner claims every request that arrives while its own navigation is in
 * flight and issues the latest one once that navigation lands
 * (`clinic-hub-reset.ts`, `admin-hub-reset.ts`). A url commit, Back/Forward and
 * a failed payload (Next reloads the document) all end the flight. A payload
 * that never answers ends nothing: Next never aborts a navigation's request and
 * exposes no event, rejection or callback while it is pending. The claims then
 * held every later click while the stage followed them, and the url and
 * history stayed on the origin until a reload.
 *
 * Elapsed time is the only signal that case leaves, so the flight has a budget.
 * The budget is a policy, not a property of the protocol: within it SINGLE
 * FLIGHT is unchanged; past it the flight is ABANDONED. If the latest intent is
 * not the navigation already in flight, the owner navigates it once, as a new
 * flight; otherwise nothing is re-issued and claims simply stop. A navigation is
 * never handed over twice, so two hung payloads cannot become a retry loop.
 * A late commit of an abandoned navigation is still a superseded target:
 * reconciled, never painted.
 *
 * NO IMPORTS, no DOM: testable from `test/unit/ui` with a short budget.
 *
 * @see test/unit/ui/dashboard/frontend-dashboard-lateral-navigation.test.ts
 */

export const NAVIGATION_FLIGHT_BUDGET_MS = 10_000;

export type NavigationFlight = {
  /** Arms the budget of the navigation to `target` just issued. */
  readonly start: (target: string) => void;
  /** The flight reached a terminal state: committed, cancelled or dropped. */
  readonly end: () => void;
  /** `false` once ended or abandoned: requests are no longer claimed. */
  readonly isActive: () => boolean;
};

/**
 * `onExpire` gets the target of the abandoned navigation and returns the target
 * it navigated instead (a new flight), or `null` when it issued nothing.
 */
export function createNavigationFlight(
  onExpire: (abandonedTarget: string) => string | null,
  budgetMs: number = NAVIGATION_FLIGHT_BUDGET_MS,
): NavigationFlight {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function end() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function start(target: string) {
    end();
    timer = setTimeout(() => {
      timer = null;
      const handedOver = onExpire(target);
      if (handedOver !== null && handedOver !== target) start(handedOver);
    }, budgetMs);
  }

  return { start, end, isActive: () => timer !== null };
}
