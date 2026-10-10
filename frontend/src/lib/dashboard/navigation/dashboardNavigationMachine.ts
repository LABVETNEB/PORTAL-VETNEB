/**
 * Dashboard navigation machine — the executable form of the normative table in
 * docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md §12 (rev. 2.2.1).
 *
 * One explicit state per surface replaces the implicit refs of the two
 * workspace controllers. Every transition is a pure function of
 * `(config, ctx, state, event)`; what the browser must do comes back as data
 * (`NavEffect`) for the provider to interpret (§12.5). The machine fixes which
 * effects a transition emits and in what order; when they run is the
 * interpreter's contract (§12.5.1) and no part of this file.
 *
 * `#n` marks the row of §12.4 a branch implements. A branch that returns
 * `stay` without a number is a pair §12.4 lists as explicitly ignored.
 *
 * NO IMPORTS, no DOM, no timers, no clock, no randomness, no module state.
 * Erasable TypeScript only: the test runner strips types.
 *
 * Not wired to any consumer yet (PR-NAV-02).
 *
 * @see test/unit/ui/dashboard/dashboard-navigation-machine.test.ts
 */

export type Surface = "admin" | "clinic";

export type NavLocation =
  | { readonly kind: "none" }
  | { readonly kind: "module"; readonly module: string }
  | { readonly kind: "hub" }
  | { readonly kind: "route"; readonly path: string; readonly module: string };

export type MachineConfig = {
  readonly surface: Surface;
  readonly modules: readonly string[];
  readonly defaultModule: string;
};

export type NavContext = {
  /** Last location confirmed by a URL commit. */
  readonly committed: NavLocation;
  /** What stage and chrome must show. */
  readonly display: NavLocation;
  /** Monotonic, starts at 1, never reused. */
  readonly nextNavId: number;
  /** Targets replaced while in flight; empty outside ROUTING/STALLED. */
  readonly superseded: readonly NavLocation[];
  /** Last persisted module; where a module-less Admin entry normalizes to. */
  readonly lastModule: string | null;
};

export type NavState =
  | { readonly tag: "BOOTING" }
  | { readonly tag: "IDLE" }
  | {
      readonly tag: "ROUTING";
      readonly navId: number;
      readonly target: NavLocation;
      readonly intent: "user" | "restore";
      readonly history: "push" | "replace";
      readonly afterTraverse: boolean;
    }
  | { readonly tag: "TRAVERSING"; readonly navId: number; readonly destination: NavLocation }
  | {
      readonly tag: "STALLED";
      readonly navId: number;
      readonly target: NavLocation;
      readonly intent: "user" | "restore" | "traverse";
      readonly history: "push" | "replace";
    }
  | { readonly tag: "FAILED"; readonly reason: "render" | "payload" | "unknown" };

export type NavEvent =
  | {
      readonly type: "HYDRATED";
      readonly location: NavLocation;
      readonly explicit: boolean;
      readonly storedModule: string | null;
    }
  | { readonly type: "SELECT_MODULE"; readonly module: string }
  | { readonly type: "SELECT_HUB" }
  | { readonly type: "OPEN_ROUTE"; readonly path: string; readonly module: string }
  | { readonly type: "URL_COMMITTED"; readonly location: NavLocation }
  | { readonly type: "TRAVERSE_STARTED"; readonly destination: NavLocation }
  | { readonly type: "BUDGET_EXPIRED"; readonly navId: number }
  | { readonly type: "NAV_FAILED"; readonly reason: "render" | "payload" | "unknown" }
  | { readonly type: "RETRY" }
  | { readonly type: "RESET"; readonly location: NavLocation };

export type NavEffect =
  | { readonly type: "ROUTER_PUSH"; readonly to: NavLocation }
  | { readonly type: "ROUTER_REPLACE"; readonly to: NavLocation }
  | { readonly type: "HARD_NAVIGATE"; readonly to: NavLocation; readonly mode: "assign" | "replace" }
  | { readonly type: "ARM_BUDGET"; readonly navId: number }
  | { readonly type: "CANCEL_BUDGET"; readonly navId: number }
  | { readonly type: "PERSIST"; readonly module: string }
  | { readonly type: "PUBLISH_DISPLAY" };

export type TransitionResult = {
  readonly ctx: NavContext;
  readonly state: NavState;
  readonly effects: readonly NavEffect[];
};

type ModuleLocation = Extract<NavLocation, { readonly kind: "module" }>;
type SelectEvent = Extract<NavEvent, { readonly type: "SELECT_MODULE" | "SELECT_HUB" | "OPEN_ROUTE" }>;
type HydratedEvent = Extract<NavEvent, { readonly type: "HYDRATED" }>;

const PUBLISH_DISPLAY: NavEffect = { type: "PUBLISH_DISPLAY" };

// ── Normative helpers (§12.4) ────────────────────────────────────────────────

function same(a: NavLocation, b: NavLocation): boolean {
  if (a.kind === "module") return b.kind === "module" && a.module === b.module;
  if (a.kind === "route") return b.kind === "route" && a.module === b.module && a.path === b.path;
  return a.kind === b.kind;
}

function valid(config: MachineConfig, moduleId: string | null): moduleId is string {
  return moduleId !== null && config.modules.includes(moduleId);
}

function targetOf(config: MachineConfig, event: SelectEvent): NavLocation | null {
  switch (event.type) {
    case "SELECT_MODULE":
      return valid(config, event.module) ? { kind: "module", module: event.module } : null;
    case "SELECT_HUB":
      return config.surface === "clinic" ? { kind: "hub" } : null;
    case "OPEN_ROUTE":
      return config.surface === "clinic" && valid(config, event.module)
        ? { kind: "route", path: event.path, module: event.module }
        : null;
  }
}

function bootRestore(config: MachineConfig, event: HydratedEvent): ModuleLocation | null {
  const stored = event.storedModule;

  if (config.surface === "admin") {
    if (event.location.kind !== "none") return null;
    return { kind: "module", module: valid(config, stored) ? stored : config.defaultModule };
  }

  const atDefault = same(event.location, { kind: "module", module: config.defaultModule });
  if (!event.explicit && atDefault && valid(config, stored) && stored !== config.defaultModule) {
    return { kind: "module", module: stored };
  }
  return null;
}

function normalization(
  config: MachineConfig,
  ctx: NavContext,
  location: NavLocation,
): ModuleLocation | null {
  if (config.surface !== "admin" || location.kind !== "none") return null;
  return {
    kind: "module",
    module: valid(config, ctx.lastModule) ? ctx.lastModule : config.defaultModule,
  };
}

/** The only source of a PERSIST effect and of a `lastModule` update by commit. */
function persistable(config: MachineConfig, location: NavLocation): string | null {
  const moduleId = location.kind === "module" || location.kind === "route" ? location.module : null;
  return valid(config, moduleId) ? moduleId : null;
}

function includes(list: readonly NavLocation[], location: NavLocation): boolean {
  return list.some((entry) => same(entry, location));
}

/** `(superseded ∪ {replaced}) \ {next}`: the target in flight is never in it. */
function supersede(
  list: readonly NavLocation[],
  replaced: NavLocation,
  next: NavLocation,
): readonly NavLocation[] {
  const merged = includes(list, replaced) ? list : [...list, replaced];
  return merged.filter((entry) => !same(entry, next));
}

function cancelBudget(state: NavState): readonly NavEffect[] {
  return state.tag === "ROUTING" || state.tag === "TRAVERSING"
    ? [{ type: "CANCEL_BUDGET", navId: state.navId }]
    : [];
}

function stay(ctx: NavContext, state: NavState): TransitionResult {
  return { ctx, state, effects: [] };
}

/**
 * Rows #9, #14, #18, #21, #22, #23 and #28: every transition that rests on a
 * location just confirmed, or normalizes it. `lead` is the budget of the flight
 * it leaves, cancelled before anything else.
 */
function settle(
  config: MachineConfig,
  ctx: NavContext,
  location: NavLocation,
  lead: readonly NavEffect[],
): TransitionResult {
  const target = normalization(config, ctx, location);

  if (target === null) {
    const moduleId = persistable(config, location);
    return {
      ctx: {
        ...ctx,
        committed: location,
        display: location,
        superseded: [],
        lastModule: moduleId ?? ctx.lastModule,
      },
      state: { tag: "IDLE" },
      effects: [
        ...lead,
        ...(moduleId === null ? [] : [{ type: "PERSIST", module: moduleId } as const]),
        PUBLISH_DISPLAY,
      ],
    };
  }

  const navId = ctx.nextNavId;
  return {
    ctx: { ...ctx, committed: location, display: location, superseded: [], nextNavId: navId + 1 },
    state: {
      tag: "ROUTING",
      navId,
      target,
      intent: "restore",
      history: "replace",
      afterTraverse: false,
    },
    effects: [
      ...lead,
      { type: "ROUTER_REPLACE", to: target },
      { type: "ARM_BUDGET", navId },
      PUBLISH_DISPLAY,
    ],
  };
}

/** Rows #5, #7, #8, #10, #16 and #19: a user selection takes the flight. */
function route(
  ctx: NavContext,
  target: NavLocation,
  lead: readonly NavEffect[],
  superseded: readonly NavLocation[],
  afterTraverse: boolean,
): TransitionResult {
  const navId = ctx.nextNavId;
  return {
    ctx: { ...ctx, display: target, superseded, nextNavId: navId + 1 },
    state: { tag: "ROUTING", navId, target, intent: "user", history: "push", afterTraverse },
    effects: [
      ...lead,
      { type: "ROUTER_PUSH", to: target },
      { type: "ARM_BUDGET", navId },
      PUBLISH_DISPLAY,
    ],
  };
}

/** Row #25: back to the committed location, which no commit could confirm. */
function returnToCommitted(
  ctx: NavContext,
  target: NavLocation,
  lead: readonly NavEffect[],
): TransitionResult {
  return {
    ctx: { ...ctx, display: ctx.committed, superseded: [] },
    state: { tag: "IDLE" },
    effects: [...lead, { type: "ROUTER_PUSH", to: target }, PUBLISH_DISPLAY],
  };
}

// ── Transitions, one function per event of the guard partition (§12.4) ───────

function hydrate(config: MachineConfig, ctx: NavContext, event: HydratedEvent): TransitionResult {
  const target = bootRestore(config, event);

  if (target !== null) {
    // #2 (target from the stored module) · #3 (Admin, no valid stored module)
    const navId = ctx.nextNavId;
    return {
      ctx: {
        ...ctx,
        committed: event.location,
        display: event.location,
        nextNavId: navId + 1,
        lastModule: target.module,
      },
      state: {
        tag: "ROUTING",
        navId,
        target,
        intent: "restore",
        history: "replace",
        afterTraverse: false,
      },
      effects: [
        { type: "ROUTER_REPLACE", to: target },
        { type: "ARM_BUDGET", navId },
        PUBLISH_DISPLAY,
      ],
    };
  }

  // #1
  const persisted = persistable(config, event.location);
  return {
    ctx: {
      ...ctx,
      committed: event.location,
      display: event.location,
      lastModule: persisted ?? event.storedModule,
    },
    state: { tag: "IDLE" },
    effects: [
      ...(persisted === null ? [] : [{ type: "PERSIST", module: persisted } as const]),
      PUBLISH_DISPLAY,
    ],
  };
}

function select(ctx: NavContext, state: NavState, target: NavLocation | null): TransitionResult {
  if (target === null) return stay(ctx, state); // #6

  switch (state.tag) {
    case "BOOTING":
    case "FAILED":
      return stay(ctx, state);
    case "IDLE":
      if (same(target, ctx.committed)) return stay(ctx, state); // #4
      return route(ctx, target, [], [], false); // #5 · #7 · #8
    case "ROUTING":
      if (same(target, state.target)) return stay(ctx, state);
      if (same(target, ctx.committed)) return returnToCommitted(ctx, target, cancelBudget(state)); // #25
      return route(
        ctx,
        target,
        cancelBudget(state),
        supersede(ctx.superseded, state.target, target),
        false,
      ); // #10
    case "TRAVERSING":
      if (same(target, state.destination)) return stay(ctx, state);
      if (same(target, ctx.committed)) return returnToCommitted(ctx, target, cancelBudget(state)); // #25
      return route(ctx, target, cancelBudget(state), ctx.superseded, true); // #19
    case "STALLED":
      if (same(target, ctx.committed)) {
        if (same(target, state.target)) return stay(ctx, state);
        return returnToCommitted(ctx, target, []); // #25
      }
      return route(
        ctx,
        target,
        [],
        same(target, state.target)
          ? ctx.superseded
          : supersede(ctx.superseded, state.target, target),
        false,
      ); // #16
  }
}

function commit(
  config: MachineConfig,
  ctx: NavContext,
  state: NavState,
  location: NavLocation,
): TransitionResult {
  switch (state.tag) {
    case "BOOTING":
    case "FAILED":
      return stay(ctx, state);
    case "IDLE":
      if (same(location, ctx.committed)) return stay(ctx, state);
      return settle(config, ctx, location, []); // #22
    case "TRAVERSING":
      return settle(config, ctx, location, cancelBudget(state)); // #18
    case "ROUTING":
      if (same(location, state.target)) return settle(config, ctx, location, cancelBudget(state)); // #9
      if (includes(ctx.superseded, location)) return stay(ctx, state); // #11
      if (state.afterTraverse) {
        // #26
        return {
          ctx: { ...ctx, committed: location },
          state: { ...state, afterTraverse: false },
          effects: [],
        };
      }
      return settle(config, ctx, location, cancelBudget(state)); // #23
    case "STALLED":
      if (same(location, state.target)) return settle(config, ctx, location, []); // #14
      if (includes(ctx.superseded, location)) return stay(ctx, state); // #11
      return settle(config, ctx, location, []); // #23
  }
}

function traverse(
  config: MachineConfig,
  ctx: NavContext,
  state: NavState,
  destination: NavLocation,
): TransitionResult {
  if (state.tag === "BOOTING" || state.tag === "FAILED") return stay(ctx, state);
  if (same(destination, ctx.committed)) {
    if (state.tag === "IDLE") return stay(ctx, state); // #24
    return settle(config, ctx, destination, cancelBudget(state)); // #28
  }

  // #17
  const navId = ctx.nextNavId;
  return {
    ctx: { ...ctx, display: destination, superseded: [], nextNavId: navId + 1 },
    state: { tag: "TRAVERSING", navId, destination },
    effects: [...cancelBudget(state), { type: "ARM_BUDGET", navId }, PUBLISH_DISPLAY],
  };
}

function expire(ctx: NavContext, state: NavState, navId: number): TransitionResult {
  if (state.tag === "ROUTING" && navId === state.navId) {
    // #12
    return {
      ctx,
      state: {
        tag: "STALLED",
        navId: state.navId,
        target: state.target,
        intent: state.intent,
        history: state.history,
      },
      effects: [PUBLISH_DISPLAY],
    };
  }

  if (state.tag === "TRAVERSING" && navId === state.navId) {
    // #27
    return {
      ctx: { ...ctx, display: state.destination },
      state: {
        tag: "STALLED",
        navId: state.navId,
        target: state.destination,
        intent: "traverse",
        history: "replace",
      },
      effects: [PUBLISH_DISPLAY],
    };
  }

  return stay(ctx, state); // #13 and the ignored pairs
}

function fail(
  ctx: NavContext,
  state: NavState,
  reason: "render" | "payload" | "unknown",
): TransitionResult {
  if (state.tag === "FAILED") return stay(ctx, state);

  // #20
  return {
    ctx: { ...ctx, superseded: [] },
    state: { tag: "FAILED", reason },
    effects: [...cancelBudget(state), PUBLISH_DISPLAY],
  };
}

function retry(ctx: NavContext, state: NavState): TransitionResult {
  if (state.tag !== "STALLED") return stay(ctx, state);

  // #15
  const navId = ctx.nextNavId;
  return {
    ctx: { ...ctx, nextNavId: navId + 1 },
    state: {
      tag: "ROUTING",
      navId,
      target: state.target,
      intent: state.intent === "restore" ? "restore" : "user",
      history: state.history,
      afterTraverse: false,
    },
    effects: [
      {
        type: "HARD_NAVIGATE",
        to: state.target,
        mode: state.history === "push" ? "assign" : "replace",
      },
      { type: "ARM_BUDGET", navId },
      PUBLISH_DISPLAY,
    ],
  };
}

// ── Public API (§12.1) ───────────────────────────────────────────────────────

export function initial(config: MachineConfig): { ctx: NavContext; state: NavState } {
  // §12.1: the same value on both surfaces; the signature is part of the contract.
  void config;
  return {
    ctx: {
      committed: { kind: "none" },
      display: { kind: "none" },
      nextNavId: 1,
      superseded: [],
      lastModule: null,
    },
    state: { tag: "BOOTING" },
  };
}

export function transition(
  config: MachineConfig,
  ctx: NavContext,
  state: NavState,
  event: NavEvent,
): TransitionResult {
  switch (event.type) {
    case "HYDRATED":
      return state.tag === "BOOTING" ? hydrate(config, ctx, event) : stay(ctx, state); // #1–#3
    case "SELECT_MODULE":
    case "SELECT_HUB":
    case "OPEN_ROUTE":
      return select(ctx, state, targetOf(config, event));
    case "URL_COMMITTED":
      return commit(config, ctx, state, event.location);
    case "TRAVERSE_STARTED":
      return traverse(config, ctx, state, event.destination);
    case "BUDGET_EXPIRED":
      return expire(ctx, state, event.navId);
    case "NAV_FAILED":
      return fail(ctx, state, event.reason);
    case "RETRY":
      return retry(ctx, state);
    case "RESET":
      return state.tag === "FAILED" ? settle(config, ctx, event.location, []) : stay(ctx, state); // #21
  }
}
