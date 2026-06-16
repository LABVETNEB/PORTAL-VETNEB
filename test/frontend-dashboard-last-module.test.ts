import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const {
  CLINIC_LAST_MODULE_STORAGE_KEY,
  ADMIN_LAST_MODULE_STORAGE_KEY,
  readDashboardLastModule,
  writeDashboardLastModule,
} = await import("../frontend/src/lib/dashboard-last-module.ts");

const STORAGE_PATH = "frontend/src/lib/dashboard-last-module.ts";
const ADMIN_CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const CLINIC_CONTROLLER_PATH =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const globalRef = globalThis as { window?: unknown };

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
  const had = "window" in globalRef;
  const prev = globalRef.window;
  if (had) delete globalRef.window;
  try {
    assert.equal(readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY), null);
  } finally {
    if (had) globalRef.window = prev;
  }
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
  const source = read(ADMIN_CONTROLLER_PATH);

  assert.ok(source.includes("ADMIN_LAST_MODULE_STORAGE_KEY"));
  assert.equal(source.includes("CLINIC_LAST_MODULE_STORAGE_KEY"), false);

  assert.ok(
    source.includes(
      "writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, activeModule)",
    ),
  );
  assert.ok(
    source.includes("readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY)"),
  );

  // URL takes priority over storage; invalid stored value is ignored.
  assert.ok(source.includes('if (searchParams.get("module")) return;'));
  assert.ok(source.includes("if (!lastModule) return;"));

  // Restore uses replace, never push (no history pollution, no loop).
  assert.ok(
    source.includes("router.replace(`/dashboard/admin?module=${lastModule}`"),
  );
  assert.equal(
    source.includes("router.push(`/dashboard/admin?module=${lastModule}`"),
    false,
  );
  assert.ok(
    source.includes(
      "if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;",
    ),
  );

  // Hub stays accessible; storage stays centralized in the allowlisted helper.
  assert.ok(source.includes("setHasManuallyReturnedToHub(true);"));
  assert.equal(source.includes("localStorage"), false);
});

test("clinic controller persists/restores with the clinic key and replace-only restore", () => {
  const source = read(CLINIC_CONTROLLER_PATH);

  assert.ok(source.includes("CLINIC_LAST_MODULE_STORAGE_KEY"));
  assert.equal(source.includes("ADMIN_LAST_MODULE_STORAGE_KEY"), false);

  assert.ok(
    source.includes(
      "writeDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY, activeModule)",
    ),
  );
  assert.ok(
    source.includes("readDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY)"),
  );

  assert.ok(source.includes('if (searchParams.get("module")) return;'));
  assert.ok(source.includes("if (!lastModule) return;"));

  assert.ok(
    source.includes("router.replace(`${ROUTES.dashboard}?module=${lastModule}`"),
  );
  assert.equal(
    source.includes("router.push(`${ROUTES.dashboard}?module=${lastModule}`"),
    false,
  );
  assert.ok(
    source.includes(
      "if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;",
    ),
  );

  assert.ok(source.includes("setHasManuallyReturnedToHub(true);"));
  assert.equal(source.includes("localStorage"), false);
});

// ── 9.4 Scope: persisted-module surface stays client-side and self-contained ─

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
