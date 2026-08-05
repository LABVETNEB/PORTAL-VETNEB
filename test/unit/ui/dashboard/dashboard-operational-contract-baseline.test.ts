import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_MODULE_IDS,
  CLINIC_MODULE_IDS,
} from "../../../../frontend/src/features/dashboard/config/dashboardModules.ts";
import {
  ADMIN_MODULE_ROUTE_BASE,
  CLINIC_MODULE_ROUTE_BASE,
  DASHBOARD_ADMIN_MODULE_TOTAL,
  DASHBOARD_CLINIC_MODULE_TOTAL,
  DASHBOARD_MODULE_CONTRACTS,
  DASHBOARD_MODULE_TOTAL,
  DASHBOARD_OPERATIONAL_DRIFT,
  SUPER_SEARCH_CONTRACTS,
  SUPER_SEARCH_TOTAL,
  SUPER_SEARCH_WITHOUT_FILTER_BAR,
} from "../../../fixtures/dashboard-operational-contract.ts";

// ─────────────────────────────────────────────────────────────────────────────
// A01 · Dashboard operational contract baseline.
//
// Freezes the operational truth of the dashboard: the 15 canonical modules and
// the 7 super searchers (S1–S7). Every operational marker is checked against the
// executable source, and every divergence with the global audit is asserted as
// explicit drift instead of being normalized away.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..", "..", "..");

const sourceCache = new Map<string, string>();

/** Repo source with CRLF normalized so markers match on Windows and Linux. */
function readSource(repoRelativePath: string): string {
  const cached = sourceCache.get(repoRelativePath);
  if (cached !== undefined) return cached;

  const absolutePath = resolve(REPO_ROOT, repoRelativePath);
  assert.ok(existsSync(absolutePath), `missing source file: ${repoRelativePath}`);
  const source = readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
  sourceCache.set(repoRelativePath, source);
  return source;
}

test("dashboard module inventory is 15 modules: 10 admin + 5 clinic", () => {
  assert.equal(DASHBOARD_MODULE_CONTRACTS.length, DASHBOARD_MODULE_TOTAL);
  assert.equal(DASHBOARD_MODULE_TOTAL, 15);

  const adminModules = DASHBOARD_MODULE_CONTRACTS.filter((entry) => entry.role === "admin");
  const clinicModules = DASHBOARD_MODULE_CONTRACTS.filter((entry) => entry.role === "clinic");

  assert.equal(adminModules.length, DASHBOARD_ADMIN_MODULE_TOTAL);
  assert.equal(clinicModules.length, DASHBOARD_CLINIC_MODULE_TOTAL);
  assert.equal(DASHBOARD_ADMIN_MODULE_TOTAL, 10);
  assert.equal(DASHBOARD_CLINIC_MODULE_TOTAL, 5);
  assert.equal(
    adminModules.length + clinicModules.length,
    DASHBOARD_MODULE_CONTRACTS.length,
    "every module must be admin or clinic",
  );
});

test("module order matches the runtime registry exactly, with no duplicate ids", () => {
  const adminIds = DASHBOARD_MODULE_CONTRACTS.filter((entry) => entry.role === "admin").map(
    (entry) => entry.moduleId,
  );
  const clinicIds = DASHBOARD_MODULE_CONTRACTS.filter((entry) => entry.role === "clinic").map(
    (entry) => entry.moduleId,
  );

  assert.deepEqual(adminIds, [...ADMIN_MODULE_IDS], "admin order-of-record drifted");
  assert.deepEqual(clinicIds, [...CLINIC_MODULE_IDS], "clinic navigation order drifted");

  const allIds = DASHBOARD_MODULE_CONTRACTS.map((entry) => entry.moduleId);
  assert.equal(new Set(allIds).size, allIds.length, "module ids must be unique across roles");

  for (const role of ["admin", "clinic"] as const) {
    const roleEntries = DASHBOARD_MODULE_CONTRACTS.filter((entry) => entry.role === role);
    assert.deepEqual(
      roleEntries.map((entry) => entry.order),
      roleEntries.map((_, index) => index + 1),
      `${role} order must be dense and 1-based`,
    );
  }
});

test("every module declares its canonical deep link", () => {
  for (const entry of DASHBOARD_MODULE_CONTRACTS) {
    const base = entry.role === "admin" ? ADMIN_MODULE_ROUTE_BASE : CLINIC_MODULE_ROUTE_BASE;
    assert.equal(
      entry.route,
      `${base}?module=${entry.moduleId}`,
      `${entry.moduleId} route drifted`,
    );
  }

  assert.equal(ADMIN_MODULE_ROUTE_BASE, "/dashboard/admin");
  assert.equal(CLINIC_MODULE_ROUTE_BASE, "/dashboard");
});

test("every module sourcePath exists and exports its declared component", () => {
  for (const entry of DASHBOARD_MODULE_CONTRACTS) {
    assert.equal(
      entry.sourcePath.includes("\\"),
      false,
      `${entry.moduleId} sourcePath must use forward slashes`,
    );
    assert.ok(
      entry.sourcePath.startsWith("frontend/src/"),
      `${entry.moduleId} must live under frontend/src/`,
    );

    const source = readSource(entry.sourcePath);
    assert.ok(
      source.includes(`export function ${entry.component}(`),
      `${entry.sourcePath} must export function ${entry.component}`,
    );
  }
});

test("super searcher inventory is exactly S1–S7", () => {
  assert.equal(SUPER_SEARCH_CONTRACTS.length, SUPER_SEARCH_TOTAL);
  assert.equal(SUPER_SEARCH_TOTAL, 7);
  assert.deepEqual(
    SUPER_SEARCH_CONTRACTS.map((entry) => entry.id),
    ["S1", "S2", "S3", "S4", "S5", "S6", "S7"],
  );

  const moduleIds = new Set(DASHBOARD_MODULE_CONTRACTS.map((entry) => entry.moduleId));
  for (const contract of SUPER_SEARCH_CONTRACTS) {
    assert.ok(
      moduleIds.has(contract.moduleId),
      `${contract.id} points at unknown module ${contract.moduleId}`,
    );

    const module = DASHBOARD_MODULE_CONTRACTS.find(
      (entry) => entry.moduleId === contract.moduleId,
    );
    assert.ok(module);
    assert.equal(contract.role, module.role, `${contract.id} role drifted`);
    assert.equal(contract.route, module.route, `${contract.id} route drifted`);
  }

  assert.equal(
    new Set(SUPER_SEARCH_CONTRACTS.map((entry) => entry.moduleId)).size,
    SUPER_SEARCH_TOTAL,
    "each super searcher must own a distinct module",
  );
});

test("every super searcher operational marker is backed by its runtime source", () => {
  for (const contract of SUPER_SEARCH_CONTRACTS) {
    const source = readSource(contract.sourcePath);
    assert.ok(contract.markers.length > 0, `${contract.id} must declare markers`);
    assert.ok(contract.fields.length > 0, `${contract.id} must declare fields`);
    assert.ok(contract.apply.trim(), `${contract.id} must declare apply`);
    assert.ok(contract.emptyState.trim(), `${contract.id} must declare an empty state`);
    assert.ok(contract.errorState.trim(), `${contract.id} must declare an error state`);
    assert.ok(contract.desktopVisibility.trim(), `${contract.id} must declare desktop visibility`);
    assert.ok(contract.mobileAccess.trim(), `${contract.id} must declare mobile access`);

    for (const marker of contract.markers) {
      assert.ok(
        source.includes(marker),
        `${contract.id}: marker not found in ${contract.sourcePath}: ${marker}`,
      );
    }
  }
});

test("S1 is the only native-get contract and the only one persisted in the URL", () => {
  const nativeGet = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.mode === "native-get");
  assert.deepEqual(nativeGet.map((entry) => entry.id), ["S1"]);

  const urlPersisted = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.urlPersistence);
  assert.deepEqual(urlPersisted.map((entry) => entry.id), ["S1"]);

  const s1 = nativeGet[0];
  assert.equal(s1.moduleId, "audit-log");
  assert.equal(s1.filtering, "server-side");
  assert.equal(s1.backForwardRestores, true);
  assert.equal(s1.reloadRestores, true);
  assert.deepEqual(s1.fields, [
    "module",
    "event",
    "actorType",
    "from",
    "to",
    "clinicId",
    "reportId",
  ]);

  for (const contract of SUPER_SEARCH_CONTRACTS) {
    if (contract.id === "S1") continue;
    assert.equal(contract.urlPersistence, false, `${contract.id} must not persist in the URL`);
    assert.equal(contract.backForwardRestores, false, `${contract.id} has no history contract`);
    assert.equal(contract.reloadRestores, false, `${contract.id} has no reload contract`);
  }
});

test("query mode partition matches the runtime: 4 client-submit, 2 debounced-server", () => {
  const byMode = (mode: string) =>
    SUPER_SEARCH_CONTRACTS.filter((entry) => entry.mode === mode).map((entry) => entry.id);

  assert.deepEqual(byMode("client-submit"), ["S2", "S3", "S6", "S7"]);
  assert.deepEqual(byMode("debounced-server"), ["S4", "S5"]);

  const clientSide = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.filtering === "client-side");
  assert.deepEqual(clientSide.map((entry) => entry.id), ["S2", "S3", "S6", "S7"]);

  const serverSide = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.filtering === "server-side");
  assert.deepEqual(serverSide.map((entry) => entry.id), ["S1", "S4", "S5"]);

  // Every client-submit surface resets its own pager on apply.
  for (const contract of SUPER_SEARCH_CONTRACTS) {
    if (contract.mode !== "client-submit") continue;
    assert.ok(contract.pageReset, `${contract.id} must reset its pager on apply`);
    assert.ok(contract.clear, `${contract.id} must expose a clear action`);
  }
});

test("refresh, loading and disabled wiring is declared only where runtime has it", () => {
  const withRefresh = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.refresh !== null);
  assert.deepEqual(withRefresh.map((entry) => entry.id), ["S2", "S3", "S4", "S5", "S7"]);

  const withoutDisabled = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.disabled === null);
  assert.deepEqual(withoutDisabled.map((entry) => entry.id), ["S1", "S6"]);

  const withoutLoading = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.loading === null);
  assert.deepEqual(withoutLoading.map((entry) => entry.id), ["S1", "S6"]);

  // A declared disabled/loading wiring must never be an empty string.
  for (const contract of SUPER_SEARCH_CONTRACTS) {
    for (const [field, value] of [
      ["refresh", contract.refresh],
      ["loading", contract.loading],
      ["disabled", contract.disabled],
      ["clear", contract.clear],
      ["pageReset", contract.pageReset],
    ] as const) {
      if (value === null) continue;
      assert.ok(value.trim().length > 0, `${contract.id}.${field} must not be blank`);
    }
  }
});

test("clinic super searcher surfaces are conditional, admin ones are always rendered", () => {
  const conditional = SUPER_SEARCH_CONTRACTS.filter((entry) => entry.renderPolicy !== "always");
  assert.deepEqual(conditional.map((entry) => entry.id), ["S6", "S7"]);
  assert.deepEqual(
    conditional.map((entry) => entry.role),
    ["clinic", "clinic"],
    "only clinic surfaces gate their bar on loaded state",
  );
  assert.deepEqual(
    conditional.map((entry) => entry.renderPolicy),
    ["when-no-reports-load-error", "when-tokens-loaded"],
  );

  for (const contract of SUPER_SEARCH_CONTRACTS) {
    if (contract.role !== "admin") continue;
    assert.equal(contract.renderPolicy, "always", `${contract.id} admin bar must always render`);
  }

  // The two clinic policies are distinct: PR-BUG-01 has not unified them.
  assert.equal(
    new Set(conditional.map((entry) => entry.renderPolicy)).size,
    2,
    "the two clinic render policies must stay distinct until PR-BUG-01",
  );
});

test("S4 and S5 are the two surfaces without the shared FilterBar primitive", () => {
  assert.deepEqual(SUPER_SEARCH_WITHOUT_FILTER_BAR, ["S4", "S5"]);

  for (const contract of SUPER_SEARCH_CONTRACTS) {
    const source = readSource(contract.sourcePath);
    const usesFilterBar: boolean = source.includes("FilterBar");
    const expectsFilterBar: boolean = !SUPER_SEARCH_WITHOUT_FILTER_BAR.includes(contract.id);
    assert.equal(
      usesFilterBar,
      expectsFilterBar,
      `${contract.id} FilterBar usage drifted in ${contract.sourcePath}`,
    );
  }
});

test("audit-vs-runtime drift is recorded explicitly and proven against the source", () => {
  assert.ok(DASHBOARD_OPERATIONAL_DRIFT.length > 0, "A01 must record the observed drift");
  assert.deepEqual(
    DASHBOARD_OPERATIONAL_DRIFT.map((entry) => entry.id),
    ["D-01", "D-02", "D-03", "D-04", "D-05", "D-06"],
  );

  const driftedSurfaces = DASHBOARD_OPERATIONAL_DRIFT.map((entry) => entry.surface);
  for (const surface of ["S2", "S3", "S4", "S5"]) {
    assert.ok(
      driftedSurfaces.includes(surface),
      `${surface} drift must stay recorded`,
    );
  }
  assert.ok(
    driftedSurfaces.some((surface) => surface.includes("S6")),
    "S6 drift must stay recorded",
  );
  assert.ok(
    driftedSurfaces.some((surface) => surface.includes("S7")),
    "S7 drift must stay recorded",
  );

  const auditDoc = readSource("docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md");

  for (const record of DASHBOARD_OPERATIONAL_DRIFT) {
    assert.equal(record.resolution, "runtime-prevails", `${record.id} must not rewrite runtime`);
    assert.ok(record.auditClaim.trim(), `${record.id} must quote the audit claim`);
    assert.ok(record.runtimeBehaviour.trim(), `${record.id} must state the runtime behaviour`);
    assert.ok(record.auditSections.length > 0, `${record.id} must anchor an audit section`);
    for (const section of record.auditSections) {
      assert.ok(
        auditDoc.includes(`### ${section} `),
        `${record.id} anchors a missing audit heading: ### ${section}`,
      );
    }

    const source = readSource(record.runtimeSourcePath);
    assert.ok(record.runtimeMarkers.length > 0, `${record.id} must prove the runtime behaviour`);
    for (const marker of record.runtimeMarkers) {
      assert.ok(
        source.includes(marker),
        `${record.id}: runtime marker not found in ${record.runtimeSourcePath}: ${marker}`,
      );
    }
  }
});

test("drift D-01 and D-02 keep S4/S5 pinned to debounced-server with offset reset", () => {
  const s4 = SUPER_SEARCH_CONTRACTS.find((entry) => entry.id === "S4");
  const s5 = SUPER_SEARCH_CONTRACTS.find((entry) => entry.id === "S5");
  assert.ok(s4 && s5);

  assert.equal(s4.mode, "debounced-server");
  assert.equal(s4.filtering, "server-side");
  assert.match(String(s4.pageReset), /setOffset\(0\)/);

  assert.equal(s5.mode, "debounced-server");
  assert.equal(s5.filtering, "server-side");
  assert.match(String(s5.pageReset), /setOffset\(0\)/);
  assert.match(
    String(s5.pageReset),
    /select/,
    "S5 must record that both the debounce and the selects reset the offset",
  );
});
