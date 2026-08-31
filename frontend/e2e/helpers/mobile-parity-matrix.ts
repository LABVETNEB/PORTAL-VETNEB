import { expect, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// CMP-12 — cross-role runtime parity matrix.
//
// This is a NEW instrument, deliberately separate from `dashboard-geometry-
// matrix.ts` (A02): that tool freezes ONE role's geometry against a committed
// baseline over time (self-comparison). This one measures Admin and Clinic in
// THE SAME test run and compares them to each other. Neither replaces the
// other; A02 stays untouched by CMP-12.
//
// Every selector below is a hook already shared by both roles' runtime after
// CMP-01…11 (ModuleCard, ModuleMetricRun, DashboardPager, the mobile nav, the
// topbar, the module stage/workspace/viewport chain). No new data-* attribute
// is added to `frontend/src/**` for this file to work.
// ─────────────────────────────────────────────────────────────────────────────

export const PARITY_SESSION_COOKIE = {
  admin: { name: "admin_session_id", value: "e2e_populated_admin_session" },
  clinic: { name: "app_session_id", value: "e2e_populated_clinic_session" },
} as const;

export type ParityRole = "admin" | "clinic";

export type ParityViewport = {
  readonly slug: string;
  readonly width: number;
  readonly height: number;
};

/** The 6 canonical mobile viewports derived from the repository (CMP-01…11's own matrix). */
export const PARITY_VIEWPORTS: readonly ParityViewport[] = [
  { slug: "w360x740", width: 360, height: 740 },
  { slug: "w360x800", width: 360, height: 800 },
  { slug: "w375x812", width: 375, height: 812 },
  { slug: "w390x844", width: 390, height: 844 },
  { slug: "w412x915", width: 412, height: 915 },
  { slug: "w430x932", width: 430, height: 932 },
] as const;

export type ParitySurface = {
  /** Stable id — CLN-001…010, matching the audit's own numbering. */
  readonly id: string;
  readonly route: string;
  /** Selector awaited visible before measuring. */
  readonly readiness: string;
  /**
   * Admin surface id (see ADMIN_REFERENCE_SURFACES) this Clinic surface is
   * compared against. Not "same content" — same operational archetype.
   */
  readonly adminReference: string;
};

/** The 10 Clinic mobile surfaces — CMP-08…11's own census, not re-derived by hand elsewhere. */
export const CLINIC_PARITY_SURFACES: readonly ParitySurface[] = [
  {
    id: "CLN-001",
    route: "/dashboard?module=operaciones",
    readiness: '[data-dashboard-module-workspace="operaciones"]',
    adminReference: "admin-resumen",
  },
  {
    id: "CLN-002",
    route: "/dashboard?module=informes",
    readiness: '[data-dashboard-module-workspace="informes"]',
    adminReference: "admin-auditoria",
  },
  {
    id: "CLN-003",
    route: "/dashboard?module=logistica",
    readiness: '[data-dashboard-module-workspace="logistica"]',
    adminReference: "admin-auditoria",
  },
  {
    id: "CLN-004",
    route: "/dashboard?module=perfil",
    readiness: '[data-dashboard-module-workspace="perfil"]',
    adminReference: "admin-precios",
  },
  {
    id: "CLN-005",
    route: "/dashboard?module=tokens",
    readiness: '[data-dashboard-module-workspace="tokens"]',
    adminReference: "admin-usuarios",
  },
  {
    id: "CLN-006",
    route: "/dashboard/informes",
    readiness: '[data-dashboard-module-workspace="informes-full"]',
    adminReference: "admin-auditoria",
  },
  {
    id: "CLN-007",
    route: "/dashboard/logistica",
    readiness: '[data-dashboard-module-workspace="logistica-full"]',
    adminReference: "admin-auditoria",
  },
  {
    id: "CLN-008",
    route: "/dashboard/logistica/visitas",
    readiness: '[data-dashboard-module-workspace="logistica-visitas"]',
    adminReference: "admin-auditoria",
  },
  {
    id: "CLN-009",
    route: "/dashboard/logistica/rutas",
    readiness: '[data-dashboard-module-workspace="logistica-rutas"]',
    adminReference: "admin-auditoria",
  },
  {
    id: "CLN-010",
    route: "/dashboard/logistica/metricas",
    readiness: '[data-dashboard-module-workspace="logistica-metricas"]',
    adminReference: "admin-auditoria",
  },
] as const;

export type AdminReferenceSurface = {
  readonly route: string;
  readonly readiness: string;
};

/**
 * Admin canonical archetype references. Not a 1:1 route mirror of Clinic —
 * each entry is the Admin surface whose row/pager/metrics/state GRAMMAR is
 * the pattern the mapped Clinic surface(s) were built to match (CMP-08's own
 * canonical row reference was AdminSessionsReadOnlyCard/AdminUsersRolesReadOnlyCard/
 * AdminMobileAuditModule; CMP-05's metric run and CMP-09's pager are literally
 * the same shared components on both roles for shell-level contracts).
 */
export const ADMIN_REFERENCE_SURFACES: Readonly<Record<string, AdminReferenceSurface>> = {
  "admin-resumen": {
    route: "/dashboard/admin?module=admin",
    readiness: '[data-dashboard-module-workspace="admin"]',
  },
  "admin-sesiones": {
    route: "/dashboard/admin?module=admin-sessions",
    readiness: '[data-dashboard-module-workspace="admin-sessions"]',
  },
  "admin-usuarios": {
    route: "/dashboard/admin?module=admin-users-roles",
    readiness: '[data-dashboard-module-workspace="admin-users-roles"]',
  },
  "admin-precios": {
    route: "/dashboard/admin?module=admin-pricing",
    readiness: '[data-dashboard-module-workspace="admin-pricing"]',
  },
  "admin-clinicas": {
    route: "/dashboard/admin?module=admin-clinics",
    readiness: '[data-dashboard-module-workspace="admin-clinics"]',
  },
  "admin-auditoria": {
    route: "/dashboard/admin?module=audit-log",
    readiness: '[data-dashboard-module-workspace="audit-log"]',
  },
} as const;

export async function setParitySession(page: Page, role: ParityRole): Promise<void> {
  const cookie = PARITY_SESSION_COOKIE[role];
  await page.context().addCookies([{ ...cookie, url: "http://127.0.0.1:3000" }]);
}

// ── Measurement schema ──────────────────────────────────────────────────────

export type ParityBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ParityContract = {
  readonly role: ParityRole;
  readonly appBar: {
    readonly bounds: ParityBounds | null;
    readonly actionCount: number;
    readonly hasSubtitle: boolean;
  };
  readonly bottomNav: {
    readonly bounds: ParityBounds | null;
    readonly itemCount: number;
  };
  readonly stage: { readonly count: number };
  readonly workspace: { readonly present: boolean };
  readonly viewport: { readonly present: boolean };
  readonly surface: {
    readonly count: number;
    readonly bounds: ParityBounds | null;
  };
  readonly metrics: {
    readonly count: number;
    readonly bounds: ParityBounds | null;
  };
  readonly rows: {
    readonly pitch: string | null;
    readonly adaptiveRowCount: number;
    readonly firstRowBounds: ParityBounds | null;
  };
  readonly pager: {
    readonly bounds: ParityBounds | null;
    readonly stateText: string | null;
  };
  readonly scroll: {
    readonly pageScrollsX: boolean;
    readonly pageScrollsY: boolean;
    readonly localScrollerCount: number;
  };
};

/**
 * Reads the full parity contract from whatever page is currently loaded.
 * Purely selector-driven — every hook here is shared by both roles, so the
 * SAME function measures Admin and Clinic alike.
 */
export async function measureParityContract(page: Page, role: ParityRole): Promise<ParityContract> {
  return page.evaluate((currentRole) => {
    const round = (value: number) => Math.round(value * 100) / 100;

    const isVisible = (element: Element): boolean => {
      const candidate = element as Element & {
        checkVisibility?: (options?: Record<string, boolean>) => boolean;
      };
      if (typeof candidate.checkVisibility === "function") {
        return candidate.checkVisibility({ checkVisibilityCSS: true });
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const firstVisible = (root: ParentNode, selector: string): Element | null => {
      for (const element of Array.from(root.querySelectorAll(selector))) {
        if (isVisible(element)) return element;
      }
      return null;
    };

    const allVisible = (root: ParentNode, selector: string): Element[] =>
      Array.from(root.querySelectorAll(selector)).filter(isVisible);

    const boundsOf = (element: Element | null): { x: number; y: number; width: number; height: number } | null => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) };
    };

    const appBarEl = firstVisible(document, 'header[data-dashboard-topbar-polish="true"]');
    const appBarActionButtons = appBarEl
      ? Array.from(appBarEl.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(isVisible)
      : [];
    // The actual shared subtitle hook (already established and anchored by
    // `admin-mobile-app-shell-absolute-no-scroll.spec.ts`) is
    // `data-dashboard-topbar-subtitle`, set unconditionally by
    // `DashboardTopbar.tsx` for both roles — not `data-dashboard-chrome-
    // secondary`, which is an unrelated hook used for in-content description
    // lines elsewhere.
    const appBarSubtitle = appBarEl
      ? appBarEl.querySelector('[data-dashboard-topbar-subtitle="true"]')
      : null;

    const bottomNavEl = firstVisible(document, `[data-dashboard-mobile-nav="${currentRole}"]`);
    const bottomNavItems = bottomNavEl
      ? allVisible(bottomNavEl, "[data-dashboard-mobile-nav-item]")
      : [];

    const stageEls = allVisible(document, '[data-dashboard-module-stage="true"]');
    const workspaceEl = firstVisible(document, "[data-dashboard-module-workspace]");
    const viewportEl = firstVisible(document, "[data-dashboard-module-viewport]");

    const surfaceEls = allVisible(document, "section.dashboard-surface, .dashboard-surface");
    const primarySurface = surfaceEls[0] ?? null;

    const metricsEl = firstVisible(document, "[data-dashboard-b14-metrics]");
    const metricsAll = allVisible(document, "[data-dashboard-b14-metrics]");

    const rowPitchCanvas = firstVisible(document, "[data-dashboard-row-pitch]");
    const adaptiveRows = allVisible(document, '[data-dashboard-adaptive-row="true"]');
    const firstRow = adaptiveRows[0] ?? null;

    // The shared hook across BOTH roles' pager primitives (DashboardPager,
    // CompactPager and Admin's own AdminMobileOpsPager) is the adaptive
    // reserved-region marker, not `data-dashboard-pager` — Admin's pager
    // never carries that attribute, only `data-admin-mobile-ops-pager`.
    const pagerEl = firstVisible(document, '[data-dashboard-adaptive-reserved-region="pager"]');
    // Admin's own `AdminMobileOpsPager` never carries `[data-dashboard-pager-
    // state]` (Clinic-only hook) — its state text is plain content inside the
    // shared reserved region. Falling back to the pager's own trimmed text
    // content reads the label on both roles without a role-specific hook.
    const pagerStateEl = pagerEl ? pagerEl.querySelector("[data-dashboard-pager-state]") : null;
    const pagerStateText = pagerStateEl ? pagerStateEl.textContent : pagerEl ? pagerEl.textContent : null;

    const localScrollers = Array.from(document.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const style = window.getComputedStyle(el);
      if (!["auto", "scroll"].includes(style.overflowY) && !["auto", "scroll"].includes(style.overflowX)) {
        return false;
      }
      return el.scrollHeight - el.clientHeight > 2 || el.scrollWidth - el.clientWidth > 2;
    });

    return {
      role: currentRole,
      appBar: {
        bounds: boundsOf(appBarEl),
        actionCount: appBarActionButtons.length,
        hasSubtitle: appBarSubtitle !== null && isVisible(appBarSubtitle),
      },
      bottomNav: {
        bounds: boundsOf(bottomNavEl),
        itemCount: bottomNavItems.length,
      },
      stage: { count: stageEls.length },
      workspace: { present: workspaceEl !== null },
      viewport: { present: viewportEl !== null },
      surface: {
        count: surfaceEls.length,
        bounds: boundsOf(primarySurface),
      },
      metrics: {
        count: metricsAll.length,
        bounds: boundsOf(metricsEl),
      },
      rows: {
        pitch: rowPitchCanvas ? rowPitchCanvas.getAttribute("data-dashboard-row-pitch") : null,
        adaptiveRowCount: adaptiveRows.length,
        firstRowBounds: boundsOf(firstRow),
      },
      pager: {
        bounds: boundsOf(pagerEl),
        stateText: pagerStateText,
      },
      scroll: {
        pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        pageScrollsY: document.documentElement.scrollHeight > document.documentElement.clientHeight + 2,
        localScrollerCount: localScrollers.length,
      },
    };
  }, role);
}

/** Waits for fonts + two committed frames — no timeout-based readiness. */
export async function waitForParityLayoutSettled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      document.fonts.ready.then(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      ),
  );
}

/**
 * Measures once the contract is quiescent (adaptive capacity engines settle
 * after a measure -> derive -> repaint pass, same reasoning as A02's own
 * `measureSurfaceGeometry`).
 */
export async function measureSettledParityContract(
  page: Page,
  role: ParityRole,
): Promise<ParityContract> {
  const requiredStableReads = 3;
  let current = await measureParityContract(page, role);
  let serialized = JSON.stringify(current);
  let stableReads = 0;

  for (let attempt = 0; attempt < 24 && stableReads < requiredStableReads; attempt += 1) {
    await waitForParityLayoutSettled(page);
    await page.waitForTimeout(80);
    const next = await measureParityContract(page, role);
    const nextSerialized = JSON.stringify(next);

    if (nextSerialized === serialized) {
      stableReads += 1;
      continue;
    }

    stableReads = 0;
    current = next;
    serialized = nextSerialized;
  }

  return current;
}

// ── Tolerances ───────────────────────────────────────────────────────────────
// Structural, content-independent geometry: 0.5 CSS px (per Nico's directive —
// tighter than A02's 2px, since this compares two live roles in the same run
// rather than tolerating cross-platform font rasterization drift). Computed
// styles compare exactly. Content-dependent geometry (row/surface HEIGHT that
// legitimately varies with domain row count or text length) is never compared
// as a pixel value — only its structural contract (pitch token, primitive
// identity) is asserted; see the spec files for which fields fall in which
// bucket.

export const PARITY_STRUCTURAL_TOLERANCE_PX = 0.5;

export function boundsDeltaWithinTolerance(
  a: ParityBounds | null,
  b: ParityBounds | null,
  axis: keyof ParityBounds,
  tolerance = PARITY_STRUCTURAL_TOLERANCE_PX,
): { readonly withinTolerance: boolean; readonly delta: number | null } {
  if (a === null || b === null) {
    return { withinTolerance: a === b, delta: null };
  }
  const delta = Math.round(Math.abs(a[axis] - b[axis]) * 1000) / 1000;
  return { withinTolerance: delta <= tolerance, delta };
}

/**
 * Diagnosable failure message: surface, admin reference, viewport, region,
 * property, both values, delta, tolerance — never a bare "expected/received".
 */
export function formatParityFailure(params: {
  readonly clinicSurfaceId: string;
  readonly adminReferenceId: string;
  readonly viewportSlug: string;
  readonly region: string;
  readonly property: string;
  readonly adminValue: unknown;
  readonly clinicValue: unknown;
  readonly delta?: number | null;
  readonly tolerance?: number | null;
  readonly selector?: string;
}): string {
  const {
    clinicSurfaceId,
    adminReferenceId,
    viewportSlug,
    region,
    property,
    adminValue,
    clinicValue,
    delta,
    tolerance,
    selector,
  } = params;
  return (
    `${clinicSurfaceId} vs ${adminReferenceId} @ ${viewportSlug} | ${region}.${property} | ` +
    `admin=${JSON.stringify(adminValue)} clinic=${JSON.stringify(clinicValue)} ` +
    `${delta !== undefined ? `delta=${delta === null ? "n/a" : delta} ` : ""}` +
    `${tolerance !== undefined ? `tolerance=${tolerance === null ? "exact" : tolerance} ` : ""}` +
    `${selector ? `selector=${selector}` : ""}`
  );
}

/** Fails loudly with the full diagnostic context instead of a bare boolean. */
export function expectBoundsWithinTolerance(params: {
  readonly clinicSurfaceId: string;
  readonly adminReferenceId: string;
  readonly viewportSlug: string;
  readonly region: string;
  readonly admin: ParityBounds | null;
  readonly clinic: ParityBounds | null;
  readonly axis: keyof ParityBounds;
  readonly tolerance?: number;
}): void {
  const { clinicSurfaceId, adminReferenceId, viewportSlug, region, admin, clinic, axis, tolerance } = params;
  const { withinTolerance, delta } = boundsDeltaWithinTolerance(admin, clinic, axis, tolerance);
  expect(
    withinTolerance,
    formatParityFailure({
      clinicSurfaceId,
      adminReferenceId,
      viewportSlug,
      region,
      property: axis,
      adminValue: admin ? admin[axis] : null,
      clinicValue: clinic ? clinic[axis] : null,
      delta,
      tolerance: tolerance ?? PARITY_STRUCTURAL_TOLERANCE_PX,
    }),
  ).toBe(true);
}
