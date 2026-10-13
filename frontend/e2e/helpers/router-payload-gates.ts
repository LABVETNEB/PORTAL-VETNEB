import type { Page, Route } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Gates over the router payloads (`?_rsc=`) of the dashboard pages (PR-NAV-06).
//
// One gate set per page. A navigation payload can be listed, held and then
// continued, answered late with an HTTP status while it is held, answered at
// once with a status, or answered with the leading part of its real 200 body.
// Nothing is ever aborted: Next turns a network failure into a document
// navigation, which is a contract of its own (the offline rows) and is produced
// there by the browser, not by a gate.
//
// Every answer a gate fabricates is recorded in `injected()`, so a scenario
// proves the failure it claims instead of inferring it from the outcome.
// Prefetches are let through and never listed. Session setup stays in
// helpers/session.ts: a gate reads and writes no cookie.
// ─────────────────────────────────────────────────────────────────────────────

/** Payload of a page URL with no `?module=`: the bare entry. */
export const BARE_PAYLOAD = "(bare)";
/** Payload of the clinic hub, `/dashboard?hub=1`. */
export const HUB_PAYLOAD = "(hub)";

const ADMIN_PATH = "/dashboard/admin";
const CLINIC_PATH = "/dashboard";

export type GateInjection =
  | { readonly kind: "status"; readonly key: string; readonly status: number; readonly late: boolean }
  | { readonly kind: "cut"; readonly key: string; readonly sentBytes: number; readonly realBytes: number };

export type RouterPayloadGates = {
  /** Lists every navigation payload from now on. */
  record(): void;
  /** Lists and holds every navigation payload from now on. */
  hold(): void;
  /** Key of every navigation payload requested while recording, in order. */
  requested(): string[];
  /** Key of every payload held right now, in arrival order. */
  held(): string[];
  /** Continues the held payloads of `key` to the server and waits for their answers. */
  releaseOnly(key: string): Promise<number>;
  /** Stops holding and continues everything held. */
  release(): Promise<void>;
  /**
   * Stops holding and continues what is held without waiting for an answer: for
   * payloads whose document is gone, which no response event will ever follow.
   * Returns the keys it let go.
   */
  drop(): Promise<string[]>;
  /** Answers the held payloads of `key` with `status` and no Flight body: a late failure. */
  failHeld(key: string, status: number): Promise<number>;
  /** Answers the next payloads of `key` with `status` at once, until `clearFailures()`. */
  failNext(key: string, status: number): void;
  /** Answers the next payloads of `key` with the leading `fraction` of their real 200 body. */
  cutNext(key: string, fraction?: number): void;
  clearFailures(): void;
  /** Every answer the gates fabricated, in order. */
  injected(): readonly GateInjection[];
  /**
   * Retires the gates and continues what is still held; returns the keys it had
   * to let go. From then on every payload falls through untouched: nothing is
   * listed, held or fabricated, whatever was configured before.
   */
  dispose(): Promise<string[]>;
};

/** `?module=`, `(hub)` or `(bare)` on the two shells; the pathname on a full route. */
export function payloadKey(requestUrl: string): string {
  const url = new URL(requestUrl);
  if (url.pathname !== ADMIN_PATH && url.pathname !== CLINIC_PATH) return url.pathname;
  if (url.pathname === CLINIC_PATH && url.searchParams.get("hub") === "1") return HUB_PAYLOAD;
  return url.searchParams.get("module") ?? BARE_PAYLOAD;
}

/**
 * Installs the gates. The matcher names the four page paths literally:
 * E2E-GLOBAL-11 resolves it statically and proves no fixture API route can be
 * answered from here.
 */
export async function installRouterPayloadGates(page: Page): Promise<RouterPayloadGates> {
  const held: Route[] = [];
  const requested: string[] = [];
  const injected: GateInjection[] = [];
  const failing = new Map<string, number>();
  const cutting = new Map<string, number>();
  let recording = false;
  let holding = false;
  let disposed = false;

  const keyOf = (route: Route) => payloadKey(route.request().url());

  const handler = async (route: Route) => {
    // Disposal is a state of the handler, not an unroute(): Playwright removes a
    // predicate route only by the identity of the function it was given, and
    // E2E-GLOBAL-11 needs that predicate written inline below to resolve it.
    if (disposed) {
      await route.fallback();
      return;
    }
    if (route.request().headers()["next-router-prefetch"] !== undefined) {
      await route.continue();
      return;
    }
    const key = keyOf(route);
    if (recording) requested.push(key);
    const status = failing.get(key);
    if (status !== undefined) {
      injected.push({ kind: "status", key, status, late: false });
      await route.fulfill({ status, contentType: "text/plain", body: "" });
      return;
    }
    const fraction = cutting.get(key);
    if (fraction !== undefined) {
      const response = await route.fetch();
      const body = await response.body();
      const headers = { ...response.headers() };
      delete headers["content-length"];
      delete headers["content-encoding"];
      const sent = body.subarray(0, Math.floor(body.length * fraction));
      injected.push({ kind: "cut", key, sentBytes: sent.length, realBytes: body.length });
      await route.fulfill({ status: 200, headers, body: sent });
      return;
    }
    if (holding) {
      held.push(route);
      return;
    }
    await route.continue();
  };

  await page.route(
    (url) =>
      (url.pathname === "/dashboard/admin" ||
        url.pathname === "/dashboard" ||
        url.pathname === "/dashboard/informes" ||
        url.pathname === "/dashboard/logistica") &&
      url.searchParams.has("_rsc"),
    handler,
  );

  function take(routes: Route[]) {
    for (const route of routes) held.splice(held.indexOf(route), 1);
    return routes;
  }

  async function letThrough(routes: Route[]) {
    for (const route of take(routes)) {
      const continued = await route.continue().then(
        () => true,
        () => false /* the router dropped that navigation */,
      );
      // An answer that never arrives (the context went offline) is a result too.
      if (continued) await route.request().response().then(
        () => true,
        () => false,
      );
    }
    return routes.length;
  }

  return {
    record() {
      recording = true;
    },
    hold() {
      recording = true;
      holding = true;
    },
    requested: () => [...requested],
    held: () => held.map(keyOf),
    releaseOnly: (key) => letThrough(held.filter((route) => keyOf(route) === key)),
    async release() {
      holding = false;
      await letThrough([...held]);
    },
    async drop() {
      holding = false;
      const dropped = held.map(keyOf);
      for (const route of take([...held])) {
        await route.continue().then(
          () => true,
          () => false,
        );
      }
      return dropped;
    },
    async failHeld(key, status) {
      const routes = take(held.filter((route) => keyOf(route) === key));
      for (const route of routes) {
        injected.push({ kind: "status", key, status, late: true });
        await route.fulfill({ status, contentType: "text/plain", body: "" });
      }
      return routes.length;
    },
    failNext(key, status) {
      failing.set(key, status);
    },
    cutNext(key, fraction = 0.5) {
      cutting.set(key, fraction);
    },
    clearFailures() {
      failing.clear();
      cutting.clear();
    },
    injected: () => [...injected],
    async dispose() {
      if (disposed) return [];
      disposed = true;
      holding = false;
      const leftover = held.map(keyOf);
      for (const route of take([...held])) {
        await route.continue().then(
          () => true,
          () => false,
        );
      }
      return leftover;
    },
  };
}
