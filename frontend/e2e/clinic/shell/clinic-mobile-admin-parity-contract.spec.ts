import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN_REFERENCE_SURFACES,
  CLINIC_PARITY_SURFACES,
  PARITY_VIEWPORTS,
  expectBoundsWithinTolerance,
  formatParityFailure,
  measureSettledParityContract,
  setParitySession,
  type ParityContract,
  type ParityRowPitch,
} from "../../helpers/mobile-parity-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// CMP-12 — cross-role runtime parity contract (RC-017 closure).
//
// Built incrementally: pilot (1 viewport x 1 surface, Capa A) -> layered
// assertions (B/C/E/F/order/scroll) -> scaled to 6 viewports x 1 surface ->
// scaled to all 10 clinic surfaces. Each stage was verified green before the
// next widened. See the roadmap's CMP-12 block for the full phase mandate.
// ─────────────────────────────────────────────────────────────────────────────

async function measureSurface(
  page: Page,
  role: "admin" | "clinic",
  route: string,
  readiness: string,
): Promise<ParityContract> {
  await setParitySession(page, role);
  await page.goto(route);
  await expect(page.locator(readiness).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return measureSettledParityContract(page, role);
}

/**
 * Capas A/B/scroll: shell, app bar, bottom nav, stage/workspace/viewport
 * hooks, ModuleCard surface geometry, no page-level scroll. Applies to
 * EVERY clinic surface — every one of the 10 sits inside the same shell.
 */
function assertShellAndSurfaceParity(
  admin: ParityContract,
  clinic: ParityContract,
  ctx: { clinicSurfaceId: string; adminReferenceId: string; viewportSlug: string },
) {
  // ── appBar ───────────────────────────────────────────────────────────
  expect(admin.appBar.bounds, formatParityFailure({ ...ctx, region: "appBar", property: "present(admin)", adminValue: admin.appBar.bounds, clinicValue: null })).not.toBeNull();
  expect(clinic.appBar.bounds, formatParityFailure({ ...ctx, region: "appBar", property: "present(clinic)", adminValue: null, clinicValue: clinic.appBar.bounds })).not.toBeNull();
  expectBoundsWithinTolerance({ ...ctx, region: "appBar", admin: admin.appBar.bounds, clinic: clinic.appBar.bounds, axis: "height" });
  expect(
    clinic.appBar.actionCount,
    formatParityFailure({ ...ctx, region: "appBar", property: "actionCount", adminValue: admin.appBar.actionCount, clinicValue: clinic.appBar.actionCount }),
  ).toBe(admin.appBar.actionCount);
  expect(
    clinic.appBar.hasSubtitle,
    formatParityFailure({ ...ctx, region: "appBar", property: "hasSubtitle", adminValue: admin.appBar.hasSubtitle, clinicValue: clinic.appBar.hasSubtitle }),
  ).toBe(admin.appBar.hasSubtitle);

  // ── bottomNav ────────────────────────────────────────────────────────
  expectBoundsWithinTolerance({ ...ctx, region: "bottomNav", admin: admin.bottomNav.bounds, clinic: clinic.bottomNav.bounds, axis: "height" });
  expect(
    clinic.bottomNav.itemCount,
    formatParityFailure({ ...ctx, region: "bottomNav", property: "itemCount", adminValue: admin.bottomNav.itemCount, clinicValue: clinic.bottomNav.itemCount }),
  ).toBe(admin.bottomNav.itemCount);

  // ── stage / workspace / viewport hooks ──────────────────────────────
  expect(clinic.stage.count, formatParityFailure({ ...ctx, region: "stage", property: "count", adminValue: admin.stage.count, clinicValue: clinic.stage.count })).toBe(1);
  expect(admin.stage.count).toBe(1);
  expect(clinic.workspace.present, formatParityFailure({ ...ctx, region: "workspace", property: "present", adminValue: admin.workspace.present, clinicValue: clinic.workspace.present })).toBe(true);
  expect(admin.workspace.present).toBe(true);
  expect(clinic.viewport.present, formatParityFailure({ ...ctx, region: "viewport", property: "present", adminValue: admin.viewport.present, clinicValue: clinic.viewport.present })).toBe(true);
  expect(admin.viewport.present).toBe(true);

  // ── Capa B: ModuleCard / surface ────────────────────────────────────
  expect(clinic.surface.count, formatParityFailure({ ...ctx, region: "surface", property: "count", adminValue: admin.surface.count, clinicValue: clinic.surface.count })).toBe(1);
  expect(admin.surface.count).toBe(1);
  expect(admin.surface.bounds, formatParityFailure({ ...ctx, region: "surface", property: "present(admin)", adminValue: admin.surface.bounds, clinicValue: null })).not.toBeNull();
  expect(clinic.surface.bounds, formatParityFailure({ ...ctx, region: "surface", property: "present(clinic)", adminValue: null, clinicValue: clinic.surface.bounds })).not.toBeNull();

  const adminSurfaceTop = admin.surface.bounds!.y - (admin.appBar.bounds ? admin.appBar.bounds.y + admin.appBar.bounds.height : 0);
  const clinicSurfaceTop = clinic.surface.bounds!.y - (clinic.appBar.bounds ? clinic.appBar.bounds.y + clinic.appBar.bounds.height : 0);
  expect(
    Math.abs(adminSurfaceTop - clinicSurfaceTop),
    formatParityFailure({ ...ctx, region: "surface", property: "surfaceTop", adminValue: adminSurfaceTop, clinicValue: clinicSurfaceTop }),
  ).toBeLessThanOrEqual(0.5);

  const adminSurfaceBottomGap = admin.bottomNav.bounds ? admin.bottomNav.bounds.y - (admin.surface.bounds!.y + admin.surface.bounds!.height) : null;
  const clinicSurfaceBottomGap = clinic.bottomNav.bounds ? clinic.bottomNav.bounds.y - (clinic.surface.bounds!.y + clinic.surface.bounds!.height) : null;
  expect(
    adminSurfaceBottomGap !== null && clinicSurfaceBottomGap !== null && Math.abs(adminSurfaceBottomGap - clinicSurfaceBottomGap) <= 0.5,
    formatParityFailure({ ...ctx, region: "surface", property: "surfaceBottomGap", adminValue: adminSurfaceBottomGap, clinicValue: clinicSurfaceBottomGap }),
  ).toBe(true);
  expectBoundsWithinTolerance({ ...ctx, region: "surface", admin: admin.surface.bounds, clinic: clinic.surface.bounds, axis: "width" });

  // ── no page-level scroll on either role ─────────────────────────────
  expect(admin.scroll.pageScrollsX, `${ctx.adminReferenceId} @ ${ctx.viewportSlug}: admin no horizontal page scroll`).toBe(false);
  expect(admin.scroll.pageScrollsY, `${ctx.adminReferenceId} @ ${ctx.viewportSlug}: admin no vertical page scroll`).toBe(false);
  expect(clinic.scroll.pageScrollsX, `${ctx.clinicSurfaceId} @ ${ctx.viewportSlug}: clinic no horizontal page scroll`).toBe(false);
  expect(clinic.scroll.pageScrollsY, `${ctx.clinicSurfaceId} @ ${ctx.viewportSlug}: clinic no vertical page scroll`).toBe(false);
}

/**
 * The five clinic workspace surfaces whose metric run is desktop-only by
 * product contract (`hidden md:flex`), so a phone must show none. Frozen as a
 * roster rather than derived from a measurement: derived, it would absorb a
 * regression on a sixth surface as "expected". The full routes CLN-006..010 are
 * deliberately absent — they still paint their run and still compare normally.
 * Their own grammar is covered by `dashboard-clinic-metric-run-parity.spec.ts`.
 */
const CLINIC_DESKTOP_ONLY_METRIC_SURFACES = new Set([
  "CLN-001", // operaciones — band retired whole (the run was its only child)
  "CLN-002", // informes workspace
  "CLN-003", // logistica workspace
  "CLN-004", // perfil
  "CLN-005", // tokens (already desktop-only since PR #1690)
]);

/**
 * Capa C: ModuleMetricRun. Only asserted when BOTH sides actually expose a
 * mobile-visible metric run — some admin read-only cards (sessions, users-
 * roles) mount `[data-dashboard-b14-metrics]` desktop-only (`hidden md:grid`),
 * so their reference mapping must not force a count==1 that role can never
 * satisfy on mobile. A skip is reported, never silently dropped.
 */
function assertMetricsParity(
  admin: ParityContract,
  clinic: ParityContract,
  ctx: { clinicSurfaceId: string; adminReferenceId: string; viewportSlug: string },
): boolean {
  // Several admin read-only cards (sessions, users-roles, pricing, resumen,
  // clinics) mount `[data-dashboard-b14-metrics]` desktop-only (`hidden
  // md:grid`) — confirmed by direct measurement, not assumed. When the
  // MAPPED admin reference itself has no mobile-visible metric run, presence
  // parity cannot be asserted against it; the metric run's own canonical
  // grammar (display/gap/height) is already covered independently by
  // `dashboard-clinic-metric-run-parity.spec.ts` (CMP-05/09/11), so this is
  // a legitimate skip, not a silently dropped contract.
  // The five clinic WORKSPACE surfaces retired their mobile metric band by
  // product decision: the run stays mounted for desktop (`hidden md:flex`) and
  // paints nothing below `md`, so its height went back to the module. Against a
  // mapped Admin reference that DOES paint one (CLN-002/003 map to
  // admin-auditoria), presence parity would now fail on a difference that is
  // intended, so it is stated here instead of being inferred.
  //
  // This is an exception to the presence comparison ONLY, and it is asserted in
  // the positive direction: the clinic side must show exactly ZERO runs. A run
  // reappearing on any of these five phones fails here as loudly as a missing
  // one used to. Every other layer of this contract — shell, surface, rows,
  // pager, order, scroll — keeps comparing both roles unchanged.
  if (CLINIC_DESKTOP_ONLY_METRIC_SURFACES.has(ctx.clinicSurfaceId)) {
    expect(
      clinic.metrics.count,
      formatParityFailure({ ...ctx, region: "metrics", property: "count(desktop-only clinic surface)", adminValue: admin.metrics.count, clinicValue: clinic.metrics.count }),
    ).toBe(0);
    return false;
  }

  if (admin.metrics.count === 0) {
    return false;
  }
  expect(clinic.metrics.count, formatParityFailure({ ...ctx, region: "metrics", property: "count", adminValue: admin.metrics.count, clinicValue: clinic.metrics.count })).toBe(1);
  expect(admin.metrics.count).toBe(1);
  expectBoundsWithinTolerance({ ...ctx, region: "metrics", admin: admin.metrics.bounds, clinic: clinic.metrics.bounds, axis: "height" });
  return true;
}

/**
 * Capa E: operational rows. Skipped whenever EITHER side has no visible
 * adaptive row — the archetype mapping is a pattern reference, not a literal
 * content mirror (Nico's Phase 3: "NO exigir que ambas rutas tengan mismo
 * contenido"). Confirmed by direct measurement, not assumed: e.g. CLN-005
 * (tokens) genuinely renders zero rows against the current fixture data (a
 * real empty state, "Sin tokens particulares" — not a broken selector).
 *
 * Three separable obligations, in this order:
 *
 *   A. PRESENCE   both sides actually paint adaptive rows.
 *   B. GRAMMAR    each role's canvas declares the pitch tier ITS OWN matrix
 *                 entry contracts it to declare — Clinic against
 *                 `ParitySurface.expectedRowPitch`, Admin against
 *                 `AdminReferenceSurface.expectedRowPitch`.
 *   C. CROSS-ROLE pitch equality and first-row height parity, asserted only
 *                 when the two matrix entries declare the SAME grammar.
 *
 * C is gated on the DECLARATIONS, never on the measured values: two surfaces
 * that both drifted to the same wrong tier still fail B, and an Admin
 * reference that silently changed tier fails B rather than being read as a
 * "difference" that excuses Clinic from C.
 *
 * The one intentional divergence today is CLN-003 (clinic Logística): its
 * visit row is a real two-line grammar — clinic name over scheduled date —
 * whose intrinsic height is the `tall` tier exactly, while its mapped Admin
 * reference (`admin-auditoria`) is a one-line `regular` audit entry. Forcing
 * those two to the same pitch is what clipped the date line off every row on
 * every phone. Row pitch equality and row HEIGHT equality are the only two
 * assertions that difference suspends, because they are the only two that are
 * a direct consequence of the tier; presence, shell, surface, metrics, pager,
 * order and no-scroll keep comparing both roles unchanged. The row's own
 * physics (two real lines, content inside the row rect, no clipping, last row
 * above the pager) is a separate contract and is owned by
 * `dashboard-clinic-logistica-mobile-parity.spec.ts` — not restated here.
 */
function assertRowsParity(
  admin: ParityContract,
  clinic: ParityContract,
  ctx: { clinicSurfaceId: string; adminReferenceId: string; viewportSlug: string },
  grammar: { readonly clinic: ParityRowPitch; readonly admin: ParityRowPitch },
): boolean {
  if (admin.rows.adaptiveRowCount === 0 || clinic.rows.adaptiveRowCount === 0) {
    return false;
  }

  // ── A. presence ──────────────────────────────────────────────────────
  expect(clinic.rows.adaptiveRowCount, formatParityFailure({ ...ctx, region: "rows", property: "adaptiveRowCount>0", adminValue: admin.rows.adaptiveRowCount, clinicValue: clinic.rows.adaptiveRowCount })).toBeGreaterThan(0);
  expect(admin.rows.adaptiveRowCount).toBeGreaterThan(0);

  // ── B. declared grammar, per role ────────────────────────────────────
  expect(clinic.rows.pitch, formatParityFailure({ ...ctx, region: "rows", property: "pitch(declared clinic grammar)", adminValue: grammar.clinic, clinicValue: clinic.rows.pitch })).toBe(grammar.clinic);
  expect(admin.rows.pitch, formatParityFailure({ ...ctx, region: "rows", property: "pitch(declared admin grammar)", adminValue: admin.rows.pitch, clinicValue: grammar.admin })).toBe(grammar.admin);

  // ── C. cross-role, only across a shared declared grammar ─────────────
  if (grammar.clinic !== grammar.admin) {
    return true;
  }
  expect(clinic.rows.pitch, formatParityFailure({ ...ctx, region: "rows", property: "pitch", adminValue: admin.rows.pitch, clinicValue: clinic.rows.pitch })).toBe(admin.rows.pitch);
  expectBoundsWithinTolerance({ ...ctx, region: "rows", admin: admin.rows.firstRowBounds, clinic: clinic.rows.firstRowBounds, axis: "height" });
  return true;
}

/**
 * Capa F: pager. Skipped whenever EITHER side has no pager — a form/tabs
 * surface like CLN-004 (perfil) legitimately has none, regardless of whether
 * its mapped archetype does.
 */
function assertPagerParity(
  admin: ParityContract,
  clinic: ParityContract,
  ctx: { clinicSurfaceId: string; adminReferenceId: string; viewportSlug: string },
): boolean {
  if (admin.pager.bounds === null || clinic.pager.bounds === null) {
    return false;
  }
  expect(admin.pager.bounds, formatParityFailure({ ...ctx, region: "pager", property: "present(admin)", adminValue: admin.pager.bounds, clinicValue: null })).not.toBeNull();
  expect(clinic.pager.bounds, formatParityFailure({ ...ctx, region: "pager", property: "present(clinic)", adminValue: null, clinicValue: clinic.pager.bounds })).not.toBeNull();
  expectBoundsWithinTolerance({ ...ctx, region: "pager", admin: admin.pager.bounds, clinic: clinic.pager.bounds, axis: "height" });
  expect(clinic.pager.stateText, formatParityFailure({ ...ctx, region: "pager", property: "stateText present", adminValue: admin.pager.stateText, clinicValue: clinic.pager.stateText })).not.toBeNull();
  expect(admin.pager.stateText).not.toBeNull();
  return true;
}

/** Order contract: DOM-geometry y-ascending across every region actually present. */
function assertOrderParity(
  admin: ParityContract,
  clinic: ParityContract,
  ctx: { clinicSurfaceId: string; adminReferenceId: string; viewportSlug: string },
) {
  const isAscending = (ys: (number | undefined)[]) => {
    const defined = ys.filter((y): y is number => y !== undefined);
    return defined.every((y, i) => i === 0 || y >= defined[i - 1] - 0.5);
  };
  const adminYs = [admin.appBar.bounds?.y, admin.surface.bounds?.y, admin.metrics.bounds?.y, admin.rows.firstRowBounds?.y, admin.pager.bounds?.y, admin.bottomNav.bounds?.y];
  const clinicYs = [clinic.appBar.bounds?.y, clinic.surface.bounds?.y, clinic.metrics.bounds?.y, clinic.rows.firstRowBounds?.y, clinic.pager.bounds?.y, clinic.bottomNav.bounds?.y];
  expect(isAscending(adminYs), formatParityFailure({ ...ctx, region: "order", property: "y-ascending(admin)", adminValue: adminYs, clinicValue: null })).toBe(true);
  expect(isAscending(clinicYs), formatParityFailure({ ...ctx, region: "order", property: "y-ascending(clinic)", adminValue: null, clinicValue: clinicYs })).toBe(true);
}

// ── Phase 7: full matrix — all 10 clinic surfaces x all 6 viewports = 60 ────
for (const surface of CLINIC_PARITY_SURFACES) {
  const adminReference = ADMIN_REFERENCE_SURFACES[surface.adminReference];

  for (const viewport of PARITY_VIEWPORTS) {
    test(`CMP-12 — ${surface.id} vs ${surface.adminReference} @ ${viewport.slug}`, async ({
      browser,
    }) => {
      const adminContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const clinicContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });

      try {
        const admin = await measureSurface(await adminContext.newPage(), "admin", adminReference.route, adminReference.readiness);
        const clinic = await measureSurface(await clinicContext.newPage(), "clinic", surface.route, surface.readiness);
        const ctx = { clinicSurfaceId: surface.id, adminReferenceId: surface.adminReference, viewportSlug: viewport.slug };

        assertShellAndSurfaceParity(admin, clinic, ctx);
        assertMetricsParity(admin, clinic, ctx);
        assertRowsParity(admin, clinic, ctx, {
          clinic: surface.expectedRowPitch,
          admin: adminReference.expectedRowPitch,
        });
        assertPagerParity(admin, clinic, ctx);
        assertOrderParity(admin, clinic, ctx);
      } finally {
        await adminContext.close();
        await clinicContext.close();
      }
    });
  }
}
