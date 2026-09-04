import test from "node:test";
import assert from "node:assert/strict";

import {
  CLINIC_MODULE_IDS,
} from "../../frontend/src/features/dashboard/config/dashboardModules.ts";
import { ROUTES, DASHBOARD_ROUTES } from "../../frontend/src/lib/routes.ts";
import {
  ADMIN_REFERENCE_SURFACES,
  CLINIC_PARITY_SURFACES,
} from "../../frontend/e2e/helpers/mobile-parity-matrix.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CMP-12 (RC-017) — census guard.
//
// The clinic mobile surface census in `mobile-parity-matrix.ts` is not a hand-
// typed list this test trusts blindly: it is checked here against the
// CANONICAL route sources the rest of the app already derives navigation and
// module resolution from (`CLINIC_MODULE_IDS`, `DASHBOARD_ROUTES`). If a new
// clinic module or full route is added to either canonical source without a
// matching row in `CLINIC_PARITY_SURFACES`, this test fails — that is the
// guard the audit's RC-017 finding says never existed ("Nada bloquea añadir
// una superficie clínica nueva con gramática divergente").
// ─────────────────────────────────────────────────────────────────────────────

/** The 5 clinic full routes, derived from ROUTES/DASHBOARD_ROUTES — never hand-typed. */
const CLINIC_FULL_ROUTE_PATHS = DASHBOARD_ROUTES.filter(
  (route) => route !== ROUTES.dashboard && route !== ROUTES.dashboardAdmin,
);

test("CLINIC_PARITY_SURFACES census matches the canonical route sources (10/10, 0 N/A)", () => {
  assert.equal(
    CLINIC_PARITY_SURFACES.length,
    10,
    "clinic mobile surface census must stay at exactly 10 (5 module-embedded + 5 full routes)",
  );

  // ── module-embedded surfaces (CLN-001..005) derived from CLINIC_MODULE_IDS ──
  for (const moduleId of CLINIC_MODULE_IDS) {
    const expectedRoute = `/dashboard?module=${moduleId}`;
    const match = CLINIC_PARITY_SURFACES.find((surface) => surface.route === expectedRoute);
    assert.ok(
      match,
      `clinic module "${moduleId}" (from CLINIC_MODULE_IDS) has no row in CLINIC_PARITY_SURFACES — ` +
        `a new/renamed clinic module must be added to mobile-parity-matrix.ts before this guard passes`,
    );
  }

  // Every parity-matrix module-embedded route must correspond to a REAL
  // canonical module id — catches a stale/renamed entry left behind.
  const moduleEmbeddedSurfaces = CLINIC_PARITY_SURFACES.filter((surface) =>
    surface.route.startsWith("/dashboard?module="),
  );
  assert.equal(
    moduleEmbeddedSurfaces.length,
    CLINIC_MODULE_IDS.length,
    "CLINIC_PARITY_SURFACES module-embedded row count must equal CLINIC_MODULE_IDS.length exactly",
  );
  for (const surface of moduleEmbeddedSurfaces) {
    const moduleId = surface.route.replace("/dashboard?module=", "");
    assert.ok(
      (CLINIC_MODULE_IDS as readonly string[]).includes(moduleId),
      `${surface.id} (${surface.route}) references module id "${moduleId}", which is not in CLINIC_MODULE_IDS`,
    );
  }

  // ── full-route surfaces (CLN-006..010) derived from ROUTES/DASHBOARD_ROUTES ──
  for (const fullRoute of CLINIC_FULL_ROUTE_PATHS) {
    const match = CLINIC_PARITY_SURFACES.find((surface) => surface.route === fullRoute);
    assert.ok(
      match,
      `clinic full route "${fullRoute}" (from DASHBOARD_ROUTES) has no row in CLINIC_PARITY_SURFACES — ` +
        `a new/renamed clinic full route must be added to mobile-parity-matrix.ts before this guard passes`,
    );
  }

  const fullRouteSurfaces = CLINIC_PARITY_SURFACES.filter(
    (surface) => !surface.route.startsWith("/dashboard?module="),
  );
  assert.equal(
    fullRouteSurfaces.length,
    CLINIC_FULL_ROUTE_PATHS.length,
    "CLINIC_PARITY_SURFACES full-route row count must equal the derived DASHBOARD_ROUTES subset exactly",
  );
  for (const surface of fullRouteSurfaces) {
    assert.ok(
      CLINIC_FULL_ROUTE_PATHS.includes(surface.route as (typeof CLINIC_FULL_ROUTE_PATHS)[number]),
      `${surface.id} (${surface.route}) is not one of the canonical clinic full routes`,
    );
  }
});

test("every CLINIC_PARITY_SURFACES entry declares a resolvable adminReference (0 N/A)", () => {
  const unresolved: string[] = [];

  for (const surface of CLINIC_PARITY_SURFACES) {
    if (!(surface.adminReference in ADMIN_REFERENCE_SURFACES)) {
      unresolved.push(`${surface.id} -> "${surface.adminReference}"`);
    }
  }

  assert.deepEqual(
    unresolved,
    [],
    `every clinic surface must map to a declared ADMIN_REFERENCE_SURFACES entry — ` +
      `unresolved: ${unresolved.join(", ")}`,
  );
});

test("CLINIC_PARITY_SURFACES ids are unique and follow the CLN-0NN audit numbering", () => {
  const ids = CLINIC_PARITY_SURFACES.map((surface) => surface.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate CLN-* id in CLINIC_PARITY_SURFACES");

  for (const id of ids) {
    assert.match(id, /^CLN-\d{3}$/, `"${id}" does not follow the CLN-0NN audit numbering`);
  }
});
