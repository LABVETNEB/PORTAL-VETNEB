import assert from "node:assert/strict";
import test from "node:test";

import {
  initial,
  transition,
  type MachineConfig,
  type NavContext,
  type NavEffect,
  type NavEvent,
  type NavLocation,
  type NavState,
  type TransitionResult,
} from "../../../../frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts";

// PR-NAV-02 — mechanical verification of the navigation machine against the
// normative table of docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md
// §12 (rev. 2.2.2: 28 rows, 113 guard branches) and the invariants of §13.
//
// The machine is never its own oracle. Four independent sources judge it:
//
//   1. CASES      — one literal expectation per cell of the guard partition
//                   (113 cells over the 60 state × event pairs), written by hand
//                   from the "Estado siguiente" and "Efectos" columns.
//   2. GUARDS     — the "Guard" column and the ignored-pairs table transcribed
//                   row by row, each guard on its own, with no ordering. A
//                   situation must satisfy EXACTLY one: zero is a hole in the
//                   table, two is an overlap.
//   3. PROPERTIES — the invariants of §13, checked after every transition of an
//                   exhaustive walk of a small universe, of 10 000 seeded
//                   random traces and of 4 000 closed-loop sessions.
//   4. HISTORY    — the abstract router and session history of §13.1 (H1–H7).
//                   It interprets the machine's effects and is the only thing
//                   that answers back: S5(b), L6 and C-6 are judged here.
//
// A red test here is a finding about the SPECIFICATION as much as about the
// code: §16 forbids this PR from amending the table on its own.
//
// Out of reach by design (§16, rev. 2.2.1): WHEN an emitted effect runs. The
// interpreter of §12.5.1 and its invariants I1–I8 belong to PR-NAV-03; this
// suite only proves what the machine emits, and in what order, per transition.

// ── Vocabulary ───────────────────────────────────────────────────────────────

type Tag = NavState["tag"];
type EventType = NavEvent["type"];
type Branch = "ignored" | `#${number}`;
type Covers<Union, Listed> = [Union] extends [Listed] ? true : false;

const TAGS = ["BOOTING", "IDLE", "ROUTING", "TRAVERSING", "STALLED", "FAILED"] as const satisfies
  readonly Tag[];
const EVENT_TYPES = [
  "HYDRATED",
  "SELECT_MODULE",
  "SELECT_HUB",
  "OPEN_ROUTE",
  "URL_COMMITTED",
  "TRAVERSE_STARTED",
  "BUDGET_EXPIRED",
  "NAV_FAILED",
  "RETRY",
  "RESET",
] as const satisfies readonly EventType[];
const EFFECT_TYPES = [
  "ROUTER_PUSH",
  "ROUTER_REPLACE",
  "HARD_NAVIGATE",
  "ARM_BUDGET",
  "CANCEL_BUDGET",
  "PERSIST",
  "PUBLISH_DISPLAY",
] as const satisfies readonly NavEffect["type"][];
const SELECT_TYPES = ["SELECT_MODULE", "SELECT_HUB", "OPEN_ROUTE"] as const satisfies
  readonly EventType[];

// Compile-time exhaustiveness: a state, event or effect added to the machine
// without being listed here stops `typecheck:test`.
const EVERY_TAG_LISTED: Covers<Tag, (typeof TAGS)[number]> = true;
const EVERY_EVENT_LISTED: Covers<EventType, (typeof EVENT_TYPES)[number]> = true;
const EVERY_EFFECT_LISTED: Covers<NavEffect["type"], (typeof EFFECT_TYPES)[number]> = true;
// S9: the three T1 effects are not members of the union.
const NO_NATIVE_OR_REFRESH_EFFECT: Covers<
  Extract<NavEffect["type"], "REFRESH_DATA" | "PUSH_NATIVE" | "REPLACE_NATIVE">,
  never
> = true;

const RETIRED = "retired-module";

const ADMIN: MachineConfig = {
  surface: "admin",
  modules: ["admin", "admin-clinics", "admin-pricing"],
  defaultModule: "admin",
};
const CLINIC: MachineConfig = {
  surface: "clinic",
  modules: ["operaciones", "informes", "logistica", "perfil"],
  defaultModule: "operaciones",
};

const NONE: NavLocation = { kind: "none" };
const HUB: NavLocation = { kind: "hub" };
const mod = (module: string): NavLocation => ({ kind: "module", module });
const route = (path: string, module: string): NavLocation => ({ kind: "route", path, module });

const HOME = mod("admin");
const CLINICS = mod("admin-clinics");
const PRICING = mod("admin-pricing");
const OPS = mod("operaciones");
const INFORMES = mod("informes");
const LOGISTICA = mod("logistica");
const PERFIL = mod("perfil");
const INFORMES_ROUTE = route("/dashboard/informes", "informes");
const LOGISTICA_ROUTE = route("/dashboard/logistica", "logistica");
const VISITS_ROUTE = route("/dashboard/logistica/visitas", "logistica");
const UNRESOLVED_ROUTE = route("/dashboard/retirada", RETIRED);

const PUBLISH: NavEffect = { type: "PUBLISH_DISPLAY" };
const push = (to: NavLocation): NavEffect => ({ type: "ROUTER_PUSH", to });
const replace = (to: NavLocation): NavEffect => ({ type: "ROUTER_REPLACE", to });
const hard = (to: NavLocation, mode: "assign" | "replace"): NavEffect => ({
  type: "HARD_NAVIGATE",
  to,
  mode,
});
const arm = (navId: number): NavEffect => ({ type: "ARM_BUDGET", navId });
const cancel = (navId: number): NavEffect => ({ type: "CANCEL_BUDGET", navId });
const persist = (module: string): NavEffect => ({ type: "PERSIST", module });

const BOOTING: NavState = { tag: "BOOTING" };
const IDLE: NavState = { tag: "IDLE" };
const RESTORE = { intent: "restore", history: "replace" } as const;

function routing(
  navId: number,
  target: NavLocation,
  options: {
    readonly intent?: "user" | "restore";
    readonly history?: "push" | "replace";
    readonly afterTraverse?: boolean;
  } = {},
): NavState {
  return {
    tag: "ROUTING",
    navId,
    target,
    intent: options.intent ?? "user",
    history: options.history ?? "push",
    afterTraverse: options.afterTraverse ?? false,
  };
}

function traversing(navId: number, destination: NavLocation): NavState {
  return { tag: "TRAVERSING", navId, destination };
}

function stalled(
  navId: number,
  target: NavLocation,
  intent: "user" | "restore" | "traverse" = "user",
  history: "push" | "replace" = "push",
): NavState {
  return { tag: "STALLED", navId, target, intent, history };
}

function failed(reason: "render" | "payload" | "unknown"): NavState {
  return { tag: "FAILED", reason };
}

function context(
  committed: NavLocation,
  display: NavLocation,
  nextNavId: number,
  rest: { readonly superseded?: readonly NavLocation[]; readonly lastModule?: string | null } = {},
): NavContext {
  return {
    committed,
    display,
    nextNavId,
    superseded: rest.superseded ?? [],
    lastModule: rest.lastModule ?? null,
  };
}

const hydrated = (
  location: NavLocation,
  storedModule: string | null = null,
  explicit = false,
): NavEvent => ({ type: "HYDRATED", location, explicit, storedModule });
const selectModule = (module: string): NavEvent => ({ type: "SELECT_MODULE", module });
const SELECT_HUB: NavEvent = { type: "SELECT_HUB" };
const openRoute = (path: string, module: string): NavEvent => ({ type: "OPEN_ROUTE", path, module });
const urlCommitted = (location: NavLocation): NavEvent => ({ type: "URL_COMMITTED", location });
const traverseStarted = (destination: NavLocation): NavEvent => ({
  type: "TRAVERSE_STARTED",
  destination,
});
const budgetExpired = (navId: number): NavEvent => ({ type: "BUDGET_EXPIRED", navId });
const navFailed = (reason: "render" | "payload" | "unknown"): NavEvent => ({
  type: "NAV_FAILED",
  reason,
});
const RETRY: NavEvent = { type: "RETRY" };
const reset = (location: NavLocation): NavEvent => ({ type: "RESET", location });

// ── Canonical text: comparison, hashing and readable counterexamples ─────────

function locKey(location: NavLocation): string {
  if (location.kind === "module") return `module:${location.module}`;
  if (location.kind === "route") return `route:${location.path}:${location.module}`;
  return location.kind;
}

function stateKey(state: NavState): string {
  switch (state.tag) {
    case "BOOTING":
    case "IDLE":
      return state.tag;
    case "ROUTING":
      return `ROUTING#${state.navId}(${locKey(state.target)},${state.intent},${state.history}${
        state.afterTraverse ? ",afterTraverse" : ""
      })`;
    case "TRAVERSING":
      return `TRAVERSING#${state.navId}(${locKey(state.destination)})`;
    case "STALLED":
      return `STALLED#${state.navId}(${locKey(state.target)},${state.intent},${state.history})`;
    case "FAILED":
      return `FAILED(${state.reason})`;
  }
}

/** `superseded` is a set in §12.4: its order is not part of the contract. */
function supersededKey(ctx: NavContext): string {
  return ctx.superseded.map(locKey).sort().join(",");
}

function ctxKey(ctx: NavContext): string {
  return [
    `committed=${locKey(ctx.committed)}`,
    `display=${locKey(ctx.display)}`,
    `next=${ctx.nextNavId}`,
    `superseded={${supersededKey(ctx)}}`,
    `last=${ctx.lastModule ?? "∅"}`,
  ].join(" ");
}

function effectKey(effect: NavEffect): string {
  switch (effect.type) {
    case "ROUTER_PUSH":
    case "ROUTER_REPLACE":
      return `${effect.type}(${locKey(effect.to)})`;
    case "HARD_NAVIGATE":
      return `HARD_NAVIGATE(${locKey(effect.to)},${effect.mode})`;
    case "ARM_BUDGET":
    case "CANCEL_BUDGET":
      return `${effect.type}(${effect.navId})`;
    case "PERSIST":
      return `PERSIST(${effect.module})`;
    case "PUBLISH_DISPLAY":
      return effect.type;
  }
}

function eventKey(event: NavEvent): string {
  switch (event.type) {
    case "HYDRATED":
      return `HYDRATED(${locKey(event.location)},${event.explicit ? "explicit" : "implicit"},stored=${
        event.storedModule ?? "∅"
      })`;
    case "SELECT_MODULE":
      return `SELECT_MODULE(${event.module})`;
    case "OPEN_ROUTE":
      return `OPEN_ROUTE(${event.path},${event.module})`;
    case "URL_COMMITTED":
    case "RESET":
      return `${event.type}(${locKey(event.location)})`;
    case "TRAVERSE_STARTED":
      return `TRAVERSE_STARTED(${locKey(event.destination)})`;
    case "BUDGET_EXPIRED":
      return `BUDGET_EXPIRED(${event.navId})`;
    case "NAV_FAILED":
      return `NAV_FAILED(${event.reason})`;
    case "SELECT_HUB":
    case "RETRY":
      return event.type;
  }
}

function resultKey(result: TransitionResult): string {
  return `${stateKey(result.state)} | ${ctxKey(result.ctx)} | ${
    result.effects.map(effectKey).join(" > ") || "—"
  }`;
}

// ── The helper functions of §12.4, transcribed independently of the machine ──

type Situation = {
  readonly config: MachineConfig;
  readonly ctx: NavContext;
  readonly state: NavState;
  readonly event: NavEvent;
};

const same = (a: NavLocation, b: NavLocation): boolean => locKey(a) === locKey(b);
const within = (list: readonly NavLocation[], location: NavLocation): boolean =>
  list.some((entry) => same(entry, location));
const valid = (config: MachineConfig, moduleId: string | null): boolean =>
  moduleId !== null && config.modules.includes(moduleId);
const budgeted = (state: NavState): state is Extract<NavState, { tag: "ROUTING" | "TRAVERSING" }> =>
  state.tag === "ROUTING" || state.tag === "TRAVERSING";

function targetOf(config: MachineConfig, event: NavEvent): NavLocation | null {
  if (event.type === "SELECT_MODULE") return valid(config, event.module) ? mod(event.module) : null;
  if (event.type === "SELECT_HUB") return config.surface === "clinic" ? HUB : null;
  if (event.type === "OPEN_ROUTE") {
    return config.surface === "clinic" && valid(config, event.module)
      ? route(event.path, event.module)
      : null;
  }
  throw new Error(`${event.type} is not a selection`);
}

function bootRestore(config: MachineConfig, event: NavEvent): NavLocation | null {
  if (event.type !== "HYDRATED") throw new Error(`${event.type} is not a hydration`);
  const stored = event.storedModule;
  if (config.surface === "admin") {
    if (event.location.kind !== "none") return null;
    return mod(stored !== null && valid(config, stored) ? stored : config.defaultModule);
  }
  return !event.explicit &&
    same(event.location, mod(config.defaultModule)) &&
    stored !== null &&
    valid(config, stored) &&
    stored !== config.defaultModule
    ? mod(stored)
    : null;
}

/** `L` / `D` of the table: the location an event carries. */
function at({ event }: Situation): NavLocation {
  if (event.type === "HYDRATED" || event.type === "URL_COMMITTED" || event.type === "RESET") {
    return event.location;
  }
  if (event.type === "TRAVERSE_STARTED") return event.destination;
  throw new Error(`${event.type} carries no location`);
}

/** `T` / `D` of the table: the location a state is flying to. */
function flight({ state }: Situation): NavLocation {
  if (state.tag === "ROUTING" || state.tag === "STALLED") return state.target;
  if (state.tag === "TRAVERSING") return state.destination;
  throw new Error(`${state.tag} flies nowhere`);
}

function expired({ state, event }: Situation): boolean {
  return event.type === "BUDGET_EXPIRED" && "navId" in state && event.navId === state.navId;
}

function chosen(situation: Situation, guard: (target: NavLocation) => boolean): boolean {
  const target = targetOf(situation.config, situation.event);
  return target !== null && guard(target);
}

// ── GUARDS: the Guard column and the ignored-pairs table of §12.4 ────────────

type Guard = {
  readonly branch: Branch;
  readonly from: readonly Tag[];
  readonly on: readonly EventType[];
  readonly when: (situation: Situation) => boolean;
};

const always = (): boolean => true;
const committedOf = (s: Situation): NavLocation => s.ctx.committed;
const superseded = (s: Situation): boolean => within(s.ctx.superseded, at(s));
const afterTraverse = (s: Situation): boolean => s.state.tag === "ROUTING" && s.state.afterTraverse;
const storedIsValid = (s: Situation): boolean =>
  s.event.type === "HYDRATED" && valid(s.config, s.event.storedModule);

const GUARDS: readonly Guard[] = [
  { branch: "#1", from: ["BOOTING"], on: ["HYDRATED"], when: (s) => bootRestore(s.config, s.event) === null },
  {
    branch: "#2",
    from: ["BOOTING"],
    on: ["HYDRATED"],
    when: (s) => bootRestore(s.config, s.event) !== null && storedIsValid(s),
  },
  {
    branch: "#3",
    from: ["BOOTING"],
    on: ["HYDRATED"],
    when: (s) => s.config.surface === "admin" && at(s).kind === "none" && !storedIsValid(s),
  },
  { branch: "#4", from: ["IDLE"], on: SELECT_TYPES, when: (s) => chosen(s, (x) => same(x, committedOf(s))) },
  { branch: "#5", from: ["IDLE"], on: ["SELECT_MODULE"], when: (s) => chosen(s, (x) => !same(x, committedOf(s))) },
  { branch: "#6", from: TAGS, on: SELECT_TYPES, when: (s) => targetOf(s.config, s.event) === null },
  { branch: "#7", from: ["IDLE"], on: ["SELECT_HUB"], when: (s) => chosen(s, (x) => !same(x, committedOf(s))) },
  { branch: "#8", from: ["IDLE"], on: ["OPEN_ROUTE"], when: (s) => chosen(s, (x) => !same(x, committedOf(s))) },
  { branch: "#9", from: ["ROUTING"], on: ["URL_COMMITTED"], when: (s) => same(at(s), flight(s)) },
  {
    branch: "#10",
    from: ["ROUTING"],
    on: SELECT_TYPES,
    when: (s) => chosen(s, (x) => !same(x, flight(s)) && !same(x, committedOf(s))),
  },
  { branch: "#11", from: ["ROUTING", "STALLED"], on: ["URL_COMMITTED"], when: superseded },
  { branch: "#12", from: ["ROUTING"], on: ["BUDGET_EXPIRED"], when: expired },
  { branch: "#13", from: ["ROUTING", "TRAVERSING"], on: ["BUDGET_EXPIRED"], when: (s) => !expired(s) },
  { branch: "#13", from: ["STALLED"], on: ["BUDGET_EXPIRED"], when: always },
  { branch: "#14", from: ["STALLED"], on: ["URL_COMMITTED"], when: (s) => same(at(s), flight(s)) },
  { branch: "#15", from: ["STALLED"], on: ["RETRY"], when: always },
  { branch: "#16", from: ["STALLED"], on: SELECT_TYPES, when: (s) => chosen(s, (x) => !same(x, committedOf(s))) },
  {
    branch: "#17",
    from: ["IDLE", "ROUTING", "STALLED", "TRAVERSING"],
    on: ["TRAVERSE_STARTED"],
    when: (s) => !same(at(s), committedOf(s)),
  },
  { branch: "#18", from: ["TRAVERSING"], on: ["URL_COMMITTED"], when: always },
  {
    branch: "#19",
    from: ["TRAVERSING"],
    on: SELECT_TYPES,
    when: (s) => chosen(s, (x) => !same(x, flight(s)) && !same(x, committedOf(s))),
  },
  {
    branch: "#20",
    from: ["BOOTING", "IDLE", "ROUTING", "TRAVERSING", "STALLED"],
    on: ["NAV_FAILED"],
    when: always,
  },
  { branch: "#21", from: ["FAILED"], on: ["RESET"], when: always },
  { branch: "#22", from: ["IDLE"], on: ["URL_COMMITTED"], when: (s) => !same(at(s), committedOf(s)) },
  {
    branch: "#23",
    from: ["ROUTING"],
    on: ["URL_COMMITTED"],
    when: (s) => !same(at(s), flight(s)) && !superseded(s) && !afterTraverse(s),
  },
  {
    branch: "#23",
    from: ["STALLED"],
    on: ["URL_COMMITTED"],
    when: (s) => !same(at(s), flight(s)) && !superseded(s),
  },
  { branch: "#24", from: ["IDLE"], on: ["TRAVERSE_STARTED"], when: (s) => same(at(s), committedOf(s)) },
  {
    branch: "#25",
    from: ["ROUTING", "STALLED", "TRAVERSING"],
    on: SELECT_TYPES,
    when: (s) => chosen(s, (x) => same(x, committedOf(s)) && !same(x, flight(s))),
  },
  {
    branch: "#26",
    from: ["ROUTING"],
    on: ["URL_COMMITTED"],
    when: (s) => afterTraverse(s) && !same(at(s), flight(s)) && !superseded(s),
  },
  { branch: "#27", from: ["TRAVERSING"], on: ["BUDGET_EXPIRED"], when: expired },
  {
    branch: "#28",
    from: ["ROUTING", "STALLED", "TRAVERSING"],
    on: ["TRAVERSE_STARTED"],
    when: (s) => same(at(s), committedOf(s)),
  },

  // Explicitly ignored pairs.
  {
    branch: "ignored",
    from: ["BOOTING", "FAILED"],
    on: SELECT_TYPES,
    when: (s) => targetOf(s.config, s.event) !== null,
  },
  {
    branch: "ignored",
    from: ["BOOTING"],
    on: ["URL_COMMITTED", "TRAVERSE_STARTED", "BUDGET_EXPIRED", "RETRY", "RESET"],
    when: always,
  },
  { branch: "ignored", from: ["IDLE"], on: ["HYDRATED", "BUDGET_EXPIRED", "RETRY", "RESET"], when: always },
  { branch: "ignored", from: ["IDLE"], on: ["URL_COMMITTED"], when: (s) => same(at(s), committedOf(s)) },
  { branch: "ignored", from: ["ROUTING", "TRAVERSING"], on: ["HYDRATED", "RETRY", "RESET"], when: always },
  {
    branch: "ignored",
    from: ["ROUTING", "TRAVERSING"],
    on: SELECT_TYPES,
    when: (s) => chosen(s, (x) => same(x, flight(s))),
  },
  { branch: "ignored", from: ["STALLED"], on: ["HYDRATED", "RESET"], when: always },
  {
    branch: "ignored",
    from: ["STALLED"],
    on: SELECT_TYPES,
    when: (s) => chosen(s, (x) => same(x, committedOf(s)) && same(x, flight(s))),
  },
  {
    branch: "ignored",
    from: ["FAILED"],
    on: ["HYDRATED", "URL_COMMITTED", "TRAVERSE_STARTED", "BUDGET_EXPIRED", "NAV_FAILED", "RETRY"],
    when: always,
  },
];

function classify(situation: Situation): readonly Branch[] {
  return GUARDS.filter(
    (guard) =>
      guard.from.includes(situation.state.tag) &&
      guard.on.includes(situation.event.type) &&
      guard.when(situation),
  ).map((guard) => guard.branch);
}

const cellKey = (tag: Tag, type: EventType, branch: Branch): string => `${tag} × ${type} → ${branch}`;
const pairKey = (tag: Tag, type: EventType): string => `${tag} × ${type}`;

/** Every (state, event, branch) the two normative tables declare. */
const CELLS: ReadonlySet<string> = new Set(
  GUARDS.flatMap((guard) =>
    guard.from.flatMap((tag) => guard.on.map((type) => cellKey(tag, type, guard.branch))),
  ),
);

// ── The Efectos column, as the shape each row is allowed to produce ──────────

const UNCHANGED = "unchanged";
const SETTLED = ["IDLE:PUBLISH_DISPLAY", "IDLE:PERSIST>PUBLISH_DISPLAY", "ROUTING:ROUTER_REPLACE>ARM_BUDGET>PUBLISH_DISPLAY"];
const led = (lead: string, shapes: readonly string[]): readonly string[] =>
  shapes.map((shape) => shape.replace(":", `:${lead}>`));

function shapesOf(branch: Branch, from: NavState): readonly string[] {
  switch (branch) {
    case "#1":
      return ["IDLE:PUBLISH_DISPLAY", "IDLE:PERSIST>PUBLISH_DISPLAY"];
    case "#2":
    case "#3":
      return ["ROUTING:ROUTER_REPLACE>ARM_BUDGET>PUBLISH_DISPLAY"];
    case "#5":
    case "#7":
    case "#8":
    case "#16":
      return ["ROUTING:ROUTER_PUSH>ARM_BUDGET>PUBLISH_DISPLAY"];
    case "#9":
      return led("CANCEL_BUDGET", SETTLED);
    case "#10":
    case "#19":
      return ["ROUTING:CANCEL_BUDGET>ROUTER_PUSH>ARM_BUDGET>PUBLISH_DISPLAY"];
    case "#12":
    case "#27":
      return ["STALLED:PUBLISH_DISPLAY"];
    case "#14":
      return SETTLED;
    case "#15":
      return ["ROUTING:HARD_NAVIGATE>ARM_BUDGET>PUBLISH_DISPLAY"];
    case "#17":
      return budgeted(from)
        ? ["TRAVERSING:CANCEL_BUDGET>ARM_BUDGET>PUBLISH_DISPLAY"]
        : ["TRAVERSING:ARM_BUDGET>PUBLISH_DISPLAY"];
    case "#18":
      return led("CANCEL_BUDGET", SETTLED);
    case "#20":
      return budgeted(from) ? ["FAILED:CANCEL_BUDGET>PUBLISH_DISPLAY"] : ["FAILED:PUBLISH_DISPLAY"];
    case "#21":
    case "#22":
      return SETTLED;
    case "#23":
      return from.tag === "ROUTING" ? led("CANCEL_BUDGET", SETTLED) : SETTLED;
    case "#25":
      return budgeted(from)
        ? ["IDLE:CANCEL_BUDGET>ROUTER_PUSH>PUBLISH_DISPLAY"]
        : ["IDLE:ROUTER_PUSH>PUBLISH_DISPLAY"];
    case "#28":
      return budgeted(from) ? led("CANCEL_BUDGET", SETTLED) : SETTLED;
    case "#26":
      return ["ROUTING:"];
    default:
      return [UNCHANGED];
  }
}

// ── Running the machine ──────────────────────────────────────────────────────

function deepFreeze<Value>(value: Value): Value {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

/** Inputs are frozen first: a transition that mutated one would throw. */
function apply({ config, ctx, state, event }: Situation): TransitionResult {
  return transition(deepFreeze(config), deepFreeze(ctx), deepFreeze(state), deepFreeze(event));
}

function unchanged(before: { ctx: NavContext; state: NavState }, result: TransitionResult): boolean {
  return (
    result.effects.length === 0 &&
    ctxKey(result.ctx) === ctxKey(before.ctx) &&
    stateKey(result.state) === stateKey(before.state)
  );
}

// ── PROPERTIES: the invariants of §13 and the emission contract of §12.5 ─────

const PROPERTIES = {
  S1: "in IDLE, display = committed",
  S3: "a BUDGET_EXPIRED with a stale id changes nothing and emits nothing",
  S4: "a commit that belongs to `superseded` is never painted",
  S5: "a restore or normalization flies to a valid module by ROUTER_REPLACE and never emits ROUTER_PUSH",
  S6: "HARD_NAVIGATE only answers a RETRY from STALLED",
  S9: "no effect outside NavEffect: no REFRESH_DATA, PUSH_NATIVE or REPLACE_NATIVE",
  S10: "in ROUTING restore, display = committed",
  S11: "exactly one budget armed while ROUTING/TRAVERSING, with its navId, and none otherwise",
  S12: "PERSIST only carries a module the surface has: the one of the location just confirmed in IDLE",
  S13: "afterTraverse holds exactly while the flight descends, selection after selection, from a traverse whose commit was not yet recorded",
  L1: "a valid selection either starts a navigation with ROUTER_PUSH or is idempotent on the destination in force",
  L2: "ROUTING and TRAVERSING end in STALLED when their budget expires",
  L3: "STALLED recovers on RETRY and FAILED on RESET",
  L4: "TRAVERSE_STARTED always abandons the flight of ROUTING/STALLED",
  L5: "an Admin without a module never rests in IDLE",
  L6: "no flight targets the committed location: its commit could never be observed",
  "display rules": "display follows §12.4: target in ROUTING user, destination in TRAVERSING, kept in STALLED/FAILED",
  "superseded scope": "`superseded` is empty outside ROUTING/STALLED",
  "target never superseded": "the target in flight is never in `superseded` (premise of the #9/#11 partition)",
  "navId monotonic": "navIds grow by one per budget armed and are never reused",
  partition: "exactly one row or ignored entry of §12.4 resolves each situation",
  shape: "the machine produces the next state and the ordered effects of the row that resolves it",
  // What the interpreter of §12.5.1 takes for granted about a transition. These
  // are facts about the effects EMITTED; I1–I8 are about their execution.
  "inert rows": "nothing changes and nothing is emitted exactly under an ignored pair or rows #4, #6, #11, #13 and #24 (A2)",
  "navigation scope": "at most one navigation per transition: that of the flight it leaves in ROUTING, or the return to `committed` of row #25",
  "budget scope": "ARM_BUDGET names the flight the transition leaves open, CANCEL_BUDGET the one it found, and the cancel comes first",
  publish: "PUBLISH_DISPLAY closes, once, every transition that emits anything or changes display or the tag",
} as const;
type Property = keyof typeof PROPERTIES;

/** §12.5.1, A2: the transitions that do not advance `seq`. */
const INERT_ROWS: readonly Branch[] = ["ignored", "#4", "#6", "#11", "#13", "#24"];

type World = {
  readonly ctx: NavContext;
  readonly state: NavState;
  /** Budgets armed and neither cancelled nor fired. */
  readonly armed: readonly number[];
  /** Highest navId ever armed. */
  readonly issued: number;
  /**
   * S13, kept apart from the machine's own flag: a selection abandoned a
   * traverse (#19) and no commit has been recorded since (#26), through every
   * selection that replaced that flight (#10).
   */
  readonly owed: boolean;
};

type Step = {
  readonly event: NavEvent;
  readonly branches: readonly Branch[];
  readonly result: TransitionResult;
  readonly world: World;
  readonly broken: readonly Property[];
};

function boot(config: MachineConfig): World {
  return { ...initial(config), armed: [], issued: 0, owed: false };
}

function advance(config: MachineConfig, before: World, event: NavEvent): Step {
  const situation: Situation = { config, ctx: before.ctx, state: before.state, event };
  const branches = classify(situation);
  const result = apply(situation);

  let armed = before.armed.filter((id) => event.type !== "BUDGET_EXPIRED" || id !== event.navId);
  let issued = before.issued;
  let ledger = true;
  for (const effect of result.effects) {
    if (effect.type === "ARM_BUDGET") {
      if (effect.navId !== before.ctx.nextNavId || effect.navId <= issued) ledger = false;
      issued = Math.max(issued, effect.navId);
      armed = [...armed, effect.navId];
    }
    if (effect.type === "CANCEL_BUDGET") {
      if (!armed.includes(effect.navId)) ledger = false;
      armed = armed.filter((id) => id !== effect.navId);
    }
  }

  const world: World = { ctx: result.ctx, state: result.state, armed, issued, owed: owes(before, event, result) };
  return { event, branches, result, world, broken: audit(config, before, event, branches, result, world, ledger) };
}

/** Whether the flight a transition leaves open still awaits the commit of an abandoned traverse. */
function owes(before: World, event: NavEvent, result: TransitionResult): boolean {
  const { state } = result;
  if (state.tag !== "ROUTING" || state.intent !== "user") return false;
  const chose = (SELECT_TYPES as readonly EventType[]).includes(event.type);
  const from = before.state;

  if (from.tag === "TRAVERSING") return chose;
  if (from.tag !== "ROUTING") return false;
  if (state.navId !== from.navId) return chose && before.owed;
  // The same flight: the debt is paid by the one commit it lets through.
  return before.owed && !(event.type === "URL_COMMITTED" && !unchanged(before, result));
}

function audit(
  config: MachineConfig,
  before: World,
  event: NavEvent,
  branches: readonly Branch[],
  result: TransitionResult,
  after: World,
  ledger: boolean,
): readonly Property[] {
  const broken: Property[] = [];
  const check = (property: Property, holds: boolean): void => {
    if (!holds) broken.push(property);
  };
  const { ctx, state, effects } = result;
  const inert = unchanged(before, result);
  const live = budgeted(before.state) && event.type === "BUDGET_EXPIRED" && event.navId === before.state.navId;

  check("S1", state.tag !== "IDLE" || same(ctx.display, ctx.committed));
  check("S3", event.type !== "BUDGET_EXPIRED" || live || inert);
  check(
    "S4",
    !(
      event.type === "URL_COMMITTED" &&
      (before.state.tag === "ROUTING" || before.state.tag === "STALLED") &&
      within(before.ctx.superseded, event.location)
    ) || inert,
  );
  check(
    "S6",
    effects.every((effect) => effect.type !== "HARD_NAVIGATE") ||
      (event.type === "RETRY" && before.state.tag === "STALLED"),
  );
  check("S9", effects.every((effect) => (EFFECT_TYPES as readonly string[]).includes(effect.type)));
  check("S10", !(state.tag === "ROUTING" && state.intent === "restore") || same(ctx.display, ctx.committed));
  check(
    "S11",
    ledger && after.armed.join() === (budgeted(state) ? [state.navId] : []).join(),
  );

  if (
    (event.type === "SELECT_MODULE" || event.type === "SELECT_HUB" || event.type === "OPEN_ROUTE") &&
    before.state.tag !== "BOOTING" &&
    before.state.tag !== "FAILED"
  ) {
    const target = targetOf(config, event);
    if (target !== null) {
      // Rev. 2.2: the destination in force is what the state already answers
      // for. A stalled target is not in flight any more, so it only counts
      // when it is also the committed location.
      const from = before.state;
      const inForce =
        from.tag === "IDLE"
          ? same(target, before.ctx.committed)
          : from.tag === "ROUTING"
            ? same(target, from.target)
            : from.tag === "TRAVERSING"
              ? same(target, from.destination)
              : from.tag === "STALLED" && same(target, from.target) && same(target, before.ctx.committed);
      const pushed = effects.some((effect) => effect.type === "ROUTER_PUSH" && same(effect.to, target));
      check("L1", inForce ? inert : pushed);
    }
  }

  const restoring = state.tag === "ROUTING" && state.intent === "restore" && !unchanged(before, result);
  check(
    "S5",
    !restoring ||
      (state.tag === "ROUTING" &&
        state.target.kind === "module" &&
        valid(config, state.target.module) &&
        effects.every((effect) => effect.type !== "ROUTER_PUSH") &&
        effects.some(
          (effect) =>
            (effect.type === "ROUTER_REPLACE" || effect.type === "HARD_NAVIGATE") &&
            same(effect.to, state.target),
        )),
  );
  for (const effect of effects) {
    if (effect.type !== "PERSIST") continue;
    const confirmed = ctx.committed;
    check(
      "S12",
      valid(config, effect.module) &&
        state.tag === "IDLE" &&
        (confirmed.kind === "module" || confirmed.kind === "route") &&
        confirmed.module === effect.module,
    );
  }
  check("S13", state.tag !== "ROUTING" || state.afterTraverse === after.owed);
  check("L2", !live || (state.tag === "STALLED" && after.armed.length === 0));
  check(
    "L3",
    !(before.state.tag === "STALLED" && event.type === "RETRY") ||
      (state.tag === "ROUTING" && effects.some((effect) => effect.type === "HARD_NAVIGATE")),
  );
  check(
    "L3",
    !(before.state.tag === "FAILED" && event.type === "RESET") ||
      state.tag === "IDLE" ||
      state.tag === "ROUTING",
  );
  check(
    "L4",
    !(event.type === "TRAVERSE_STARTED" && (before.state.tag === "ROUTING" || before.state.tag === "STALLED")) ||
      state.tag === "TRAVERSING" ||
      state.tag === "IDLE" ||
      // #28 on a module-less Admin entry: a NEW normalization, never the old flight.
      (state.tag === "ROUTING" &&
        state.intent === "restore" &&
        "navId" in before.state &&
        state.navId !== before.state.navId),
  );
  check("L5", !(config.surface === "admin" && state.tag === "IDLE" && ctx.committed.kind === "none"));
  check(
    "L6",
    !(state.tag === "ROUTING" || state.tag === "STALLED" || state.tag === "TRAVERSING") ||
      !same(state.tag === "TRAVERSING" ? state.destination : state.target, ctx.committed),
  );

  check(
    "display rules",
    !(state.tag === "ROUTING" && state.intent === "user") || same(ctx.display, state.target),
  );
  check("display rules", state.tag !== "TRAVERSING" || same(ctx.display, state.destination));
  check(
    "display rules",
    !(state.tag === "STALLED" || state.tag === "FAILED") || same(ctx.display, before.ctx.display),
  );
  check(
    "superseded scope",
    state.tag === "ROUTING" || state.tag === "STALLED" || ctx.superseded.length === 0,
  );
  check(
    "target never superseded",
    !(state.tag === "ROUTING" || state.tag === "STALLED") || !within(ctx.superseded, state.target),
  );
  check(
    "navId monotonic",
    ctx.nextNavId >= before.ctx.nextNavId &&
      ctx.nextNavId - before.ctx.nextNavId ===
        effects.filter((effect) => effect.type === "ARM_BUDGET").length &&
      (!("navId" in state) || state.navId < ctx.nextNavId),
  );

  check("partition", branches.length === 1);
  if (branches.length === 1) {
    const branch = branches[0] ?? "ignored";
    const shape = inert ? UNCHANGED : `${state.tag}:${effects.map((effect) => effect.type).join(">")}`;
    check("shape", shapesOf(branch, before.state).includes(shape));
    check("inert rows", inert === INERT_ROWS.includes(branch));
  }

  const opened = "navId" in state && state.navId === before.ctx.nextNavId;
  const navigations = effects.filter(
    (effect) => effect.type === "ROUTER_PUSH" || effect.type === "ROUTER_REPLACE" || effect.type === "HARD_NAVIGATE",
  );
  // A flight opened in ROUTING carries its navigation; nothing else navigates twice.
  check("navigation scope", navigations.length === 1 || (navigations.length === 0 && !(opened && state.tag === "ROUTING")));
  for (const navigation of navigations) {
    if (state.tag === "ROUTING") {
      check("navigation scope", opened && same(navigation.to, state.target));
      check(
        "navigation scope",
        navigation.type === "ROUTER_PUSH"
          ? state.intent === "user" && state.history === "push"
          : navigation.type === "ROUTER_REPLACE"
            ? state.intent === "restore" && state.history === "replace"
            : navigation.type === "HARD_NAVIGATE" &&
              navigation.mode === (state.history === "push" ? "assign" : "replace"),
      );
    } else {
      check(
        "navigation scope",
        navigation.type === "ROUTER_PUSH" && state.tag === "IDLE" && same(navigation.to, ctx.committed),
      );
    }
  }

  const kinds = effects.map((effect) => effect.type);
  const arms = effects.filter((effect) => effect.type === "ARM_BUDGET");
  const cancels = effects.filter((effect) => effect.type === "CANCEL_BUDGET");
  check("budget scope", arms.length === (opened && budgeted(state) ? 1 : 0));
  check("budget scope", arms.every((effect) => budgeted(state) && effect.navId === state.navId));
  check(
    "budget scope",
    cancels.length <= 1 &&
      cancels.every((effect) => budgeted(before.state) && effect.navId === before.state.navId) &&
      (cancels.length === 0 || kinds[0] === "CANCEL_BUDGET"),
  );
  // A budgeted flight is left by its own expiry or with its budget cancelled.
  const kept = budgeted(before.state) && budgeted(state) && state.navId === before.state.navId;
  check("budget scope", !budgeted(before.state) || kept || live || cancels.length === 1);

  const visible = state.tag !== before.state.tag || !same(ctx.display, before.ctx.display);
  const published = kinds.filter((kind) => kind === "PUBLISH_DISPLAY").length;
  check("publish", published <= 1 && (published === 0 || kinds.at(-1) === "PUBLISH_DISPLAY"));
  check("publish", published === (visible || effects.length > 0 ? 1 : 0));

  return [...new Set(broken)];
}

type Finding = {
  readonly property: Property;
  readonly source: "exhaustive walk" | "random traces" | "session history";
  readonly config: MachineConfig;
  readonly events: readonly NavEvent[];
};

function narrate(finding: Finding): string {
  let world = boot(finding.config);
  const lines = finding.events.map((event, index) => {
    const step = advance(finding.config, world, event);
    world = step.world;
    const flags = step.broken.length > 0 ? `   ✗ ${step.broken.join(", ")}` : "";
    return `  ${index + 1}. ${eventKey(event)}  [${step.branches.join(" + ") || "no row"}]  → ${resultKey(step.result)}${flags}`;
  });
  return [
    `${finding.property}: ${PROPERTIES[finding.property]}`,
    `counterexample from the ${finding.source} (${finding.config.surface}, ${finding.events.length} events):`,
    ...lines,
  ].join("\n");
}

// ── Exhaustive walk: every reachable state of a small universe × every event ─

const WALK_ADMIN = ADMIN;
const WALK_CLINIC: MachineConfig = {
  surface: "clinic",
  modules: ["operaciones", "informes", "logistica"],
  defaultModule: "operaciones",
};

function placesOf(config: MachineConfig): readonly NavLocation[] {
  const modules = [...config.modules, RETIRED].map(mod);
  return config.surface === "admin"
    ? [NONE, ...modules]
    : [...modules, HUB, INFORMES_ROUTE, UNRESOLVED_ROUTE];
}

function alphabet(config: MachineConfig, world: World): readonly NavEvent[] {
  const places = placesOf(config);
  const stored = [null, config.modules[1] ?? null, config.defaultModule, RETIRED];
  const hydrations =
    world.state.tag === "BOOTING"
      ? places.flatMap((place) =>
          stored.flatMap((module) => [hydrated(place, module, false), hydrated(place, module, true)]),
        )
      : [hydrated(places[0] ?? NONE)];
  const resets = world.state.tag === "FAILED" ? places.map(reset) : [reset(places[0] ?? NONE)];
  const budgets = "navId" in world.state ? [world.state.navId, 0] : [0];

  return [
    ...hydrations,
    ...[...config.modules, RETIRED].map(selectModule),
    SELECT_HUB,
    openRoute("/dashboard/informes", "informes"),
    openRoute("/dashboard/retirada", RETIRED),
    ...places.map(urlCommitted),
    ...places.map(traverseStarted),
    ...budgets.map(budgetExpired),
    navFailed("render"),
    RETRY,
    ...resets,
  ];
}

/** navIds only ever matter by equality, so they are erased from the identity of a state. */
function abstractKey(world: World): string {
  const state = "navId" in world.state ? { ...world.state, navId: 0 } : world.state;
  const armed = world.armed.map((id) => ("navId" in world.state && id === world.state.navId ? "own" : "other"));
  return `${stateKey(state)} | ${ctxKey({ ...world.ctx, nextNavId: 0 })} | armed=${armed.join()} | owed=${world.owed}`;
}

type Coverage = {
  readonly findings: Map<Property, Finding>;
  readonly broken: Map<Property, number>;
  readonly branches: Map<Branch, number>;
  readonly pairs: Set<string>;
  readonly effects: Set<string>;
  /** Situations the guard table does not resolve to exactly one row: "hole" or "#a + #b". */
  readonly unresolved: Map<string, number>;
  transitions: number;
  /** PERSIST of a module the surface does not have (S12 counts the same, by transition). */
  strayPersists: number;
  /** Transitions that entered BOOTING: §12.1 has none. */
  rebooted: number;
};

function emptyCoverage(): Coverage {
  return {
    findings: new Map(),
    broken: new Map(),
    branches: new Map(),
    pairs: new Set(),
    effects: new Set(),
    unresolved: new Map(),
    transitions: 0,
    strayPersists: 0,
    rebooted: 0,
  };
}

function record(
  coverage: Coverage,
  source: Finding["source"],
  config: MachineConfig,
  before: World,
  step: Step,
  events: () => readonly NavEvent[],
): void {
  coverage.transitions += 1;
  if (step.world.state.tag === "BOOTING" && before.state.tag !== "BOOTING") coverage.rebooted += 1;
  coverage.pairs.add(pairKey(before.state.tag, step.event.type));
  for (const branch of step.branches) coverage.branches.set(branch, (coverage.branches.get(branch) ?? 0) + 1);
  for (const effect of step.result.effects) {
    coverage.effects.add(effect.type);
    if (effect.type === "PERSIST" && !valid(config, effect.module)) coverage.strayPersists += 1;
  }
  if (step.branches.length !== 1) {
    const overlap = step.branches.join(" + ") || "hole";
    coverage.unresolved.set(overlap, (coverage.unresolved.get(overlap) ?? 0) + 1);
  }
  for (const property of step.broken) {
    coverage.broken.set(property, (coverage.broken.get(property) ?? 0) + 1);
    if (!coverage.findings.has(property)) {
      coverage.findings.set(property, { property, source, config, events: events() });
    }
  }
}

type Node = { readonly world: World; readonly parent: Node | null; readonly event: NavEvent | null };

function pathTo(node: Node): readonly NavEvent[] {
  const events: NavEvent[] = [];
  for (let cursor: Node | null = node; cursor !== null; cursor = cursor.parent) {
    if (cursor.event !== null) events.unshift(cursor.event);
  }
  return events;
}

type Walk = {
  readonly states: number;
  readonly tags: Set<Tag>;
  /** Reachable states from which no sequence of events brings the machine to rest in IDLE. */
  readonly trapped: readonly string[];
  /** The most events any reachable state needs to come to rest. */
  readonly farthest: number;
};

/** Breadth first, so the first finding per property is a shortest counterexample. */
function explore(config: MachineConfig, coverage: Coverage): Walk {
  const root: Node = { world: boot(config), parent: null, event: null };
  const seen = new Set([abstractKey(root.world)]);
  const tags = new Set<Tag>([root.world.state.tag]);
  const parents = new Map<string, Set<string>>();
  let frontier: Node[] = [root];

  while (frontier.length > 0) {
    const next: Node[] = [];
    for (const node of frontier) {
      const origin = abstractKey(node.world);
      for (const event of alphabet(config, node.world)) {
        const step = advance(config, node.world, event);
        const child: Node = { world: step.world, parent: node, event };
        record(coverage, "exhaustive walk", config, node.world, step, () => pathTo(child));
        // A leaked budget is S11 already broken, and the only thing that could
        // keep this space from closing: the walk reports it and goes no further.
        if (step.world.armed.length > 1) continue;
        const key = abstractKey(step.world);
        const into = parents.get(key) ?? new Set<string>();
        parents.set(key, into.add(origin));
        if (!seen.has(key)) {
          seen.add(key);
          tags.add(step.world.state.tag);
          next.push(child);
        }
      }
    }
    frontier = next;
  }

  // Backwards from every resting state: whatever is not reached is a trap.
  let layer = [...seen].filter((key) => key.startsWith("IDLE | "));
  const resting = new Set(layer);
  let farthest = 0;
  while (layer.length > 0) {
    const previous: string[] = [];
    for (const key of layer) {
      for (const parent of parents.get(key) ?? []) {
        if (resting.has(parent)) continue;
        resting.add(parent);
        previous.push(parent);
      }
    }
    if (previous.length > 0) farthest += 1;
    layer = previous;
  }

  return { states: seen.size, tags, trapped: [...seen].filter((key) => !resting.has(key)), farthest };
}

// ── Model-based campaign: seeded, reproducible random traces ─────────────────

/** "NAV2" in ASCII. Changing it, the generator or the machine changes TRACE_HASH. */
const SEED = 0x4e415632;
const TRACE_COUNT = 10_000;
const MAX_EVENTS = 40;
const TRACE_HASH = "d6b4b32f4822884a";
/** "WIDE" in ASCII: the campaign over the wide universe, pinned apart so TRACE_HASH keeps its generator. */
const WIDE_SEED = 0x57494445;
const WIDE_TRACE_COUNT = 2_000;
const WIDE_HASH = "17abdaccdca4ee3b";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** cyrb53-style 64-bit digest; enough to tell two campaigns apart without a dependency. */
function digester(): { add(text: string): void; hex(): string } {
  let high = 0xdeadbeef;
  let low = 0x41c6ce57;
  return {
    add(text) {
      for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        high = Math.imul(high ^ code, 2_654_435_761);
        low = Math.imul(low ^ code, 1_597_334_677);
      }
    },
    hex() {
      const a = Math.imul(high ^ (high >>> 16), 2_246_822_507) ^ Math.imul(low ^ (low >>> 13), 3_266_489_909);
      const b = Math.imul(low ^ (low >>> 16), 2_246_822_507) ^ Math.imul(a ^ (a >>> 13), 3_266_489_909);
      return [b, a].map((half) => (half >>> 0).toString(16).padStart(8, "0")).join("");
    },
  };
}

const REASONS = ["render", "payload", "unknown"] as const;
const ROUTES = [
  ["/dashboard/informes", "informes"],
  ["/dashboard/logistica", "logistica"],
  ["/dashboard/retirada", RETIRED],
] as const;

/** What a campaign draws locations and full routes from. */
type Universe = {
  readonly places: (config: MachineConfig) => readonly NavLocation[];
  readonly routes: readonly (readonly [string, string])[];
};

const BASE: Universe = { places: placesOf, routes: ROUTES };

/**
 * The two things BASE cannot tell apart, found by mutating the machine: two
 * full routes of one module (`same` must compare paths), and a full route
 * asked of Admin with a module Admin does have (`targetOf` must still refuse).
 */
const WIDE: Universe = {
  places: (config) =>
    config.surface === "clinic" ? [...placesOf(config), LOGISTICA_ROUTE, VISITS_ROUTE] : placesOf(config),
  routes: [...ROUTES, ["/dashboard/logistica/visitas", "logistica"], ["/dashboard/admin/precios", "admin-pricing"]],
};

function nextEvent(random: () => number, config: MachineConfig, world: World, universe: Universe): NavEvent {
  const pick = <Item>(items: readonly Item[]): Item => items[Math.floor(random() * items.length)] as Item;
  const places = universe.places(config);
  const modules = [...config.modules, RETIRED];
  const { ctx, state } = world;
  const hydration = (): NavEvent => hydrated(pick(places), pick([null, ...modules]), random() < 0.5);

  const bias = random();
  if (state.tag === "BOOTING" && bias < 0.85) return hydration();
  if (state.tag === "FAILED" && bias < 0.6) return reset(pick(places));
  if (state.tag === "STALLED" && bias < 0.15) return RETRY;

  const roll = random();
  if (roll < 0.26) return selectModule(pick(modules));
  if (roll < 0.31) return SELECT_HUB;
  if (roll < 0.39) {
    const [path, module] = pick(universe.routes);
    return openRoute(path, module);
  }
  if (roll < 0.66) {
    // Commits that matter: the target in flight, a superseded one, or anything.
    const aim = random();
    if ((state.tag === "ROUTING" || state.tag === "STALLED") && aim < 0.45) return urlCommitted(state.target);
    if ((state.tag === "ROUTING" || state.tag === "STALLED") && aim < 0.65 && ctx.superseded.length > 0) {
      return urlCommitted(pick(ctx.superseded));
    }
    if (state.tag === "TRAVERSING" && aim < 0.6) return urlCommitted(state.destination);
    return urlCommitted(pick(places));
  }
  if (roll < 0.76) return traverseStarted(pick(places));
  if (roll < 0.88) {
    // The live budget, or an id that was cancelled, already fired, or never issued.
    if ("navId" in state && random() < 0.6) return budgetExpired(state.navId);
    return budgetExpired(Math.floor(random() * (ctx.nextNavId + 2)));
  }
  if (roll < 0.91) return navFailed(pick(REASONS));
  if (roll < 0.94) return RETRY;
  if (roll < 0.97) return reset(pick(places));
  return hydration();
}

type Campaign = Coverage & {
  readonly hash: string;
  readonly traces: number;
  readonly longest: number;
  readonly bySurface: Record<string, number>;
  readonly tags: Set<Tag>;
};

function campaign(seed: number, traceCount: number, universe: Universe = BASE): Campaign {
  const random = mulberry32(seed);
  const digest = digester();
  const coverage = emptyCoverage();
  const tags = new Set<Tag>();
  const bySurface: Record<string, number> = { admin: 0, clinic: 0 };
  let longest = 0;

  for (let trace = 0; trace < traceCount; trace += 1) {
    const config = trace % 2 === 0 ? ADMIN : CLINIC;
    const length = 1 + Math.floor(random() * MAX_EVENTS);
    const events: NavEvent[] = [];
    let world = boot(config);
    bySurface[config.surface] = (bySurface[config.surface] ?? 0) + 1;
    longest = Math.max(longest, length);
    digest.add(`\n${trace}:${config.surface}`);

    const take = (event: NavEvent): void => {
      events.push(event);
      const step = advance(config, world, event);
      record(coverage, "random traces", config, world, step, () => [...events]);
      digest.add(`\n${eventKey(event)} => ${resultKey(step.result)}`);
      tags.add(step.world.state.tag);
      world = step.world;
    };

    for (let index = 0; index < length; index += 1) take(nextEvent(random, config, world, universe));
    // L2 by drain: whatever is still in flight when the trace ends has a live
    // budget, and firing it must leave ROUTING/TRAVERSING.
    for (let guard = 0; guard < 2 && budgeted(world.state); guard += 1) take(budgetExpired(world.state.navId));
    if (budgeted(world.state) || world.armed.length > 0) {
      coverage.broken.set("L2", (coverage.broken.get("L2") ?? 0) + 1);
      if (!coverage.findings.has("L2")) {
        coverage.findings.set("L2", { property: "L2", source: "random traces", config, events: [...events] });
      }
    }
  }

  return { ...coverage, hash: digest.hex(), traces: traceCount, longest, bySurface, tags };
}

type Evidence = {
  readonly campaign: Campaign;
  /** A second, smaller campaign over WIDE. */
  readonly wide: Campaign;
  readonly walked: Coverage;
  readonly walks: readonly (Walk & { readonly surface: string })[];
};

let memo: Evidence | null = null;

function evidence(): Evidence {
  if (memo === null) {
    const walked = emptyCoverage();
    const walks = [WALK_ADMIN, WALK_CLINIC].map((config) => ({ surface: config.surface, ...explore(config, walked) }));
    memo = { campaign: campaign(SEED, TRACE_COUNT), wide: campaign(WIDE_SEED, WIDE_TRACE_COUNT, WIDE), walked, walks };
  }
  return memo;
}

// ── CASES: one literal expectation per cell of the partition ─────────────────

type Expected =
  | typeof UNCHANGED
  | { readonly state: NavState; readonly ctx: NavContext; readonly effects: readonly NavEffect[] };
type Case = Situation & { readonly branch: Branch; readonly title: string; readonly expected: Expected };

const CASES: Case[] = [];

function to(state: NavState, ctx: NavContext, ...effects: NavEffect[]): Expected {
  return { state, ctx, effects };
}

function given(config: MachineConfig, ctx: NavContext, state: NavState) {
  return {
    on(event: NavEvent, branch: Branch, title: string, expected: Expected) {
      CASES.push({ config, ctx, state, event, branch, title, expected });
      return this;
    },
  };
}

// BOOTING × HYDRATED — #1, #2, #3

given(CLINIC, initial(CLINIC).ctx, BOOTING)
  .on(
    hydrated(OPS),
    "#1",
    "Clinic on the bare URL with nothing stored settles on the default and persists it",
    to(IDLE, context(OPS, OPS, 1, { lastModule: "operaciones" }), persist("operaciones"), PUBLISH),
  )
  .on(
    hydrated(INFORMES, "logistica", true),
    "#1",
    "an explicit module wins over the stored one",
    to(IDLE, context(INFORMES, INFORMES, 1, { lastModule: "informes" }), persist("informes"), PUBLISH),
  )
  .on(
    hydrated(OPS, "logistica", true),
    "#1",
    "an explicit default module is not restored over",
    to(IDLE, context(OPS, OPS, 1, { lastModule: "operaciones" }), persist("operaciones"), PUBLISH),
  )
  .on(
    hydrated(OPS, "operaciones"),
    "#1",
    "a stored module equal to the default needs no restore",
    to(IDLE, context(OPS, OPS, 1, { lastModule: "operaciones" }), persist("operaciones"), PUBLISH),
  )
  .on(
    hydrated(OPS, RETIRED),
    "#1",
    "a stored module the surface no longer has is not restored",
    to(IDLE, context(OPS, OPS, 1, { lastModule: "operaciones" }), persist("operaciones"), PUBLISH),
  )
  .on(
    hydrated(HUB, "logistica", true),
    "#1",
    "the hub persists nothing and keeps the stored module as lastModule",
    to(IDLE, context(HUB, HUB, 1, { lastModule: "logistica" }), PUBLISH),
  )
  .on(
    hydrated(INFORMES_ROUTE),
    "#1",
    "rev. 2.1: a full route persists its module",
    to(
      IDLE,
      context(INFORMES_ROUTE, INFORMES_ROUTE, 1, { lastModule: "informes" }),
      persist("informes"),
      PUBLISH,
    ),
  )
  .on(
    hydrated(UNRESOLVED_ROUTE, "logistica"),
    "#1",
    "rev. 2.1: a full route without a resolvable module persists nothing",
    to(IDLE, context(UNRESOLVED_ROUTE, UNRESOLVED_ROUTE, 1, { lastModule: "logistica" }), PUBLISH),
  )
  .on(
    hydrated(OPS, "logistica"),
    "#2",
    "Clinic restores the stored module with display = committed until the commit (DT-8 = C)",
    to(
      routing(1, LOGISTICA, RESTORE),
      context(OPS, OPS, 2, { lastModule: "logistica" }),
      replace(LOGISTICA),
      arm(1),
      PUBLISH,
    ),
  );

given(ADMIN, initial(ADMIN).ctx, BOOTING)
  .on(
    hydrated(PRICING, "admin-clinics", true),
    "#1",
    "Admin on an explicit module settles and persists it",
    to(IDLE, context(PRICING, PRICING, 1, { lastModule: "admin-pricing" }), persist("admin-pricing"), PUBLISH),
  )
  .on(
    hydrated(mod(RETIRED), "admin-clinics", true),
    "#1",
    "a module location that is not valid persists nothing",
    to(IDLE, context(mod(RETIRED), mod(RETIRED), 1, { lastModule: "admin-clinics" }), PUBLISH),
  )
  .on(
    hydrated(NONE, "admin-pricing"),
    "#2",
    "Admin on the bare URL restores the stored module through the router",
    to(
      routing(1, PRICING, RESTORE),
      context(NONE, NONE, 2, { lastModule: "admin-pricing" }),
      replace(PRICING),
      arm(1),
      PUBLISH,
    ),
  )
  .on(
    hydrated(NONE, "admin-pricing", true),
    "#2",
    "Admin ?hub=1 or an invalid ?module= is module-less too, explicit or not",
    to(
      routing(1, PRICING, RESTORE),
      context(NONE, NONE, 2, { lastModule: "admin-pricing" }),
      replace(PRICING),
      arm(1),
      PUBLISH,
    ),
  )
  .on(
    hydrated(NONE),
    "#3",
    "Admin on the bare URL with nothing stored normalizes to the default",
    to(routing(1, HOME, RESTORE), context(NONE, NONE, 2, { lastModule: "admin" }), replace(HOME), arm(1), PUBLISH),
  )
  .on(
    hydrated(NONE, RETIRED),
    "#3",
    "Admin with a stored module it no longer has normalizes to the default",
    to(routing(1, HOME, RESTORE), context(NONE, NONE, 2, { lastModule: "admin" }), replace(HOME), arm(1), PUBLISH),
  );

// BOOTING — everything else

given(CLINIC, initial(CLINIC).ctx, BOOTING)
  .on(urlCommitted(INFORMES), "ignored", "a commit before hydration", UNCHANGED)
  .on(traverseStarted(INFORMES), "ignored", "a traverse before hydration", UNCHANGED)
  .on(budgetExpired(1), "ignored", "a budget before any was armed", UNCHANGED)
  .on(RETRY, "ignored", "retry before hydration", UNCHANGED)
  .on(reset(INFORMES), "ignored", "reset before any failure", UNCHANGED)
  .on(
    navFailed("render"),
    "#20",
    "a failure before hydration has no budget to cancel",
    to(failed("render"), initial(CLINIC).ctx, PUBLISH),
  );

// IDLE

const AT_OPS = context(OPS, OPS, 4, { lastModule: "operaciones" });

given(CLINIC, AT_OPS, IDLE)
  .on(hydrated(INFORMES, "logistica"), "ignored", "a second hydration", UNCHANGED)
  .on(urlCommitted(OPS), "ignored", "a commit of the committed location", UNCHANGED)
  .on(budgetExpired(3), "ignored", "a budget with nothing in flight", UNCHANGED)
  .on(RETRY, "ignored", "retry with nothing stalled", UNCHANGED)
  .on(reset(INFORMES), "ignored", "reset without a failure", UNCHANGED)
  .on(traverseStarted(OPS), "#24", "a traverse onto the committed location", UNCHANGED)
  .on(
    traverseStarted(INFORMES),
    "#17",
    "Back/Forward leaves IDLE under a budget, showing the destination",
    to(traversing(4, INFORMES), context(OPS, INFORMES, 5, { lastModule: "operaciones" }), arm(4), PUBLISH),
  )
  .on(
    urlCommitted(INFORMES),
    "#22",
    "an external commit of a module settles and persists it",
    to(IDLE, context(INFORMES, INFORMES, 4, { lastModule: "informes" }), persist("informes"), PUBLISH),
  )
  .on(
    urlCommitted(LOGISTICA_ROUTE),
    "#22",
    "an external commit of a full route persists its module",
    to(
      IDLE,
      context(LOGISTICA_ROUTE, LOGISTICA_ROUTE, 4, { lastModule: "logistica" }),
      persist("logistica"),
      PUBLISH,
    ),
  )
  .on(
    urlCommitted(HUB),
    "#22",
    "an external commit of the hub persists nothing",
    to(IDLE, context(HUB, HUB, 4, { lastModule: "operaciones" }), PUBLISH),
  )
  .on(
    navFailed("payload"),
    "#20",
    "a failure at rest has no budget to cancel",
    to(failed("payload"), AT_OPS, PUBLISH),
  );

given(ADMIN, context(PRICING, PRICING, 4, { lastModule: "admin-pricing" }), IDLE).on(
  urlCommitted(NONE),
  "#22",
  "Admin: an external commit of the bare URL normalizes to the last module, display = committed",
  to(
    routing(4, PRICING, RESTORE),
    context(NONE, NONE, 5, { lastModule: "admin-pricing" }),
    replace(PRICING),
    arm(4),
    PUBLISH,
  ),
);
given(ADMIN, context(PRICING, PRICING, 4, { lastModule: RETIRED }), IDLE).on(
  urlCommitted(NONE),
  "#22",
  "Admin: normalization falls back to the default when the last module is not valid",
  to(routing(4, HOME, RESTORE), context(NONE, NONE, 5, { lastModule: RETIRED }), replace(HOME), arm(4), PUBLISH),
);

// ROUTING

const IN_FLIGHT = context(OPS, INFORMES, 8, { superseded: [PERFIL], lastModule: "operaciones" });

given(CLINIC, IN_FLIGHT, routing(7, INFORMES))
  .on(hydrated(LOGISTICA), "ignored", "hydration in flight", UNCHANGED)
  .on(RETRY, "ignored", "retry before the budget expired", UNCHANGED)
  .on(reset(LOGISTICA), "ignored", "reset without a failure", UNCHANGED)
  .on(
    urlCommitted(INFORMES),
    "#9",
    "the commit of the target cancels its budget, persists and clears superseded",
    to(
      IDLE,
      context(INFORMES, INFORMES, 8, { lastModule: "informes" }),
      cancel(7),
      persist("informes"),
      PUBLISH,
    ),
  )
  .on(urlCommitted(PERFIL), "#11", "a superseded commit is not painted", UNCHANGED)
  .on(
    urlCommitted(LOGISTICA),
    "#23",
    "an external commit abandons the flight and settles",
    to(
      IDLE,
      context(LOGISTICA, LOGISTICA, 8, { lastModule: "logistica" }),
      cancel(7),
      persist("logistica"),
      PUBLISH,
    ),
  )
  .on(
    traverseStarted(LOGISTICA),
    "#17",
    "Back/Forward takes over the flight and clears superseded",
    to(
      traversing(8, LOGISTICA),
      context(OPS, LOGISTICA, 9, { lastModule: "operaciones" }),
      cancel(7),
      arm(8),
      PUBLISH,
    ),
  )
  .on(
    traverseStarted(OPS),
    "#28",
    "rev. 2.2: a traverse onto the committed location ends the flight at once: no commit could confirm it",
    to(IDLE, context(OPS, OPS, 8, { lastModule: "operaciones" }), cancel(7), persist("operaciones"), PUBLISH),
  )
  .on(
    budgetExpired(7),
    "#12",
    "the live budget stalls the flight and keeps display",
    to(stalled(7, INFORMES, "user", "push"), IN_FLIGHT, PUBLISH),
  )
  .on(budgetExpired(6), "#13", "a stale budget", UNCHANGED)
  .on(
    navFailed("payload"),
    "#20",
    "a failure in flight cancels the budget, keeps display and clears superseded",
    to(failed("payload"), context(OPS, INFORMES, 8, { lastModule: "operaciones" }), cancel(7), PUBLISH),
  );

given(CLINIC, context(OPS, HUB, 8), routing(7, HUB)).on(
  urlCommitted(HUB),
  "#9",
  "the commit of the hub persists nothing",
  to(IDLE, context(HUB, HUB, 8), cancel(7), PUBLISH),
);
given(CLINIC, context(OPS, INFORMES_ROUTE, 8), routing(7, INFORMES_ROUTE)).on(
  urlCommitted(INFORMES_ROUTE),
  "#9",
  "the commit of a full route persists its module",
  to(
    IDLE,
    context(INFORMES_ROUTE, INFORMES_ROUTE, 8, { lastModule: "informes" }),
    cancel(7),
    persist("informes"),
    PUBLISH,
  ),
);
given(CLINIC, context(OPS, OPS, 2, { lastModule: "logistica" }), routing(1, LOGISTICA, RESTORE))
  .on(
    budgetExpired(1),
    "#12",
    "a stalled restore keeps its intent and its replace history",
    to(stalled(1, LOGISTICA, "restore", "replace"), context(OPS, OPS, 2, { lastModule: "logistica" }), PUBLISH),
  )
  .on(
    selectModule("informes"),
    "#10",
    "a click supersedes a restore: user intent, push history",
    to(
      routing(2, INFORMES),
      context(OPS, INFORMES, 3, { superseded: [LOGISTICA], lastModule: "logistica" }),
      cancel(1),
      push(INFORMES),
      arm(2),
      PUBLISH,
    ),
  );
given(CLINIC, context(OPS, INFORMES, 8, { superseded: [LOGISTICA, PERFIL] }), routing(7, INFORMES)).on(
  selectModule("logistica"),
  "#10",
  "re-selecting a superseded target takes it out of superseded",
  to(
    routing(8, LOGISTICA),
    context(OPS, LOGISTICA, 9, { superseded: [PERFIL, INFORMES] }),
    cancel(7),
    push(LOGISTICA),
    arm(8),
    PUBLISH,
  ),
);
given(CLINIC, context(OPS, INFORMES, 8), routing(7, INFORMES, { afterTraverse: true }))
  .on(
    urlCommitted(LOGISTICA),
    "#26",
    "the commit of the traverse that started earlier moves committed and nothing else",
    to(routing(7, INFORMES), context(LOGISTICA, INFORMES, 8)),
  )
  .on(
    selectModule("perfil"),
    "#10",
    "rev. 2.2.2: a new selection keeps afterTraverse: the commit of the traverse is still owed (C-10)",
    to(
      routing(8, PERFIL, { afterTraverse: true }),
      context(OPS, PERFIL, 9, { superseded: [INFORMES] }),
      cancel(7),
      push(PERFIL),
      arm(8),
      PUBLISH,
    ),
  );
given(ADMIN, context(HOME, CLINICS, 8, { lastModule: "admin-pricing" }), routing(7, CLINICS)).on(
  urlCommitted(NONE),
  "#23",
  "Admin: an external commit of the bare URL cancels the flight and normalizes",
  to(
    routing(8, PRICING, RESTORE),
    context(NONE, NONE, 9, { lastModule: "admin-pricing" }),
    cancel(7),
    replace(PRICING),
    arm(8),
    PUBLISH,
  ),
);

// TRAVERSING

const TRAVERSE = context(OPS, INFORMES, 4, { lastModule: "operaciones" });

given(CLINIC, TRAVERSE, traversing(3, INFORMES))
  .on(hydrated(LOGISTICA), "ignored", "hydration during a traverse", UNCHANGED)
  .on(RETRY, "ignored", "retry before the budget expired", UNCHANGED)
  .on(reset(LOGISTICA), "ignored", "reset without a failure", UNCHANGED)
  .on(
    urlCommitted(INFORMES),
    "#18",
    "the commit of the traverse settles and persists",
    to(
      IDLE,
      context(INFORMES, INFORMES, 4, { lastModule: "informes" }),
      cancel(3),
      persist("informes"),
      PUBLISH,
    ),
  )
  .on(
    urlCommitted(HUB),
    "#18",
    "any commit ends the traverse, whatever the announced destination",
    to(IDLE, context(HUB, HUB, 4, { lastModule: "operaciones" }), cancel(3), PUBLISH),
  )
  .on(
    traverseStarted(LOGISTICA),
    "#17",
    "a second traverse replaces the first and its budget",
    to(
      traversing(4, LOGISTICA),
      context(OPS, LOGISTICA, 5, { lastModule: "operaciones" }),
      cancel(3),
      arm(4),
      PUBLISH,
    ),
  )
  .on(
    budgetExpired(3),
    "#27",
    "a traverse whose payload never lands stalls as a replace",
    to(stalled(3, INFORMES, "traverse", "replace"), TRAVERSE, PUBLISH),
  )
  .on(budgetExpired(2), "#13", "a stale budget", UNCHANGED)
  .on(
    navFailed("unknown"),
    "#20",
    "a failure during a traverse cancels its budget",
    to(failed("unknown"), TRAVERSE, cancel(3), PUBLISH),
  )
  .on(
    traverseStarted(OPS),
    "#28",
    "rev. 2.2: Back and then Forward before the first traverse lands rests on the committed location",
    to(IDLE, context(OPS, OPS, 4, { lastModule: "operaciones" }), cancel(3), persist("operaciones"), PUBLISH),
  );

given(ADMIN, context(PRICING, NONE, 4, { lastModule: "admin-pricing" }), traversing(3, NONE)).on(
  urlCommitted(NONE),
  "#18",
  "Admin: Back onto the bare entry normalizes through the router",
  to(
    routing(4, PRICING, RESTORE),
    context(NONE, NONE, 5, { lastModule: "admin-pricing" }),
    cancel(3),
    replace(PRICING),
    arm(4),
    PUBLISH,
  ),
);

// STALLED

const STUCK = context(OPS, INFORMES, 6, { superseded: [PERFIL], lastModule: "operaciones" });

given(CLINIC, STUCK, stalled(5, INFORMES))
  .on(hydrated(LOGISTICA), "ignored", "hydration while stalled", UNCHANGED)
  .on(reset(LOGISTICA), "ignored", "reset without a failure", UNCHANGED)
  .on(
    urlCommitted(INFORMES),
    "#14",
    "the late commit of the target settles without a budget to cancel",
    to(IDLE, context(INFORMES, INFORMES, 6, { lastModule: "informes" }), persist("informes"), PUBLISH),
  )
  .on(urlCommitted(PERFIL), "#11", "a superseded commit is not painted", UNCHANGED)
  .on(
    urlCommitted(LOGISTICA),
    "#23",
    "an external commit settles without a budget to cancel",
    to(IDLE, context(LOGISTICA, LOGISTICA, 6, { lastModule: "logistica" }), persist("logistica"), PUBLISH),
  )
  .on(
    traverseStarted(LOGISTICA),
    "#17",
    "Back/Forward leaves STALLED without a budget to cancel",
    to(traversing(6, LOGISTICA), context(OPS, LOGISTICA, 7, { lastModule: "operaciones" }), arm(6), PUBLISH),
  )
  .on(budgetExpired(5), "#13", "the budget that already fired, fired again", UNCHANGED)
  .on(budgetExpired(4), "#13", "a stale budget", UNCHANGED)
  .on(
    navFailed("render"),
    "#20",
    "a failure while stalled has no budget to cancel",
    to(failed("render"), context(OPS, INFORMES, 6, { lastModule: "operaciones" }), PUBLISH),
  )
  .on(
    RETRY,
    "#15",
    "retrying a pushed flight is a document assign under a new budget",
    to(
      routing(6, INFORMES),
      context(OPS, INFORMES, 7, { superseded: [PERFIL], lastModule: "operaciones" }),
      hard(INFORMES, "assign"),
      arm(6),
      PUBLISH,
    ),
  )
  .on(
    selectModule("informes"),
    "#16",
    "re-selecting the stalled target is a soft retry that keeps superseded",
    to(
      routing(6, INFORMES),
      context(OPS, INFORMES, 7, { superseded: [PERFIL], lastModule: "operaciones" }),
      push(INFORMES),
      arm(6),
      PUBLISH,
    ),
  );

given(CLINIC, context(OPS, OPS, 2, { lastModule: "logistica" }), stalled(1, LOGISTICA, "restore", "replace")).on(
  RETRY,
  "#15",
  "retrying a stalled restore stays a restore: document replace, display = committed",
  to(
    routing(2, LOGISTICA, RESTORE),
    context(OPS, OPS, 3, { lastModule: "logistica" }),
    hard(LOGISTICA, "replace"),
    arm(2),
    PUBLISH,
  ),
);
given(CLINIC, context(OPS, INFORMES, 4), stalled(3, INFORMES, "traverse", "replace")).on(
  RETRY,
  "#15",
  "retrying a stalled traverse becomes a user flight that keeps its replace history",
  to(
    routing(4, INFORMES, { intent: "user", history: "replace" }),
    context(OPS, INFORMES, 5),
    hard(INFORMES, "replace"),
    arm(4),
    PUBLISH,
  ),
);

// FAILED

const BROKEN = context(OPS, INFORMES, 6, { lastModule: "operaciones" });

given(CLINIC, BROKEN, failed("render"))
  .on(hydrated(LOGISTICA), "ignored", "hydration after a failure", UNCHANGED)
  .on(urlCommitted(LOGISTICA), "ignored", "a commit after a failure", UNCHANGED)
  .on(traverseStarted(LOGISTICA), "ignored", "a traverse after a failure", UNCHANGED)
  .on(budgetExpired(5), "ignored", "the budget the failure cancelled", UNCHANGED)
  .on(navFailed("payload"), "ignored", "a second failure", UNCHANGED)
  .on(RETRY, "ignored", "retry is the STALLED recovery, not the FAILED one", UNCHANGED)
  .on(
    reset(INFORMES),
    "#21",
    "the boundary's retry settles on the location it read",
    to(IDLE, context(INFORMES, INFORMES, 6, { lastModule: "informes" }), persist("informes"), PUBLISH),
  )
  .on(
    reset(HUB),
    "#21",
    "a reset onto the hub persists nothing",
    to(IDLE, context(HUB, HUB, 6, { lastModule: "operaciones" }), PUBLISH),
  );

given(ADMIN, context(PRICING, CLINICS, 6, { lastModule: "admin-pricing" }), failed("render")).on(
  reset(NONE),
  "#21",
  "Admin: a reset onto the bare URL normalizes through the router",
  to(
    routing(6, PRICING, RESTORE),
    context(NONE, NONE, 7, { lastModule: "admin-pricing" }),
    replace(PRICING),
    arm(6),
    PUBLISH,
  ),
);

// Rev. 2.2 — C-1: a confirmed module-less Admin commit normalizes (#9, #14)

const BARE_FLIGHT = context(PRICING, NONE, 4, { lastModule: "admin-pricing" });

given(ADMIN, BARE_FLIGHT, routing(3, NONE, { intent: "user", history: "replace" })).on(
  urlCommitted(NONE),
  "#9",
  "rev. 2.2: Admin: the commit of a module-less target normalizes instead of resting",
  to(
    routing(4, PRICING, RESTORE),
    context(NONE, NONE, 5, { lastModule: "admin-pricing" }),
    cancel(3),
    replace(PRICING),
    arm(4),
    PUBLISH,
  ),
);
given(ADMIN, BARE_FLIGHT, stalled(3, NONE, "traverse", "replace")).on(
  urlCommitted(NONE),
  "#14",
  "rev. 2.2: Admin: a stalled traverse to the bare entry that lands late normalizes",
  to(
    routing(4, PRICING, RESTORE),
    context(NONE, NONE, 5, { lastModule: "admin-pricing" }),
    replace(PRICING),
    arm(4),
    PUBLISH,
  ),
);

// Rev. 2.2 — C-2: a normalization starts with nothing superseded

given(
  ADMIN,
  context(HOME, CLINICS, 8, { superseded: [PRICING], lastModule: "admin-pricing" }),
  routing(7, CLINICS),
).on(
  urlCommitted(NONE),
  "#23",
  "rev. 2.2: Admin: a normalization out of a flight clears superseded, its own target included",
  to(
    routing(8, PRICING, RESTORE),
    context(NONE, NONE, 9, { lastModule: "admin-pricing" }),
    cancel(7),
    replace(PRICING),
    arm(8),
    PUBLISH,
  ),
);

// Rev. 2.2 — C-8: a traverse onto the committed location settles (#28)

given(CLINIC, STUCK, stalled(5, INFORMES)).on(
  traverseStarted(OPS),
  "#28",
  "rev. 2.2: a traverse onto the committed location leaves the stall without a budget to cancel",
  to(IDLE, context(OPS, OPS, 6, { lastModule: "operaciones" }), persist("operaciones"), PUBLISH),
);
given(ADMIN, context(NONE, NONE, 2, { lastModule: "admin-pricing" }), routing(1, PRICING, RESTORE)).on(
  traverseStarted(NONE),
  "#28",
  "rev. 2.2: Admin: a traverse onto another bare entry re-issues the normalization under a new budget",
  to(
    routing(2, PRICING, RESTORE),
    context(NONE, NONE, 3, { lastModule: "admin-pricing" }),
    cancel(1),
    replace(PRICING),
    arm(2),
    PUBLISH,
  ),
);

// Rev. 2.2 — C-5: PERSIST only for a module the surface has, in every confirmation

given(CLINIC, AT_OPS, IDLE).on(
  urlCommitted(UNRESOLVED_ROUTE),
  "#22",
  "rev. 2.2: an external commit of a full route without a resolvable module persists nothing",
  to(IDLE, context(UNRESOLVED_ROUTE, UNRESOLVED_ROUTE, 4, { lastModule: "operaciones" }), PUBLISH),
);
given(
  CLINIC,
  context(OPS, mod(RETIRED), 8, { lastModule: "operaciones" }),
  routing(7, mod(RETIRED), { intent: "user", history: "replace" }),
).on(
  urlCommitted(mod(RETIRED)),
  "#9",
  "rev. 2.2: the commit of a target the surface does not have persists nothing",
  to(IDLE, context(mod(RETIRED), mod(RETIRED), 8, { lastModule: "operaciones" }), cancel(7), PUBLISH),
);
given(
  CLINIC,
  context(OPS, UNRESOLVED_ROUTE, 6, { lastModule: "operaciones" }),
  stalled(5, UNRESOLVED_ROUTE, "traverse", "replace"),
).on(
  urlCommitted(UNRESOLVED_ROUTE),
  "#14",
  "rev. 2.2: the late commit of an unresolvable route persists nothing",
  to(IDLE, context(UNRESOLVED_ROUTE, UNRESOLVED_ROUTE, 6, { lastModule: "operaciones" }), PUBLISH),
);
given(CLINIC, context(OPS, UNRESOLVED_ROUTE, 4, { lastModule: "operaciones" }), traversing(3, UNRESOLVED_ROUTE)).on(
  urlCommitted(UNRESOLVED_ROUTE),
  "#18",
  "rev. 2.2: a traverse onto an unresolvable route persists nothing",
  to(IDLE, context(UNRESOLVED_ROUTE, UNRESOLVED_ROUTE, 4, { lastModule: "operaciones" }), cancel(3), PUBLISH),
);
given(CLINIC, BROKEN, failed("render")).on(
  reset(mod(RETIRED)),
  "#21",
  "rev. 2.2: a reset onto a module the surface does not have persists nothing",
  to(IDLE, context(mod(RETIRED), mod(RETIRED), 6, { lastModule: "operaciones" }), PUBLISH),
);

// same() — two full routes of one module are two locations, and neither is the module

const ON_ROUTE = context(LOGISTICA_ROUTE, LOGISTICA_ROUTE, 4, { lastModule: "logistica" });

given(CLINIC, ON_ROUTE, IDLE)
  .on(
    openRoute("/dashboard/logistica/visitas", "logistica"),
    "#8",
    "another full route of the committed module is a new flight, told apart by its path",
    to(
      routing(4, VISITS_ROUTE),
      context(LOGISTICA_ROUTE, VISITS_ROUTE, 5, { lastModule: "logistica" }),
      push(VISITS_ROUTE),
      arm(4),
      PUBLISH,
    ),
  )
  .on(
    urlCommitted(VISITS_ROUTE),
    "#22",
    "an external commit of another full route of the committed module is obeyed",
    to(IDLE, context(VISITS_ROUTE, VISITS_ROUTE, 4, { lastModule: "logistica" }), persist("logistica"), PUBLISH),
  )
  .on(
    traverseStarted(VISITS_ROUTE),
    "#17",
    "a traverse between two full routes of one module leaves IDLE",
    to(traversing(4, VISITS_ROUTE), context(LOGISTICA_ROUTE, VISITS_ROUTE, 5, { lastModule: "logistica" }), arm(4), PUBLISH),
  )
  .on(
    selectModule("logistica"),
    "#5",
    "the module of the committed full route is not that route",
    to(
      routing(4, LOGISTICA),
      context(LOGISTICA_ROUTE, LOGISTICA, 5, { lastModule: "logistica" }),
      push(LOGISTICA),
      arm(4),
      PUBLISH,
    ),
  );
given(CLINIC, context(OPS, VISITS_ROUTE, 8, { superseded: [LOGISTICA_ROUTE] }), routing(7, VISITS_ROUTE))
  .on(
    urlCommitted(LOGISTICA_ROUTE),
    "#11",
    "a superseded full route is not the one in flight, though both carry the same module",
    UNCHANGED,
  )
  .on(
    openRoute("/dashboard/logistica", "logistica"),
    "#10",
    "re-selecting the superseded full route swaps it with the one in flight",
    to(
      routing(8, LOGISTICA_ROUTE),
      context(OPS, LOGISTICA_ROUTE, 9, { superseded: [VISITS_ROUTE] }),
      cancel(7),
      push(LOGISTICA_ROUTE),
      arm(8),
      PUBLISH,
    ),
  );

// Selections that resolve to a target — every state × every kind of selection

const CHOICES: readonly { readonly kind: string; readonly event: NavEvent; readonly x: NavLocation; readonly idleRow: Branch }[] = [
  { kind: "module", event: selectModule("logistica"), x: LOGISTICA, idleRow: "#5" },
  { kind: "hub", event: SELECT_HUB, x: HUB, idleRow: "#7" },
  { kind: "route", event: openRoute("/dashboard/logistica", "logistica"), x: LOGISTICA_ROUTE, idleRow: "#8" },
];

for (const { kind, event, x, idleRow } of CHOICES) {
  given(CLINIC, initial(CLINIC).ctx, BOOTING).on(event, "ignored", `${kind}: a selection before hydration`, UNCHANGED);
  given(CLINIC, BROKEN, failed("render")).on(event, "ignored", `${kind}: a selection after a failure`, UNCHANGED);

  given(CLINIC, context(x, x, 4), IDLE).on(event, "#4", `${kind}: selecting what is already committed`, UNCHANGED);
  given(CLINIC, AT_OPS, IDLE).on(
    event,
    idleRow,
    `${kind}: a selection takes flight and is shown at once`,
    to(routing(4, x), context(OPS, x, 5, { lastModule: "operaciones" }), push(x), arm(4), PUBLISH),
  );

  given(CLINIC, context(OPS, x, 8, { superseded: [PERFIL] }), routing(7, x)).on(
    event,
    "ignored",
    `${kind}: re-selecting the target already in flight`,
    UNCHANGED,
  );
  given(CLINIC, context(x, INFORMES, 8, { superseded: [PERFIL] }), routing(7, INFORMES)).on(
    event,
    "#25",
    `${kind}: returning to the committed location drops the flight`,
    to(IDLE, context(x, x, 8), cancel(7), push(x), PUBLISH),
  );
  given(CLINIC, IN_FLIGHT, routing(7, INFORMES)).on(
    event,
    "#10",
    `${kind}: a new selection supersedes the target in flight`,
    to(
      routing(8, x),
      context(OPS, x, 9, { superseded: [PERFIL, INFORMES], lastModule: "operaciones" }),
      cancel(7),
      push(x),
      arm(8),
      PUBLISH,
    ),
  );

  given(CLINIC, context(OPS, x, 4), traversing(3, x)).on(
    event,
    "ignored",
    `${kind}: selecting the destination of the traverse`,
    UNCHANGED,
  );
  given(CLINIC, context(x, INFORMES, 4, { lastModule: "operaciones" }), traversing(3, INFORMES)).on(
    event,
    "#25",
    `${kind}: rev. 2.2: returning to the committed location during a traverse drops the traverse`,
    to(IDLE, context(x, x, 4, { lastModule: "operaciones" }), cancel(3), push(x), PUBLISH),
  );
  given(CLINIC, TRAVERSE, traversing(3, INFORMES)).on(
    event,
    "#19",
    `${kind}: a selection during a traverse flies with afterTraverse`,
    to(
      routing(4, x, { afterTraverse: true }),
      context(OPS, x, 5, { lastModule: "operaciones" }),
      cancel(3),
      push(x),
      arm(4),
      PUBLISH,
    ),
  );

  given(CLINIC, context(x, x, 6), stalled(5, x, "traverse", "replace")).on(
    event,
    "ignored",
    `${kind}: selecting a stalled target that is also committed`,
    UNCHANGED,
  );
  given(CLINIC, context(x, INFORMES, 6, { superseded: [PERFIL] }), stalled(5, INFORMES)).on(
    event,
    "#25",
    `${kind}: returning to the committed location from a stall`,
    to(IDLE, context(x, x, 6), push(x), PUBLISH),
  );
  given(CLINIC, STUCK, stalled(5, INFORMES)).on(
    event,
    "#16",
    `${kind}: a new selection leaves the stall and supersedes its target`,
    to(
      routing(6, x),
      context(OPS, x, 7, { superseded: [PERFIL, INFORMES], lastModule: "operaciones" }),
      push(x),
      arm(6),
      PUBLISH,
    ),
  );
}

// #6 — selections that resolve to nothing, in every state

const REJECTED: readonly { readonly config: MachineConfig; readonly event: NavEvent; readonly why: string }[] = [
  { config: ADMIN, event: selectModule(RETIRED), why: "a module Admin does not have" },
  { config: CLINIC, event: selectModule(RETIRED), why: "a module Clinic does not have" },
  { config: ADMIN, event: SELECT_HUB, why: "the hub in Admin" },
  { config: ADMIN, event: openRoute("/dashboard/informes", "admin-pricing"), why: "a full route in Admin" },
  { config: CLINIC, event: openRoute("/dashboard/retirada", RETIRED), why: "a full route whose module is not valid" },
];

function sample(config: MachineConfig, tag: Tag): { readonly ctx: NavContext; readonly state: NavState } {
  const [a, b, c] = config.modules.map(mod) as [NavLocation, NavLocation, NavLocation];
  switch (tag) {
    case "BOOTING":
      return initial(config);
    case "IDLE":
      return { ctx: context(a, a, 4), state: IDLE };
    case "ROUTING":
      return { ctx: context(a, b, 8, { superseded: [c] }), state: routing(7, b) };
    case "TRAVERSING":
      return { ctx: context(a, b, 4), state: traversing(3, b) };
    case "STALLED":
      return { ctx: context(a, b, 6, { superseded: [c] }), state: stalled(5, b) };
    case "FAILED":
      return { ctx: context(a, b, 6), state: failed("payload") };
  }
}

for (const tag of TAGS) {
  for (const { config, event, why } of REJECTED) {
    const { ctx, state } = sample(config, tag);
    given(config, ctx, state).on(event, "#6", `${why} is rejected`, UNCHANGED);
  }
}

for (const scenario of CASES) {
  const { branch, title, expected, ...situation } = scenario;

  test(`${pairKey(situation.state.tag, situation.event.type)} · ${branch} · ${title}`, () => {
    assert.deepEqual(classify(situation), [branch], "the guard table resolves this situation to one row");

    const result = apply(situation);
    if (expected === UNCHANGED) {
      assert.deepEqual(result.ctx, situation.ctx, "context unchanged");
      assert.deepEqual(result.state, situation.state, "state unchanged");
      assert.deepEqual(result.effects, [], "no effects");
      return;
    }

    assert.deepEqual(result.state, expected.state);
    assert.deepEqual(
      { ...result.ctx, superseded: supersededKey(result.ctx) },
      { ...expected.ctx, superseded: supersededKey(expected.ctx) },
    );
    assert.deepEqual(result.effects, expected.effects, "effects, in the order of the table");
  });
}

// ── Coverage of the table by the literal cases ───────────────────────────────

const ROWS: readonly Branch[] = Array.from({ length: 28 }, (_, index): Branch => `#${index + 1}`);

test("coverage · the transcribed tables declare 28 rows, 60 pairs and 113 cells", () => {
  assert.ok(EVERY_TAG_LISTED && EVERY_EVENT_LISTED && EVERY_EFFECT_LISTED);

  const branches = new Set(GUARDS.map((guard) => guard.branch));
  assert.deepEqual([...branches].filter((branch) => branch !== "ignored").sort(), [...ROWS].sort());

  const pairs = new Set(GUARDS.flatMap((guard) => guard.from.flatMap((tag) => guard.on.map((type) => pairKey(tag, type)))));
  const expected = TAGS.flatMap((tag) => EVENT_TYPES.map((type) => pairKey(tag, type)));
  assert.equal(expected.length, 60);
  assert.deepEqual([...pairs].sort(), [...expected].sort(), "every state × event pair has a row or an ignored entry");

  assert.equal(CELLS.size, 113);
});

test("coverage · 28/28 rows have a literal case", () => {
  const covered = new Set(CASES.map((scenario) => scenario.branch));
  assert.deepEqual(
    ROWS.filter((branch) => !covered.has(branch)),
    [],
  );
});

test("coverage · 60/60 pairs and 113/113 guard branches have a literal case", (t) => {
  const covered = new Set(
    CASES.map((scenario) => cellKey(scenario.state.tag, scenario.event.type, scenario.branch)),
  );
  const pairs = new Set(CASES.map((scenario) => pairKey(scenario.state.tag, scenario.event.type)));

  assert.deepEqual([...covered].filter((cell) => !CELLS.has(cell)), [], "no case sits outside the table");
  assert.deepEqual([...CELLS].filter((cell) => !covered.has(cell)), [], "every guard branch has a case");
  assert.equal(pairs.size, 60);
  t.diagnostic(`literal cases: ${CASES.length}; cells: ${covered.size}/113; pairs: ${pairs.size}/60`);
});

// ── initial() and purity ─────────────────────────────────────────────────────

test("initial · the normative value of §12.1 on both surfaces: BOOTING, nothing read, navIds from 1 (C-4)", () => {
  const unusual: MachineConfig = { surface: "clinic", modules: [], defaultModule: RETIRED };

  for (const config of [ADMIN, CLINIC, unusual]) {
    // Every field, and no other: before HYDRATED no URL has been read, on either surface.
    assert.deepEqual(initial(deepFreeze(config)), {
      state: { tag: "BOOTING" },
      ctx: { committed: { kind: "none" }, display: { kind: "none" }, nextNavId: 1, superseded: [], lastModule: null },
    });
  }

  // Each call hands out its own value: no shared module state to corrupt.
  const first = initial(ADMIN);
  assert.notEqual(first.ctx, initial(ADMIN).ctx);
  assert.notEqual(first.ctx.superseded, initial(ADMIN).ctx.superseded);
});

test("initial · BOOTING is left only by HYDRATED or NAV_FAILED, and no row leads back to it", () => {
  const { campaign: run, walked } = evidence();
  const closed = history();

  for (const config of [ADMIN, CLINIC]) {
    const start = boot(config);
    for (const event of alphabet(config, start)) {
      const step = advance(config, start, event);
      const leaves = event.type === "HYDRATED" || event.type === "NAV_FAILED";
      assert.equal(step.world.state.tag !== "BOOTING", leaves, eventKey(event));
      if (!leaves) assert.ok(unchanged(start, step.result), eventKey(event));
    }
  }
  for (const coverage of [run, evidence().wide, walked, closed.coverage, closed.settling]) {
    assert.equal(coverage.rebooted, 0);
  }
});

test("purity · the same input gives the same output and inputs are never mutated", () => {
  for (const scenario of CASES) {
    const before = `${ctxKey(scenario.ctx)} ${stateKey(scenario.state)} ${eventKey(scenario.event)}`;
    assert.equal(resultKey(apply(scenario)), resultKey(apply(scenario)));
    assert.equal(`${ctxKey(scenario.ctx)} ${stateKey(scenario.state)} ${eventKey(scenario.event)}`, before);
  }
});

test("purity · no clock, no randomness and no timers on any explored path", () => {
  const real = {
    Date: globalThis.Date,
    random: Math.random,
    setTimeout: globalThis.setTimeout,
    setInterval: globalThis.setInterval,
    queueMicrotask: globalThis.queueMicrotask,
  };
  const forbidden = (name: string) => () => {
    throw new Error(`the machine reached ${name}`);
  };

  let explored: Campaign;
  try {
    globalThis.Date = new Proxy(real.Date, {
      construct: forbidden("new Date()"),
      get: forbidden("Date"),
      apply: forbidden("Date()"),
    });
    Math.random = forbidden("Math.random");
    globalThis.setTimeout = forbidden("setTimeout") as unknown as typeof setTimeout;
    globalThis.setInterval = forbidden("setInterval") as unknown as typeof setInterval;
    globalThis.queueMicrotask = forbidden("queueMicrotask");
    explored = campaign(SEED, 500);
  } finally {
    globalThis.Date = real.Date;
    Math.random = real.random;
    globalThis.setTimeout = real.setTimeout;
    globalThis.setInterval = real.setInterval;
    globalThis.queueMicrotask = real.queueMicrotask;
  }

  assert.equal(explored.traces, 500);
  assert.ok(explored.transitions > 500);
});

// ── Model-based: reproducibility, reach and the invariants ───────────────────

test("model · 10 000 seeded traces of up to 40 events over Admin and Clinic are reproducible", (t) => {
  const { campaign: run } = evidence();

  assert.equal(run.traces, TRACE_COUNT);
  assert.ok(run.traces >= 10_000);
  assert.ok(run.longest <= MAX_EVENTS);
  assert.deepEqual(run.bySurface, { admin: TRACE_COUNT / 2, clinic: TRACE_COUNT / 2 });

  assert.equal(campaign(SEED, TRACE_COUNT).hash, run.hash, "same seed, same trace hash");
  assert.notEqual(campaign(SEED, 200).hash, campaign(SEED + 1, 200).hash, "the hash depends on the seed");
  assert.equal(run.hash, TRACE_HASH, "the campaign is pinned: seed, generator and machine");

  t.diagnostic(`seed 0x${SEED.toString(16)}; traces ${run.traces}; transitions ${run.transitions}; hash ${run.hash}`);
});

test("model · 2 000 more seeded traces cover what the base universe cannot tell apart", (t) => {
  const { wide } = evidence();
  const drawn = (location: NavLocation): boolean => WIDE.places(CLINIC).some((place) => same(place, location));

  assert.ok(drawn(VISITS_ROUTE) && drawn(LOGISTICA_ROUTE) && !BASE.places(CLINIC).some((place) => same(place, VISITS_ROUTE)));
  assert.equal(wide.traces, WIDE_TRACE_COUNT);
  assert.deepEqual(wide.bySurface, { admin: WIDE_TRACE_COUNT / 2, clinic: WIDE_TRACE_COUNT / 2 });
  assert.equal(campaign(WIDE_SEED, WIDE_TRACE_COUNT, WIDE).hash, wide.hash, "same seed, same trace hash");
  assert.equal(wide.hash, WIDE_HASH, "the wide campaign is pinned: seed, generator, universe and machine");
  assert.deepEqual(ROWS.filter((branch) => !wide.branches.has(branch)), [], "unreachable rows");
  assert.equal(wide.pairs.size, 60);
  assert.deepEqual([...wide.unresolved], [], "situations with a hole or an overlap in the guard table");
  assert.equal(wide.strayPersists, 0);

  t.diagnostic(`seed 0x${WIDE_SEED.toString(16)}; traces ${wide.traces}; transitions ${wide.transitions}; hash ${wide.hash}`);
});

test("model · every row, pair, state and effect is reached by the generated traces", (t) => {
  const { campaign: run, walked, walks } = evidence();

  for (const [name, coverage] of [["random traces", run], ["exhaustive walk", walked]] as const) {
    assert.deepEqual(ROWS.filter((branch) => !coverage.branches.has(branch)), [], `${name}: unreachable rows`);
    assert.equal(coverage.pairs.size, 60, `${name}: state × event pairs exercised`);
    assert.deepEqual([...coverage.effects].sort(), [...EFFECT_TYPES].sort(), `${name}: effect types emitted`);
  }
  assert.deepEqual([...run.tags].sort(), [...TAGS].sort());

  for (const { surface, states, tags } of walks) {
    assert.deepEqual([...tags].sort(), [...TAGS].sort(), `${surface}: every state is reachable`);
    t.diagnostic(`exhaustive walk · ${surface}: ${states} reachable states`);
  }
  t.diagnostic(`exhaustive walk · ${walked.transitions} transitions checked`);
  for (const [name, coverage] of [["random traces", run], ["exhaustive walk", walked]] as const) {
    const unresolved = [...coverage.unresolved].map(([overlap, count]) => `${overlap} ×${count}`).join(", ");
    assert.equal(unresolved, "", `${name}: situations with a hole or an overlap in the guard table`);
    assert.equal(coverage.strayPersists, 0, `${name}: PERSIST of a module the surface does not have`);
    t.diagnostic(`${name} · situations without exactly one row: ${unresolved || "none"}`);
    t.diagnostic(`${name} · PERSIST of a module the surface does not have: ${coverage.strayPersists}`);
  }
  t.diagnostic(
    `rows hit by the random traces: ${ROWS.map((branch) => `${branch}=${run.branches.get(branch) ?? 0}`).join(" ")} ignored=${run.branches.get("ignored") ?? 0}`,
  );
});

test("model · no terminal state: every reachable state can come to rest in IDLE", (t) => {
  for (const { surface, states, trapped, farthest } of evidence().walks) {
    assert.deepEqual(trapped.slice(0, 3), [], `${surface}: states with no way back to IDLE`);
    t.diagnostic(`exhaustive walk · ${surface}: ${states} states, each at most ${farthest} event(s) away from IDLE`);
  }
});

for (const property of Object.keys(PROPERTIES) as Property[]) {
  test(`model · ${property} · ${PROPERTIES[property]}`, () => {
    const { campaign: run, walked } = evidence();
    // The walk is breadth first: when it has a finding, it is a shortest one.
    const closed = history();
    const runs = [walked, run, evidence().wide, closed.coverage, closed.settling];
    const finding = runs.map((coverage) => coverage.findings.get(property)).find((found) => found !== undefined);
    const count = runs.reduce((total, coverage) => total + (coverage.broken.get(property) ?? 0), 0);

    assert.equal(
      count,
      0,
      finding === undefined
        ? `${property} is reported broken without a recorded trace`
        : `broken in ${run.broken.get(property) ?? 0} of ${run.transitions} random transitions and ${
            walked.broken.get(property) ?? 0
          } of ${walked.transitions} walked ones.\n${narrate(finding)}`,
    );
  });
}

// ── Named traces: the regressions of #1830–#1837 and of rev. 2 / 2.1 ─────────

/** Plays a script and returns one line per step: the row that fired and all it produced. */
function play(config: MachineConfig, events: readonly NavEvent[], from: World = boot(config)): readonly string[] {
  let world = from;
  return events.map((event) => {
    const step = advance(config, world, event);
    world = step.world;
    return `${step.branches.join("+")} → ${resultKey(step.result)}`;
  });
}

test("trace · A→B→A with B in flight returns to A and drops B (#1830, row 25)", () => {
  assert.deepEqual(
    play(CLINIC, [hydrated(OPS), selectModule("informes"), selectModule("operaciones"), budgetExpired(1)]),
    [
      "#1 → IDLE | committed=module:operaciones display=module:operaciones next=1 superseded={} last=operaciones | PERSIST(operaciones) > PUBLISH_DISPLAY",
      "#5 → ROUTING#1(module:informes,user,push) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | ROUTER_PUSH(module:informes) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#25 → IDLE | committed=module:operaciones display=module:operaciones next=2 superseded={} last=operaciones | CANCEL_BUDGET(1) > ROUTER_PUSH(module:operaciones) > PUBLISH_DISPLAY",
      "ignored → IDLE | committed=module:operaciones display=module:operaciones next=2 superseded={} last=operaciones | —",
    ],
  );
});

test("trace · Back before the commit on a full route leaves the flight (#1836, row 17)", () => {
  assert.deepEqual(
    play(CLINIC, [
      hydrated(INFORMES_ROUTE),
      selectModule("logistica"),
      traverseStarted(OPS),
      urlCommitted(OPS),
    ]),
    [
      "#1 → IDLE | committed=route:/dashboard/informes:informes display=route:/dashboard/informes:informes next=1 superseded={} last=informes | PERSIST(informes) > PUBLISH_DISPLAY",
      "#5 → ROUTING#1(module:logistica,user,push) | committed=route:/dashboard/informes:informes display=module:logistica next=2 superseded={} last=informes | ROUTER_PUSH(module:logistica) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#17 → TRAVERSING#2(module:operaciones) | committed=route:/dashboard/informes:informes display=module:operaciones next=3 superseded={} last=informes | CANCEL_BUDGET(1) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
      "#18 → IDLE | committed=module:operaciones display=module:operaciones next=3 superseded={} last=operaciones | CANCEL_BUDGET(2) > PERSIST(operaciones) > PUBLISH_DISPLAY",
    ],
  );
});

test("trace · an RSC payload held past the budget stalls and recovers by RETRY (#1837, rows 12 and 15)", () => {
  assert.deepEqual(
    play(CLINIC, [
      hydrated(OPS),
      selectModule("informes"),
      budgetExpired(1),
      budgetExpired(1),
      RETRY,
      urlCommitted(INFORMES),
    ]),
    [
      "#1 → IDLE | committed=module:operaciones display=module:operaciones next=1 superseded={} last=operaciones | PERSIST(operaciones) > PUBLISH_DISPLAY",
      "#5 → ROUTING#1(module:informes,user,push) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | ROUTER_PUSH(module:informes) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#12 → STALLED#1(module:informes,user,push) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | PUBLISH_DISPLAY",
      "#13 → STALLED#1(module:informes,user,push) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | —",
      "#15 → ROUTING#2(module:informes,user,push) | committed=module:operaciones display=module:informes next=3 superseded={} last=operaciones | HARD_NAVIGATE(module:informes,assign) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
      "#9 → IDLE | committed=module:informes display=module:informes next=3 superseded={} last=informes | CANCEL_BUDGET(2) > PERSIST(informes) > PUBLISH_DISPLAY",
    ],
  );
});

test("trace · a held payload that lands after the stall settles without a retry (row 14)", () => {
  assert.deepEqual(
    play(CLINIC, [hydrated(OPS), selectModule("informes"), budgetExpired(1), urlCommitted(INFORMES)]).slice(2),
    [
      "#12 → STALLED#1(module:informes,user,push) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | PUBLISH_DISPLAY",
      "#14 → IDLE | committed=module:informes display=module:informes next=2 superseded={} last=informes | PERSIST(informes) > PUBLISH_DISPLAY",
    ],
  );
});

test("trace · hub → module → Back to the hub (rows 1, 5, 9, 17, 18)", () => {
  assert.deepEqual(
    play(CLINIC, [
      hydrated(HUB, null, true),
      selectModule("informes"),
      urlCommitted(INFORMES),
      traverseStarted(HUB),
      urlCommitted(HUB),
      SELECT_HUB,
      selectModule("informes"),
      urlCommitted(INFORMES),
      SELECT_HUB,
    ]),
    [
      "#1 → IDLE | committed=hub display=hub next=1 superseded={} last=∅ | PUBLISH_DISPLAY",
      "#5 → ROUTING#1(module:informes,user,push) | committed=hub display=module:informes next=2 superseded={} last=∅ | ROUTER_PUSH(module:informes) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#9 → IDLE | committed=module:informes display=module:informes next=2 superseded={} last=informes | CANCEL_BUDGET(1) > PERSIST(informes) > PUBLISH_DISPLAY",
      "#17 → TRAVERSING#2(hub) | committed=module:informes display=hub next=3 superseded={} last=informes | ARM_BUDGET(2) > PUBLISH_DISPLAY",
      "#18 → IDLE | committed=hub display=hub next=3 superseded={} last=informes | CANCEL_BUDGET(2) > PUBLISH_DISPLAY",
      "#4 → IDLE | committed=hub display=hub next=3 superseded={} last=informes | —",
      "#5 → ROUTING#3(module:informes,user,push) | committed=hub display=module:informes next=4 superseded={} last=informes | ROUTER_PUSH(module:informes) > ARM_BUDGET(3) > PUBLISH_DISPLAY",
      "#9 → IDLE | committed=module:informes display=module:informes next=4 superseded={} last=informes | CANCEL_BUDGET(3) > PERSIST(informes) > PUBLISH_DISPLAY",
      "#7 → ROUTING#4(hub,user,push) | committed=module:informes display=hub next=5 superseded={} last=informes | ROUTER_PUSH(hub) > ARM_BUDGET(4) > PUBLISH_DISPLAY",
    ],
  );
});

test("trace · a pending refresh holds every commit: selections stall, supersede and converge (SP-5)", () => {
  assert.deepEqual(
    play(CLINIC, [
      hydrated(OPS),
      selectModule("informes"),
      selectModule("logistica"),
      budgetExpired(1),
      budgetExpired(2),
      selectModule("perfil"),
      urlCommitted(INFORMES),
      urlCommitted(LOGISTICA),
      urlCommitted(PERFIL),
    ]).slice(1),
    [
      "#5 → ROUTING#1(module:informes,user,push) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | ROUTER_PUSH(module:informes) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#10 → ROUTING#2(module:logistica,user,push) | committed=module:operaciones display=module:logistica next=3 superseded={module:informes} last=operaciones | CANCEL_BUDGET(1) > ROUTER_PUSH(module:logistica) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
      "#13 → ROUTING#2(module:logistica,user,push) | committed=module:operaciones display=module:logistica next=3 superseded={module:informes} last=operaciones | —",
      "#12 → STALLED#2(module:logistica,user,push) | committed=module:operaciones display=module:logistica next=3 superseded={module:informes} last=operaciones | PUBLISH_DISPLAY",
      "#16 → ROUTING#3(module:perfil,user,push) | committed=module:operaciones display=module:perfil next=4 superseded={module:informes,module:logistica} last=operaciones | ROUTER_PUSH(module:perfil) > ARM_BUDGET(3) > PUBLISH_DISPLAY",
      "#11 → ROUTING#3(module:perfil,user,push) | committed=module:operaciones display=module:perfil next=4 superseded={module:informes,module:logistica} last=operaciones | —",
      "#11 → ROUTING#3(module:perfil,user,push) | committed=module:operaciones display=module:perfil next=4 superseded={module:informes,module:logistica} last=operaciones | —",
      "#9 → IDLE | committed=module:perfil display=module:perfil next=4 superseded={} last=perfil | CANCEL_BUDGET(3) > PERSIST(perfil) > PUBLISH_DISPLAY",
    ],
  );
});

test("trace · a restore replaced by a user selection never repaints (rows 2, 10, 11, 9)", () => {
  assert.deepEqual(
    play(CLINIC, [
      hydrated(OPS, "logistica"),
      selectModule("informes"),
      urlCommitted(LOGISTICA),
      urlCommitted(INFORMES),
    ]),
    [
      "#2 → ROUTING#1(module:logistica,restore,replace) | committed=module:operaciones display=module:operaciones next=2 superseded={} last=logistica | ROUTER_REPLACE(module:logistica) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#10 → ROUTING#2(module:informes,user,push) | committed=module:operaciones display=module:informes next=3 superseded={module:logistica} last=logistica | CANCEL_BUDGET(1) > ROUTER_PUSH(module:informes) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
      "#11 → ROUTING#2(module:informes,user,push) | committed=module:operaciones display=module:informes next=3 superseded={module:logistica} last=logistica | —",
      "#9 → IDLE | committed=module:informes display=module:informes next=3 superseded={} last=informes | CANCEL_BUDGET(2) > PERSIST(informes) > PUBLISH_DISPLAY",
    ],
  );
});

test("trace · a selection during TRAVERSING survives the commit of the traverse (rows 19, 26, 9)", () => {
  assert.deepEqual(
    play(CLINIC, [
      hydrated(OPS),
      traverseStarted(INFORMES),
      selectModule("logistica"),
      urlCommitted(INFORMES),
      urlCommitted(LOGISTICA),
    ]).slice(1),
    [
      "#17 → TRAVERSING#1(module:informes) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#19 → ROUTING#2(module:logistica,user,push,afterTraverse) | committed=module:operaciones display=module:logistica next=3 superseded={} last=operaciones | CANCEL_BUDGET(1) > ROUTER_PUSH(module:logistica) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
      "#26 → ROUTING#2(module:logistica,user,push) | committed=module:informes display=module:logistica next=3 superseded={} last=operaciones | —",
      "#9 → IDLE | committed=module:logistica display=module:logistica next=3 superseded={} last=logistica | CANCEL_BUDGET(2) > PERSIST(logistica) > PUBLISH_DISPLAY",
    ],
  );
});

test("trace · Admin restores onto the bare URL at boot, on Back and on RESET (rows 2, 3, 18, 21)", () => {
  assert.deepEqual(
    play(ADMIN, [
      hydrated(NONE, "admin-pricing"),
      urlCommitted(PRICING),
      traverseStarted(NONE),
      urlCommitted(NONE),
      urlCommitted(PRICING),
      navFailed("render"),
      reset(NONE),
      urlCommitted(PRICING),
    ]),
    [
      "#2 → ROUTING#1(module:admin-pricing,restore,replace) | committed=none display=none next=2 superseded={} last=admin-pricing | ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#9 → IDLE | committed=module:admin-pricing display=module:admin-pricing next=2 superseded={} last=admin-pricing | CANCEL_BUDGET(1) > PERSIST(admin-pricing) > PUBLISH_DISPLAY",
      "#17 → TRAVERSING#2(none) | committed=module:admin-pricing display=none next=3 superseded={} last=admin-pricing | ARM_BUDGET(2) > PUBLISH_DISPLAY",
      "#18 → ROUTING#3(module:admin-pricing,restore,replace) | committed=none display=none next=4 superseded={} last=admin-pricing | CANCEL_BUDGET(2) > ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(3) > PUBLISH_DISPLAY",
      "#9 → IDLE | committed=module:admin-pricing display=module:admin-pricing next=4 superseded={} last=admin-pricing | CANCEL_BUDGET(3) > PERSIST(admin-pricing) > PUBLISH_DISPLAY",
      "#20 → FAILED(render) | committed=module:admin-pricing display=module:admin-pricing next=4 superseded={} last=admin-pricing | PUBLISH_DISPLAY",
      "#21 → ROUTING#4(module:admin-pricing,restore,replace) | committed=none display=none next=5 superseded={} last=admin-pricing | ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(4) > PUBLISH_DISPLAY",
      "#9 → IDLE | committed=module:admin-pricing display=module:admin-pricing next=5 superseded={} last=admin-pricing | CANCEL_BUDGET(4) > PERSIST(admin-pricing) > PUBLISH_DISPLAY",
    ],
  );
  assert.deepEqual(play(ADMIN, [hydrated(NONE)]), [
    "#3 → ROUTING#1(module:admin,restore,replace) | committed=none display=none next=2 superseded={} last=admin | ROUTER_REPLACE(module:admin) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
  ]);
});

test("trace · direct entry to /dashboard/informes persists it and a later boot restores it (rev. 2.1)", () => {
  assert.deepEqual(play(CLINIC, [hydrated(INFORMES_ROUTE), urlCommitted(OPS)]), [
    "#1 → IDLE | committed=route:/dashboard/informes:informes display=route:/dashboard/informes:informes next=1 superseded={} last=informes | PERSIST(informes) > PUBLISH_DISPLAY",
    "#22 → IDLE | committed=module:operaciones display=module:operaciones next=1 superseded={} last=operaciones | PERSIST(operaciones) > PUBLISH_DISPLAY",
  ]);
  // A new document on the bare URL, with `informes` as the stored module.
  assert.deepEqual(play(CLINIC, [hydrated(OPS, "informes")]), [
    "#2 → ROUTING#1(module:informes,restore,replace) | committed=module:operaciones display=module:operaciones next=2 superseded={} last=informes | ROUTER_REPLACE(module:informes) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
  ]);
});

test("trace · NAV_FAILED cancels the budget, the late timer is inert and RESET recovers (rows 20, 21)", () => {
  assert.deepEqual(
    play(CLINIC, [
      hydrated(OPS),
      selectModule("informes"),
      navFailed("payload"),
      budgetExpired(1),
      reset(INFORMES),
    ]).slice(1),
    [
      "#5 → ROUTING#1(module:informes,user,push) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | ROUTER_PUSH(module:informes) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "#20 → FAILED(payload) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | CANCEL_BUDGET(1) > PUBLISH_DISPLAY",
      "ignored → FAILED(payload) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | —",
      "#21 → IDLE | committed=module:informes display=module:informes next=2 superseded={} last=informes | PERSIST(informes) > PUBLISH_DISPLAY",
    ],
  );
});

// ── Regressions: the counterexamples the table of rev. 2.1 failed (§0.4) ─────
//
// Each one replays the minimal trace the first mechanical verification found.
// The transcript proves which rows fire; the closing assertion is the property
// the rev. 2.1 table broke. They are permanent: a change that turns one red has
// reopened the finding.

const short = (line: string): string => line.split(" | ")[0] ?? line;

function finish(config: MachineConfig, events: readonly NavEvent[]): World {
  return events.reduce((world, event) => advance(config, world, event).world, boot(config));
}

const restingPlace = (world: World): string => `${world.state.tag} at ${locKey(world.ctx.committed)}`;

test("regression · C-1 · L5 · an Admin traverse to the bare entry that stalls and then lands normalizes (rows 17, 27, 14)", () => {
  const stalledOnBare = [hydrated(PRICING, null, true), traverseStarted(NONE), budgetExpired(1)];

  assert.deepEqual(play(ADMIN, [...stalledOnBare, urlCommitted(NONE), urlCommitted(PRICING)]), [
    "#1 → IDLE | committed=module:admin-pricing display=module:admin-pricing next=1 superseded={} last=admin-pricing | PERSIST(admin-pricing) > PUBLISH_DISPLAY",
    "#17 → TRAVERSING#1(none) | committed=module:admin-pricing display=none next=2 superseded={} last=admin-pricing | ARM_BUDGET(1) > PUBLISH_DISPLAY",
    "#27 → STALLED#1(none,traverse,replace) | committed=module:admin-pricing display=none next=2 superseded={} last=admin-pricing | PUBLISH_DISPLAY",
    "#14 → ROUTING#2(module:admin-pricing,restore,replace) | committed=none display=none next=3 superseded={} last=admin-pricing | ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
    "#9 → IDLE | committed=module:admin-pricing display=module:admin-pricing next=3 superseded={} last=admin-pricing | CANCEL_BUDGET(2) > PERSIST(admin-pricing) > PUBLISH_DISPLAY",
  ]);
  assert.notEqual(
    restingPlace(finish(ADMIN, [...stalledOnBare, urlCommitted(NONE)])),
    "IDLE at none",
    "L5: row 14 must normalize the bare entry, as `settle` does for row 18",
  );

  // The same stall recovered by RETRY: row 15, then row 9 twice — one budget at a time.
  assert.deepEqual(play(ADMIN, [...stalledOnBare, RETRY, urlCommitted(NONE), urlCommitted(PRICING)]).slice(3), [
    "#15 → ROUTING#2(none,user,replace) | committed=module:admin-pricing display=none next=3 superseded={} last=admin-pricing | HARD_NAVIGATE(none,replace) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
    "#9 → ROUTING#3(module:admin-pricing,restore,replace) | committed=none display=none next=4 superseded={} last=admin-pricing | CANCEL_BUDGET(2) > ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(3) > PUBLISH_DISPLAY",
    "#9 → IDLE | committed=module:admin-pricing display=module:admin-pricing next=4 superseded={} last=admin-pricing | CANCEL_BUDGET(3) > PERSIST(admin-pricing) > PUBLISH_DISPLAY",
  ]);
  assert.notEqual(
    restingPlace(finish(ADMIN, [...stalledOnBare, RETRY, urlCommitted(NONE)])),
    "IDLE at none",
    "L5: row 9 must normalize the bare entry too",
  );
});

test("regression · C-2 · partition and S4 · a normalization out of ROUTING starts with nothing superseded (rows 10, 11, 23, then 9 alone)", () => {
  const events = [hydrated(NONE), selectModule("admin-clinics"), urlCommitted(HOME), urlCommitted(NONE)];

  assert.deepEqual(
    play(ADMIN, events).map(short),
    [
      "#3 → ROUTING#1(module:admin,restore,replace)",
      "#10 → ROUTING#2(module:admin-clinics,user,push)",
      "#11 → ROUTING#2(module:admin-clinics,user,push)",
      "#23 → ROUTING#3(module:admin,restore,replace)",
    ],
    "the table is followed row by row",
  );

  const end = finish(ADMIN, events);
  assert.deepEqual(end.ctx.superseded, [], "the normalization of `settle` empties `superseded`");
  assert.deepEqual(
    classify({ config: ADMIN, ctx: end.ctx, state: end.state, event: urlCommitted(HOME) }),
    ["#9"],
    "the commit of the target must resolve to row 9 alone",
  );

  // S4 from the other side: the commit of the re-armed target is painted, not swallowed by row 11.
  assert.deepEqual(play(ADMIN, [urlCommitted(HOME)], end), [
    "#9 → IDLE | committed=module:admin display=module:admin next=4 superseded={} last=admin | CANCEL_BUDGET(3) > PERSIST(admin) > PUBLISH_DISPLAY",
  ]);
});

test("regression · C-3 · L1 · selecting the target already in flight is idempotent; selecting a stalled one retries (ROUTING restore ignored, row 16)", () => {
  for (const [config, boots, target] of [
    [CLINIC, hydrated(OPS, "logistica"), "logistica"],
    [ADMIN, hydrated(NONE, "admin-pricing"), "admin-pricing"],
  ] as const) {
    const restoring = finish(config, [boots]);
    const again = advance(config, restoring, selectModule(target));

    assert.deepEqual(again.branches, ["ignored"], "the table is followed: same(X, T) is ignored in ROUTING");
    assert.ok(unchanged(restoring, again.result), "no second navigation while the first is in flight");
    assert.ok(!same(restoring.ctx.display, mod(target)), "the target is not shown yet: display = committed in a restore");
    assert.deepEqual(again.broken, [], "L1 holds on the destination in force, with no redundant ROUTER_PUSH");
  }

  const stuck = finish(CLINIC, [hydrated(OPS, "logistica"), budgetExpired(1)]);
  assert.deepEqual(play(CLINIC, [selectModule("logistica")], stuck), [
    "#16 → ROUTING#2(module:logistica,user,push) | committed=module:operaciones display=module:logistica next=3 superseded={} last=logistica | ROUTER_PUSH(module:logistica) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
  ]);
});

test("regression · C-5 · S12 · a location without a module the surface has persists nothing, in every confirmation", () => {
  // An external commit of a full route whose module is not resolvable, then of a retired module.
  assert.deepEqual(play(CLINIC, [hydrated(INFORMES), urlCommitted(UNRESOLVED_ROUTE), urlCommitted(mod(RETIRED))]), [
    "#1 → IDLE | committed=module:informes display=module:informes next=1 superseded={} last=informes | PERSIST(informes) > PUBLISH_DISPLAY",
    "#22 → IDLE | committed=route:/dashboard/retirada:retired-module display=route:/dashboard/retirada:retired-module next=1 superseded={} last=informes | PUBLISH_DISPLAY",
    "#22 → IDLE | committed=module:retired-module display=module:retired-module next=1 superseded={} last=informes | PUBLISH_DISPLAY",
  ]);

  // The same two locations through every other confirming row: #18, #14, #9 and #21.
  for (const place of [UNRESOLVED_ROUTE, mod(RETIRED)]) {
    const scripts: readonly (readonly [string, readonly NavEvent[]])[] = [
      ["#17 #18", [traverseStarted(place), urlCommitted(place)]],
      ["#17 #27 #14", [traverseStarted(place), budgetExpired(1), urlCommitted(place)]],
      ["#17 #27 #15 #9", [traverseStarted(place), budgetExpired(1), RETRY, urlCommitted(place)]],
      ["#20 #21", [navFailed("render"), reset(place)]],
    ];
    for (const [rows, script] of scripts) {
      let world = finish(CLINIC, [hydrated(INFORMES)]);
      const fired: string[] = [];
      for (const event of script) {
        const step = advance(CLINIC, world, event);
        fired.push(...step.branches);
        assert.deepEqual(step.result.effects.filter((effect) => effect.type === "PERSIST"), [], rows);
        world = step.world;
      }

      assert.equal(fired.join(" "), rows);
      assert.equal(restingPlace(world), `IDLE at ${locKey(place)}`);
      assert.equal(world.ctx.lastModule, "informes", "lastModule keeps the last module the surface has");
    }
  }
});

test("regression · C-6 · the boundary leaving without retry() resets the machine, and the button plus the unmount reset once", () => {
  // A failure on a full route, then Back to /dashboard: Next drops the boundary
  // because the pathname changed; its unmount dispatches RESET.
  assert.deepEqual(
    play(CLINIC, [
      hydrated(INFORMES_ROUTE),
      navFailed("render"),
      traverseStarted(OPS),
      urlCommitted(OPS),
      reset(OPS),
      reset(OPS),
      selectModule("logistica"),
    ]),
    [
      "#1 → IDLE | committed=route:/dashboard/informes:informes display=route:/dashboard/informes:informes next=1 superseded={} last=informes | PERSIST(informes) > PUBLISH_DISPLAY",
      "#20 → FAILED(render) | committed=route:/dashboard/informes:informes display=route:/dashboard/informes:informes next=1 superseded={} last=informes | PUBLISH_DISPLAY",
      "ignored → FAILED(render) | committed=route:/dashboard/informes:informes display=route:/dashboard/informes:informes next=1 superseded={} last=informes | —",
      "ignored → FAILED(render) | committed=route:/dashboard/informes:informes display=route:/dashboard/informes:informes next=1 superseded={} last=informes | —",
      "#21 → IDLE | committed=module:operaciones display=module:operaciones next=1 superseded={} last=operaciones | PERSIST(operaciones) > PUBLISH_DISPLAY",
      "ignored → IDLE | committed=module:operaciones display=module:operaciones next=1 superseded={} last=operaciones | —",
      "#5 → ROUTING#1(module:logistica,user,push) | committed=module:operaciones display=module:logistica next=2 superseded={} last=operaciones | ROUTER_PUSH(module:logistica) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
    ],
  );

  // Admin on the bare URL: "Reintentar" resets and normalizes; the unmount
  // that follows must not arm a second budget.
  assert.deepEqual(
    play(ADMIN, [hydrated(PRICING, null, true), navFailed("payload"), reset(NONE), reset(NONE)]).slice(2),
    [
      "#21 → ROUTING#1(module:admin-pricing,restore,replace) | committed=none display=none next=2 superseded={} last=admin-pricing | ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
      "ignored → ROUTING#1(module:admin-pricing,restore,replace) | committed=none display=none next=2 superseded={} last=admin-pricing | —",
    ],
  );
});

test("regression · C-8 · L6 · Back and then Forward before the commit rests on the committed location (rows 17, 28)", () => {
  const events = [
    hydrated(OPS),
    selectModule("informes"),
    urlCommitted(INFORMES),
    traverseStarted(OPS),
    traverseStarted(INFORMES),
    budgetExpired(2),
  ];

  assert.deepEqual(play(CLINIC, events).slice(3), [
    "#17 → TRAVERSING#2(module:operaciones) | committed=module:informes display=module:operaciones next=3 superseded={} last=informes | ARM_BUDGET(2) > PUBLISH_DISPLAY",
    "#28 → IDLE | committed=module:informes display=module:informes next=3 superseded={} last=informes | CANCEL_BUDGET(2) > PERSIST(informes) > PUBLISH_DISPLAY",
    "ignored → IDLE | committed=module:informes display=module:informes next=3 superseded={} last=informes | —",
  ]);
  assert.equal(
    restingPlace(finish(CLINIC, events)),
    "IDLE at module:informes",
    "L6: rev. 2.1 opened TRAVERSING onto `committed` (row 17), which only its budget could end, as a spurious STALLED",
  );

  // The same traverse onto `committed` with a selection in flight, and with a stalled one.
  const flying = [hydrated(OPS), selectModule("informes")];
  assert.deepEqual(play(CLINIC, [...flying, traverseStarted(OPS)]).map(short).slice(2), ["#28 → IDLE"]);
  assert.deepEqual(play(CLINIC, [...flying, budgetExpired(1), traverseStarted(OPS)]).map(short).slice(2), [
    "#12 → STALLED#1(module:informes,user,push)",
    "#28 → IDLE",
  ]);
});

test("regression · C-8 · L6 · Back and then a click on the committed module returns to it (rows 17, 25)", () => {
  const events = [
    hydrated(OPS),
    selectModule("informes"),
    urlCommitted(INFORMES),
    traverseStarted(OPS),
    selectModule("informes"),
    budgetExpired(2),
  ];

  assert.deepEqual(play(CLINIC, events).slice(3), [
    "#17 → TRAVERSING#2(module:operaciones) | committed=module:informes display=module:operaciones next=3 superseded={} last=informes | ARM_BUDGET(2) > PUBLISH_DISPLAY",
    "#25 → IDLE | committed=module:informes display=module:informes next=3 superseded={} last=informes | CANCEL_BUDGET(2) > ROUTER_PUSH(module:informes) > PUBLISH_DISPLAY",
    "ignored → IDLE | committed=module:informes display=module:informes next=3 superseded={} last=informes | —",
  ]);
  assert.equal(
    restingPlace(finish(CLINIC, events)),
    "IDLE at module:informes",
    "L6: rev. 2.1 opened ROUTING onto `committed` (row 19), whose commit the provider never reports",
  );
});

test("regression · C-8 · L5 · a traverse onto the bare Admin entry during its normalization re-issues it under one budget (row 28)", () => {
  assert.deepEqual(play(ADMIN, [hydrated(NONE, "admin-pricing"), traverseStarted(NONE), urlCommitted(PRICING)]), [
    "#2 → ROUTING#1(module:admin-pricing,restore,replace) | committed=none display=none next=2 superseded={} last=admin-pricing | ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(1) > PUBLISH_DISPLAY",
    "#28 → ROUTING#2(module:admin-pricing,restore,replace) | committed=none display=none next=3 superseded={} last=admin-pricing | CANCEL_BUDGET(1) > ROUTER_REPLACE(module:admin-pricing) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
    "#9 → IDLE | committed=module:admin-pricing display=module:admin-pricing next=3 superseded={} last=admin-pricing | CANCEL_BUDGET(2) > PERSIST(admin-pricing) > PUBLISH_DISPLAY",
  ]);
});

// ── Regression: the counterexample the table of rev. 2.2.1 failed (C-10) ─────
//
// Found by the review of this PR, not by the suite: no oracle of rev. 2.2.1
// could see it, because row #10 itself said `afterTraverse = false`. S13 is the
// property that sees it now.

const BACK_THEN_TWO = [hydrated(OPS), traverseStarted(INFORMES), selectModule("logistica"), selectModule("perfil")];

test("regression · C-10 · S13 · a second selection after a traverse still survives the commit of that traverse (rows 17, 19, 10, 26, 9)", () => {
  const events = [...BACK_THEN_TWO, urlCommitted(INFORMES), urlCommitted(PERFIL)];

  assert.deepEqual(play(CLINIC, events).slice(1), [
    "#17 → TRAVERSING#1(module:informes) | committed=module:operaciones display=module:informes next=2 superseded={} last=operaciones | ARM_BUDGET(1) > PUBLISH_DISPLAY",
    "#19 → ROUTING#2(module:logistica,user,push,afterTraverse) | committed=module:operaciones display=module:logistica next=3 superseded={} last=operaciones | CANCEL_BUDGET(1) > ROUTER_PUSH(module:logistica) > ARM_BUDGET(2) > PUBLISH_DISPLAY",
    "#10 → ROUTING#3(module:perfil,user,push,afterTraverse) | committed=module:operaciones display=module:perfil next=4 superseded={module:logistica} last=operaciones | CANCEL_BUDGET(2) > ROUTER_PUSH(module:perfil) > ARM_BUDGET(3) > PUBLISH_DISPLAY",
    "#26 → ROUTING#3(module:perfil,user,push) | committed=module:informes display=module:perfil next=4 superseded={module:logistica} last=operaciones | —",
    "#9 → IDLE | committed=module:perfil display=module:perfil next=4 superseded={} last=perfil | CANCEL_BUDGET(3) > PERSIST(perfil) > PUBLISH_DISPLAY",
  ]);
  assert.equal(
    restingPlace(finish(CLINIC, events.slice(0, -1))),
    "ROUTING at module:informes",
    "S13: rev. 2.2.1 dropped afterTraverse on row 10, and the commit of the traverse took row 23: budget 3 cancelled, PERSIST(informes), IDLE on the history entry",
  );
});

test("regression · C-10 · S13 · every selection of the burst inherits the debt: Admin, the hub and full routes (rows 19, 10, 26)", () => {
  // Three selections, the last one the hub.
  assert.deepEqual(
    play(CLINIC, [...BACK_THEN_TWO, SELECT_HUB, urlCommitted(INFORMES), urlCommitted(HUB)]).map(short).slice(3),
    [
      "#10 → ROUTING#3(module:perfil,user,push,afterTraverse)",
      "#10 → ROUTING#4(hub,user,push,afterTraverse)",
      "#26 → ROUTING#4(hub,user,push)",
      "#9 → IDLE",
    ],
  );

  // From a full route, Back to the shell and two full routes of one module.
  assert.deepEqual(
    play(CLINIC, [
      hydrated(INFORMES_ROUTE),
      traverseStarted(OPS),
      openRoute("/dashboard/logistica", "logistica"),
      openRoute("/dashboard/logistica/visitas", "logistica"),
      urlCommitted(OPS),
      urlCommitted(VISITS_ROUTE),
    ])
      .map(short)
      .slice(2),
    [
      "#19 → ROUTING#2(route:/dashboard/logistica:logistica,user,push,afterTraverse)",
      "#10 → ROUTING#3(route:/dashboard/logistica/visitas:logistica,user,push,afterTraverse)",
      "#26 → ROUTING#3(route:/dashboard/logistica/visitas:logistica,user,push)",
      "#9 → IDLE",
    ],
  );

  // Admin, Back to the bare entry: rev. 2.2.1 answered its late commit with row
  // 23 and a ROUTER_REPLACE onto the last module, over the click still in flight.
  const admin = [
    hydrated(HOME, null, true),
    traverseStarted(NONE),
    selectModule("admin-clinics"),
    selectModule("admin-pricing"),
    urlCommitted(NONE),
    urlCommitted(PRICING),
  ];
  const transcript = play(ADMIN, admin);
  assert.deepEqual(transcript.map(short).slice(2), [
    "#19 → ROUTING#2(module:admin-clinics,user,push,afterTraverse)",
    "#10 → ROUTING#3(module:admin-pricing,user,push,afterTraverse)",
    "#26 → ROUTING#3(module:admin-pricing,user,push)",
    "#9 → IDLE",
  ]);
  assert.ok(transcript.every((line) => !line.includes("ROUTER_REPLACE")), "no normalization over the click");
  assert.equal(restingPlace(finish(ADMIN, admin)), "IDLE at module:admin-pricing");
});

test("regression · C-10 · S13 · the debt is paid by one commit and ends with the flight (rows 26, 11, 23, 9, 22, 12, 15, 17, 25, 20)", () => {
  const after = (events: readonly NavEvent[], skip: number): readonly string[] =>
    play(CLINIC, events).map(short).slice(skip);

  // Selecting the target already in flight is inert and keeps the debt.
  assert.deepEqual(after([...BACK_THEN_TWO.slice(0, 3), selectModule("logistica"), urlCommitted(INFORMES)], 3), [
    "ignored → ROUTING#2(module:logistica,user,push,afterTraverse)",
    "#26 → ROUTING#2(module:logistica,user,push)",
  ]);
  // So do a superseded commit and a stale budget: neither is the commit owed.
  assert.deepEqual(after([...BACK_THEN_TWO, urlCommitted(LOGISTICA), budgetExpired(2), urlCommitted(INFORMES)], 4), [
    "#11 → ROUTING#3(module:perfil,user,push,afterTraverse)",
    "#13 → ROUTING#3(module:perfil,user,push,afterTraverse)",
    "#26 → ROUTING#3(module:perfil,user,push)",
  ]);
  // Paid once: after row 26 a later selection flies without it, and the next foreign commit is external.
  assert.deepEqual(
    after([...BACK_THEN_TWO.slice(0, 3), urlCommitted(INFORMES), selectModule("perfil"), urlCommitted(HUB)], 3),
    ["#26 → ROUTING#2(module:logistica,user,push)", "#10 → ROUTING#3(module:perfil,user,push)", "#23 → IDLE"],
  );
  // The target lands first: the flight is over, and a commit after it is external (H3 excludes it).
  assert.deepEqual(after([...BACK_THEN_TWO, urlCommitted(PERFIL), urlCommitted(INFORMES)], 4), ["#9 → IDLE", "#22 → IDLE"]);
  // A stall keeps no provenance (row 23 covers STALLED whatever came before), and RETRY starts clean.
  assert.deepEqual(after([...BACK_THEN_TWO, budgetExpired(3), urlCommitted(INFORMES)], 4), [
    "#12 → STALLED#3(module:perfil,user,push)",
    "#23 → IDLE",
  ]);
  assert.deepEqual(after([...BACK_THEN_TWO, budgetExpired(3), RETRY], 5), ["#15 → ROUTING#4(module:perfil,user,push)"]);
  // A new traverse takes the flight; a selection during it owes the commit of that one.
  assert.deepEqual(after([...BACK_THEN_TWO, traverseStarted(HUB), selectModule("logistica")], 4), [
    "#17 → TRAVERSING#4(hub)",
    "#19 → ROUTING#5(module:logistica,user,push,afterTraverse)",
  ]);
  // Returning to the committed location and a failure both end the flight.
  assert.deepEqual(after([...BACK_THEN_TWO, selectModule("operaciones")], 4), ["#25 → IDLE"]);
  assert.deepEqual(after([...BACK_THEN_TWO, navFailed("render"), budgetExpired(3), reset(INFORMES)], 4), [
    "#20 → FAILED(render)",
    "ignored → FAILED(render)",
    "#21 → IDLE",
  ]);
  // No traverse, no debt: a click over a restore inherits nothing.
  assert.deepEqual(after([hydrated(OPS, "logistica"), selectModule("informes"), urlCommitted(HUB)], 1), [
    "#10 → ROUTING#2(module:informes,user,push)",
    "#23 → IDLE",
  ]);
});

// ── HISTORY: the abstract router and session history of §13.1 ────────────────
//
// The traces above feed the machine anything. Here the machine's own effects
// drive a model of the router and of the session history, and only that model
// answers back. Its assumptions are the integration contracts of §12.6:
//
//   H1  a new navigation, a traverse or a document navigation discards the
//       pending one
//   H2  a push that lands appends after the current entry and drops the forward
//       ones, unless it targets the current URL: then it replaces in place. A
//       replace that lands overwrites the current entry
//   H3  a discarded navigation never lands
//   H4  Back/Forward moves the index at once, announces its destination and
//       neither adds nor removes entries
//   H5  HARD_NAVIGATE is a document navigation and ends the machine instance
//   H6  the provider reports URL_COMMITTED only when the location it derives
//       differs from the last one it handed to the machine
//   H7  the boundary mounts with NAV_FAILED and leaves on "Reintentar" or when
//       the pathname changes; leaving dispatches RESET with the current location
//
// H1–H7 are assumptions about Next and the provider. Nothing here confirms
// them: that is the E2E of PR-NAV-03/04 (§13.1).

type Pending = { readonly kind: "push" | "replace" | "traverse"; readonly to: NavLocation };
type Sink = (before: World, step: Step, events: readonly NavEvent[]) => void;
type Tally = {
  appends: number;
  replaces: number;
  traverses: number;
  bursts: number;
  /** S5(b): user bursts that appended a second entry. */
  readonly overflows: (readonly string[])[];
};

const emptyTally = (): Tally => ({ appends: 0, replaces: 0, traverses: 0, bursts: 0, overflows: [] });

const pathnameOf = (config: MachineConfig, location: NavLocation): string =>
  location.kind === "route" ? location.path : config.surface === "admin" ? "/dashboard/admin" : "/dashboard";

function openSession(config: MachineConfig, start: NavLocation, tally: Tally, observer: Sink) {
  const entries: NavLocation[] = [start];
  const events: NavEvent[] = [];
  const log: string[] = [];
  let sink = observer;
  let index = 0;
  let pending: Pending | null = null;
  /** The location the router has committed. */
  let canonical = start;
  /** H6: the last location handed to the machine. */
  let seen = start;
  /** Entries appended by the user burst in course. */
  let appended = 0;
  let boundary = false;
  let ended = false;
  let world = boot(config);

  const deliver = (event: NavEvent): Step => {
    const before = world;
    events.push(event);
    const step = advance(config, before, event);
    world = step.world;
    log.push(`${eventKey(event)} [${step.branches.join("+")}] → ${stateKey(world.state)}`);
    sink(before, step, events);

    const from = before.state;
    const sameBurst = (from.tag === "ROUTING" || from.tag === "STALLED") && from.intent === "user";
    for (const effect of step.result.effects) {
      if (effect.type === "ROUTER_PUSH") {
        if (!sameBurst) {
          appended = 0;
          tally.bursts += 1;
        }
        pending = { kind: "push", to: effect.to }; // H1
      } else if (effect.type === "ROUTER_REPLACE") {
        pending = { kind: "replace", to: effect.to }; // H1
      } else if (effect.type === "HARD_NAVIGATE") {
        // H5
        if (effect.mode === "assign") {
          entries.splice(index + 1);
          entries.push(effect.to);
          index += 1;
        } else {
          entries[index] = effect.to;
        }
        pending = null;
        ended = true;
      }
    }
    return step;
  };

  /** The pending navigation lands. H3: whatever was discarded before it never does. */
  const land = (): void => {
    const landing = pending;
    if (landing === null) return;
    pending = null;
    const from = canonical;
    const here = entries[index] ?? canonical;

    if (landing.kind === "traverse") {
      canonical = here;
      log.push("· the traverse lands");
    } else if (landing.kind === "replace" || same(landing.to, here)) {
      entries[index] = landing.to; // H2
      canonical = landing.to;
      tally.replaces += 1;
      log.push(`· ${landing.kind} lands in place`);
    } else {
      entries.splice(index + 1); // H2
      entries.push(landing.to);
      index += 1;
      canonical = landing.to;
      tally.appends += 1;
      appended += 1;
      log.push("· push lands as a new entry");
      if (appended > 1) tally.overflows.push([...log]);
    }

    const left = boundary && pathnameOf(config, from) !== pathnameOf(config, canonical);
    if (!same(canonical, seen)) {
      seen = canonical; // H6
      deliver(urlCommitted(canonical));
    }
    if (left) {
      boundary = false; // H7
      log.push("· the boundary leaves: pathname changed");
      deliver(reset(canonical));
    }
  };

  /** H4. */
  const traverse = (action: "back" | "forward"): void => {
    index += action === "back" ? -1 : 1;
    const destination = entries[index] ?? canonical;
    pending = { kind: "traverse", to: destination }; // H1
    tally.traverses += 1;
    log.push(`· ${action}`);
    deliver(traverseStarted(destination));
  };

  return {
    events,
    log,
    deliver,
    land,
    back: (): void => traverse("back"),
    forward: (): void => traverse("forward"),
    /** A render or payload error reaches the boundary (H7). The navigation that failed is gone. */
    fail(reason: "render" | "payload" | "unknown"): void {
      pending = null;
      boundary = true;
      deliver(navFailed(reason));
    },
    /** The boundary's button: RESET with the current location, then Next's own retry(). */
    reintentar(): void {
      boundary = false; // H7
      seen = canonical;
      log.push("· Reintentar");
      deliver(reset(canonical));
    },
    observe(next: Sink): void {
      sink = next;
    },
    get entries(): readonly NavLocation[] {
      return entries;
    },
    get index(): number {
      return index;
    },
    get pending(): Pending | null {
      return pending;
    },
    get canonical(): NavLocation {
      return canonical;
    },
    get seen(): NavLocation {
      return seen;
    },
    get boundary(): boolean {
      return boundary;
    },
    get ended(): boolean {
      return ended;
    },
    get world(): World {
      return world;
    },
  };
}

type Session = ReturnType<typeof openSession>;

/**
 * L6 in closed loop: a flight the router has nothing pending for. No commit can
 * end it; only its budget, as a STALLED that answers to nothing.
 */
function orphanFlight({ world, pending, ended }: Session): boolean {
  const { state } = world;
  if (ended) return false;
  if (state.tag === "ROUTING") return pending === null || pending.kind === "traverse" || !same(pending.to, state.target);
  return state.tag === "TRAVERSING" && pending === null;
}

/** The same for a stall: STALLED whose navigation the router is no longer running. */
function orphanStall({ world, pending, ended }: Session): boolean {
  const { state } = world;
  if (ended || state.tag !== "STALLED") return false;
  if (pending === null || !same(pending.to, state.target)) return true;
  return (pending.kind === "traverse") !== (state.intent === "traverse");
}

/** The machine and the provider disagree on where the session is. FAILED is reconciled by RESET. */
function adrift({ world, seen, ended }: Session): boolean {
  return !ended && world.state.tag !== "FAILED" && !same(world.ctx.committed, seen);
}

/**
 * Lets everything pending land and says what is wrong with where the session
 * rests, or null. A session ends at rest, behind the boundary, or in a document
 * navigation (H5); never in a flight, a stall or with a budget armed.
 */
function quiesce(session: Session): string | null {
  for (let guard = 0; guard < 8 && session.pending !== null; guard += 1) session.land();

  const { state, ctx, armed } = session.world;
  if (session.pending !== null) return "navigations keep landing";
  if (session.ended) return null;
  if (session.boundary) {
    return state.tag === "FAILED" && armed.length === 0 ? null : `behind the boundary in ${stateKey(state)}`;
  }
  if (state.tag !== "IDLE") return `nothing pending and the machine is in ${stateKey(state)}`;
  if (armed.length > 0) return `at rest with budget ${armed.join()} armed`;
  if (!same(ctx.committed, session.canonical)) {
    return `at rest on ${locKey(ctx.committed)} while the router is on ${locKey(session.canonical)}`;
  }
  return null;
}

// H1–H7, one script each: what the model does, and what the machine makes of it.

function scripted(config: MachineConfig, start: NavLocation, storedModule: string | null = null) {
  const broken: string[] = [];
  const tally = emptyTally();
  const session = openSession(config, start, tally, (_before, step) => {
    broken.push(...step.broken);
  });
  session.deliver(hydrated(start, storedModule));
  return { session, tally, broken };
}

const keys = (locations: readonly NavLocation[]): readonly string[] => locations.map(locKey);

test("history · H1 and H3 · a newer navigation discards the pending one, which never lands", () => {
  const { session, tally, broken } = scripted(CLINIC, OPS);

  session.deliver(selectModule("informes"));
  assert.deepEqual(session.pending, { kind: "push", to: INFORMES });
  session.deliver(selectModule("logistica"));
  assert.deepEqual(session.pending, { kind: "push", to: LOGISTICA }, "H1: one navigation pending at most");

  session.land();
  assert.deepEqual(keys(session.entries), ["module:operaciones", "module:logistica"]);
  assert.equal(restingPlace(session.world), "IDLE at module:logistica");

  const delivered = session.events.length;
  session.land();
  assert.equal(session.events.length, delivered, "H3: the superseded push to informes never lands");
  assert.deepEqual(keys(session.entries), ["module:operaciones", "module:logistica"]);

  // A traverse discards a pending push just the same.
  session.deliver(selectModule("perfil"));
  session.back();
  assert.deepEqual(session.pending, { kind: "traverse", to: OPS });
  session.land();
  assert.equal(restingPlace(session.world), "IDLE at module:operaciones");
  assert.deepEqual(keys(session.entries), ["module:operaciones", "module:logistica"]);

  assert.deepEqual([tally.bursts, tally.appends, tally.overflows.length], [2, 1, 0]);
  assert.deepEqual(broken, []);
});

test("history · H2 · a push appends and drops the forward entries, lands in place on the current URL, and a replace overwrites", () => {
  const { session, tally, broken } = scripted(CLINIC, OPS);

  for (const module of ["informes", "logistica"]) {
    session.deliver(selectModule(module));
    session.land();
  }
  session.back();
  session.land();
  session.back();
  session.land();
  assert.deepEqual([session.entries.length, session.index], [3, 0]);

  session.deliver(selectModule("perfil"));
  session.land();
  assert.deepEqual(keys(session.entries), ["module:operaciones", "module:perfil"], "the forward entries are gone");

  // A→B→A with B in flight: row 25 pushes onto the current URL, which lands in place.
  session.deliver(selectModule("informes"));
  session.deliver(selectModule("perfil"));
  assert.deepEqual(session.pending, { kind: "push", to: PERFIL });
  const delivered = session.events.length;
  session.land();
  assert.deepEqual(keys(session.entries), ["module:operaciones", "module:perfil"], "no entry for the abandoned burst");
  assert.equal(session.events.length, delivered, "H6: nothing to report, the location did not change");
  assert.equal(restingPlace(session.world), "IDLE at module:perfil");
  assert.equal(tally.replaces, 1);

  // A restore lands as a replace: zero entries for it (S5).
  const restore = scripted(ADMIN, NONE, "admin-pricing");
  assert.deepEqual(restore.session.pending, { kind: "replace", to: PRICING });
  restore.session.land();
  assert.deepEqual(keys(restore.session.entries), ["module:admin-pricing"]);
  assert.equal(restingPlace(restore.session.world), "IDLE at module:admin-pricing");
  assert.deepEqual([...broken, ...restore.broken], []);
});

test("history · H4 · Back and Forward move the index at once, announce the entry they land on and keep every entry", () => {
  const { session, broken } = scripted(CLINIC, OPS);
  session.deliver(selectModule("informes"));
  session.land();
  const before = keys(session.entries);

  session.back();
  assert.equal(session.index, 0, "the index moves before anything lands");
  assert.deepEqual(session.events.at(-1), traverseStarted(OPS));
  assert.equal(stateKey(session.world.state), "TRAVERSING#2(module:operaciones)");
  assert.equal(locKey(session.canonical), "module:informes", "the router has not committed yet");
  session.land();
  assert.equal(restingPlace(session.world), "IDLE at module:operaciones");

  session.forward();
  assert.equal(session.index, 1);
  assert.deepEqual(session.events.at(-1), traverseStarted(INFORMES));
  session.land();
  assert.equal(restingPlace(session.world), "IDLE at module:informes");
  assert.deepEqual(keys(session.entries), before);
  assert.deepEqual(broken, []);
});

test("history · H5 · HARD_NAVIGATE is a document navigation: it ends the instance, assigning or replacing by the flight's history", () => {
  const pushed = scripted(CLINIC, OPS);
  pushed.session.deliver(selectModule("informes"));
  pushed.session.deliver(budgetExpired(1));
  pushed.session.deliver(RETRY);
  assert.ok(pushed.session.ended);
  assert.equal(pushed.session.pending, null, "H1: the document navigation discards the held payload");
  assert.deepEqual(keys(pushed.session.entries), ["module:operaciones", "module:informes"], "assign: one entry");

  const restored = scripted(CLINIC, OPS, "logistica");
  restored.session.deliver(budgetExpired(1));
  restored.session.deliver(RETRY);
  assert.ok(restored.session.ended);
  assert.deepEqual(keys(restored.session.entries), ["module:logistica"], "replace: no entry for a restore");
  assert.deepEqual([...pushed.broken, ...restored.broken], []);
});

test("history · H6 · URL_COMMITTED reaches the machine only when the location differs from the last one handed to it", () => {
  const { session, broken } = scripted(ADMIN, NONE);
  session.deliver(selectModule("admin-clinics"));
  session.land();
  assert.deepEqual(session.events.at(-1), urlCommitted(CLINICS));
  assert.equal(locKey(session.seen), "module:admin-clinics");

  // Back onto the bare entry behind the boundary: its commit is reported once,
  // and ignored in FAILED. The RESET of "Reintentar" hands the same location
  // over and nothing reports it a second time: one normalization, one budget.
  session.fail("render");
  session.back();
  session.land();
  session.reintentar();
  assert.deepEqual(session.events.slice(-4), [
    navFailed("render"),
    traverseStarted(NONE),
    urlCommitted(NONE),
    reset(NONE),
  ]);
  assert.equal(stateKey(session.world.state), "ROUTING#3(module:admin-clinics,restore,replace)");
  assert.deepEqual(session.world.armed, [3]);

  session.land();
  assert.deepEqual(session.events.at(-1), urlCommitted(CLINICS));
  assert.equal(restingPlace(session.world), "IDLE at module:admin-clinics");
  assert.deepEqual(broken, []);
});

test("history · H7 · the boundary mounts with NAV_FAILED and leaves by its button or by a pathname change, with RESET", () => {
  // Clinic: a failure on a full route; Back to /dashboard changes the pathname.
  const clinic = scripted(CLINIC, OPS);
  clinic.session.deliver(openRoute("/dashboard/informes", "informes"));
  clinic.session.land();
  clinic.session.fail("render");
  assert.ok(clinic.session.boundary);
  assert.equal(stateKey(clinic.session.world.state), "FAILED(render)");

  clinic.session.back();
  assert.equal(stateKey(clinic.session.world.state), "FAILED(render)", "the traverse is ignored while FAILED");
  clinic.session.land();
  assert.ok(!clinic.session.boundary, "the pathname changed: Next dropped the boundary");
  assert.deepEqual(clinic.session.events.slice(-2), [urlCommitted(OPS), reset(OPS)]);
  assert.equal(restingPlace(clinic.session.world), "IDLE at module:operaciones");

  // Admin: every location shares /dashboard/admin, so Back does not unmount the
  // boundary. The machine stays FAILED until "Reintentar" reconciles it.
  const admin = scripted(ADMIN, PRICING);
  admin.session.deliver(selectModule("admin-clinics"));
  admin.session.land();
  admin.session.fail("payload");
  admin.session.back();
  admin.session.land();
  assert.ok(admin.session.boundary);
  assert.equal(stateKey(admin.session.world.state), "FAILED(payload)");
  assert.deepEqual(admin.session.events.at(-1), urlCommitted(PRICING), "reported, and ignored in FAILED");
  admin.session.reintentar();
  assert.equal(restingPlace(admin.session.world), "IDLE at module:admin-pricing");
  assert.deepEqual([...clinic.broken, ...admin.broken], []);
});

test("history · C-8 in closed loop · Back + Forward and Back + click on the committed module leave no flight behind", () => {
  for (const second of ["forward", "click"] as const) {
    const { session, broken } = scripted(CLINIC, OPS);
    session.deliver(selectModule("informes"));
    session.land();

    session.back();
    if (second === "forward") session.forward();
    else session.deliver(selectModule("informes"));

    assert.equal(restingPlace(session.world), "IDLE at module:informes", second);
    assert.deepEqual(session.world.armed, [], "no budget left to expire into a spurious STALLED");
    assert.ok(!orphanFlight(session) && !orphanStall(session));
    assert.equal(quiesce(session), null);
    assert.deepEqual(keys(session.entries), ["module:operaciones", "module:informes"]);
    assert.equal(session.index, 1);
    assert.deepEqual(broken, []);
  }
});

test("history · C-1 in closed loop · Back onto a bare Admin entry whose payload outlasts the budget normalizes without adding an entry", () => {
  const { session, broken } = scripted(ADMIN, NONE);
  // The user clicks before the initial normalization lands: the bare entry stays in the history.
  session.deliver(selectModule("admin-clinics"));
  session.land();
  assert.deepEqual(keys(session.entries), ["none", "module:admin-clinics"]);

  session.back();
  session.deliver(budgetExpired(3));
  assert.equal(stateKey(session.world.state), "STALLED#3(none,traverse,replace)");
  session.land();
  assert.equal(stateKey(session.world.state), "ROUTING#4(module:admin-clinics,restore,replace)", "row 14 normalizes");
  session.land();

  assert.equal(restingPlace(session.world), "IDLE at module:admin-clinics");
  assert.deepEqual(keys(session.entries), ["module:admin-clinics", "module:admin-clinics"], "replaced in place");
  assert.equal(quiesce(session), null);
  assert.deepEqual(broken, []);
});

// 4 000 seeded sessions: every action is drawn from what the model allows next.

type History = {
  readonly coverage: Coverage;
  /** Transitions of the closing drain: audited like the rest, outside the hash. */
  readonly settling: Coverage;
  readonly hash: string;
  readonly sessions: number;
  readonly tally: Tally;
  /** C-6: moments where FAILED and the mounted boundary disagree. */
  readonly stranded: readonly (readonly string[])[];
  readonly orphanFlights: number;
  readonly orphanStalls: number;
  readonly adrift: number;
  /** Landings of the closing drain, already counted in `tally`. */
  readonly drained: { readonly appends: number; readonly replaces: number };
  /** First log per kind of orphan, to read a failure. */
  readonly orphans: ReadonlyMap<string, readonly string[]>;
  /** Sessions that do not end at rest, behind the boundary or in a document navigation. */
  readonly unsettled: readonly (readonly string[])[];
  readonly endings: Readonly<Record<"at rest" | "behind the boundary" | "document navigation", number>>;
};

function sessions(seed: number, count: number): History {
  const random = mulberry32(seed);
  const pick = <Item>(items: readonly Item[]): Item => items[Math.floor(random() * items.length)] as Item;
  const digest = digester();
  const coverage = emptyCoverage();
  const settling = emptyCoverage();
  const tally = emptyTally();
  const stranded: string[][] = [];
  const unsettled: string[][] = [];
  const orphans = new Map<string, string[]>();
  const endings = { "at rest": 0, "behind the boundary": 0, "document navigation": 0 };
  const drained = { appends: 0, replaces: 0 };
  let orphanFlights = 0;
  let orphanStalls = 0;
  let drifted = 0;

  for (let id = 0; id < count; id += 1) {
    const config = id % 2 === 0 ? ADMIN : CLINIC;
    const places =
      config.surface === "admin"
        ? [NONE, ...config.modules.map(mod)]
        : [...config.modules.map(mod), HUB, INFORMES_ROUTE, LOGISTICA_ROUTE];
    const start = pick(places);
    const session = openSession(config, start, tally, (from, step, events) => {
      record(coverage, "session history", config, from, step, () => [...events]);
      digest.add(`\n${eventKey(step.event)} => ${resultKey(step.result)}`);
    });
    let flagged = 0;
    digest.add(`\n${id}:${config.surface}`);

    const selection = (): NavEvent => {
      const roll = random();
      if (roll < 0.7) return selectModule(pick([...config.modules, RETIRED]));
      if (roll < 0.82) return SELECT_HUB;
      const [path, module] = pick(ROUTES);
      return openRoute(path, module);
    };

    session.deliver(hydrated(start, pick([null, ...config.modules]), random() < 0.5));

    const steps = 1 + Math.floor(random() * MAX_EVENTS);
    for (let step = 0; step < steps && !session.ended; step += 1) {
      const { boundary } = session;
      const flying = session.world.state;
      const options: [string, number][] = boundary ? [["reintentar", 3]] : [["select", 5], ["fail", 0.3]];
      if (session.pending !== null) options.push(["land", 5]);
      if (!boundary && budgeted(flying)) options.push(["expire", 1.5]);
      if (session.index > 0) options.push(["back", 1.2]);
      if (session.index < session.entries.length - 1) options.push(["forward", 0.8]);
      if (!boundary && flying.tag === "STALLED") options.push(["retry", 1]);

      let roll = random() * options.reduce((total, [, weight]) => total + weight, 0);
      const action = (options.find(([, weight]) => (roll -= weight) < 0) ?? options[0])?.[0];

      if (action === "select") session.deliver(selection());
      else if (action === "land") session.land();
      else if (action === "expire" && "navId" in flying) session.deliver(budgetExpired(flying.navId));
      else if (action === "retry") session.deliver(RETRY);
      else if (action === "back") session.back();
      else if (action === "forward") session.forward();
      else if (action === "fail") session.fail(pick(REASONS));
      else if (action === "reintentar") session.reintentar();

      const { state } = session.world;
      if ((state.tag === "FAILED") !== session.boundary) stranded.push([...session.log]);
      if (adrift(session)) drifted += 1;

      const lost = orphanFlight(session);
      if ((lost || orphanStall(session)) && "navId" in state && state.navId !== flagged) {
        flagged = state.navId;
        if (lost) orphanFlights += 1;
        else orphanStalls += 1;
        const signature = `${state.tag}${state.tag === "ROUTING" && state.afterTraverse ? " afterTraverse" : ""}`;
        if (!orphans.has(signature)) orphans.set(signature, [...session.log]);
      }
    }

    session.observe((from, step, events) => {
      record(settling, "session history", config, from, step, () => [...events]);
    });
    const mark = { appends: tally.appends, replaces: tally.replaces };
    const complaint = quiesce(session);
    drained.appends += tally.appends - mark.appends;
    drained.replaces += tally.replaces - mark.replaces;
    if (complaint !== null) unsettled.push([complaint, ...session.log]);
    endings[session.ended ? "document navigation" : session.boundary ? "behind the boundary" : "at rest"] += 1;
  }

  return {
    coverage,
    settling,
    hash: digest.hex(),
    sessions: count,
    tally,
    stranded,
    orphanFlights,
    orphanStalls,
    adrift: drifted,
    drained,
    orphans,
    unsettled,
    endings,
  };
}

/** "S5V2" in ASCII. Changing it, the model or the machine changes SESSION_HASH. */
const SESSION_SEED = 0x53355632;
const SESSION_COUNT = 4_000;
const SESSION_HASH = "f3b66b570889461e";
/** §13.1: defences against what H1, H3 and H6 exclude; the closed loop cannot reach them. */
const OPEN_LOOP_ONLY: readonly Branch[] = ["#11", "#13", "#23", "#26"];

let historyMemo: History | null = null;

function history(): History {
  historyMemo ??= sessions(SESSION_SEED, SESSION_COUNT);
  return historyMemo;
}

test("history · 4 000 seeded sessions drive the router model in closed loop, reproducibly", (t) => {
  const run = history();
  const { tally } = run;

  assert.equal(run.sessions, SESSION_COUNT);
  assert.ok(run.sessions >= 4_000);
  assert.equal(sessions(SESSION_SEED, SESSION_COUNT).hash, run.hash, "same seed, same session hash");
  assert.notEqual(sessions(SESSION_SEED, 100).hash, sessions(SESSION_SEED + 1, 100).hash, "the hash depends on the seed");
  assert.equal(run.hash, SESSION_HASH, "the sessions are pinned: seed, model and machine");
  assert.ok(tally.appends > 0 && tally.replaces > 0 && tally.traverses > 0 && tally.bursts > 0);

  for (const [name, coverage] of [["sessions", run.coverage], ["closing drain", run.settling]] as const) {
    assert.deepEqual([...coverage.unresolved], [], `${name}: every situation resolves to exactly one row`);
    assert.equal(coverage.strayPersists, 0, `${name}: PERSIST of a module the surface does not have`);
  }

  t.diagnostic(
    `seed 0x${SESSION_SEED.toString(16)}; sessions ${run.sessions}; transitions ${run.coverage.transitions}; hash ${run.hash}`,
  );
  t.diagnostic(
    `user bursts ${tally.bursts}; entries appended ${tally.appends - run.drained.appends} (+${run.drained.appends} in the closing drain); in-place landings ${tally.replaces - run.drained.replaces} (+${run.drained.replaces}); traverses ${tally.traverses}`,
  );
  t.diagnostic(`rows hit: ${ROWS.map((branch) => `${branch}=${run.coverage.branches.get(branch) ?? 0}`).join(" ")}`);
  t.diagnostic(
    `endings: ${Object.entries(run.endings)
      .map(([ending, total]) => `${ending} ${total}`)
      .join("; ")}; closing drain: ${run.settling.transitions} transitions`,
  );
});

test("history · the rows the closed loop cannot reach are exactly the four defences of §13.1", () => {
  const { coverage } = history();
  assert.deepEqual(
    ROWS.filter((branch) => !coverage.branches.has(branch)),
    OPEN_LOOP_ONLY,
  );
});

test("history · S5 · a burst of user selections appends at most one entry", () => {
  const run = history();
  assert.deepEqual(run.tally.overflows[0] ?? [], [], "a burst appended a second entry");
});

test("history · L6 · no flight and no stall is left with nothing pending in the router", (t) => {
  const run = history();
  const first = [...run.orphans].map(([signature, log]) => `${signature}:\n  ${log.join("\n  ")}`).join("\n");

  t.diagnostic(`orphan flights (nothing pending in the router): ${run.orphanFlights}; orphan stalls: ${run.orphanStalls}`);
  assert.equal(run.orphanFlights, 0, `${run.orphanFlights} orphan flights; the first of each kind:\n${first}`);
  assert.equal(run.orphanStalls, 0, `${run.orphanStalls} orphan stalls; the first of each kind:\n${first}`);
});

test("history · C-6 · FAILED lasts exactly as long as the boundary is mounted", () => {
  const run = history();
  assert.ok((run.coverage.branches.get("#20") ?? 0) > 0 && (run.coverage.branches.get("#21") ?? 0) > 0);
  assert.deepEqual(run.stranded[0] ?? [], [], "FAILED and the boundary disagree");
});

test("history · every session ends at rest, behind the boundary or in a document navigation, with no budget unaccounted for", () => {
  const run = history();
  const { endings } = run;

  assert.equal(run.adrift, 0, "the machine lost track of the location the provider last handed to it");
  assert.deepEqual(run.unsettled[0] ?? [], [], "a session does not come to rest once everything pending has landed");
  assert.equal(endings["at rest"] + endings["behind the boundary"] + endings["document navigation"], SESSION_COUNT);
  assert.ok(endings["at rest"] > 0 && endings["behind the boundary"] > 0 && endings["document navigation"] > 0);
});

test("S9 · the effect union carries no native history and no refresh", () => {
  assert.ok(NO_NATIVE_OR_REFRESH_EFFECT);
  assert.deepEqual([...EFFECT_TYPES].sort(), [
    "ARM_BUDGET",
    "CANCEL_BUDGET",
    "HARD_NAVIGATE",
    "PERSIST",
    "PUBLISH_DISPLAY",
    "ROUTER_PUSH",
    "ROUTER_REPLACE",
  ]);
});
