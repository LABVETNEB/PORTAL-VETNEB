import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const {
  CLINIC_LAST_MODULE_STORAGE_KEY,
  ADMIN_LAST_MODULE_STORAGE_KEY,
  clearDashboardLastModules,
  readDashboardLastModule,
  writeDashboardLastModule,
} = await import("../../../../frontend/src/lib/dashboard-last-module.ts");

const STORAGE_PATH = "frontend/src/lib/dashboard-last-module.ts";
const AUTH_CONTEXT_PATH = "frontend/src/context/AuthContext.tsx";
const DASHBOARD_TOPBAR_PATH =
  "frontend/src/components/dashboard/DashboardTopbar.tsx";
const ADMIN_CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const CLINIC_CONTROLLER_PATH =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const ADMIN_NAVIGATION_PROVIDER_PATH =
  "frontend/src/components/dashboard/DashboardNavigationProvider.tsx";
const NAVIGATION_MACHINE_PATH =
  "frontend/src/lib/dashboard/navigation/dashboardNavigationMachine.ts";

const globalRef = globalThis as { window?: unknown };

function withoutWindow(run: () => void): void {
  const had = "window" in globalRef;
  const prev = globalRef.window;
  if (had) delete globalRef.window;
  try {
    run();
  } finally {
    if (had) globalRef.window = prev;
  }
}

function withStubbedWindow(stub: unknown, run: () => void): void {
  const had = "window" in globalRef;
  const prev = globalRef.window;
  globalRef.window = stub;
  try {
    run();
  } finally {
    if (had) globalRef.window = prev;
    else delete globalRef.window;
  }
}

// ── 9.1 Helper runtime behavior ─────────────────────────────────────────────

test("readDashboardLastModule returns null when window is unavailable (SSR)", () => {
  withoutWindow(() => {
    assert.equal(readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY), null);
  });
});

test("readDashboardLastModule returns null when localStorage.getItem throws", () => {
  withStubbedWindow(
    {
      localStorage: {
        getItem() {
          throw new Error("storage blocked");
        },
      },
    },
    () => {
      assert.equal(
        readDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY),
        null,
      );
    },
  );
});

test("writeDashboardLastModule does not throw when localStorage.setItem throws", () => {
  withStubbedWindow(
    {
      localStorage: {
        setItem() {
          throw new Error("quota exceeded");
        },
      },
    },
    () => {
      assert.doesNotThrow(() =>
        writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, "admin-clinics"),
      );
    },
  );
});

test("write/read round-trips a module id under the exact role key and isolates roles", () => {
  const store = new Map<string, string>();
  withStubbedWindow(
    {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
    },
    () => {
      writeDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY, "perfil");
      writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, "admin-clinics");

      assert.equal(store.get("vetneb:dashboard:last-module:clinic"), "perfil");
      assert.equal(
        store.get("vetneb:dashboard:last-module:admin"),
        "admin-clinics",
      );
      assert.equal(
        readDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY),
        "perfil",
      );
      assert.equal(
        readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY),
        "admin-clinics",
      );
    },
  );
});

test("clearDashboardLastModules removes both role keys and keeps other UI preferences", () => {
  const store = new Map<string, string>([
    [CLINIC_LAST_MODULE_STORAGE_KEY, "perfil"],
    [ADMIN_LAST_MODULE_STORAGE_KEY, "admin-clinics"],
    ["vetneb-theme-mode", "dark"],
  ]);
  const removedKeys: string[] = [];

  withStubbedWindow(
    {
      localStorage: {
        removeItem: (key: string) => {
          removedKeys.push(key);
          store.delete(key);
        },
      },
    },
    () => {
      clearDashboardLastModules();

      assert.equal(store.has(CLINIC_LAST_MODULE_STORAGE_KEY), false);
      assert.equal(store.has(ADMIN_LAST_MODULE_STORAGE_KEY), false);
      assert.equal(store.get("vetneb-theme-mode"), "dark");
      assert.deepEqual(removedKeys, [
        CLINIC_LAST_MODULE_STORAGE_KEY,
        ADMIN_LAST_MODULE_STORAGE_KEY,
      ]);
    },
  );
});

test("clearDashboardLastModules does not throw when window is unavailable (SSR)", () => {
  withoutWindow(() => {
    assert.doesNotThrow(() => clearDashboardLastModules());
  });
});

test("clearDashboardLastModules does not throw when localStorage.removeItem throws", () => {
  withStubbedWindow(
    {
      localStorage: {
        removeItem() {
          throw new Error("storage blocked");
        },
      },
    },
    () => {
      assert.doesNotThrow(() => clearDashboardLastModules());
    },
  );
});

test("storage keys are the exact namespaced contract values", () => {
  assert.equal(
    CLINIC_LAST_MODULE_STORAGE_KEY,
    "vetneb:dashboard:last-module:clinic",
  );
  assert.equal(
    ADMIN_LAST_MODULE_STORAGE_KEY,
    "vetneb:dashboard:last-module:admin",
  );
});

// ── 9.2 Storage stays non-sensitive ─────────────────────────────────────────

test("dashboard last-module helper stores no sensitive identifiers", () => {
  const source = read(STORAGE_PATH).toLowerCase();

  for (const forbidden of [
    "session",
    "auth",
    "cookie",
    "token",
    "password",
    "secret",
    "jwt",
    "bearer",
    "clinicid",
    "userid",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `helper must not reference ${forbidden}`,
    );
  }
});

// ── 9.3 Admin / clinic navigation contracts ─────────────────────────────────

test("admin controller persists/restores with the admin key and replace-only restore", () => {
  // PR-NAV-03: persistence and restore belong to the navigation machine; the
  // provider is the only place that touches the admin key. The controller, now
  // a view of the machine's display, reads and writes no storage at all.
  const controller = read(ADMIN_CONTROLLER_PATH);
  const source = read(ADMIN_NAVIGATION_PROVIDER_PATH);
  const machine = read(NAVIGATION_MACHINE_PATH);

  // PR-NAV-04: the provider owns both surfaces, each under its own key.
  const admin = source.slice(source.indexOf("const ADMIN_CONFIG"), source.indexOf("const CLINIC_CONFIG"));
  assert.ok(admin.includes("  storageKey: ADMIN_LAST_MODULE_STORAGE_KEY,\n  parseModule: parseAdminModule,\n"));
  assert.equal(admin.includes("CLINIC_LAST_MODULE_STORAGE_KEY"), false);
  for (const storage of ["ADMIN_LAST_MODULE_STORAGE_KEY", "writeDashboardLastModule", "readDashboardLastModule"]) {
    assert.equal(controller.includes(storage), false, `the admin controller no longer owns ${storage}`);
  }

  // PERSIST is the only writer, and the machine emits it on confirmations only
  // (§12.5): an optimistic module the URL never committed is never stored.
  assert.ok(source.includes("persist: (moduleId) => writeDashboardLastModule(surface.storageKey, moduleId),"));
  assert.equal(source.split("writeDashboardLastModule(").length - 1, 1);
  assert.ok(
    source.includes("storedModule: surface.parseModule(readDashboardLastModule(surface.storageKey)),"),
  );
  assert.equal(source.split("readDashboardLastModule(").length - 1, 1, "storage is read once, for HYDRATED");

  // Any URL module (including an invalid legacy value) and the explicit hub
  // are reported to the machine as explicit. A bare entry falls back to the
  // explicit operational default when storage is absent, stale, or unavailable.
  assert.ok(
    source.includes("return query.has(MODULE_QUERY_PARAM) || query.has(HUB_QUERY_PARAM);") &&
      admin.includes("      explicit: isExplicit(query),\n"),
  );
  assert.ok(source.includes("defaultModule: DEFAULT_ADMIN_MODULE,"));
  assert.ok(
    machine.includes(
      'return { kind: "module", module: valid(config, stored) ? stored : config.defaultModule };',
    ),
  );

  // Restore uses replace, never push (no history pollution, no loop).
  const hydrate = machine.slice(machine.indexOf("function hydrate("), machine.indexOf("function select("));
  assert.ok(hydrate.includes('{ type: "ROUTER_REPLACE", to: target },'));
  assert.equal(hydrate.includes("ROUTER_PUSH"), false);
  assert.ok(source.includes("buildDashboardModuleHref(ROUTES.dashboardAdmin, location.module)"));
  assert.equal(
    source.includes("router.push(`/dashboard/admin?module=${lastModule}`"),
    false,
  );
  // The restore is a landing-only one-shot by construction: only HYDRATED,
  // the first event of a store, can produce it, and BOOTING is never re-entered.
  assert.ok(
    machine.includes('return state.tag === "BOOTING" ? hydrate(config, ctx, event) : stay(ctx, state); // #1–#3'),
  );

  // Hub stays addressable; storage stays centralized in the allowlisted helper.
  assert.ok(read("frontend/src/lib/admin-hub-reset.ts").includes("export function requestAdminHubReset(): void {"));
  assert.equal(source.includes("localStorage"), false);
  assert.equal(controller.includes("localStorage"), false);
});

test("clinic controller persists/restores with the clinic key and replace-only restore", () => {
  // PR-NAV-04: persistence and restore belong to the navigation machine, as on
  // the admin surface. The provider is the only place that touches the clinic
  // key; the controller, a view of the machine's display, touches no storage.
  const controller = read(CLINIC_CONTROLLER_PATH);
  const source = read(ADMIN_NAVIGATION_PROVIDER_PATH);
  const machine = read(NAVIGATION_MACHINE_PATH);
  const clinic = source.slice(source.indexOf("const CLINIC_CONFIG"), source.indexOf("const SURFACES"));

  assert.ok(clinic.includes("  storageKey: CLINIC_LAST_MODULE_STORAGE_KEY,\n  parseModule: parseClinicModule,\n"));
  assert.equal(clinic.includes("ADMIN_LAST_MODULE_STORAGE_KEY"), false);
  for (const storage of ["CLINIC_LAST_MODULE_STORAGE_KEY", "writeDashboardLastModule", "readDashboardLastModule"]) {
    assert.equal(controller.includes(storage), false, `the clinic controller no longer owns ${storage}`);
  }

  // PERSIST is the only writer, and the machine emits it on confirmations only
  // (§12.5, S15). The controller used to store the module it showed on every
  // render, the default included, before its own restore could read the stored
  // one: that write is what kept the restore dead (D-12).
  assert.ok(source.includes("persist: (moduleId) => writeDashboardLastModule(surface.storageKey, moduleId),"));
  assert.equal(source.split("writeDashboardLastModule(").length - 1, 1);
  assert.ok(source.includes("storedModule: surface.parseModule(readDashboardLastModule(surface.storageKey)),"));
  assert.equal(source.split("readDashboardLastModule(").length - 1, 1, "storage is read once, for HYDRATED");

  // An explicit `?module=` or `?hub=1` wins over storage; nothing stored, or
  // an unknown module, restores nothing; and restoring the DEFAULT module is
  // not a navigation at all — a bare entry already shows that url — so no
  // replace is put in flight during mount, where it could land after the
  // user's first tap and undo it.
  const bootRestore = machine.slice(machine.indexOf("function bootRestore("), machine.indexOf("function normalization("));
  assert.ok(
    bootRestore.includes('const atDefault = same(event.location, { kind: "module", module: config.defaultModule });') &&
      bootRestore.includes(
        "if (!event.explicit && atDefault && valid(config, stored) && stored !== config.defaultModule) {",
      ),
    "restoring the operational default must not issue a router commit",
  );
  assert.ok(
    clinic.includes("      explicit: pathname === ROUTES.dashboard && isExplicit(query),\n") &&
      clinic.includes("defaultModule: DEFAULT_CLINIC_MODULE,"),
  );
  // `/dashboard?hub=1` carries no `?module=`: it is a location of its own, read
  // before the module, so the restore can never replace the hub with a workspace.
  assert.ok(
    clinic.includes("  if (isHubRequested(query)) return HUB;\n  return {\n    kind: \"module\","),
    "the last-module restore never fires while the url is the hub",
  );

  // The restore is a navigation of the owner. Its url comes from
  // `clinicModuleHref`, never hand-built, and a later explicit tap supersedes
  // it instead of losing to its late commit (row #10).
  const hydrate = machine.slice(machine.indexOf("function hydrate("), machine.indexOf("function select("));
  assert.ok(hydrate.includes('{ type: "ROUTER_REPLACE", to: target },'));
  assert.equal(
    hydrate.includes("ROUTER_PUSH"),
    false,
    "restore stays replace-only: it must never add a history entry",
  );
  assert.ok(clinic.includes("return clinicModuleHref(ROUTES.dashboard, DEFAULT_CLINIC_MODULE, location.module);"));
  assert.equal(
    source.includes("`${ROUTES.dashboard}?module=${"),
    false,
    "the restore must not hand-build the url: that is what spelled the default module as ?module=operaciones",
  );
  assert.ok(
    machine.includes('if (state.intent === "restore") {') &&
      machine.includes("// #10: a push over a pending replace adds one entry in either order."),
    "a tap made while the restore is in flight supersedes it",
  );
  // The restore is a landing-only one-shot by construction: only HYDRATED,
  // the first event of a store, can produce it, and BOOTING is never re-entered.
  assert.ok(
    machine.includes('return state.tag === "BOOTING" ? hydrate(config, ctx, event) : stay(ctx, state); // #1–#3'),
  );
  assert.equal(controller.includes("router."), false, "the view navigates nothing: neither push nor replace");

  // The hub stays addressable; storage stays centralized in the allowlisted helper.
  assert.ok(read("frontend/src/lib/clinic-hub-reset.ts").includes("export function requestClinicHubReset(): void {"));
  assert.equal(source.includes("localStorage"), false);
  assert.equal(controller.includes("localStorage"), false);
});

// ── 9.4 Logout clears persisted module preferences ─────────────────────────

test("dashboard topbar logout clears persisted module keys and invalidates the session before routing to login", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(
    source.includes(
      'import { clearDashboardLastModules } from "@/lib/dashboard-last-module";',
    ),
  );
  // Persisted module keys must still be cleared before leaving the surface.
  assert.ok(source.includes("clearDashboardLastModules();"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.equal(source.includes("localStorage"), false);

  // Security regression guard (fix/security-admin-logout-private-cache): logout
  // must invalidate the server session, not only navigate to /login. A bare
  // `onClick={clearDashboardLastModules}` left the session cookie valid and let
  // Back + reload re-render private dashboard data — this evolves the previous
  // (insecure) contract to require real session invalidation.
  assert.ok(
    source.includes("logoutAdmin") && source.includes("logoutClinic"),
    "logout must call the per-surface logout endpoint",
  );
  assert.ok(
    source.includes("event.preventDefault();"),
    "logout must cancel PublicRouteControl client navigation so the session is invalidated first",
  );
  assert.ok(
    source.includes("window.location.replace(ROUTES.login)"),
    "logout must hard-redirect to /login after invalidating the session",
  );
  assert.equal(
    source.includes("onClick={clearDashboardLastModules}"),
    false,
    "logout must not use the insecure navigate-only handler",
  );
});

test("AuthContext logout clears persisted module keys after backend logout succeeds", () => {
  const source = read(AUTH_CONTEXT_PATH);

  assert.ok(
    source.includes(
      'import { clearDashboardLastModules } from "@/lib/dashboard-last-module";',
    ),
  );
  assert.ok(
    source.includes(
      "await logoutClinic();\n    clearDashboardLastModules();\n    setUser(null);",
    ),
  );
  assert.equal(source.includes("localStorage"), false);
});

// ── 9.5 Scope: persisted-module surface stays client-side and self-contained ─

test("persisted-module surface does not reach backend, api, proxy or public layers", () => {
  const helper = read(STORAGE_PATH);

  // Helper is dependency-free.
  assert.equal(
    /^\s*import\s/m.test(helper),
    false,
    "storage helper must not import any module",
  );

  for (const source of [
    helper,
    read(ADMIN_CONTROLLER_PATH),
    read(CLINIC_CONTROLLER_PATH),
  ]) {
    for (const forbidden of ["next/server", "/api/", "server/", "fetch(", "proxy"]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `persisted-module surface must not reference ${forbidden}`,
      );
    }
  }
});
