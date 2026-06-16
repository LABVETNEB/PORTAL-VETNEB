import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

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

test("dashboard last-module helper uses role-separated keys and is SSR/error safe", () => {
  const source = read(STORAGE_PATH);

  assert.ok(source.includes('"vetneb:dashboard:last-module:clinic"'));
  assert.ok(source.includes('"vetneb:dashboard:last-module:admin"'));

  // Client-only and resilient to disabled/unavailable storage.
  assert.ok(source.includes('typeof window === "undefined"'));
  assert.ok(source.includes("try {"));
  assert.ok(source.includes("catch"));

  // Only a module id is read/written — no sensitive data handling.
  for (const forbidden of [
    "token",
    "session",
    "cookie",
    "password",
    "clinicid",
    "userid",
  ]) {
    assert.equal(
      source.toLowerCase().includes(forbidden),
      false,
      `storage helper must not reference ${forbidden}`,
    );
  }
});

test("admin controller persists/restores the last module with the admin key", () => {
  const source = read(ADMIN_CONTROLLER_PATH);

  assert.ok(source.includes("ADMIN_LAST_MODULE_STORAGE_KEY"));
  assert.equal(source.includes("CLINIC_LAST_MODULE_STORAGE_KEY"), false);

  // Persist only a valid active module.
  assert.ok(
    source.includes(
      "writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, activeModule)",
    ),
  );

  // Restore: only when the URL has no module, validating the stored value.
  assert.ok(source.includes('if (searchParams.get("module")) return;'));
  assert.ok(
    source.includes("readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY)"),
  );
  assert.ok(
    source.includes("router.replace(`/dashboard/admin?module=${lastModule}`"),
  );

  // Hub stays accessible: manual return suppresses immediate restore.
  assert.ok(source.includes("setHasManuallyReturnedToHub(true);"));
  assert.ok(
    source.includes(
      "if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;",
    ),
  );
});

test("clinic controller persists/restores the last module with the clinic key", () => {
  const source = read(CLINIC_CONTROLLER_PATH);

  assert.ok(source.includes("CLINIC_LAST_MODULE_STORAGE_KEY"));
  assert.equal(source.includes("ADMIN_LAST_MODULE_STORAGE_KEY"), false);

  assert.ok(
    source.includes(
      "writeDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY, activeModule)",
    ),
  );

  assert.ok(source.includes('if (searchParams.get("module")) return;'));
  assert.ok(
    source.includes("readDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY)"),
  );
  assert.ok(
    source.includes("router.replace(`${ROUTES.dashboard}?module=${lastModule}`"),
  );

  assert.ok(source.includes("setHasManuallyReturnedToHub(true);"));
  assert.ok(
    source.includes(
      "if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;",
    ),
  );
});
