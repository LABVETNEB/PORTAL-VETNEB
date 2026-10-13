/**
 * Budget of a module navigation (DT-5). The navigation owner arms it per
 * `navId` and the machine decides what a flight that outlives it becomes.
 * The budget is a policy, not a property of the protocol.
 *
 * @see test/unit/ui/dashboard/frontend-dashboard-lateral-navigation.test.ts
 */

export const NAVIGATION_FLIGHT_BUDGET_MS = 10_000;
