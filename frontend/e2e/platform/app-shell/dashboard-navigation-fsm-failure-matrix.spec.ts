import { expect, test as base, type BrowserContext, type Page } from "@playwright/test";

import { suppressNextDevChrome, waitForLayoutSettled } from "../../helpers/dashboard-geometry-matrix";
import { installRouterPayloadGates, type RouterPayloadGates } from "../../helpers/router-payload-gates";
import { setAdminSession, setClinicSession, type SessionProfile } from "../../helpers/session";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD_NAVIGATION_FSM_FAILURE_MATRIX (PR-NAV-06) — one matrix of router
// payload failures × surfaces × history, over the navigation machine that
// PR-NAV-03, 04 and 05 put behind the admin shell, the clinic shell, the clinic
// hub and the clinic full routes.
//
// Three blocks, all data-driven so the coverage test at the end can count them:
//   1. FAILURES  F1–F7 × S1–S4, each cell on one viewport × Navigation API pair.
//   2. SEQUENCES N1–N10 as named runs of the history model below.
//   3. MODEL     20 runs generated from a fixed seed, replayed in the browser.
//
// The oracle of blocks 2 and 3 is NOT the production machine: it is the history
// model of the roadmap (§13.1, H1–H7) — a stack of entries, an index and the
// stored module — and it only predicts what a person can observe at rest: URL,
// stage, current item, history length and the stored module.
//
// Payloads are held and continued, answered late with a status, or cut short;
// nothing is aborted. The budget (DT-5, 10 000 ms) runs on the page clock.
//
// D-10: a late failure of an abandoned navigation or retry must not displace
// the latest selection. F4 covers an already committed selection; F7 covers a
// selection waiting behind the retry's payload.
// DT-13 and DT-15 remain in their own specs.
// ─────────────────────────────────────────────────────────────────────────────

type Role = "admin" | "clinic";
type Dim = { readonly viewport: "desktop" | "mobile"; readonly navigationApi: boolean };
type SurfaceId = "S1" | "S2" | "S3" | "S4";
type FailureId = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";
type SequenceId = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "N8" | "N9" | "N10";

const DIMS: readonly Dim[] = [
  { viewport: "desktop", navigationApi: true },
  { viewport: "desktop", navigationApi: false },
  { viewport: "mobile", navigationApi: true },
  { viewport: "mobile", navigationApi: false },
];
const SIZE = { desktop: { width: 1366, height: 768 }, mobile: { width: 390, height: 844 } } as const;
const SURFACE_NAME: Record<SurfaceId, string> = {
  S1: "admin shell",
  S2: "clinic shell",
  S3: "clinic hub",
  S4: "clinic full route",
};

/** DT-5: the navigation budget. */
const BUDGET_MS = 10_000;
/** The budget plus a margin for the timer to fire. */
const PAST_THE_BUDGET_MS = BUDGET_MS + 500;
const STORAGE_KEY: Record<Role, string> = {
  admin: "vetneb:dashboard:last-module:admin",
  clinic: "vetneb:dashboard:last-module:clinic",
};
const FULL_ROUTE_CONTROL: Record<string, string> = {
  informes: "Abrir módulo completo de informes",
  logistica: "Abrir módulo completo de logística",
};

function dimLabel(dim: Dim): string {
  return `${SIZE[dim.viewport].width}x${SIZE[dim.viewport].height}, ${dim.navigationApi ? "Navigation API" : "no Navigation API"}`;
}

// ── Locations ────────────────────────────────────────────────────────────────

type Loc =
  | { readonly kind: "module"; readonly role: Role; readonly module: string; readonly url: string }
  | { readonly kind: "route"; readonly role: "clinic"; readonly module: string; readonly url: string }
  | { readonly kind: "hub"; readonly role: "clinic"; readonly url: string };

function moduleLoc(role: Role, moduleId: string): Loc {
  const base = role === "admin" ? "/dashboard/admin" : "/dashboard";
  return { kind: "module", role, module: moduleId, url: `${base}?module=${moduleId}` };
}

function routeLoc(moduleId: string): Loc {
  return { kind: "route", role: "clinic", module: moduleId, url: `/dashboard/${moduleId}` };
}

const HUB_LOC: Loc = { kind: "hub", role: "clinic", url: "/dashboard?hub=1" };

function same(a: Loc, b: Loc): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "hub" || b.kind === "hub") return true;
  return a.module === b.module;
}

function stageOf(loc: Loc): string | null {
  if (loc.kind === "hub") return null;
  return loc.kind === "route" ? `${loc.module}-full` : loc.module;
}

function describeLoc(loc: Loc): string {
  return loc.kind === "hub" ? "hub" : loc.kind === "route" ? `route:${loc.module}` : loc.module;
}

// ── What a person sees ───────────────────────────────────────────────────────

type Ctx = { readonly role: Role; readonly dim: Dim };

function band(page: Page, ctx: Ctx) {
  const selector =
    ctx.dim.viewport === "desktop"
      ? `[data-dashboard-navigation-drawer="${ctx.role}"]`
      : `[data-dashboard-mobile-nav="${ctx.role}"]`;
  return page.locator(selector).filter({ visible: true });
}

function itemAttribute(ctx: Ctx): string {
  return ctx.dim.viewport === "desktop" ? "data-dashboard-navigation-item" : "data-dashboard-mobile-nav-item";
}

function bandItem(page: Page, ctx: Ctx, moduleId: string) {
  return band(page, ctx).locator(`[${itemAttribute(ctx)}="${moduleId}"]`);
}

/** A card of the hub's launcher from 768px up, its tile below. */
function hubLauncher(page: Page, ctx: Ctx, moduleId: string) {
  const attribute = ctx.dim.viewport === "desktop" ? "data-dashboard-module-card" : "data-admin-mobile-hub-tile";
  return page.locator(`[${attribute}="${moduleId}"]`).filter({ visible: true });
}

function fullRouteControl(page: Page, moduleId: string) {
  return page.getByRole("button", { name: FULL_ROUTE_CONTROL[moduleId] }).filter({ visible: true });
}

function stalledNotice(page: Page) {
  return page.locator('[data-dashboard-navigation-stalled="true"]');
}

function errorBoundary(page: Page) {
  return page.locator('[data-route-error-boundary="dashboard"]');
}

/** Stage and current item agree on one location, whatever the URL says. */
async function expectDisplay(page: Page, ctx: Ctx, loc: Loc) {
  const stage = stageOf(loc);
  if (loc.kind === "hub" || stage === null) {
    await expect(page.locator("[data-clinic-dashboard-stage]")).toBeVisible();
    await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(0);
    return;
  }
  await expect(page.locator(`[data-dashboard-module-workspace="${stage}"]`)).toBeVisible();
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
  const current = band(page, ctx).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute(itemAttribute(ctx), loc.module);
}

/** URL, stage and current item agree on one location. */
async function expectView(page: Page, ctx: Ctx, loc: Loc) {
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === loc.url);
  await expectDisplay(page, ctx, loc);
}

function historyLength(page: Page): Promise<number> {
  return page.evaluate(() => window.history.length);
}

function storedModule(page: Page, role: Role): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY[role]);
}

/** Main-frame document requests since the last `take()`. */
function watchDocuments(page: Page) {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document" && request.frame() === page.mainFrame()) {
      const url = new URL(request.url());
      documents.push(`${url.pathname}${url.search}`);
    }
  });
  return { take: () => documents.splice(0) };
}

/** Records, on every DOM mutation from now on, any stage or current item that is not `loc`. */
async function recordDivergenceFrom(page: Page, ctx: Ctx, loc: Loc) {
  const selector =
    ctx.dim.viewport === "desktop"
      ? `[data-dashboard-navigation-drawer="${ctx.role}"]`
      : `[data-dashboard-mobile-nav="${ctx.role}"]`;
  await page.evaluate(
    ({ selector, attribute, stage, moduleId }) => {
      const divergence: string[] = [];
      const record = () => {
        const nav = [...document.querySelectorAll(selector)].find((node) => node.getClientRects().length > 0);
        const current = nav?.querySelector('[aria-current="page"]')?.getAttribute(attribute) ?? "none";
        const shown = [...document.querySelectorAll("[data-dashboard-module-workspace]")]
          .map((node) => node.getAttribute("data-dashboard-module-workspace"))
          .join(",");
        if (current !== moduleId || shown !== stage) divergence.push(`current=${current} stage=${shown}`);
      };
      new MutationObserver(record).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["aria-current", "data-dashboard-module-workspace"],
      });
      (window as Window & { __divergence?: string[] }).__divergence = divergence;
    },
    {
      selector,
      attribute: itemAttribute(ctx),
      stage: stageOf(loc) ?? "",
      moduleId: loc.kind === "hub" ? "none" : loc.module,
    },
  );
  return () =>
    page.evaluate(() => [...new Set((window as Window & { __divergence?: string[] }).__divergence ?? ["unrecorded"])]);
}

// ── Harness ──────────────────────────────────────────────────────────────────

const test = base.extend<{ gates: RouterPayloadGates }>({
  gates: async ({ page }, provide, testInfo) => {
    const gates = await installRouterPayloadGates(page);
    await provide(gates);
    const leftover = await gates.dispose();
    if (testInfo.status === testInfo.expectedStatus) {
      expect(leftover, "a router payload was still held when the scenario ended").toEqual([]);
    }
  },
});

/** One hydrated document at `entry`, at rest, with the page clock installed. */
async function open(page: Page, ctx: Ctx, entry: Loc, profile: SessionProfile = "populated") {
  await page.setViewportSize(SIZE[ctx.dim.viewport]);
  if (!ctx.dim.navigationApi) {
    await page.addInitScript(() => {
      Object.defineProperty(window, "navigation", { value: undefined, configurable: true });
    });
  }
  await suppressNextDevChrome(page);
  if (ctx.role === "admin") await setAdminSession(page, profile);
  else await setClinicSession(page, profile);
  await page.clock.install();
  await page.goto(entry.url);
  await expectView(page, ctx, entry);
  await atRest(page);
  expect(
    await page.evaluate(() => (window as Window & { navigation?: unknown }).navigation !== undefined),
    "the Navigation API is what this cell says it is",
  ).toBe(ctx.dim.navigationApi);
}

/** The document is hydrated and its own traffic is over. */
async function atRest(page: Page) {
  await page.locator("[data-public-route-control-hydrated]").first().waitFor({ state: "attached" });
  await page.waitForLoadState("networkidle");
}

// ── Block 1: failures × surfaces ─────────────────────────────────────────────

type Journey = {
  readonly role: Role;
  readonly origin: Loc;
  readonly dest: Loc;
  /** Key of the destination's router payload (helpers/router-payload-gates). */
  readonly destKey: string;
  /** A module to choose afterwards, with a real control of the band. */
  readonly other: string;
  /** While the payload is pending the stage shows the destination, or the origin with a busy control. */
  readonly pending: "destination" | "busy-control";
  readonly act: (page: Page, ctx: Ctx) => Promise<void>;
};

const JOURNEYS = {
  S1: {
    role: "admin",
    origin: moduleLoc("admin", "admin-clinics"),
    dest: moduleLoc("admin", "admin-sessions"),
    destKey: "admin-sessions",
    other: "audit-log",
    pending: "destination",
    act: (page, ctx) => bandItem(page, ctx, "admin-sessions").click(),
  },
  S2: {
    role: "clinic",
    origin: moduleLoc("clinic", "informes"),
    dest: moduleLoc("clinic", "tokens"),
    destKey: "tokens",
    other: "perfil",
    pending: "destination",
    act: (page, ctx) => bandItem(page, ctx, "tokens").click(),
  },
  S3: {
    role: "clinic",
    origin: HUB_LOC,
    dest: moduleLoc("clinic", "tokens"),
    destKey: "tokens",
    other: "perfil",
    pending: "destination",
    act: (page, ctx) => hubLauncher(page, ctx, "tokens").click(),
  },
  /** N10: the shell opens a full route (OPEN_ROUTE). */
  "S4 shell→route": {
    role: "clinic",
    origin: moduleLoc("clinic", "informes"),
    dest: routeLoc("informes"),
    destKey: "/dashboard/informes",
    other: "tokens",
    pending: "busy-control",
    act: (page) => fullRouteControl(page, "informes").click(),
  },
  /** N9: the band of a full route selects a module of the shell. */
  "S4 route→shell": {
    role: "clinic",
    origin: routeLoc("logistica"),
    dest: moduleLoc("clinic", "tokens"),
    destKey: "tokens",
    other: "perfil",
    pending: "destination",
    act: (page, ctx) => bandItem(page, ctx, "tokens").click(),
  },
} as const satisfies Record<string, Journey>;

type JourneyId = keyof typeof JOURNEYS;

type FailureCell = {
  readonly failure: FailureId;
  readonly surface: SurfaceId;
  readonly journey: JourneyId;
  readonly dim: Dim;
  readonly variant?: string;
  readonly contract?: "D10_LATE_FAILURE";
};

const GRID_FAILURES = ["F1", "F2", "F3", "F4", "F5"] as const;
const GRID_SURFACES = ["S1", "S2", "S3", "S4"] as const;
/** Which direction of S4 a failure takes: both appear, and each failure meets the route once. */
const S4_JOURNEY: Record<(typeof GRID_FAILURES)[number], JourneyId> = {
  F1: "S4 route→shell",
  F2: "S4 shell→route",
  F3: "S4 shell→route",
  F4: "S4 route→shell",
  F5: "S4 shell→route",
};

/**
 * F1–F5 on every surface. The viewport × Navigation API pair rotates with the
 * cell, so every failure and every surface meets the four pairs without a
 * cartesian product.
 */
const FAILURE_GRID: readonly FailureCell[] = GRID_FAILURES.flatMap((failure, f) =>
  GRID_SURFACES.map(
    (surface, s): FailureCell => ({
      failure,
      surface,
      journey: surface === "S4" ? S4_JOURNEY[failure] : surface,
      dim: DIMS[(f + s) % DIMS.length],
    }),
  ),
);

/** Cells whose mechanism is the product's same-URL retry, plus the D-10 variants of F4. */
const FAILURE_EXTRA: readonly FailureCell[] = [
  { failure: "F4", surface: "S1", journey: "S1", dim: DIMS[1], variant: "after a later selection landed", contract: "D10_LATE_FAILURE" },
  { failure: "F4", surface: "S2", journey: "S2", dim: DIMS[2], variant: "after a later selection landed", contract: "D10_LATE_FAILURE" },
  { failure: "F6", surface: "S2", journey: "S2", dim: DIMS[0] },
  { failure: "F6", surface: "S2", journey: "S2", dim: DIMS[3] },
  { failure: "F6", surface: "S4", journey: "S4 shell→route", dim: DIMS[1] },
  { failure: "F7", surface: "S2", journey: "S2", dim: DIMS[1], contract: "D10_LATE_FAILURE" },
  { failure: "F7", surface: "S2", journey: "S2", dim: DIMS[2], contract: "D10_LATE_FAILURE" },
];

const FAILURE_NOT_APPLICABLE: readonly { failure: FailureId; surface: SurfaceId; reason: string }[] = [
  { failure: "F6", surface: "S1", reason: "no DashboardRefreshButton exists on the admin dashboard; the machine never issues a retry (DT-2). The admin H-08 contract with the router's own instance stays in dashboard-navigation-fsm-admin" },
  { failure: "F6", surface: "S3", reason: "the hub renders no DashboardRefreshButton: its load errors belong to the module summaries" },
  { failure: "F7", surface: "S1", reason: "same as F6 × S1: no DashboardRefreshButton on the admin dashboard" },
  { failure: "F7", surface: "S3", reason: "same as F6 × S3: no product emitter of router.refresh() on the hub" },
  { failure: "F7", surface: "S4", reason: "a full route renders no DashboardRefreshButton; the late failure of the shell's retry is covered by F7 × S2" },
];

type Run = { readonly page: Page; readonly context: BrowserContext; readonly gates: RouterPayloadGates };

async function expectPending(page: Page, ctx: Ctx, journey: Journey) {
  if (journey.pending === "destination") {
    await expectDisplay(page, ctx, journey.dest);
  } else {
    await expectDisplay(page, ctx, journey.origin);
    await expect(fullRouteControl(page, journey.dest.kind === "hub" ? "" : journey.dest.module)).toHaveAttribute(
      "aria-busy",
      "true",
    );
  }
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === journey.origin.url);
}

/** The document is operative: a module chosen on the band lands by client navigation. */
async function expectOperative(page: Page, ctx: Ctx, moduleId: string, documents: { take(): string[] }) {
  await atRest(page);
  documents.take();
  await bandItem(page, ctx, moduleId).click();
  await expectView(page, ctx, moduleLoc(ctx.role, moduleId));
  await expect(stalledNotice(page)).toHaveCount(0);
  await expect(errorBoundary(page)).toHaveCount(0);
  expect(documents.take(), "the next choice is a client navigation").toEqual([]);
}

const FAILURE_RUNNERS: Record<FailureId, (run: Run, ctx: Ctx, journey: Journey, cell: FailureCell) => Promise<void>> = {
  // F1 — the payload is held past the budget: ROUTING, then STALLED (#12), a
  // later choice navigates (#16) and the abandoned payload's late answer is
  // neither painted nor written to history (#11).
  async F1({ page, gates }, ctx, journey) {
    const documents = watchDocuments(page);
    await open(page, ctx, journey.origin);
    const length = await historyLength(page);
    documents.take();

    // The clock is paused from before the click, so the budget is measured on
    // both sides and not merely outwaited: nothing at 9 900 ms, STALLED by 10 100.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    gates.hold();
    await journey.act(page, ctx);
    await expectPending(page, ctx, journey);
    expect(gates.requested()).toEqual([journey.destKey]);
    expect(gates.held(), "the gate holds the destination's payload").toEqual([journey.destKey]);

    await page.clock.runFor(BUDGET_MS - 100);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expectPending(page, ctx, journey);
    await page.clock.runFor(200);
    const notice = stalledNotice(page);
    await expect(notice).toBeVisible();
    await page.clock.resume();
    await expect(notice).toHaveAttribute("role", "status");
    await expect(notice.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expectPending(page, ctx, journey);
    expect(gates.requested(), "the budget re-issues nothing by itself").toEqual([journey.destKey]);
    expect(gates.held(), "the payload is still unanswered when the notice shows").toEqual([journey.destKey]);

    const other = moduleLoc(ctx.role, journey.other);
    await bandItem(page, ctx, journey.other).click();
    await expectDisplay(page, ctx, other);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect.poll(() => gates.requested()).toEqual([journey.destKey, journey.other]);
    expect(await gates.releaseOnly(journey.other)).toBe(1);
    await expectView(page, ctx, other);
    await expect.poll(() => storedModule(page, ctx.role)).toBe(journey.other);
    expect(await historyLength(page), "one entry for the choice that landed").toBe(length + 1);

    const divergence = await recordDivergenceFrom(page, ctx, other);
    await gates.release();
    await waitForLayoutSettled(page);
    await expectView(page, ctx, other);
    expect(await divergence(), "the abandoned payload's late answer repainted").toEqual([]);
    expect(await historyLength(page), "the abandoned payload's late answer wrote history").toBe(length + 1);
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(documents.take(), "client navigation, never a reload").toEqual([]);
    expect(gates.injected(), "nothing was fabricated: the payload was only late").toEqual([]);
  },

  // F2 — the real 200 payload is cut short: the boundary mounts (NAV_FAILED,
  // #20), no budget is left behind, and Reintentar (RESET, #21) recovers.
  async F2({ page, gates }, ctx, journey) {
    const documents = watchDocuments(page);
    await open(page, ctx, journey.origin);
    documents.take();

    gates.record();
    gates.cutNext(journey.destKey, 0.5);
    await journey.act(page, ctx);
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });
    await expect(errorBoundary(page)).toHaveAttribute("role", "alert");
    await expect(page.locator("[data-route-error-boundary]")).toHaveCount(1);
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === journey.dest.url);
    const cuts = gates.injected();
    expect(cuts.length, "the destination's payload was answered truncated").toBeGreaterThan(0);
    for (const cut of cuts) {
      expect(cut.kind === "cut" && cut.key === journey.destKey && cut.sentBytes > 0 && cut.sentBytes < cut.realBytes).toBe(
        true,
      );
    }

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(errorBoundary(page)).toBeVisible();
    await expect(stalledNotice(page)).toHaveCount(0);

    gates.clearFailures();
    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expectView(page, ctx, journey.dest);
    expect(documents.take(), "recovery is retry(), never a reload").toEqual([]);

    await bandItem(page, ctx, journey.other).click();
    await expectView(page, ctx, moduleLoc(ctx.role, journey.other));
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(documents.take(), "client navigation, never a reload").toEqual([]);
  },

  // F3 — the payload answers 500 at once. The router does not mount a boundary:
  // it gives the navigation up to the browser, one document request for the
  // destination, which is the allowed MPA exit of S6.
  async F3({ page, gates }, ctx, journey) {
    const documents = watchDocuments(page);
    await open(page, ctx, journey.origin);
    const length = await historyLength(page);
    documents.take();

    gates.record();
    gates.failNext(journey.destKey, 500);
    const loaded = page.waitForEvent("load");
    await journey.act(page, ctx);
    await loaded;
    await expectView(page, ctx, journey.dest);
    expect(documents.take(), "one document request, for the destination").toEqual([journey.dest.url]);
    expect(gates.requested()).toEqual([journey.destKey]);
    expect(gates.injected()).toEqual([{ kind: "status", key: journey.destKey, status: 500, late: false }]);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(errorBoundary(page)).toHaveCount(0);
    expect(await historyLength(page), "the document navigation is the entry of the choice").toBe(length + 1);
    if (journey.dest.kind !== "hub") {
      await expect.poll(() => storedModule(page, ctx.role)).toBe(journey.dest.module);
    }

    // Back crosses the document the failure produced and the origin still works.
    gates.clearFailures();
    await page.goBack();
    await expectView(page, ctx, journey.origin);
    await atRest(page);
    documents.take();
    await journey.act(page, ctx);
    await expectView(page, ctx, journey.dest);
    expect(documents.take(), "with the server healthy the same choice is a client navigation").toEqual([]);
  },

  // F4 — the payload is held past the budget (STALLED) and then answers 524.
  // Alone, the late failure is a document navigation to the destination the
  // person is still waiting for. After a later selection landed it is D-10.
  async F4({ page, gates }, ctx, journey, cell) {
    const documents = watchDocuments(page);
    await open(page, ctx, journey.origin);
    const length = await historyLength(page);
    documents.take();

    gates.hold();
    await journey.act(page, ctx);
    await expectPending(page, ctx, journey);
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toBeVisible();
    expect(gates.held(), "the payload is still unanswered when the notice shows").toEqual([journey.destKey]);

    if (cell.variant === undefined) {
      const loaded = page.waitForEvent("load");
      expect(await gates.failHeld(journey.destKey, 524)).toBe(1);
      await loaded;
      await expectView(page, ctx, journey.dest);
      expect(documents.take(), "one document request, for the stalled destination").toEqual([journey.dest.url]);
      expect(gates.injected()).toEqual([{ kind: "status", key: journey.destKey, status: 524, late: true }]);
      await expect(stalledNotice(page)).toHaveCount(0);
      await expect(errorBoundary(page)).toHaveCount(0);
      expect(await historyLength(page)).toBe(length + 1);
      await gates.release();
      await expectOperative(page, ctx, journey.other, documents);
      return;
    }

    // The first flight is abandoned by a real selection (#16) that is issued,
    // answered and committed: URL, stage, current item, history and the stored
    // module all say `other` before the late failure arrives.
    const other = moduleLoc(ctx.role, journey.other);
    await bandItem(page, ctx, journey.other).click();
    await expect.poll(() => gates.requested(), "the second selection was issued").toEqual([journey.destKey, journey.other]);
    expect(gates.held(), "and the first flight is still unanswered").toEqual([journey.destKey, journey.other]);
    expect(await gates.releaseOnly(journey.other)).toBe(1);
    await expectView(page, ctx, other);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect.poll(() => storedModule(page, ctx.role)).toBe(journey.other);
    expect(await historyLength(page), "the later selection wrote its entry").toBe(length + 1);
    expect(documents.take(), "the later selection landed by client navigation").toEqual([]);
    expect(gates.held(), "only the abandoned flight is left").toEqual([journey.destKey]);

    // The abandoned 524 cannot displace the selection that already committed.
    const divergence = await recordDivergenceFrom(page, ctx, other);
    expect(await gates.failHeld(journey.destKey, 524)).toBe(1);
    await page.waitForLoadState("networkidle");
    await waitForLayoutSettled(page);
    expect(gates.injected()).toEqual([{ kind: "status", key: journey.destKey, status: 524, late: true }]);
    await expectView(page, ctx, other);
    expect(await divergence(), "the late failure repainted the abandoned selection").toEqual([]);
    expect(await storedModule(page, ctx.role)).toBe(journey.other);
    expect(await historyLength(page), "the late failure added no entry").toBe(length + 1);
    expect(documents.take(), "the late failure caused no document navigation").toEqual([]);
    expect(gates.requested(), "the late failure requested no new payload").toEqual([journey.destKey, journey.other]);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(errorBoundary(page)).toHaveCount(0);
    await gates.release();
    await page.goBack();
    await expectView(page, ctx, journey.origin);
    await page.goForward();
    await expectView(page, ctx, other);
    await expectOperative(page, ctx, journey.destKey, documents);
  },

  // F5 (H-06) — the network goes away while the payload is in flight. Next does
  // not wait for connectivity: the fetch rejects, the router gives the
  // navigation up to the browser and the browser shows its own error page.
  // Back online, loading that entry again recovers the destination.
  async F5({ page, context, gates }, ctx, journey) {
    const failed: string[] = [];
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      failed.push(`${request.resourceType()} ${url.pathname}${url.searchParams.has("_rsc") ? " rsc" : ""} ${request.failure()?.errorText}`);
    });
    await open(page, ctx, journey.origin);

    gates.hold();
    await journey.act(page, ctx);
    await expectPending(page, ctx, journey);
    await expect.poll(() => gates.held()).toEqual([journey.destKey]);

    await context.setOffline(true);
    try {
      expect(await gates.releaseOnly(journey.destKey)).toBe(1);
      await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/^chrome-error:/);
    } finally {
      await context.setOffline(false);
    }
    const destPath = new URL(journey.dest.url, "http://app").pathname;
    expect(failed, "the payload failed for lack of network").toContain(
      `fetch ${destPath} rsc net::ERR_INTERNET_DISCONNECTED`,
    );
    expect(failed, "and so did the document navigation Next fell back to").toContain(
      `document ${destPath} net::ERR_INTERNET_DISCONNECTED`,
    );
    expect(gates.injected(), "nothing was fabricated: the browser failed the request").toEqual([]);

    await gates.release();
    await page.reload();
    await expectView(page, ctx, journey.dest);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(errorBoundary(page)).toHaveCount(0);
    await expectOperative(page, ctx, journey.other, watchDocuments(page));
  },

  // F6 (H-08) — a same-URL retry of the product is held before its headers
  // and a navigation is chosen behind it: one refresh payload, one navigation
  // payload, URL and stage never disagree at rest, STALLED within the budget
  // and convergence once the refresh answers.
  async F6({ page, gates }, ctx, journey) {
    const documents = watchDocuments(page);
    await open(page, ctx, journey.origin, "default");
    const length = await historyLength(page);
    documents.take();
    const originKey = journey.origin.kind === "hub" ? "" : journey.origin.module;

    gates.hold();
    await productRefresh(page).click();
    await expect.poll(() => gates.requested()).toEqual([originKey]);
    expect(gates.held(), "the refresh is held before any header").toEqual([originKey]);

    await journey.act(page, ctx);
    await expectPending(page, ctx, journey);
    await expect.poll(() => gates.requested(), "one navigation behind the refresh, and nothing else").toEqual([
      originKey,
      journey.destKey,
    ]);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toBeVisible();
    await expectPending(page, ctx, journey);
    expect(gates.requested(), "the budget re-issues nothing by itself").toEqual([originKey, journey.destKey]);

    await gates.release();
    await expectView(page, ctx, journey.dest);
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(await historyLength(page), "the refresh adds no entry; the navigation adds one").toBe(length + 1);
    expect(gates.requested()).toEqual([originKey, journey.destKey]);
    expect(documents.take(), "client navigation, never a reload").toEqual([]);
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
  },

  // F7 — a held same-URL retry fails after a selection. Unlike F4, that
  // selection is on stage but cannot commit until its own payload answers.
  async F7({ page, gates }, ctx, journey) {
    const documents = watchDocuments(page);
    await open(page, ctx, journey.origin, "default");
    const length = await historyLength(page);
    documents.take();
    const originKey = journey.origin.kind === "hub" ? "" : journey.origin.module;

    gates.hold();
    await productRefresh(page).click();
    await expect.poll(() => gates.requested(), "the refresh was issued").toEqual([originKey]);
    await journey.act(page, ctx);
    await expectPending(page, ctx, journey);
    await expect.poll(() => gates.requested(), "the selection was issued behind it").toEqual([originKey, journey.destKey]);
    expect(gates.held(), "and neither has an answer").toEqual([originKey, journey.destKey]);
    expect(await historyLength(page), "the selection is on stage and not in history").toBe(length);

    const desired = `the latest selection (${journey.destKey}) remains authoritative`;
    const divergence = await recordDivergenceFrom(page, ctx, journey.dest);
    expect(await gates.failHeld(originKey, 500)).toBe(1);
    await waitForLayoutSettled(page);
    expect(gates.injected()).toEqual([{ kind: "status", key: originKey, status: 500, late: true }]);
    expect(documents.take(), "the failed refresh does not reload the document").toEqual([]);
    await expectDisplay(page, ctx, journey.dest);
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === journey.origin.url);
    expect(await storedModule(page, ctx.role), "the selection has not committed before its payload").toBe(originKey);
    expect(await historyLength(page), "the selection has no entry before its payload").toBe(length);
    expect(gates.held(), "the selected module's payload remains pending").toEqual([journey.destKey]);
    expect(await gates.releaseOnly(journey.destKey)).toBe(1);
    await expectView(page, ctx, journey.dest);
    await expect.poll(() => storedModule(page, ctx.role)).toBe(journey.destKey);
    expect(await historyLength(page), desired).toBe(length + 1);
    expect(await divergence(), "the failed retry repainted the abandoned module").toEqual([]);
    expect(gates.requested(), "the failure requested no extra payload").toEqual([originKey, journey.destKey]);
    expect(documents.take(), "selection commits without a document navigation").toEqual([]);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(errorBoundary(page)).toHaveCount(0);
    await gates.release();
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expectView(page, ctx, journey.dest);
    await expectOperative(page, ctx, journey.other, documents);
  },
};

/** `DashboardRefreshButton`: the product's same-URL retry, shown by a load error. */
function productRefresh(page: Page) {
  return page.getByRole("alert").getByRole("button", { name: "Reintentar", exact: true }).filter({ visible: true });
}

const FAILURE_TITLE: Record<FailureId, string> = {
  F1: "a payload held past the budget stalls, a later choice navigates and the late answer changes nothing",
  F2: "a truncated payload mounts the boundary and Reintentar recovers without a reload",
  F3: "a 500 is one document navigation to the destination, and the origin still navigates",
  F4: "a 524 after the budget is one document navigation to the stalled destination",
  F5: "going offline in flight ends on the browser's error page and recovers once back online",
  F6: "a selection behind the product's held retry stalls and converges with one payload each",
  F7: "a failed same-URL retry leaves the later selection authoritative and it commits on its payload",
};

test.describe("DASHBOARD_NAVIGATION_FSM_FAILURE_MATRIX · failures", () => {
  for (const cell of [...FAILURE_GRID, ...FAILURE_EXTRA]) {
    const journey: Journey = JOURNEYS[cell.journey];
    const title =
      cell.variant === undefined
        ? FAILURE_TITLE[cell.failure]
        : `a 524 ${cell.variant} leaves the committed selection authoritative`;
    const contract = cell.contract === undefined ? "" : `${cell.contract} · `;
    test(`${contract}${cell.failure} × ${cell.surface} ${SURFACE_NAME[cell.surface]} [${cell.journey}] (${dimLabel(cell.dim)}): ${title}`, async ({
      page,
      context,
      gates,
    }) => {
      const runtimeErrors: string[] = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      await FAILURE_RUNNERS[cell.failure]({ page, context, gates }, { role: journey.role, dim: cell.dim }, journey, cell);
      expect(gates.held(), "no payload is left held").toEqual([]);
      // A truncated payload is the one failure that reaches the page as an error.
      if (cell.failure !== "F2") expect(runtimeErrors).toEqual([]);
    });
  }

  test("the same-URL retry refetches server data without adding history or reloading", async ({ page, gates }) => {
    const ctx: Ctx = { role: "clinic", dim: DIMS[0] };
    const location = moduleLoc("clinic", "informes");
    const documents = watchDocuments(page);
    await open(page, ctx, location, "default");
    const length = await historyLength(page);
    await expect(productRefresh(page)).toBeVisible();
    documents.take();

    await setClinicSession(page, "populated");
    gates.record();
    await productRefresh(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar los informes recientes" })).toHaveCount(0);
    await expect(page.locator('[data-clinic-reports-list-panel="true"]')).toBeVisible();
    await expectView(page, ctx, location);
    expect(gates.requested(), "one same-URL server payload refetched the data").toEqual(["informes"]);
    expect(await historyLength(page), "retry did not add an entry").toBe(length);
    expect(documents.take(), "retry stayed in the client router").toEqual([]);
  });
});

// ── The history model: the independent oracle of blocks 2 and 3 ──────────────

type Action =
  | { readonly type: "select"; readonly module: string }
  | { readonly type: "launcher"; readonly module: string }
  | { readonly type: "burst"; readonly modules: readonly string[] }
  | { readonly type: "return"; readonly via: string }
  | { readonly type: "slow"; readonly module: string }
  | { readonly type: "openRoute" }
  | { readonly type: "backInFlight"; readonly module: string }
  | { readonly type: "back" }
  | { readonly type: "forward" }
  | { readonly type: "reload" };

type Model = {
  readonly stack: readonly Loc[];
  readonly index: number;
  /** Module the next bare entry would restore. */
  readonly stored: string | null;
  /** A reload happened: older entries now belong to another document. */
  readonly reloaded: boolean;
};

const ROUTE_MODULES = ["informes", "logistica"];

function startModel(entry: Loc): Model {
  return { stack: [entry], index: 0, stored: entry.kind === "hub" ? null : entry.module, reloaded: false };
}

function push(model: Model, loc: Loc): Model {
  return {
    ...model,
    stack: [...model.stack.slice(0, model.index + 1), loc],
    index: model.index + 1,
    stored: loc.kind === "hub" ? model.stored : loc.module,
  };
}

function travel(model: Model, index: number): Model {
  const loc = model.stack[index];
  return { ...model, index, stored: loc.kind === "hub" ? model.stored : loc.module };
}

/**
 * The roadmap's history model (§13.1), with the observable outcome of each
 * action and nothing of the machine's states. It throws on an action the
 * surface cannot perform, so it is also the validity rule of the generator.
 *
 * - H2: a choice that lands adds one entry after the current one and drops the
 *   ones ahead; a burst of choices made before any payload answers adds one
 *   entry, for the last choice (rows #29, #30).
 * - DT-16: returning to the committed module with another in flight adds none.
 * - H4: Back and Forward move the index and add or drop nothing; a Back taken
 *   over a choice in flight wins and that choice never reaches history.
 * - A payload that is only late changes nothing but the time it takes.
 */
function apply(model: Model, action: Action, role: Role): Model {
  const current = model.stack[model.index];
  const target = (moduleId: string) => moduleLoc(role, moduleId);
  const reject = (why: string): never => {
    throw new Error(`invalid ${action.type} at ${describeLoc(current)}: ${why}`);
  };
  switch (action.type) {
    case "select":
    case "slow":
      if (same(target(action.module), current)) reject("the module is the committed one");
      return push(model, target(action.module));
    case "launcher":
      if (current.kind !== "hub") reject("the launcher only exists on the hub");
      return push(model, target(action.module));
    case "burst": {
      if (action.modules.length < 2) reject("a burst is two choices or more");
      action.modules.forEach((moduleId, i) => {
        if (same(target(moduleId), current)) reject("a burst never passes through the committed module");
        if (i > 0 && moduleId === action.modules[i - 1]) reject("consecutive choices differ");
      });
      return push(model, target(action.modules[action.modules.length - 1]));
    }
    case "return":
      if (current.kind !== "module") reject("only a module can be returned to from the band");
      if (same(target(action.via), current)) reject("the detour is another module");
      return model;
    case "openRoute":
      if (role !== "clinic" || current.kind !== "module" || !ROUTE_MODULES.includes(current.module)) {
        reject("no full-route control here");
      }
      return push(model, routeLoc((current as { module: string }).module));
    case "backInFlight":
      if (model.index === 0) reject("nothing behind");
      if (model.reloaded) reject("the entry behind belongs to another document");
      if (same(target(action.module), current) || same(target(action.module), model.stack[model.index - 1])) {
        reject("the choice in flight is neither the committed module nor the one behind");
      }
      return travel(model, model.index - 1);
    case "back":
      if (model.index === 0) reject("nothing behind");
      return travel(model, model.index - 1);
    case "forward":
      if (model.index === model.stack.length - 1) reject("nothing ahead");
      return travel(model, model.index + 1);
    case "reload":
      return { ...model, reloaded: true };
  }
}

function describeAction(action: Action): string {
  switch (action.type) {
    case "select":
    case "slow":
    case "launcher":
    case "backInFlight":
      return `${action.type}(${action.module})`;
    case "burst":
      return `burst(${action.modules.join(",")})`;
    case "return":
      return `return(via ${action.via})`;
    default:
      return action.type;
  }
}

/** Replays `actions` in the browser and compares every rest state with the model. */
async function replay(run: Run, ctx: Ctx, entry: Loc, actions: readonly Action[]) {
  const { page, gates } = run;
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const documents = watchDocuments(page);
  await open(page, ctx, entry);
  const baseLength = await historyLength(page);
  let model = startModel(entry);

  const expectRest = async (label: string) => {
    const loc = model.stack[model.index];
    await expectView(page, ctx, loc);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(errorBoundary(page)).toHaveCount(0);
    expect(await historyLength(page), `history length after ${label}`).toBe(baseLength + model.stack.length - 1);
    await expect.poll(() => storedModule(page, ctx.role), { message: `stored module after ${label}` }).toBe(model.stored);
    expect(gates.held(), `payloads held after ${label}`).toEqual([]);
  };
  const choose = (moduleId: string) => bandItem(page, ctx, moduleId).click();
  const target = (moduleId: string) => moduleLoc(ctx.role, moduleId);
  await expectRest("the entry");

  for (const [i, action] of actions.entries()) {
    const label = `step ${i + 1} ${describeAction(action)}`;
    await test.step(label, async () => {
      const before = model.stack[model.index];
      const next = apply(model, action, ctx.role);
      // Choices are client navigations (S6); a reload is a document, and so is
      // a traversal onto an entry that an earlier reload left in another one.
      const clientOnly = !["reload", "back", "forward"].includes(action.type);
      documents.take();

      switch (action.type) {
        case "select":
          await choose(action.module);
          break;
        case "launcher":
          await hubLauncher(page, ctx, action.module).click();
          break;
        case "openRoute":
          await fullRouteControl(page, before.kind === "hub" ? "" : before.module).click();
          break;
        case "burst":
          gates.hold();
          for (const moduleId of action.modules) await choose(moduleId);
          await expectDisplay(page, ctx, target(action.modules[action.modules.length - 1]));
          await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === before.url);
          await gates.release();
          break;
        case "return":
          gates.hold();
          await choose(action.via);
          await expectDisplay(page, ctx, target(action.via));
          await choose((before as { module: string }).module);
          await expectDisplay(page, ctx, before);
          await gates.release();
          await waitForLayoutSettled(page);
          break;
        case "slow":
          gates.hold();
          await choose(action.module);
          await expectDisplay(page, ctx, target(action.module));
          await page.clock.fastForward(PAST_THE_BUDGET_MS);
          await expect(stalledNotice(page)).toBeVisible();
          await gates.release();
          break;
        case "backInFlight":
          gates.hold();
          await choose(action.module);
          await expectDisplay(page, ctx, target(action.module));
          await page.goBack();
          await expectView(page, ctx, next.stack[next.index]);
          await gates.release();
          await waitForLayoutSettled(page);
          break;
        case "back":
          await page.goBack();
          break;
        case "forward":
          await page.goForward();
          break;
        case "reload":
          await page.reload();
          break;
      }

      model = next;
      await expectRest(label);
      if (clientOnly) expect(documents.take(), `${label} is a client navigation`).toEqual([]);
      else if (model.reloaded) await atRest(page);
    });
  }

  // Nothing is left running: no budget of any step fires later.
  await page.clock.fastForward(PAST_THE_BUDGET_MS);
  await expectRest("the whole sequence, past the budget");
  expect(runtimeErrors).toEqual([]);
}

// ── Block 2: the normative sequences N1–N10 ──────────────────────────────────

type SequenceCell = {
  readonly covers: readonly SequenceId[];
  readonly surface: SurfaceId;
  readonly role: Role;
  readonly dim: Dim;
  readonly entry: Loc;
  readonly actions: readonly Action[];
};

const select = (moduleId: string): Action => ({ type: "select", module: moduleId });
const BACK: Action = { type: "back" };
const FORWARD: Action = { type: "forward" };
const RELOAD: Action = { type: "reload" };

const SEQUENCE_CELLS: readonly SequenceCell[] = [
  {
    covers: ["N1", "N2", "N5", "N6"],
    surface: "S1",
    role: "admin",
    dim: DIMS[1],
    entry: moduleLoc("admin", "admin-clinics"),
    actions: [select("admin-sessions"), select("admin-clinics"), BACK, FORWARD, RELOAD, BACK],
  },
  {
    covers: ["N1", "N2", "N5", "N6"],
    surface: "S2",
    role: "clinic",
    dim: DIMS[2],
    entry: moduleLoc("clinic", "informes"),
    actions: [select("tokens"), select("informes"), BACK, FORWARD, RELOAD, BACK],
  },
  {
    covers: ["N3", "N4", "N5"],
    surface: "S1",
    role: "admin",
    dim: DIMS[2],
    entry: moduleLoc("admin", "admin-clinics"),
    actions: [
      { type: "burst", modules: ["audit-log", "admin-sessions"] },
      { type: "backInFlight", module: "audit-log" },
      FORWARD,
    ],
  },
  {
    covers: ["N2", "N3", "N4", "N5"],
    surface: "S2",
    role: "clinic",
    dim: DIMS[1],
    entry: moduleLoc("clinic", "informes"),
    actions: [
      { type: "burst", modules: ["tokens", "logistica", "perfil"] },
      { type: "backInFlight", module: "tokens" },
      FORWARD,
      { type: "return", via: "logistica" },
    ],
  },
  {
    covers: ["N7", "N3", "N5"],
    surface: "S3",
    role: "clinic",
    dim: DIMS[0],
    entry: HUB_LOC,
    actions: [{ type: "launcher", module: "informes" }, BACK, { type: "burst", modules: ["tokens", "perfil"] }, BACK, FORWARD],
  },
  {
    covers: ["N7", "N4", "N6"],
    surface: "S3",
    role: "clinic",
    dim: DIMS[3],
    entry: HUB_LOC,
    actions: [{ type: "launcher", module: "logistica" }, { type: "backInFlight", module: "tokens" }, FORWARD, RELOAD],
  },
  {
    covers: ["N10", "N9", "N5", "N4"],
    surface: "S4",
    role: "clinic",
    dim: DIMS[0],
    entry: moduleLoc("clinic", "informes"),
    actions: [{ type: "openRoute" }, select("tokens"), BACK, BACK, FORWARD, { type: "backInFlight", module: "perfil" }],
  },
  {
    covers: ["N9", "N10", "N3", "N6"],
    surface: "S4",
    role: "clinic",
    dim: DIMS[3],
    entry: routeLoc("logistica"),
    actions: [
      { type: "burst", modules: ["tokens", "informes"] },
      { type: "openRoute" },
      { type: "slow", module: "perfil" },
      RELOAD,
    ],
  },
];

/** N8 does not go through the model: it starts before the first rest state. */
const RESTORE_CELLS: readonly { surface: SurfaceId; role: Role; dim: Dim; stored: string }[] = [
  { surface: "S1", role: "admin", dim: DIMS[3], stored: "admin-sessions" },
  { surface: "S2", role: "clinic", dim: DIMS[1], stored: "logistica" },
];

const SEQUENCE_NOT_APPLICABLE: readonly { sequence: SequenceId; surface: SurfaceId; reason: string }[] = [
  { sequence: "N7", surface: "S1", reason: "the admin hub is retired: ?hub=1 lands on a module and no admin control opens a hub" },
  { sequence: "N7", surface: "S2", reason: "the shell is not the hub; hub → module is S3" },
  { sequence: "N7", surface: "S4", reason: "a full route is not the hub" },
  { sequence: "N8", surface: "S3", reason: "the hub is an explicit entry and is never restored over (R-8); asserted in dashboard-navigation-fsm-clinic" },
  { sequence: "N8", surface: "S4", reason: "a full route restores nothing (row #1); asserted in dashboard-navigation-fsm-clinic" },
  { sequence: "N9", surface: "S1", reason: "the admin dashboard has no full route (OPEN_ROUTE is rejected by row #6)" },
  { sequence: "N9", surface: "S2", reason: "full route → shell starts on S4" },
  { sequence: "N9", surface: "S3", reason: "full route → shell starts on S4" },
  { sequence: "N10", surface: "S1", reason: "the admin dashboard has no full route (OPEN_ROUTE is rejected by row #6)" },
  { sequence: "N10", surface: "S2", reason: "shell → full route is counted on S4, the surface it lands on" },
  { sequence: "N10", surface: "S3", reason: "the hub has no full-route control" },
  { sequence: "N1", surface: "S3", reason: "on the hub A → B is hub → module, N7" },
  { sequence: "N1", surface: "S4", reason: "on a full route A → B is N9 or N10" },
  { sequence: "N2", surface: "S3", reason: "no control of the product returns to the hub (SELECT_HUB has no emitter); the hub is returned to with Back, N5" },
  { sequence: "N2", surface: "S4", reason: "shell → route → shell is N10 then N9 on the same cell" },
];

test.describe("DASHBOARD_NAVIGATION_FSM_FAILURE_MATRIX · sequences", () => {
  for (const cell of SEQUENCE_CELLS) {
    test(`${cell.covers.join("+")} × ${cell.surface} ${SURFACE_NAME[cell.surface]} (${dimLabel(cell.dim)}): ${describeLoc(cell.entry)} → ${cell.actions.map(describeAction).join(" → ")}`, async ({
      page,
      context,
      gates,
    }) => {
      await replay({ page, context, gates }, { role: cell.role, dim: cell.dim }, cell.entry, cell.actions);
    });
  }

  for (const cell of RESTORE_CELLS) {
    test(`N8+N6 × ${cell.surface} ${SURFACE_NAME[cell.surface]} (${dimLabel(cell.dim)}): a bare entry restores ${cell.stored} with one payload and no history entry, and survives a reload`, async ({
      page,
      gates,
    }) => {
      const ctx: Ctx = { role: cell.role, dim: cell.dim };
      const restored = moduleLoc(cell.role, cell.stored);
      const bare = cell.role === "admin" ? "/dashboard/admin" : "/dashboard";
      await page.setViewportSize(SIZE[cell.dim.viewport]);
      if (!cell.dim.navigationApi) {
        await page.addInitScript(() => {
          Object.defineProperty(window, "navigation", { value: undefined, configurable: true });
        });
      }
      // Stored before the first document only; later loads keep what the app wrote.
      await page.addInitScript(
        ([key, value]) => {
          if (window.sessionStorage.getItem("e2e:last-module-seeded")) return;
          window.sessionStorage.setItem("e2e:last-module-seeded", "1");
          window.localStorage.setItem(key, value);
        },
        [STORAGE_KEY[cell.role], cell.stored] as const,
      );
      await suppressNextDevChrome(page);
      if (cell.role === "admin") await setAdminSession(page, "populated");
      else await setClinicSession(page, "populated");
      await page.clock.install();
      const documents = watchDocuments(page);
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      gates.hold();
      await page.goto(bare);
      await expect.poll(() => gates.requested(), "the restore is one payload").toEqual([cell.stored]);
      await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === bare);
      expect(await storedModule(page, cell.role), "a pending restore does not overwrite the stored module").toBe(cell.stored);
      const length = await historyLength(page);
      documents.take();

      await gates.release();
      await expectView(page, ctx, restored);
      expect(await historyLength(page), "a restore adds no history entry").toBe(length);
      expect(gates.requested()).toEqual([cell.stored]);
      expect(documents.take(), "client navigation, never a reload").toEqual([]);

      await page.reload();
      await expectView(page, ctx, restored);
      await atRest(page);
      await page.clock.fastForward(PAST_THE_BUDGET_MS);
      await expect(stalledNotice(page)).toHaveCount(0);
      expect(gates.requested(), "the restored URL is explicit: a reload restores nothing").toEqual([cell.stored]);

      await page.goBack();
      await expect(page).toHaveURL((url) => url.pathname === "/");
      await page.goForward();
      await expectView(page, ctx, restored);
    });
  }
});

// ── Block 3: model-based runs from a fixed seed ──────────────────────────────

/** Fixed seed of the generated runs. Run `i` depends on the seed and on `i` alone. */
const MODEL_SEED = 0x4e41_5606;
/** The roadmap caps a run at 30 generated sequences; 20 keep e2e:ci inside its budget. */
const MODEL_RUNS = 20;
const MODEL_STEPS = 5;
/** FNV-1a of the generated plan: the same seed gives the same runs on every machine. */
const MODEL_PLAN_DIGEST = "8324122d";

type ModelProfile = {
  readonly name: string;
  readonly surface: SurfaceId;
  readonly role: Role;
  readonly dim: Dim;
  readonly entry: Loc;
  /** Modules with a control on this band. The clinic default is left out: its bare URL is restored over. */
  readonly pool: readonly string[];
};

const ADMIN_POOL = ["admin", "admin-clinics", "admin-sessions", "audit-log", "admin-pricing"];
/** Below 768px the admin band paints three modules; the rest sit behind "Más". */
const ADMIN_MOBILE_POOL = ["admin-clinics", "audit-log", "admin-sessions"];
const CLINIC_POOL = ["informes", "logistica", "tokens", "perfil"];

const MODEL_PROFILES: readonly ModelProfile[] = [
  { name: "admin", surface: "S1", role: "admin", dim: DIMS[0], entry: moduleLoc("admin", "admin-clinics"), pool: ADMIN_POOL },
  { name: "admin", surface: "S1", role: "admin", dim: DIMS[1], entry: moduleLoc("admin", "admin"), pool: ADMIN_POOL },
  { name: "admin", surface: "S1", role: "admin", dim: DIMS[3], entry: moduleLoc("admin", "audit-log"), pool: ADMIN_MOBILE_POOL },
  { name: "clinic", surface: "S2", role: "clinic", dim: DIMS[0], entry: moduleLoc("clinic", "informes"), pool: CLINIC_POOL },
  { name: "clinic", surface: "S2", role: "clinic", dim: DIMS[1], entry: moduleLoc("clinic", "tokens"), pool: CLINIC_POOL },
  { name: "clinic", surface: "S2", role: "clinic", dim: DIMS[2], entry: moduleLoc("clinic", "logistica"), pool: CLINIC_POOL },
  { name: "clinic", surface: "S2", role: "clinic", dim: DIMS[3], entry: moduleLoc("clinic", "perfil"), pool: CLINIC_POOL },
  { name: "hub", surface: "S3", role: "clinic", dim: DIMS[2], entry: HUB_LOC, pool: CLINIC_POOL },
  { name: "route", surface: "S4", role: "clinic", dim: DIMS[1], entry: routeLoc("informes"), pool: CLINIC_POOL },
  { name: "route", surface: "S4", role: "clinic", dim: DIMS[2], entry: routeLoc("logistica"), pool: CLINIC_POOL },
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every action the surface can perform from `model`, weighted. */
function candidates(model: Model, profile: ModelProfile, random: () => number): { weight: number; action: Action }[] {
  const current = model.stack[model.index];
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const elsewhere = profile.pool.filter((moduleId) => !same(moduleLoc(profile.role, moduleId), current));
  const options: { weight: number; action: Action }[] = [
    { weight: 3, action: { type: "select", module: pick(elsewhere) } },
    { weight: 1, action: { type: "slow", module: pick(elsewhere) } },
  ];
  if (elsewhere.length >= 2) {
    const first = pick(elsewhere);
    const second = pick(elsewhere.filter((moduleId) => moduleId !== first));
    const third = random() < 0.4 ? pick(elsewhere.filter((moduleId) => moduleId !== second)) : null;
    options.push({ weight: 2, action: { type: "burst", modules: third === null ? [first, second] : [first, second, third] } });
  }
  if (current.kind === "hub") options.push({ weight: 3, action: { type: "launcher", module: pick(profile.pool) } });
  if (current.kind === "module") options.push({ weight: 1, action: { type: "return", via: pick(elsewhere) } });
  if (profile.role === "clinic" && current.kind === "module" && ROUTE_MODULES.includes(current.module)) {
    options.push({ weight: 2, action: { type: "openRoute" } });
  }
  if (model.index > 0) {
    options.push({ weight: 2, action: BACK });
    const behind = model.stack[model.index - 1];
    const inFlight = elsewhere.filter((moduleId) => !same(moduleLoc(profile.role, moduleId), behind));
    if (!model.reloaded && inFlight.length > 0) {
      options.push({ weight: 1, action: { type: "backInFlight", module: pick(inFlight) } });
    }
  }
  if (model.index < model.stack.length - 1) options.push({ weight: 2, action: FORWARD });
  if (!model.reloaded) options.push({ weight: 1, action: RELOAD });
  return options;
}

function generateRun(seed: number, index: number): { profile: ModelProfile; actions: Action[] } {
  const profile = MODEL_PROFILES[index % MODEL_PROFILES.length];
  const random = mulberry32(seed + Math.imul(index + 1, 0x9e3779b1));
  const actions: Action[] = [];
  let model = startModel(profile.entry);
  while (actions.length < MODEL_STEPS) {
    const options = candidates(model, profile, random);
    let roll = random() * options.reduce((sum, option) => sum + option.weight, 0);
    const chosen = options.find((option) => (roll -= option.weight) < 0) ?? options[options.length - 1];
    model = apply(model, chosen.action, profile.role);
    actions.push(chosen.action);
  }
  return { profile, actions };
}

function generatePlan(seed: number) {
  return Array.from({ length: MODEL_RUNS }, (_, index) => generateRun(seed, index));
}

function planDigest(plan: ReturnType<typeof generatePlan>): string {
  const text = plan
    .map(({ profile, actions }) => `${profile.name}|${dimLabel(profile.dim)}|${describeLoc(profile.entry)}|${actions.map(describeAction).join(">")}`)
    .join("\n");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const MODEL_PLAN = generatePlan(MODEL_SEED);

test.describe("DASHBOARD_NAVIGATION_FSM_FAILURE_MATRIX · model", () => {
  for (const [index, { profile, actions }] of MODEL_PLAN.entries()) {
    test(`seed 0x${MODEL_SEED.toString(16)} run ${index + 1}/${MODEL_RUNS} × ${profile.surface} ${profile.name} (${dimLabel(profile.dim)}): ${describeLoc(profile.entry)} → ${actions.map(describeAction).join(" → ")}`, async ({
      page,
      context,
      gates,
    }) => {
      await replay({ page, context, gates }, { role: profile.role, dim: profile.dim }, profile.entry, actions);
    });
  }
});

// ── The gates themselves ─────────────────────────────────────────────────────

test.describe("DASHBOARD_NAVIGATION_FSM_FAILURE_MATRIX · gates", () => {
  test("dispose() removes the route: a failure configured before it is never fabricated, and nothing is listed or held afterwards", async ({
    page,
  }) => {
    const ctx: Ctx = { role: "clinic", dim: DIMS[0] };
    const gates = await installRouterPayloadGates(page);
    await open(page, ctx, moduleLoc("clinic", "informes"));
    const documents = watchDocuments(page);

    gates.hold();
    gates.failNext("tokens", 500);
    gates.cutNext("perfil", 0.5);
    expect(await gates.dispose(), "nothing was held").toEqual([]);

    for (const moduleId of ["tokens", "perfil"]) {
      await bandItem(page, ctx, moduleId).click();
      await expectView(page, ctx, moduleLoc("clinic", moduleId));
    }
    await expect(errorBoundary(page)).toHaveCount(0);
    expect(gates.injected(), "a disposed gate fabricates nothing").toEqual([]);
    expect(gates.requested(), "a disposed gate sees no payload").toEqual([]);
    expect(gates.held()).toEqual([]);
    expect(documents.take(), "both choices are client navigations").toEqual([]);
    expect(await gates.dispose(), "disposing twice is inert").toEqual([]);
  });
});

// ── The matrix counts itself ─────────────────────────────────────────────────

test.describe("DASHBOARD_NAVIGATION_FSM_FAILURE_MATRIX · coverage", () => {
  const FAILURES: readonly FailureId[] = ["F1", "F2", "F3", "F4", "F5", "F6", "F7"];
  const SURFACES: readonly SurfaceId[] = ["S1", "S2", "S3", "S4"];
  const SEQUENCES: readonly SequenceId[] = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10"];
  const pair = (dim: Dim) => `${dim.viewport}/${dim.navigationApi ? "api" : "no-api"}`;
  const ALL_PAIRS = DIMS.map(pair).sort();

  test("every failure × surface pair is a cell or a declared exclusion, and the four viewport × Navigation API pairs reach every surface", () => {
    const cells = [...FAILURE_GRID, ...FAILURE_EXTRA];
    for (const failure of FAILURES) {
      for (const surface of SURFACES) {
        const covered = cells.some((cell) => cell.failure === failure && cell.surface === surface);
        const excluded = FAILURE_NOT_APPLICABLE.filter((entry) => entry.failure === failure && entry.surface === surface);
        expect(Number(covered) + excluded.length, `${failure} × ${surface} is exactly one of cell or exclusion`).toBe(1);
        for (const entry of excluded) expect(entry.reason.length).toBeGreaterThan(20);
      }
      const pairs = new Set(cells.filter((cell) => cell.failure === failure).map((cell) => pair(cell.dim)));
      expect(pairs.size, `${failure} runs on more than one viewport × Navigation API pair`).toBeGreaterThan(1);
    }
    for (const surface of SURFACES) {
      const pairs = [...new Set(cells.filter((cell) => cell.surface === surface).map((cell) => pair(cell.dim)))].sort();
      expect(pairs, `${surface} meets every pair under failure`).toEqual(ALL_PAIRS);
    }
    expect(new Set(cells.filter((cell) => cell.surface === "S4").map((cell) => cell.journey)).size).toBe(2);
  });

  test("the four D10_LATE_FAILURE cells require convergence after an abandoned flight", () => {
    const cells = [...FAILURE_GRID, ...FAILURE_EXTRA];
    const late = cells.filter((cell) => cell.contract === "D10_LATE_FAILURE");
    expect(late.map((cell) => `${cell.failure} × ${cell.surface}${cell.variant === undefined ? "" : " late"}`).sort()).toEqual(
      ["F4 × S1 late", "F4 × S2 late", "F7 × S2", "F7 × S2"].sort(),
    );
    for (const failure of FAILURES) {
      const ordinary = cells.filter((cell) => cell.failure === failure && cell.contract === undefined);
      expect(ordinary.length > 0, `${failure} retains its ordinary cells`).toBe(failure !== "F7");
      expect(cells.some((cell) => cell.failure === failure)).toBe(true);
    }
  });

  test("every sequence × surface pair is a cell or a declared exclusion, with and without the Navigation API and on both viewports", () => {
    const cells = [
      ...SEQUENCE_CELLS.map((cell) => ({ covers: cell.covers, surface: cell.surface, dim: cell.dim })),
      ...RESTORE_CELLS.map((cell) => ({ covers: ["N8", "N6"] as const, surface: cell.surface, dim: cell.dim })),
    ];
    for (const sequence of SEQUENCES) {
      for (const surface of SURFACES) {
        const covered = cells.some((cell) => cell.surface === surface && cell.covers.some((id) => id === sequence));
        const excluded = SEQUENCE_NOT_APPLICABLE.some((entry) => entry.sequence === sequence && entry.surface === surface);
        expect(covered !== excluded, `${sequence} × ${surface} is exactly one of cell or exclusion`).toBe(true);
      }
      expect(cells.some((cell) => cell.covers.some((id) => id === sequence)), `${sequence} is run`).toBe(true);
    }
    expect([...new Set(cells.map((cell) => pair(cell.dim)))].sort()).toEqual(ALL_PAIRS);
    // The named actions really perform what the cell claims.
    for (const cell of SEQUENCE_CELLS) {
      const types = new Set(cell.actions.map((action) => action.type));
      if (cell.covers.includes("N3")) expect(types.has("burst")).toBe(true);
      if (cell.covers.includes("N4")) expect(types.has("backInFlight")).toBe(true);
      if (cell.covers.includes("N5")) expect(types.has("forward")).toBe(true);
      if (cell.covers.includes("N6")) expect(types.has("reload")).toBe(true);
      if (cell.covers.includes("N7")) expect(types.has("launcher")).toBe(true);
      if (cell.covers.includes("N10")) expect(types.has("openRoute")).toBe(true);
    }
  });

  test("the generator is deterministic, bounded, valid on its surface and exercises every action", () => {
    expect(MODEL_PLAN.length).toBe(MODEL_RUNS);
    expect(MODEL_RUNS).toBeLessThanOrEqual(30);
    expect(generatePlan(MODEL_SEED), "the same seed gives the same plan").toEqual(MODEL_PLAN);
    expect(planDigest(generatePlan(MODEL_SEED + 1)), "another seed gives another plan").not.toBe(planDigest(MODEL_PLAN));
    expect(planDigest(MODEL_PLAN), "the plan is the one this seed is pinned to").toBe(MODEL_PLAN_DIGEST);

    const types = new Set<string>();
    for (const [index, { profile, actions }] of MODEL_PLAN.entries()) {
      expect(generateRun(MODEL_SEED, index), `run ${index + 1} is reproducible on its own`).toEqual({ profile, actions });
      expect(actions.length).toBe(MODEL_STEPS);
      // Replaying through the model throws on any action the surface cannot perform.
      let model = startModel(profile.entry);
      for (const action of actions) {
        model = apply(model, action, profile.role);
        types.add(action.type);
        const modules = "modules" in action ? action.modules : "module" in action ? [action.module] : "via" in action ? [action.via] : [];
        for (const moduleId of modules) expect(profile.pool, `${moduleId} has a control on ${profile.name}`).toContain(moduleId);
      }
    }
    expect([...types].sort()).toEqual(
      ["back", "backInFlight", "burst", "forward", "launcher", "openRoute", "reload", "return", "select", "slow"].sort(),
    );
    expect(new Set(MODEL_PLAN.map(({ profile }) => profile.surface)).size, "the four surfaces").toBe(4);
    expect([...new Set(MODEL_PLAN.map(({ profile }) => pair(profile.dim)))].sort()).toEqual(ALL_PAIRS);
  });
});
