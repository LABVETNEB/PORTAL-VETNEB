import assert from "node:assert/strict";
import test from "node:test";

import { clinicModuleHref } from "../../../../frontend/src/lib/dashboard/navigation/clinicNavigationState.ts";
import { subscribeHistoryTraversal } from "../../../../frontend/src/lib/dashboard/navigation/historyTraversal.ts";

// What is left of the clinic commit classifier after the navigation machine
// replaced it (PR-NAV-04, retired in PR-NAV-07): the canonical module url the
// owner and the hub still build, and the traversal adapter.

const OPERACIONES = "operaciones";
const INFORMES = "informes";
const LOGISTICA = "logistica";
const BASE = "/dashboard";

// ── Canonical urls ───────────────────────────────────────────────────────────

test("the default module reconciles to the bare dashboard url", () => {
  assert.equal(
    clinicModuleHref(BASE, OPERACIONES, OPERACIONES),
    "/dashboard",
    "Inicio already links to /dashboard; reconciliation must not invent ?module=operaciones",
  );
  assert.equal(clinicModuleHref(BASE, OPERACIONES, INFORMES), "/dashboard?module=informes");
  assert.equal(clinicModuleHref(BASE, OPERACIONES, LOGISTICA), "/dashboard?module=logistica");
});

test("the default module never gets a second spelling", () => {
  assert.equal(clinicModuleHref(BASE, OPERACIONES, OPERACIONES).includes("module="), false);
});

test("history · only a traverse navigation raises the traversal signal", () => {
  const globals = globalThis as { window?: unknown };
  const hadWindow = "window" in globals;
  const previousWindow = globals.window;
  const navigation = new EventTarget();
  globals.window = { navigation };
  try {
    let raised = 0;
    const stop = subscribeHistoryTraversal(() => {
      raised += 1;
    });
    const navigate = (navigationType: string) =>
      navigation.dispatchEvent(Object.assign(new Event("navigate"), { navigationType }));

    navigate("push");
    navigate("replace");
    navigate("reload");
    assert.equal(raised, 0, "router writes never count as history traversal");
    navigate("traverse");
    assert.equal(raised, 1);

    stop();
    navigate("traverse");
    assert.equal(raised, 1, "the listener is removed on cleanup");

    globals.window = {};
    const noop = subscribeHistoryTraversal(() => {
      raised += 1;
    });
    noop();
    assert.equal(raised, 1, "without the Navigation API the subscription is a no-op");
  } finally {
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  }
});
