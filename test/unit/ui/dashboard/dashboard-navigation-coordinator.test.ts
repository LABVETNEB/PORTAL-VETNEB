import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

import { readSourceFile } from "../../../helpers/tracked-source-files.ts";
import {
  createNavigationCoordinator,
  previewDisplay,
  type CoordinatorHost,
  type NavigationCoordinator,
  type NavigationEffect,
} from "../../../../frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts";
import {
  initial,
  transition,
  type MachineConfig,
  type NavEffect,
  type NavEvent,
  type NavLocation,
  type NavState,
} from "../../../../frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts";

// PR-NAV-03 — the interpreter of docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md
// §12.5.1 (rev. 2.2.1, C-9; expected values of rev. 2.3, C-11), without React.
//
// The machine decides WHAT a transition emits and is verified by its own suite.
// This suite judges WHEN the coordinator runs it, with three sources:
//
//   1. REPRODUCTIONS — R1–R8 of §0.5 as named cases: order of events, order of
//                      executed effects, final state, timers and navigations.
//   2. ORACLES       — I1–I8 of §12.5.1, evaluated on every executed effect and
//                      at the end of every task of a seeded random search. The
//                      rig never asks the coordinator what it did: it observes
//                      the injected host (router, storage, timers, listeners).
//   3. MUTATIONS     — the five variants of §0.5 (M1–M5), built from the tracked
//                      source with one element of the algorithm removed. Each
//                      must violate an invariant; the unmutated source, loaded
//                      the same way, must not.
//
// Out of reach by design: React. P1 and P4 are closed by the E2E of this PR on
// the production runner; P3 (StrictMode with a real React tree) has no test
// medium in this repository. R7 and R7b below reproduce the mount → cleanup →
// mount ORDER on the coordinator; they are not evidence about React.

type Create = typeof createNavigationCoordinator;
type Hydrated = Extract<NavEvent, { readonly type: "HYDRATED" }>;
type InvariantId = "I1" | "I2" | "I3" | "I4" | "I5" | "I6" | "I7" | "I8";

const MACHINE = { initial, transition };

const ADMIN: MachineConfig = {
  surface: "admin",
  modules: ["admin", "admin-clinics", "admin-pricing", "audit-log"],
  defaultModule: "admin",
};

const CLINIC: MachineConfig = {
  surface: "clinic",
  modules: ["operaciones", "informes", "logistica", "perfil"],
  defaultModule: "operaciones",
};

const NONE: NavLocation = { kind: "none" };
const HUB: NavLocation = { kind: "hub" };

function moduleAt(moduleId: string): NavLocation {
  return { kind: "module", module: moduleId };
}

function routeAt(path: string, moduleId: string): NavLocation {
  return { kind: "route", path, module: moduleId };
}

function hydrated(location: NavLocation, storedModule: string | null, explicit = false): Hydrated {
  return { type: "HYDRATED", location, explicit, storedModule };
}

function sameLocation(a: NavLocation, b: NavLocation): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function describeLocation(location: NavLocation): string {
  if (location.kind === "module") return `module:${location.module}`;
  if (location.kind === "route") return `route:${location.path}`;
  return location.kind;
}

function describeNavigation(effect: NavigationEffect): string {
  if (effect.type === "ROUTER_PUSH") return "push";
  if (effect.type === "ROUTER_REPLACE") return "replace";
  return `hard-${effect.mode}`;
}

function flightOf(state: NavState): number | null {
  return state.tag === "ROUTING" || state.tag === "TRAVERSING" ? state.navId : null;
}

// ── Rig: an injected host that observes, and the oracles I1–I8 ───────────────

type ExecutedNavigation = { readonly effect: NavigationEffect; readonly flight: number | null };

function createRig(create: Create, config: MachineConfig, boot: Hydrated) {
  const microtasks: (() => void)[] = [];
  const timers = new Map<number, () => void>();
  const violations: InvariantId[] = [];
  const log: string[] = [];
  const navigations: ExecutedNavigation[] = [];
  const navigated: string[] = [];
  const errors: unknown[] = [];
  const enqueued: NavEffect[] = [];
  const navigationsByFlight = new Map<number, number>();
  let taskNavigations: ExecutedNavigation[] = [];
  let cursor = 0;
  let mounted = false;
  let failNextNavigation = false;

  function violate(id: InvariantId) {
    violations.push(id);
  }

  // I1: every executed effect is the next matching entry of the enqueued order.
  function matchEnqueued(effect: NavEffect) {
    const wanted = JSON.stringify(effect);
    for (let index = cursor; index < enqueued.length; index += 1) {
      if (JSON.stringify(enqueued[index]) === wanted) {
        cursor = index + 1;
        return;
      }
    }
    violate("I1");
  }

  const host: CoordinatorHost = {
    scheduleMicrotask(drain) {
      microtasks.push(drain);
    },
    navigate(effect) {
      if (!mounted) violate("I4");
      matchEnqueued(effect);
      const { ctx, state } = coordinator.getSnapshot();
      const inFlight = state.tag === "ROUTING" && sameLocation(state.target, effect.to);
      const atRest =
        state.tag === "IDLE" && effect.type === "ROUTER_PUSH" && sameLocation(ctx.committed, effect.to);
      if (!inFlight && !atRest) violate("I2");
      const flight = inFlight ? state.navId : null;
      if (flight !== null) {
        const count = (navigationsByFlight.get(flight) ?? 0) + 1;
        navigationsByFlight.set(flight, count);
        if (count > 1) violate("I5");
      }
      const executed = { effect, flight };
      navigations.push(executed);
      taskNavigations.push(executed);
      const line = `${describeNavigation(effect)}:${describeLocation(effect.to)}`;
      log.push(line);
      navigated.push(`${line}@${flight ?? "rest"}`);
      if (failNextNavigation) {
        failNextNavigation = false;
        throw new Error("navigation effect failed");
      }
    },
    persist(moduleId) {
      if (!mounted) violate("I4");
      matchEnqueued({ type: "PERSIST", module: moduleId });
      log.push(`persist:${moduleId}`);
    },
    armBudget(navId, expire) {
      if (!mounted) violate("I4");
      const { state } = coordinator.getSnapshot();
      if (flightOf(state) !== navId) violate("I7");
      if (timers.has(navId)) violate("I3");
      timers.set(navId, expire);
      log.push(`arm:${navId}`);
    },
    cancelBudget(navId) {
      timers.delete(navId);
      log.push(`cancel:${navId}`);
    },
    reportError(error) {
      errors.push(error);
    },
  };

  // A1: the store is created with HYDRATED applied and its effects enqueued.
  const start = initial(config);
  enqueued.push(...transition(config, start.ctx, start.state, boot).effects);
  const coordinator: NavigationCoordinator = create(MACHINE, config, boot, host);
  coordinator.subscribe(() => {
    if (!mounted) violate("I4");
    matchEnqueued({ type: "PUBLISH_DISPLAY" });
    log.push("publish");
  });

  function expect(event: NavEvent) {
    const { ctx, state } = coordinator.getSnapshot();
    enqueued.push(...transition(config, ctx, state, event).effects);
  }

  function endTask() {
    while (microtasks.length > 0) microtasks.shift()?.();

    const { ctx, state } = coordinator.getSnapshot();
    const flight = flightOf(state);
    if (mounted) {
      const expected = flight === null ? "" : String(flight);
      if ([...timers.keys()].join(",") !== expected) violate("I3");
      if (state.tag === "ROUTING" && navigationsByFlight.get(state.navId) !== 1) violate("I6");
    } else if (timers.size > 0) {
      violate("I4");
    }
    for (const executed of taskNavigations) {
      const kept =
        executed.flight === null
          ? state.tag === "IDLE" && sameLocation(ctx.committed, executed.effect.to)
          : state.tag === "ROUTING" && state.navId === executed.flight;
      if (!kept) violate("I8");
    }
    taskNavigations = [];
  }

  return {
    coordinator,
    violations,
    log,
    navigations,
    errors,
    timers,
    get mounted() {
      return mounted;
    },
    dispatch(event: NavEvent) {
      expect(event);
      coordinator.dispatch(event);
    },
    commit(location: NavLocation) {
      const { delivered } = coordinator.getSnapshot();
      if (!sameLocation(delivered, location)) expect({ type: "URL_COMMITTED", location });
      coordinator.commit(location);
    },
    mount() {
      mounted = true;
      coordinator.mount();
    },
    unmount() {
      mounted = false;
      coordinator.unmount();
    },
    /** The budget timer of `navId` fires: its own task. */
    fire(navId: number) {
      const expire = timers.get(navId);
      assert.ok(expire, `no live timer for navId ${navId}`);
      timers.delete(navId);
      expect({ type: "BUDGET_EXPIRED", navId });
      expire();
      endTask();
    },
    failNextNavigation() {
      failNextNavigation = true;
    },
    endTask,
    /** One task: a synchronous block followed by its microtasks. */
    task(block: () => void) {
      block();
      endTask();
    },
    /** Every navigation executed so far, with the flight it ran in. */
    navigated: () => [...navigated],
    /** Executed effects since the last call, in order. */
    take(): string[] {
      return log.splice(0);
    },
    state(): NavState {
      return coordinator.getSnapshot().state;
    },
  };
}

type Rig = ReturnType<typeof createRig>;

function assertClean(rig: Rig) {
  assert.deepEqual(rig.violations, [], "I1–I8 hold");
  assert.deepEqual(rig.errors, [], "no effect threw");
}

function select(moduleId: string): NavEvent {
  return { type: "SELECT_MODULE", module: moduleId };
}

function committed(location: NavLocation): NavEvent {
  return { type: "URL_COMMITTED", location };
}

const RENDER_FAILED: NavEvent = { type: "NAV_FAILED", reason: "render" };

/** Admin on the bare entry with `stored` in storage: row #2, `ROUTING(1, restore)`. */
function adminRestoring(create: Create = createNavigationCoordinator, stored = "admin-clinics"): Rig {
  return createRig(create, ADMIN, hydrated(NONE, stored));
}

/** Admin at rest on `moduleId`, mounted and drained. */
function adminAt(moduleId: string): Rig {
  const rig = createRig(createNavigationCoordinator, ADMIN, hydrated(moduleAt(moduleId), moduleId, true));
  rig.task(() => rig.mount());
  rig.take();
  return rig;
}

// ── A1–A8, step by step ──────────────────────────────────────────────────────

test("A1: creating the store applies HYDRATED and runs nothing", () => {
  const rig = adminRestoring();

  assert.deepEqual(rig.state(), {
    tag: "ROUTING",
    navId: 1,
    target: moduleAt("admin-clinics"),
    intent: "restore",
    history: "replace",
    afterTraverse: false,
    next: null,
  });
  assert.deepEqual(rig.coordinator.getSnapshot().delivered, NONE);
  assert.deepEqual(rig.take(), [], "no navigation, no timer, no persistence, no notification");
  assert.equal(rig.timers.size, 0);

  rig.endTask();
  assert.deepEqual(rig.take(), [], "a store that is never mounted never runs an effect");
  assertClean(rig);
});

test("A2–A5: effects run in a microtask, in the order they were enqueued, once mounted", () => {
  const rig = adminRestoring();

  rig.mount();
  assert.deepEqual(rig.take(), [], "mounting runs nothing by itself (A4)");

  rig.endTask();
  assert.deepEqual(rig.take(), ["replace:module:admin-clinics", "arm:1", "publish"]);
  assert.deepEqual([...rig.timers.keys()], [1]);

  rig.task(() => rig.dispatch(committed(moduleAt("admin-clinics"))));
  assert.deepEqual(rig.take(), ["cancel:1", "persist:admin-clinics", "publish"]);
  assert.deepEqual(rig.state(), { tag: "IDLE" });
  assert.equal(rig.timers.size, 0);
  assertClean(rig);
});

test("A3: every dispatch of one synchronous block shares a single drain", () => {
  const rig = adminAt("admin");
  let scheduled = 0;
  const counting = createRig(
    (machine, config, boot, host) =>
      createNavigationCoordinator(machine, config, boot, {
        ...host,
        scheduleMicrotask(drain) {
          scheduled += 1;
          host.scheduleMicrotask(drain);
        },
      }),
    ADMIN,
    hydrated(moduleAt("admin"), "admin", true),
  );

  counting.task(() => counting.mount());
  scheduled = 0;
  counting.task(() => {
    counting.dispatch(select("admin-clinics"));
    counting.dispatch(select("admin-pricing"));
    counting.dispatch({ type: "TRAVERSE_STARTED", destination: moduleAt("audit-log") });
  });

  assert.equal(scheduled, 1);
  assertClean(counting);
  assertClean(rig);
});

test("A5: an effect that throws is reported and does not stop the drain", () => {
  const rig = adminAt("admin");

  rig.failNextNavigation();
  rig.task(() => rig.dispatch(select("admin-clinics")));

  assert.deepEqual(rig.take(), ["push:module:admin-clinics", "arm:1", "publish"]);
  assert.deepEqual(rig.errors.map(String), ["Error: navigation effect failed"]);
  assert.deepEqual([...rig.timers.keys()], [1]);
  assert.deepEqual(rig.violations, []);
});

test("A6: timers follow the state, not the history of effects", () => {
  const rig = adminAt("admin");

  rig.task(() => rig.dispatch(select("admin-clinics")));
  assert.deepEqual([...rig.timers.keys()], [1]);

  // A BUDGET_EXPIRED delivered without its timer having fired (§0.5, limit 2).
  rig.task(() => rig.dispatch({ type: "BUDGET_EXPIRED", navId: 1 }));
  assert.equal(rig.state().tag, "STALLED");
  assert.equal(rig.timers.size, 0, "no budget stays alive in STALLED (I3)");
  assertClean(rig);
});

test("A7: a fired timer dispatches BUDGET_EXPIRED once; a late callback is inert", () => {
  const rig = adminAt("admin");

  rig.task(() => rig.dispatch(select("admin-clinics")));
  const stale = rig.timers.get(1);
  assert.ok(stale);
  rig.take();

  rig.fire(1);
  assert.deepEqual(rig.state(), {
    tag: "STALLED",
    navId: 1,
    target: moduleAt("admin-clinics"),
    intent: "user",
    history: "push",
  });
  assert.deepEqual(rig.take(), ["publish"]);

  rig.task(() => stale());
  assert.equal(rig.state().tag, "STALLED");
  assert.deepEqual(rig.take(), []);
  assertClean(rig);
});

test("A8: unmounting cancels every timer and keeps queue and state", () => {
  const rig = adminAt("admin");

  rig.task(() => rig.dispatch(select("admin-clinics")));
  rig.take();
  const before = rig.coordinator.getSnapshot();

  rig.task(() => {
    rig.unmount();
    rig.dispatch(select("admin-pricing"));
  });
  assert.deepEqual(rig.take(), ["cancel:1"]);
  assert.equal(rig.timers.size, 0);
  assert.equal(rig.coordinator.getSnapshot().state.tag, "ROUTING");
  assert.notEqual(rig.coordinator.getSnapshot(), before, "the claim was applied while unmounted (A2)");

  rig.task(() => rig.mount());
  assert.deepEqual(rig.take(), ["publish", "arm:1"], "the queue drains and A6 re-arms the budget");
  assertClean(rig);
});

// ── R1–R8 of §0.5, with the values of rev. 2.3 ───────────────────────────────

test("R1: restore, then a render failure in a later commit", () => {
  const rig = adminRestoring();

  rig.task(() => rig.mount());
  assert.deepEqual(rig.take(), ["replace:module:admin-clinics", "arm:1", "publish"]);

  rig.task(() => rig.dispatch(RENDER_FAILED));
  assert.deepEqual(rig.take(), ["cancel:1", "publish"]);
  assert.deepEqual(rig.state(), { tag: "FAILED", reason: "render" });
  assert.equal(rig.timers.size, 0);
  assert.deepEqual(
    rig.navigated(),
    ["replace:module:admin-clinics@1"],
    "the replace left before the failure was known: legitimate",
  );
  assertClean(rig);
});

test("R2 (the P1 of #1841): NAV_FAILED before the effects of HYDRATED are drained", () => {
  const rig = adminRestoring();

  rig.task(() => {
    rig.dispatch(RENDER_FAILED); // passive effect of the boundary: the child runs first
    rig.mount(); // passive effect of the provider
  });

  assert.deepEqual(rig.take(), ["publish", "publish"], "ROUTER_REPLACE@1 and ARM_BUDGET(1) were discarded");
  assert.deepEqual(rig.state(), { tag: "FAILED", reason: "render" });
  assert.equal(rig.timers.size, 0);
  assert.deepEqual(rig.navigated(), []);
  assert.equal(
    rig.coordinator.getSnapshot().ctx.lastModule,
    "admin-clinics",
    "C-4: HYDRATED reached the machine first, so the stored module survives the failure",
  );
  assertClean(rig);
});

test("R3: RESET with the queue still pending arms one budget and navigates once", () => {
  const rig = adminRestoring();

  rig.task(() => {
    rig.dispatch(RENDER_FAILED);
    rig.dispatch({ type: "RESET", location: NONE });
    rig.mount();
  });

  const state = rig.state();
  assert.equal(state.tag, "ROUTING");
  assert.equal(state.tag === "ROUTING" && state.navId, 2);
  assert.deepEqual(rig.navigated(), ["replace:module:admin-clinics@2"]);
  assert.deepEqual([...rig.timers.keys()], [2]);
  assertClean(rig);
});

test("R4a: the boundary unmounts in a later task and RESET reconciles", () => {
  const rig = adminAt("audit-log");

  rig.task(() => rig.dispatch(RENDER_FAILED));
  assert.equal(rig.state().tag, "FAILED");
  rig.take();

  rig.task(() => rig.dispatch({ type: "RESET", location: moduleAt("audit-log") }));
  assert.deepEqual(rig.state(), { tag: "IDLE" });
  assert.deepEqual(rig.take(), ["persist:audit-log", "publish"]);

  // "Reintentar" already reset; the unmount that follows resets again (inert).
  rig.task(() => rig.dispatch({ type: "RESET", location: moduleAt("audit-log") }));
  assert.deepEqual(rig.take(), []);
  assert.equal(rig.timers.size, 0);
  assert.deepEqual(rig.navigated(), []);
  assertClean(rig);
});

for (const order of ["provider first", "boundary first"] as const) {
  test(`R4b: leaving the dashboard with the boundary mounted (${order}) navigates nothing`, () => {
    const rig = adminRestoring();
    rig.task(() => rig.mount());
    rig.task(() => rig.dispatch(RENDER_FAILED));
    rig.take();
    const navigationsBefore = rig.navigations.length;

    rig.task(() => {
      if (order === "provider first") {
        rig.unmount();
        rig.dispatch({ type: "RESET", location: NONE });
      } else {
        rig.dispatch({ type: "RESET", location: NONE });
        rig.unmount();
      }
    });

    assert.deepEqual(rig.take(), []);
    assert.equal(rig.navigations.length, navigationsBefore);
    assert.equal(rig.timers.size, 0);
    assertClean(rig);
  });
}

test("R5: a selection supersedes the initial restore before the first drain; the next one is claimed", () => {
  const rig = adminRestoring();

  rig.task(() => {
    rig.dispatch(select("admin-pricing")); // #10: push over the pending restore
    rig.dispatch(select("audit-log")); // #29: claimed by the user flight
    rig.mount();
  });

  assert.deepEqual(
    rig.take(),
    ["publish", "push:module:admin-pricing", "arm:2", "publish", "publish"],
    "ROUTER_REPLACE@1 and ARM_BUDGET(1) of the restore were discarded",
  );
  assert.deepEqual(
    rig.navigated(),
    ["push:module:admin-pricing@2"],
    "one router.push: the first selection, not the last (rev. 2.3)",
  );
  assert.deepEqual([...rig.timers.keys()], [2]);
  assert.deepEqual(rig.coordinator.getSnapshot().ctx.display, moduleAt("audit-log"));
  assertClean(rig);
});

test("R5 with a traverse: Back, then two selections, before the first drain", () => {
  const rig = adminRestoring();

  rig.task(() => {
    rig.dispatch({ type: "TRAVERSE_STARTED", destination: moduleAt("admin") }); // #17
    rig.dispatch(select("admin-pricing")); // #19
    rig.dispatch(select("audit-log")); // #29
    rig.mount();
  });

  assert.deepEqual(rig.navigated(), ["push:module:admin-pricing@3"]);
  assert.deepEqual([...rig.timers.keys()], [3]);
  assertClean(rig);
});

test("R6: a late timer callback after FAILED changes nothing", () => {
  const rig = adminRestoring();
  rig.task(() => rig.mount());
  const stale = rig.timers.get(1);
  assert.ok(stale);

  rig.task(() => rig.dispatch(RENDER_FAILED));
  rig.take();

  rig.task(() => stale());
  rig.task(() => rig.dispatch({ type: "BUDGET_EXPIRED", navId: 1 }));

  assert.deepEqual(rig.state(), { tag: "FAILED", reason: "render" });
  assert.deepEqual(rig.take(), []);
  assert.equal(rig.timers.size, 0);
  assertClean(rig);
});

test("R7: StrictMode order with a failing render — mount, cleanup and mount again in one block", () => {
  const rig = adminRestoring();

  rig.task(() => {
    rig.dispatch(RENDER_FAILED); // boundary mounts
    rig.mount(); // provider mounts
    rig.dispatch({ type: "RESET", location: NONE }); // boundary cleanup
    rig.unmount(); // provider cleanup
    rig.dispatch(RENDER_FAILED); // boundary mounts again
    rig.mount(); // provider mounts again
  });

  assert.deepEqual(rig.state(), { tag: "FAILED", reason: "render" });
  assert.deepEqual(rig.navigated(), [], "neither normalization navigated");
  assert.equal(rig.timers.size, 0);
  assertClean(rig);
});

test("R7b: StrictMode order without a failure keeps one navigation and one budget", () => {
  const rig = adminRestoring();

  rig.task(() => {
    rig.mount();
    rig.unmount();
    rig.mount();
  });

  assert.deepEqual(rig.take(), ["replace:module:admin-clinics", "arm:1", "publish"]);
  assert.deepEqual([...rig.timers.keys()], [1]);

  // A remount after the first drain re-arms the budget and navigates nothing.
  rig.task(() => {
    rig.unmount();
    rig.mount();
  });
  assert.deepEqual(rig.take(), ["cancel:1", "arm:1"]);
  assert.deepEqual(rig.navigated(), ["replace:module:admin-clinics@1"]);
  assertClean(rig);
});

const HYDRATION_FAILURES: readonly (readonly [string, MachineConfig, Hydrated, string | null])[] = [
  ["R8.1 Admin, bare entry, stored module", ADMIN, hydrated(NONE, "audit-log"), "audit-log"],
  ["R8.2 Admin, bare entry, nothing stored", ADMIN, hydrated(NONE, null), "admin"],
  ["R8.3 Admin, entry with a module", ADMIN, hydrated(moduleAt("admin-pricing"), "audit-log", true), "admin-pricing"],
  ["R8.4 Clinic, bare entry, stored module", CLINIC, hydrated(moduleAt("operaciones"), "informes"), "informes"],
  ["R8.5 Clinic, bare entry, nothing stored", CLINIC, hydrated(moduleAt("operaciones"), null), "operaciones"],
  [
    "R8.6 Clinic, full route",
    CLINIC,
    hydrated(routeAt("/dashboard/informes", "informes"), "perfil", true),
    "informes",
  ],
];

for (const [name, config, boot, lastModule] of HYDRATION_FAILURES) {
  test(`${name}: a render failure during hydration leaves FAILED, no timer and no navigation`, () => {
    const rig = createRig(createNavigationCoordinator, config, boot);

    rig.task(() => {
      rig.dispatch(RENDER_FAILED);
      rig.mount();
    });
    // Past the budget nothing happens either: there is no timer to fire.
    rig.task(() => rig.dispatch({ type: "BUDGET_EXPIRED", navId: 1 }));

    assert.deepEqual(rig.state(), { tag: "FAILED", reason: "render" });
    assert.equal(rig.timers.size, 0);
    assert.deepEqual(rig.navigated(), []);
    assert.equal(rig.coordinator.getSnapshot().ctx.lastModule, lastModule);
    assertClean(rig);
  });
}

// ── Rev. 2.3: claimed selections, late commits, budget, recovery ─────────────

test("claimed selection: the second choice navigates once, as a replace, when the first lands (#29 → #30)", () => {
  const rig = adminAt("admin");

  rig.task(() => rig.dispatch(select("admin-clinics")));
  assert.deepEqual(rig.take(), ["push:module:admin-clinics", "arm:1", "publish"]);

  rig.task(() => rig.dispatch(select("admin-pricing")));
  assert.deepEqual(rig.take(), ["publish"], "a claim navigates nothing and keeps the budget (S14)");
  assert.deepEqual([...rig.timers.keys()], [1]);

  rig.task(() => rig.dispatch(committed(moduleAt("admin-clinics"))));
  assert.deepEqual(rig.take(), ["cancel:1", "replace:module:admin-pricing", "arm:2", "publish"]);

  rig.task(() => rig.dispatch(committed(moduleAt("admin-pricing"))));
  assert.deepEqual(rig.take(), ["cancel:2", "persist:admin-pricing", "publish"]);
  assert.deepEqual(rig.state(), { tag: "IDLE" });
  assertClean(rig);
});

test("a claim made before the drain does not invalidate the push of its flight", () => {
  const rig = adminAt("admin");

  rig.task(() => {
    rig.dispatch(select("admin-clinics"));
    rig.dispatch(select("admin-pricing"));
  });

  assert.deepEqual(rig.take(), ["push:module:admin-clinics", "arm:1", "publish", "publish"]);
  assertClean(rig);
});

test("budget expiry with a claimed selection relays it once (#31); without one it stalls (#12)", () => {
  const rig = adminAt("admin");

  rig.task(() => rig.dispatch(select("admin-clinics")));
  rig.task(() => rig.dispatch(select("admin-pricing")));
  rig.take();

  rig.fire(1);
  assert.deepEqual(rig.take(), ["push:module:admin-pricing", "arm:2", "publish"]);

  rig.fire(2);
  assert.equal(rig.state().tag, "STALLED");
  assert.deepEqual(rig.take(), ["publish"]);
  assert.equal(rig.timers.size, 0);
  assert.deepEqual(rig.navigated(), ["push:module:admin-clinics@1", "push:module:admin-pricing@2"]);
  assertClean(rig);
});

test("late commit of a superseded navigation runs nothing (#11) and the flight still lands (#9)", () => {
  const rig = adminRestoring();
  rig.task(() => rig.mount());
  rig.task(() => rig.dispatch(select("admin-pricing"))); // #10
  rig.take();

  rig.task(() => rig.dispatch(committed(moduleAt("admin-clinics")))); // #11
  assert.deepEqual(rig.take(), []);
  assert.deepEqual(rig.coordinator.getSnapshot().ctx.committed, moduleAt("admin-clinics"));
  assert.deepEqual([...rig.timers.keys()], [2]);

  rig.task(() => rig.dispatch(committed(moduleAt("admin-pricing"))));
  assert.deepEqual(rig.take(), ["cancel:2", "persist:admin-pricing", "publish"]);
  assertClean(rig);
});

test("return to the committed module pushes the current URL from IDLE (#25, DT-16)", () => {
  const rig = adminAt("admin");

  rig.task(() => rig.dispatch(select("admin-clinics")));
  rig.take();

  rig.task(() => rig.dispatch(select("admin")));
  assert.deepEqual(rig.take(), ["cancel:1", "push:module:admin", "publish"]);
  assert.deepEqual(rig.state(), { tag: "IDLE" });
  assert.equal(rig.timers.size, 0);
  assertClean(rig);
});

test("the push of #25 is dropped when something happens after returning to committed", () => {
  const rig = adminAt("admin");
  rig.task(() => rig.dispatch(select("admin-clinics")));
  rig.take();

  rig.task(() => {
    rig.dispatch(select("admin")); // #25, push with no flight
    rig.dispatch(select("admin-pricing")); // #5, a later non-inert transition
  });

  assert.deepEqual(rig.take(), ["cancel:1", "publish", "push:module:admin-pricing", "arm:2", "publish"]);
  assertClean(rig);
});

test("recovery: RETRY leaves STALLED through one document navigation with its budget (#15)", () => {
  const rig = adminAt("admin");
  rig.task(() => rig.dispatch(select("admin-clinics")));
  rig.fire(1);
  rig.take();

  rig.task(() => rig.dispatch({ type: "RETRY" }));
  assert.deepEqual(rig.take(), ["hard-assign:module:admin-clinics", "arm:2", "publish"]);
  assertClean(rig);
});

test("a navigation failure in flight cancels its budget and RESET normalizes the bare entry once", () => {
  const rig = adminAt("admin");
  rig.task(() => rig.dispatch(select("admin-clinics")));
  rig.take();

  rig.task(() => rig.dispatch(RENDER_FAILED));
  assert.deepEqual(rig.take(), ["cancel:1", "publish"]);

  rig.task(() => rig.dispatch({ type: "RESET", location: NONE }));
  assert.deepEqual(rig.take(), ["replace:module:admin", "arm:2", "publish"]);
  assertClean(rig);
});

// ── H6: delivery of URL commits ──────────────────────────────────────────────

test("commit() delivers a location only when it differs from the last one delivered by any event", () => {
  const rig = adminRestoring();
  rig.task(() => rig.mount());
  rig.take();

  const atBoot = rig.coordinator.getSnapshot();
  rig.task(() => rig.commit(NONE));
  assert.equal(rig.coordinator.getSnapshot(), atBoot, "HYDRATED already delivered the bare entry");

  rig.task(() => rig.dispatch(RENDER_FAILED));
  rig.task(() => rig.dispatch({ type: "RESET", location: NONE }));
  rig.take();
  const afterReset = rig.coordinator.getSnapshot();
  rig.task(() => rig.commit(NONE));
  assert.equal(rig.coordinator.getSnapshot(), afterReset, "RESET delivered it: no second normalization");
  assert.deepEqual(
    rig.navigated(),
    ["replace:module:admin-clinics@1", "replace:module:admin-clinics@2"],
    "one replace per normalization, none for the duplicate commit",
  );

  rig.task(() => rig.commit(moduleAt("admin-clinics")));
  assert.deepEqual(rig.state(), { tag: "IDLE" });
  assert.deepEqual(rig.coordinator.getSnapshot().delivered, moduleAt("admin-clinics"));
  assertClean(rig);
});

test("a commit the machine ignores in FAILED is still the last location delivered", () => {
  const rig = adminAt("admin");
  rig.task(() => rig.dispatch(RENDER_FAILED));

  rig.task(() => rig.commit(moduleAt("audit-log")));
  assert.equal(rig.state().tag, "FAILED");
  assert.deepEqual(rig.coordinator.getSnapshot().delivered, moduleAt("audit-log"));
  assertClean(rig);
});

test("previewDisplay is pure and shows the display of the commit about to be delivered", () => {
  const rig = adminAt("admin");
  rig.task(() => rig.dispatch(select("admin-clinics")));
  rig.task(() => rig.dispatch(select("admin-pricing")));
  const snapshot = rig.coordinator.getSnapshot();

  assert.deepEqual(previewDisplay(MACHINE, ADMIN, snapshot, moduleAt("admin")), moduleAt("admin-pricing"));
  // #30: the flight lands and the claimed selection stays on screen.
  assert.deepEqual(
    previewDisplay(MACHINE, ADMIN, snapshot, moduleAt("admin-clinics")),
    moduleAt("admin-pricing"),
  );
  // #23: an external commit is obeyed in the same render.
  assert.deepEqual(previewDisplay(MACHINE, ADMIN, snapshot, moduleAt("audit-log")), moduleAt("audit-log"));
  assert.equal(rig.coordinator.getSnapshot(), snapshot, "previewing dispatches nothing");
  assertClean(rig);
});

test("subscribers are notified by PUBLISH_DISPLAY and can unsubscribe", () => {
  const rig = adminAt("admin");
  let notified = 0;
  const unsubscribe = rig.coordinator.subscribe(() => {
    notified += 1;
  });

  rig.task(() => rig.dispatch(select("admin-clinics")));
  assert.equal(notified, 1);

  unsubscribe();
  rig.task(() => rig.dispatch(select("admin-pricing")));
  assert.equal(notified, 1);
});

// ── Seeded random search with I1–I8 ──────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Universe = {
  readonly config: MachineConfig;
  readonly locations: readonly NavLocation[];
  readonly selections: readonly NavEvent[];
  readonly stored: readonly (string | null)[];
};

const UNIVERSES: readonly Universe[] = [
  {
    config: ADMIN,
    locations: [NONE, moduleAt("admin"), moduleAt("admin-clinics"), moduleAt("admin-pricing"), moduleAt("retired")],
    selections: [
      select("admin"),
      select("admin-clinics"),
      select("admin-pricing"),
      select("audit-log"),
      select("retired"),
      { type: "SELECT_HUB" },
    ],
    stored: [null, "admin-clinics", "audit-log", "retired"],
  },
  {
    config: CLINIC,
    locations: [
      moduleAt("operaciones"),
      moduleAt("informes"),
      moduleAt("perfil"),
      HUB,
      routeAt("/dashboard/informes", "informes"),
      routeAt("/dashboard/logistica", "logistica"),
    ],
    selections: [
      select("operaciones"),
      select("informes"),
      select("perfil"),
      select("retired"),
      { type: "SELECT_HUB" },
      { type: "OPEN_ROUTE", path: "/dashboard/informes", module: "informes" },
      { type: "OPEN_ROUTE", path: "/dashboard/logistica", module: "logistica" },
    ],
    stored: [null, "informes", "perfil", "retired"],
  },
];

type SearchResult = {
  readonly tasks: number;
  readonly navigations: number;
  readonly counts: Readonly<Record<InvariantId, number>>;
  readonly digest: string;
};

function search(create: Create, seed: number, runs: number): SearchResult {
  const random = mulberry32(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  const counts: Record<InvariantId, number> = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0 };
  let tasks = 0;
  let navigations = 0;
  let hash = 0x811c9dc5;

  for (let run = 0; run < runs; run += 1) {
    const universe = pick(UNIVERSES);
    const location = pick(universe.locations);
    const rig = createRig(
      create,
      universe.config,
      hydrated(location, pick(universe.stored), location.kind !== "none" && random() < 0.5),
    );

    const randomEvent = (): NavEvent => {
      const roll = random();
      const state = rig.state();
      if (roll < 0.34) return pick(universe.selections);
      if (roll < 0.56) return committed(pick(universe.locations));
      if (roll < 0.68) return { type: "TRAVERSE_STARTED", destination: pick(universe.locations) };
      if (roll < 0.78) {
        const live = flightOf(state);
        return { type: "BUDGET_EXPIRED", navId: live !== null && random() < 0.6 ? live : 1 + Math.floor(random() * 6) };
      }
      if (roll < 0.86) return { type: "NAV_FAILED", reason: "render" };
      if (roll < 0.92) return { type: "RETRY" };
      return { type: "RESET", location: pick(universe.locations) };
    };

    const step = () => {
      const roll = random();
      if (roll < 0.72) rig.dispatch(randomEvent());
      else if (roll < 0.86) {
        if (rig.mounted) rig.unmount();
        else rig.mount();
      } else if (rig.mounted) {
        rig.unmount();
        rig.mount();
      } else rig.mount();
    };

    // The first task is the hydration commit: events may precede the mount.
    rig.task(() => {
      while (random() < 0.3) rig.dispatch(randomEvent());
      if (random() < 0.9) rig.mount();
    });
    tasks += 1;

    const length = 4 + Math.floor(random() * 9);
    for (let index = 0; index < length; index += 1) {
      const live = [...rig.timers.keys()];
      if (live.length > 0 && random() < 0.2) rig.fire(pick(live));
      else {
        rig.task(() => {
          const operations = 1 + Math.floor(random() * 3);
          for (let operation = 0; operation < operations; operation += 1) step();
        });
      }
      tasks += 1;
    }

    for (const id of rig.violations) counts[id] += 1;
    navigations += rig.navigations.length;
    for (const line of rig.log) {
      for (let index = 0; index < line.length; index += 1) {
        hash = Math.imul(hash ^ line.charCodeAt(index), 0x01000193) >>> 0;
      }
    }
  }

  return { tasks, navigations, counts, digest: hash.toString(16).padStart(8, "0") };
}

const NO_VIOLATIONS = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0 };
const SEARCH_RUNS = 20_000;

const SEARCH_ANCHORS: readonly (readonly [number, number, number, string])[] = [
  [0x50314631, 180_061, 22_929, "39d6780d"],
  [0x0badc0de, 179_586, 22_881, "b2a6196a"],
];

for (const [seed, tasks, navigations, digest] of SEARCH_ANCHORS) {
  test(`random search, seed 0x${seed.toString(16)}: ${SEARCH_RUNS} runs hold I1–I8 and reproduce`, () => {
    const result = search(createNavigationCoordinator, seed, SEARCH_RUNS);

    assert.deepEqual(result.counts, NO_VIOLATIONS);
    assert.deepEqual(
      [result.tasks, result.navigations, result.digest],
      [tasks, navigations, digest],
      "same seed, same trace of executed effects",
    );
  });
}

// ── Mutations M1–M5: each element of §12.5.1 is necessary ────────────────────

const COORDINATOR_PATH = "frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts";
const MUTATION_SEED = 0x4d555431;
const MUTATION_RUNS = 3_000;

async function loadVariant(anchor: string | null, replacement = ""): Promise<Create> {
  const source = readSourceFile(COORDINATOR_PATH);
  if (anchor !== null) {
    assert.equal(source.split(anchor).length - 1, 1, `mutation anchor must occur exactly once: ${anchor}`);
  }
  const code = stripTypeScriptTypes(anchor === null ? source : source.replace(anchor, replacement));
  const loaded: { createNavigationCoordinator: Create } = await import(
    `data:text/javascript;base64,${Buffer.from(code, "utf8").toString("base64")}`
  );
  return loaded.createNavigationCoordinator;
}

test("mutation control: the tracked source, loaded like a mutant, holds I1–I8", async () => {
  const result = search(await loadVariant(null), MUTATION_SEED, MUTATION_RUNS);

  assert.deepEqual(result.counts, NO_VIOLATIONS);
  assert.deepEqual(result, search(createNavigationCoordinator, MUTATION_SEED, MUTATION_RUNS));
});

const MUTANTS: readonly (readonly [string, string, string, readonly InvariantId[]])[] = [
  ["M1: no currency check", "if (!isCurrent(entry)) continue;", "", ["I2", "I7", "I8"]],
  ["M2: synchronous drain instead of a microtask", "host.scheduleMicrotask(drain);", "drain();", ["I8"]],
  [
    "M3: currency by last transition instead of by navId",
    'state.tag === "ROUTING" && state.navId === flight',
    "entry.seq === seq",
    ["I6"],
  ],
  ["M4: no timer reconciliation (A6)", "reconcileBudgets();", "", ["I3"]],
  ["M5: drains while unmounted", "if (!ready) return;", "", ["I4"]],
];

for (const [name, anchor, replacement, expected] of MUTANTS) {
  test(`${name} violates ${expected.join(", ")}`, async () => {
    const result = search(await loadVariant(anchor, replacement), MUTATION_SEED, MUTATION_RUNS);

    for (const id of expected) {
      assert.ok(result.counts[id] > 0, `${id} must detect the mutant: ${JSON.stringify(result.counts)}`);
    }
  });
}
