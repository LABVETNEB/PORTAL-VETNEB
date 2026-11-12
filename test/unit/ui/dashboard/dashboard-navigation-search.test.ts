import assert from "node:assert/strict";
import test from "node:test";

import {
  createNavigationCoordinator,
  previewDisplay,
  sameNavLocation,
  type NavigationCoordinator,
  type NavigationEffect,
} from "../../../../frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts";
import {
  initial,
  transition,
  type MachineConfig,
  type NavEvent,
  type NavLocation,
} from "../../../../frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts";
import * as searchAdapter from "../../../../frontend/src/lib/dashboard/navigation/searchNavigation.ts";
import {
  SEARCH_QUERY_PARAM,
  getDisplayedSearch,
  isSearchStateId,
  publishDisplayedSearch,
  readSearchParam,
  registerSearchNavigationOwner,
  requestSearchSelection,
  searchOfLocation,
  subscribeDisplayedSearch,
  withSearchParam,
} from "../../../../frontend/src/lib/dashboard/navigation/searchNavigation.ts";

// GLOBAL-SEARCH-DRIVE-A4 — the saved search (`?sq=<uuid v4>`) is a coordinate of the
// machine's location, selected with the machine's own events (SELECT_MODULE / SELECT_HUB /
// OPEN_ROUTE with an optional `search`). Synthetic ids only.

const ID_A = "3b0f6a52-8f4e-4c1d-9a77-0a1b2c3d4e5f";
const ID_B = "6c1d7b63-9a5f-4d2e-8b88-1b2c3d4e5f60";
const ID_C = "9d2e8c74-0b60-4e3f-9c99-2c3d4e5f6071";

const MACHINE = { initial, transition };

const ADMIN: MachineConfig = {
  surface: "admin",
  modules: ["admin", "admin-health", "admin-clinics", "audit-log"],
  defaultModule: "admin",
};
const CLINIC: MachineConfig = {
  surface: "clinic",
  modules: ["operaciones", "informes", "logistica", "perfil"],
  defaultModule: "operaciones",
};

function moduleAt(module: string, search?: string): Extract<NavLocation, { readonly kind: "module" }> {
  return search === undefined ? { kind: "module", module } : { kind: "module", module, search };
}
function hubAt(search?: string): NavLocation {
  return search === undefined ? { kind: "hub" } : { kind: "hub", search };
}
function routeAt(path: string, module: string, search?: string): NavLocation {
  return search === undefined ? { kind: "route", path, module } : { kind: "route", path, module, search };
}

/** A coordinator over a browser model: the router applies pushes and replaces, Back and Forward traverse. */
function rig(config: MachineConfig, start: NavLocation, explicit = true, storedModule: string | null = null) {
  const queue: (() => void)[] = [];
  const pending: NavigationEffect[] = [];
  const navigations: string[] = [];
  const persisted: string[] = [];
  const entries: NavLocation[] = [start];
  let index = 0;

  const store: NavigationCoordinator = createNavigationCoordinator(
    MACHINE,
    config,
    { type: "HYDRATED", location: start, explicit, storedModule },
    {
      scheduleMicrotask: (drain) => queue.push(drain),
      navigate: (effect) => pending.push(effect),
      persist: (module) => persisted.push(module),
      armBudget: () => {},
      cancelBudget: () => {},
      reportError: (error) => {
        throw error;
      },
    },
  );

  function drainQueue() {
    while (queue.length > 0) queue.shift()?.();
  }
  /** Runs what the coordinator queued and lets the router commit each navigation, in order. */
  function settle() {
    drainQueue();
    while (pending.length > 0) {
      const effect = pending.shift() as NavigationEffect;
      navigations.push(`${effect.type === "ROUTER_PUSH" ? "push" : effect.type === "ROUTER_REPLACE" ? "replace" : "hard"} ${JSON.stringify(effect.to)}`);
      if (effect.type === "ROUTER_REPLACE") entries[index] = effect.to;
      else {
        entries.splice(index + 1);
        entries.push(effect.to);
        index += 1;
      }
      store.commit(effect.to);
      drainQueue();
    }
  }
  store.mount();
  settle();

  return {
    store,
    navigations,
    persisted,
    entries,
    get at() {
      return entries[index];
    },
    send(event: NavEvent) {
      store.dispatch(event);
      settle();
    },
    /** Back / Forward: the machine hears the traversal before the URL commits. */
    traverse(step: -1 | 1) {
      index += step;
      const destination = entries[index];
      store.dispatch({ type: "TRAVERSE_STARTED", destination });
      drainQueue();
      store.commit(destination);
      settle();
    },
    display: () => store.getSnapshot().ctx.display,
    state: () => store.getSnapshot().state.tag,
  };
}

test("an absent search keeps the shape of every location: no undefined-valued key", () => {
  const result = transition(CLINIC, initial(CLINIC).ctx, { tag: "IDLE" }, { type: "SELECT_MODULE", module: "informes" });
  assert.deepEqual(result.ctx.display, { kind: "module", module: "informes" });
  assert.equal("search" in result.ctx.display, false);
  assert.deepEqual(transition(CLINIC, initial(CLINIC).ctx, { tag: "IDLE" }, { type: "SELECT_HUB" }).ctx.display, { kind: "hub" });
  // An empty id is no id.
  assert.equal("search" in transition(CLINIC, initial(CLINIC).ctx, { tag: "IDLE" }, { type: "SELECT_MODULE", module: "informes", search: "" }).ctx.display, false);
});

test("search is a coordinate: two locations that differ only in it are two locations", () => {
  assert.equal(sameNavLocation(moduleAt("informes"), moduleAt("informes", ID_A)), false);
  assert.equal(sameNavLocation(moduleAt("informes", ID_A), moduleAt("informes", ID_A)), true);
  assert.equal(sameNavLocation(moduleAt("informes", ID_A), moduleAt("informes", ID_B)), false);
  assert.equal(sameNavLocation(hubAt(ID_A), hubAt()), false);
  assert.equal(sameNavLocation(routeAt("/dashboard/informes", "informes", ID_A), routeAt("/dashboard/informes", "informes")), false);
  assert.equal(sameNavLocation({ kind: "none" }, { kind: "none" }), true);
});

test("selecting a search is the machine's own selection: one push, no new event", () => {
  const browser = rig(CLINIC, moduleAt("informes"));
  browser.send({ type: "SELECT_MODULE", module: "informes", search: ID_A });
  assert.deepEqual(browser.navigations, [`push ${JSON.stringify(moduleAt("informes", ID_A))}`]);
  assert.deepEqual(browser.display(), moduleAt("informes", ID_A));
  assert.equal(browser.state(), "IDLE");
  // The same search again is #4 (already committed): nothing navigates and nothing is added.
  browser.send({ type: "SELECT_MODULE", module: "informes", search: ID_A });
  assert.deepEqual(browser.navigations, [`push ${JSON.stringify(moduleAt("informes", ID_A))}`]);
  assert.deepEqual(browser.entries, [moduleAt("informes"), moduleAt("informes", ID_A)]);
});

test("A → B → Back → Forward: the machine's history recovers each search, on both surfaces", () => {
  for (const [config, base] of [
    [CLINIC, moduleAt("informes")],
    [ADMIN, moduleAt("admin-health")],
  ] as const) {
    const browser = rig(config, base);
    const module = base.module;
    browser.send({ type: "SELECT_MODULE", module, search: ID_A });
    browser.send({ type: "SELECT_MODULE", module, search: ID_B });
    assert.equal(searchOfLocation(browser.display() as { kind: string; search?: string }), ID_B);

    browser.traverse(-1);
    assert.deepEqual(browser.display(), moduleAt(module, ID_A), "Back recovers A");
    assert.equal(browser.state(), "IDLE");
    browser.traverse(-1);
    assert.deepEqual(browser.display(), moduleAt(module), "Back again leaves the search");
    browser.traverse(1);
    browser.traverse(1);
    assert.deepEqual(browser.display(), moduleAt(module, ID_B), "Forward recovers B");
    assert.deepEqual(
      browser.navigations,
      [moduleAt(module, ID_A), moduleAt(module, ID_B)].map((to) => `push ${JSON.stringify(to)}`),
      "traversals navigate nothing: the browser did it",
    );
  }
});

test("closing selects the same location without its search: one entry, Back returns to the search", () => {
  const browser = rig(CLINIC, moduleAt("informes"));
  browser.send({ type: "SELECT_MODULE", module: "informes", search: ID_A });
  browser.send({ type: "SELECT_MODULE", module: "informes" });
  assert.deepEqual(browser.at, moduleAt("informes"));
  assert.deepEqual(browser.entries, [moduleAt("informes"), moduleAt("informes", ID_A), moduleAt("informes")]);
  browser.traverse(-1);
  assert.deepEqual(browser.display(), moduleAt("informes", ID_A));
});

test("a burst of searches takes one flight: the first pushes, the last wins as a replace (#29–#31)", () => {
  const browser = rig(CLINIC, moduleAt("informes"));
  // No settle between selections: they arrive while the first is in the router.
  browser.store.dispatch({ type: "SELECT_MODULE", module: "informes", search: ID_A });
  browser.store.dispatch({ type: "SELECT_MODULE", module: "informes", search: ID_B });
  browser.store.dispatch({ type: "SELECT_MODULE", module: "informes", search: ID_C });
  assert.deepEqual(browser.display(), moduleAt("informes", ID_C), "the chrome shows the latest at once");
  browser.send({ type: "RETRY" }); // inert outside STALLED: only lets the router commit
  assert.deepEqual(browser.navigations, [
    `push ${JSON.stringify(moduleAt("informes", ID_A))}`,
    `replace ${JSON.stringify(moduleAt("informes", ID_C))}`,
  ]);
  assert.deepEqual(browser.entries, [moduleAt("informes"), moduleAt("informes", ID_C)], "the burst added a single history entry");
  assert.deepEqual(browser.at, moduleAt("informes", ID_C));
});

test("the hub and a full route carry a search too; the admin surface has no hub (#6)", () => {
  const clinic = rig(CLINIC, hubAt());
  clinic.send({ type: "SELECT_HUB", search: ID_A });
  assert.deepEqual(clinic.display(), hubAt(ID_A));
  clinic.send({ type: "SELECT_HUB" });
  assert.deepEqual(clinic.display(), hubAt());

  const route = rig(CLINIC, routeAt("/dashboard/informes", "informes"));
  route.send({ type: "OPEN_ROUTE", path: "/dashboard/informes", module: "informes", search: ID_B });
  assert.deepEqual(route.display(), routeAt("/dashboard/informes", "informes", ID_B));
  assert.deepEqual(route.persisted.at(-1), "informes");

  const admin = rig(ADMIN, moduleAt("admin"));
  admin.send({ type: "SELECT_HUB", search: ID_A });
  assert.deepEqual(admin.display(), moduleAt("admin"));
  assert.deepEqual(admin.navigations, []);
  // An unknown module is never selected, with or without a search.
  admin.send({ type: "SELECT_MODULE", module: "nope", search: ID_A });
  assert.deepEqual(admin.navigations, []);
});

test("a URL that carries a search is not a stored-module restore, and the module is persisted", () => {
  // Control: the bare default entry restores the stored module by one replace.
  const bare = rig(CLINIC, moduleAt("operaciones"), false, "informes");
  assert.deepEqual(bare.navigations, [`replace ${JSON.stringify(moduleAt("informes"))}`]);

  // With a saved search on the URL the entry rests where it is: the search is not dropped.
  const clinic = rig(CLINIC, moduleAt("operaciones", ID_A), false, "informes");
  assert.deepEqual(clinic.navigations, [], "no replace: the URL rests where it is");
  assert.deepEqual(clinic.display(), moduleAt("operaciones", ID_A));
  assert.deepEqual(clinic.persisted, ["operaciones"]);
});

test("the display previewed with the URL carries the search of that URL (§11.3)", () => {
  const browser = rig(CLINIC, moduleAt("informes"));
  const preview = previewDisplay(MACHINE, CLINIC, browser.store.getSnapshot(), moduleAt("informes", ID_A));
  assert.equal(searchOfLocation(preview as { kind: string; search?: string }), ID_A);
  assert.equal(searchOfLocation(previewDisplay(MACHINE, CLINIC, browser.store.getSnapshot(), moduleAt("informes")) as { kind: string; search?: string }), null);
});

// ── The adapter: the id grammar and the three hand-overs ─────────────────────

test("only a lowercase UUID v4 is an id; a query is read only when it holds exactly one", () => {
  assert.equal(isSearchStateId(ID_A), true);
  for (const bad of [
    "",
    "luna perez",
    ID_A.toUpperCase(),
    ID_A.replace("4c1d", "1c1d"),
    ID_A.replace("9a77", "1a77"),
    `${ID_A}x`,
    ` ${ID_A}`,
    "../../etc/passwd",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isSearchStateId(bad), false, String(bad));
  }
  assert.equal(readSearchParam(new URLSearchParams(`${SEARCH_QUERY_PARAM}=${ID_A}`)), ID_A);
  assert.equal(readSearchParam(new URLSearchParams(`sq=${ID_A}&sq=${ID_B}`)), null, "a repeated parameter is nothing");
  assert.equal(readSearchParam(new URLSearchParams("sq=luna")), null);
  assert.equal(readSearchParam(new URLSearchParams("module=informes")), null);
});

test("the parameter is appended before the fragment and only with a valid id", () => {
  assert.equal(withSearchParam("/dashboard?module=informes", ID_A), `/dashboard?module=informes&sq=${ID_A}`);
  assert.equal(withSearchParam("/dashboard", ID_A), `/dashboard?sq=${ID_A}`);
  assert.equal(withSearchParam("/dashboard?module=tokens#row-7", ID_A), `/dashboard?module=tokens&sq=${ID_A}#row-7`);
  assert.equal(withSearchParam("/dashboard", "luna perez"), "/dashboard");
  assert.equal(withSearchParam("/dashboard", null), "/dashboard");
  assert.equal(searchOfLocation({ kind: "module", search: "luna" }), null);
});

test("the bar's request reaches the mounted owner; without one, or with a bad id, nothing is claimed", () => {
  assert.equal(requestSearchSelection(ID_A), false, "no owner mounted");
  const taken: (string | null)[] = [];
  const unregister = registerSearchNavigationOwner({
    select(search) {
      taken.push(search);
      return true;
    },
  });
  assert.equal(requestSearchSelection(ID_A), true);
  assert.equal(requestSearchSelection(null), true);
  assert.equal(requestSearchSelection("luna perez"), false, "an id that is not one never reaches the machine");
  assert.deepEqual(taken, [ID_A, null]);
  unregister();
  assert.equal(requestSearchSelection(ID_B), false);

  // A stale unregister never removes a newer owner.
  const first = registerSearchNavigationOwner({ select: () => true });
  const second = registerSearchNavigationOwner({ select: () => false });
  first();
  assert.equal(requestSearchSelection(ID_A), false, "the second owner still stands");
  second();
});

test("the display's search is published to the bar once per change, and unsubscribing stops it", () => {
  publishDisplayedSearch(null);
  const seen: (string | null)[] = [];
  const unsubscribe = subscribeDisplayedSearch(() => seen.push(getDisplayedSearch()));
  publishDisplayedSearch(ID_A);
  publishDisplayedSearch(ID_A);
  publishDisplayedSearch("not an id");
  publishDisplayedSearch(ID_B);
  publishDisplayedSearch(null);
  unsubscribe();
  publishDisplayedSearch(ID_C);
  assert.deepEqual(seen, [ID_A, null, ID_B, null], "a repeat publishes nothing and an invalid id reads as none");
  assert.equal(getDisplayedSearch(), ID_C);
  publishDisplayedSearch(null);
});

test("the adapter is not a second owner: no DOM, no router, no history, one registrant", () => {
  // It loads and runs in bare Node: nothing it exports touches a browser or a router.
  const body = Object.values(searchAdapter).map(String).join("\n");
  for (const forbidden of ["router", "history", "window", "document", "globalThis", "fetch(", "createNavigationCoordinator"]) {
    assert.equal(body.includes(forbidden), false, `the adapter does not touch ${forbidden}`);
  }
  assert.deepEqual(
    Object.keys(searchAdapter).filter((name) => /^register/.test(name)),
    ["registerSearchNavigationOwner"],
  );
});
