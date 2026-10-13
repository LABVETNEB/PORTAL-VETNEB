/**
 * Interpreter of the dashboard navigation machine — the coordination algorithm
 * of docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md §12.5.1.
 *
 * The machine says what a transition emits; this file fixes when it runs:
 *
 *   A1 create     the store is born with HYDRATED applied and its effects queued
 *   A2 dispatch   the transition applies at once, in call order; nothing runs
 *   A3 schedule   one drain per synchronous block, in a microtask
 *   A4 mount      the owner becomes ready and schedules a drain
 *   A5 drain      FIFO, only while mounted, each entry only if still current
 *   A6 reconcile  timers are a function of the state, not of the effects run
 *   A7 timer      a fired budget forgets itself and dispatches BUDGET_EXPIRED
 *   A8 unmount    cancels every timer; queue and state are kept
 *
 * Currency is decided by `navId`, never by destination nor by "last
 * transition": a claim (#29) or a recorded commit (#11, #26) keeps the flight.
 *
 * NO React, no Next, no DOM, no timers and no clock of its own: the router,
 * storage, the microtask scheduler and the budget timers are injected. Type
 * imports only, so the test runner loads this file as it is.
 *
 * @see test/unit/ui/dashboard/dashboard-navigation-coordinator.test.ts
 */

import type {
  MachineConfig,
  NavContext,
  NavEffect,
  NavEvent,
  NavLocation,
  NavState,
  TransitionResult,
} from "./dashboardNavigationMachine";

export type NavigationEffect = Extract<
  NavEffect,
  { readonly type: "ROUTER_PUSH" | "ROUTER_REPLACE" | "HARD_NAVIGATE" }
>;

export type HydratedEvent = Extract<NavEvent, { readonly type: "HYDRATED" }>;

export type NavigationMachine = {
  readonly initial: (config: MachineConfig) => { ctx: NavContext; state: NavState };
  readonly transition: (
    config: MachineConfig,
    ctx: NavContext,
    state: NavState,
    event: NavEvent,
  ) => TransitionResult;
};

export type NavigationSnapshot = {
  readonly ctx: NavContext;
  readonly state: NavState;
  /** Last location handed to the machine by HYDRATED, URL_COMMITTED or RESET. */
  readonly delivered: NavLocation;
};

export type CoordinatorHost = {
  readonly scheduleMicrotask: (drain: () => void) => void;
  readonly navigate: (effect: NavigationEffect) => void;
  readonly persist: (moduleId: string) => void;
  /** One physical timer per `navId`; `expire` is its callback. */
  readonly armBudget: (navId: number, expire: () => void) => void;
  readonly cancelBudget: (navId: number) => void;
  readonly reportError: (error: unknown) => void;
};

export type NavigationCoordinator = {
  readonly getSnapshot: () => NavigationSnapshot;
  /** Notified by PUBLISH_DISPLAY; subscribers read the current snapshot. */
  readonly subscribe: (listener: () => void) => () => void;
  readonly dispatch: (event: NavEvent) => void;
  /** URL_COMMITTED, only when `location` is not the last one delivered. */
  readonly commit: (location: NavLocation) => void;
  readonly mount: () => void;
  readonly unmount: () => void;
};

type OutboxEntry = {
  readonly effect: NavEffect;
  /** `navId` of the flight the transition left in the router, if any. */
  readonly flight: number | null;
  /** Count of non-inert transitions when this entry was queued. */
  readonly seq: number;
};

export function sameNavLocation(a: NavLocation, b: NavLocation): boolean {
  if (a.kind === "module") return b.kind === "module" && a.module === b.module;
  if (a.kind === "route") return b.kind === "route" && a.module === b.module && a.path === b.path;
  return a.kind === b.kind;
}

function flightOf(state: NavState): number | null {
  return state.tag === "ROUTING" || state.tag === "TRAVERSING" ? state.navId : null;
}

function unchanged(before: unknown, after: unknown): boolean {
  return before === after || JSON.stringify(before) === JSON.stringify(after);
}

/**
 * What the store will display once `location` is delivered. Pure: a render may
 * call it to paint the display in the same commit as the URL (§11.3).
 */
export function previewDisplay(
  machine: NavigationMachine,
  config: MachineConfig,
  snapshot: NavigationSnapshot,
  location: NavLocation,
): NavLocation {
  if (sameNavLocation(location, snapshot.delivered)) return snapshot.ctx.display;
  return machine.transition(config, snapshot.ctx, snapshot.state, { type: "URL_COMMITTED", location })
    .ctx.display;
}

export function createNavigationCoordinator(
  machine: NavigationMachine,
  config: MachineConfig,
  hydrated: HydratedEvent,
  host: CoordinatorHost,
): NavigationCoordinator {
  const start = machine.initial(config);
  let snapshot: NavigationSnapshot = { ctx: start.ctx, state: start.state, delivered: hydrated.location };
  const outbox: OutboxEntry[] = [];
  const armed = new Set<number>();
  const listeners = new Set<() => void>();
  let seq = 0;
  let ready = false;
  let scheduled = false;

  /** A2. Returns whether anything changed or was queued. */
  function apply(event: NavEvent): boolean {
    const result = machine.transition(config, snapshot.ctx, snapshot.state, event);
    const delivered =
      event.type === "HYDRATED" || event.type === "URL_COMMITTED" || event.type === "RESET"
        ? event.location
        : snapshot.delivered;
    const inert =
      result.effects.length === 0 &&
      unchanged(snapshot.ctx, result.ctx) &&
      unchanged(snapshot.state, result.state);

    if (inert) {
      if (!sameNavLocation(delivered, snapshot.delivered)) snapshot = { ...snapshot, delivered };
      return false;
    }

    seq += 1;
    snapshot = { ctx: result.ctx, state: result.state, delivered };
    const flight = flightOf(result.state);
    for (const effect of result.effects) outbox.push({ effect, flight, seq });
    return true;
  }

  function isCurrent(entry: OutboxEntry): boolean {
    const { effect, flight } = entry;
    const { state } = snapshot;

    switch (effect.type) {
      case "ROUTER_PUSH":
      case "ROUTER_REPLACE":
      case "HARD_NAVIGATE":
        // No flight: the push to the committed URL of #25 and #32.
        return flight === null ? entry.seq === seq : state.tag === "ROUTING" && state.navId === flight;
      case "ARM_BUDGET":
        return flightOf(state) === effect.navId;
      default:
        return true;
    }
  }

  function arm(navId: number) {
    if (armed.has(navId)) return;
    armed.add(navId);
    host.armBudget(navId, () => {
      // A7. A cancelled timer that still fires is inert.
      if (!armed.delete(navId)) return;
      dispatch({ type: "BUDGET_EXPIRED", navId });
    });
  }

  function cancel(navId: number) {
    if (armed.delete(navId)) host.cancelBudget(navId);
  }

  /** A6. */
  function reconcileBudgets() {
    const flight = flightOf(snapshot.state);
    for (const navId of [...armed]) {
      if (navId !== flight) cancel(navId);
    }
    if (flight !== null) arm(flight);
  }

  function run(effect: NavEffect) {
    switch (effect.type) {
      case "ROUTER_PUSH":
      case "ROUTER_REPLACE":
      case "HARD_NAVIGATE":
        host.navigate(effect);
        return;
      case "ARM_BUDGET":
        arm(effect.navId);
        return;
      case "CANCEL_BUDGET":
        cancel(effect.navId);
        return;
      case "PERSIST":
        host.persist(effect.module);
        return;
      case "PUBLISH_DISPLAY":
        for (const listener of [...listeners]) listener();
        return;
    }
  }

  /** A5. */
  function drain() {
    scheduled = false;
    if (!ready) return;

    for (let entry = outbox.shift(); entry !== undefined; entry = outbox.shift()) {
      if (!isCurrent(entry)) continue;
      try {
        run(entry.effect);
      } catch (error) {
        host.reportError(error);
      }
    }
    reconcileBudgets();
  }

  /** A3. */
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    host.scheduleMicrotask(drain);
  }

  function dispatch(event: NavEvent) {
    if (apply(event)) schedule();
  }

  // A1.
  apply(hydrated);

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    commit(location) {
      if (sameNavLocation(location, snapshot.delivered)) return;
      dispatch({ type: "URL_COMMITTED", location });
    },
    // A4.
    mount() {
      ready = true;
      schedule();
    },
    // A8.
    unmount() {
      ready = false;
      for (const navId of [...armed]) cancel(navId);
    },
  };
}
