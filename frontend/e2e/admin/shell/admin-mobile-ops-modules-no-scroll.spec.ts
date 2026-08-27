import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  ADMIN_MOBILE_VIEWPORTS,
  assertModuleNoScrollContract,
  expectInsideViewport,
  fulfillJson,
  readModuleNoScrollContract,
  setPopulatedAdminSession,
  suppressNextDevIndicator,
} from "../../helpers/admin-mobile-contracts";

// PR-SRV-1: sessions is adaptive (measured cardinality, superset cap 32). The
// fixture stays larger than any effective mobile limit so page 2 always exists.
const MOCK_SESSIONS = Array.from({ length: 40 }, (_, index) => ({
  sessionType: (["admin", "clinic", "particular"] as const)[index % 3],
  sessionId: 8100 + index,
  actorType: (["admin_user", "clinic_user", "particular_token"] as const)[
    index % 3
  ],
  actorId: 310 + index,
  createdAt: "2026-06-15T09:00:00.000Z",
  lastAccess: "2026-06-19T18:45:00.000Z",
  expiresAt: "2026-06-30T09:00:00.000Z",
  status: index % 4 === 0 ? ("expired" as const) : ("active" as const),
}));

// PR-SRV-2: users is adaptive (measured cardinality, superset cap 36). The
// fixture stays larger than any effective mobile limit so page 2 always exists.
const MOCK_USERS = Array.from({ length: 40 }, (_, index) => {
  if (index === 0) {
    return {
      userType: "admin" as const,
      userId: 41,
      username: "admin_operaciones",
      role: "admin" as const,
      clinicId: null,
      clinicName: null,
      createdAt: "2026-01-10T10:00:00.000Z",
      updatedAt: "2026-06-18T12:00:00.000Z",
    };
  }

  return {
    userType: "clinic" as const,
    userId: 9100 + index,
    username: `usuario_clinica_${index}`,
    role: index % 2 === 0 ? ("clinic_owner" as const) : ("clinic_staff" as const),
    clinicId: 120 + index,
    clinicName: `Clínica Operativa ${index}`,
    clinicLocality: "Buenos Aires",
    createdAt: "2026-02-10T10:00:00.000Z",
    updatedAt: "2026-06-18T12:00:00.000Z",
  };
});

type OpsModule = {
  key: "audit" | "sessions" | "users";
  moduleId: "audit-log" | "admin-sessions" | "admin-users-roles";
  pagerName: RegExp;
  primaryActionName: RegExp;
  // Viewport-safe page-size ceiling for this module's mobile list. All three
  // modules are adaptive (measured cardinality) so the ceiling is each
  // module's RF/OF cap (audit 32, sessions 32, users 36) — the real
  // guarantee is that every rendered item fits the viewport.
  maxItemsPerPage: number;
};

const OPS_MODULES: OpsModule[] = [
  {
    key: "audit",
    moduleId: "audit-log",
    pagerName: /paginación de auditoría/i,
    primaryActionName: /filtros/i,
    // PR-R06: audit is RF debounced (high-volume); superset cap 32.
    maxItemsPerPage: 32,
  },
  {
    key: "sessions",
    moduleId: "admin-sessions",
    pagerName: /paginación de sesiones/i,
    primaryActionName: /actualizar/i,
    // Adaptive: superset cap 32; per-item viewport fit is asserted below.
    maxItemsPerPage: 32,
  },
  {
    key: "users",
    moduleId: "admin-users-roles",
    pagerName: /paginación de usuarios/i,
    primaryActionName: /actualizar/i,
    // Adaptive: superset cap 36; per-item viewport fit is asserted below.
    maxItemsPerPage: 36,
  },
];

async function mockOpsApis(page: Page) {
  await page.route("**/api/admin/sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/api/admin/sessions") {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "8");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await fulfillJson(route, {
      success: true,
      sessions: MOCK_SESSIONS.slice(offset, offset + limit),
      total: MOCK_SESSIONS.length,
      limit,
      offset,
      currentAdminSessionId: 8100,
    });
  });

  await page.route("**/api/admin/users-roles**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/api/admin/users-roles") {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await fulfillJson(route, {
      success: true,
      users: MOCK_USERS.slice(offset, offset + limit),
      total: MOCK_USERS.length,
      limit,
      offset,
      totals: { adminUsers: 1, clinicUsers: 39 },
    });
  });
}

async function openModuleFromMobileNavigation(page: Page, module: OpsModule) {
  await page.goto("/dashboard/admin?hub=1");
  await suppressNextDevIndicator(page);

  const bottomNav = page
    .locator('[data-dashboard-mobile-nav="admin"]')
    .filter({ visible: true });
  await expect(bottomNav).toBeVisible({ timeout: 15_000 });

  // The bar PAINTS before it is INTERACTIVE. `DashboardMobileNav` suspends on
  // `useSearchParams`, and its fallback mounts a full bar whose destinations
  // are wired to `noop`: a click landing in that window publishes no
  // `requestAdminModuleActivate` signal, and the signal has no replay buffer,
  // so the workspace never swaps optimistically and the flow degrades to the
  // async router push alone — which the fallback teardown can cancel outright.
  // Waiting on paint is therefore not enough. `PublicRouteControl` stamps the
  // document from its mount effect, the same hydration gate theme-mode.spec.ts
  // already relies on; gate the click on that instead of on visibility.
  await expect(page.locator("html")).toHaveAttribute(
    "data-public-route-controls-hydrated",
    "true",
    { timeout: 15_000 },
  );

  if (module.key === "audit") {
    await bottomNav.getByRole("button", { name: "Auditoría", exact: true }).click();
  } else if (module.key === "sessions") {
    await bottomNav.getByRole("button", { name: "Sesiones", exact: true }).click();
  } else {
    await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
    const menu = page.locator('[data-dashboard-mobile-nav-overflow="true"]');
    await expect(menu).toBeVisible();
    await menu
      .getByRole("button", { name: "Página siguiente de módulos", exact: true })
      .click();
    await menu
      .locator('[data-dashboard-mobile-nav-overflow-link]')
      .filter({ hasText: "Usuarios" })
      .click();
  }

  // Assert the NAVIGATION result first. The controller mounts the workspace off
  // `activeModule`, which converges on the module id reaching the URL, so the
  // URL is the stable upstream contract: when it never arrives, the failure
  // names the lost navigation instead of blaming the workspace that was never
  // asked to mount.
  await expect(page).toHaveURL(
    new RegExp(`/dashboard/admin\\?module=${module.moduleId}$`),
    { timeout: 15_000 },
  );

  await expect(
    page.locator(`[data-dashboard-module-workspace="${module.moduleId}"]`),
  ).toBeVisible({ timeout: 15_000 });
}

// Sessions is server-side adaptive: a ResizeObserver-driven re-fetch can remount
// rows between a `count()` read and a later `nth(index)` resolution, so the
// live-locator pattern (count + nth) races the adaptive fetch. Instead, take an
// atomic DOM snapshot of every rendered item (geometry included) in a single
// `evaluateAll`, and only trust it once two consecutive snapshots are identical.
type ItemBoxSnapshot = {
  index: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  visible: boolean;
};

function sessionSnapshotSignature(snapshot: ItemBoxSnapshot[]): string {
  return snapshot
    .map((item) =>
      [
        item.index,
        item.text,
        Math.round(item.x),
        Math.round(item.y),
        Math.round(item.width),
        Math.round(item.height),
        Math.round(item.right),
        Math.round(item.bottom),
      ].join(":"),
    )
    .join("|");
}

async function readSessionItemSnapshot(
  moduleRoot: Locator,
): Promise<ItemBoxSnapshot[]> {
  return moduleRoot
    .locator('[data-admin-mobile-ops-item="true"]')
    .evaluateAll((elements) =>
      elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();

        return {
          index,
          text,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0",
        };
      }),
    );
}

async function expectStableSessionItemSnapshot(
  moduleRoot: Locator,
  maxItems: number,
): Promise<ItemBoxSnapshot[]> {
  let previousSignature = "";
  let stableSnapshot: ItemBoxSnapshot[] = [];

  await expect
    .poll(
      async () => {
        const snapshot = await readSessionItemSnapshot(moduleRoot);
        const valid =
          snapshot.length > 0 &&
          snapshot.length <= maxItems &&
          snapshot.every((item) => item.visible);

        if (!valid) {
          previousSignature = "";
          stableSnapshot = [];
          return "__invalid__";
        }

        const signature = sessionSnapshotSignature(snapshot);

        if (signature === previousSignature) {
          stableSnapshot = snapshot;
          return "__stable__";
        }

        previousSignature = signature;
        stableSnapshot = [];
        return "__changing__";
      },
      {
        timeout: 15_000,
        intervals: [100, 150, 250, 500, 750],
      },
    )
    .toBe("__stable__");

  return stableSnapshot;
}

function expectItemBoxInsideViewport(
  item: ItemBoxSnapshot,
  viewport: { width: number; height: number },
  label: string,
) {
  const tolerance = 2;

  expect(item.visible, `${label}: visible`).toBe(true);
  expect(item.x, `${label}: left`).toBeGreaterThanOrEqual(-tolerance);
  expect(item.y, `${label}: top`).toBeGreaterThanOrEqual(-tolerance);
  expect(item.right, `${label}: right`).toBeLessThanOrEqual(
    viewport.width + tolerance,
  );
  expect(item.bottom, `${label}: bottom`).toBeLessThanOrEqual(
    viewport.height + tolerance,
  );
}

for (const moduleSpec of OPS_MODULES) {
  for (const viewport of ADMIN_MOBILE_VIEWPORTS) {
    test(`Admin mobile ops ${moduleSpec.key} is absolute no-scroll at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setPopulatedAdminSession(page);
      await mockOpsApis(page);
      await openModuleFromMobileNavigation(page, moduleSpec);

      await expect(page.locator('[data-admin-mobile-app-bar="true"]')).toBeVisible();
      await expect(
        page
          .locator('[data-dashboard-mobile-nav="admin"]')
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(page.locator('[data-dashboard-horizontal-nav-shell="true"]')).toBeHidden();

      const moduleSelector = `[data-admin-mobile-ops-module="${moduleSpec.key}"]`;
      const moduleRoot = page.locator(moduleSelector);
      await expect(moduleRoot).toBeVisible({ timeout: 15_000 });

      const items = moduleRoot.locator('[data-admin-mobile-ops-item="true"]');

      if (
        moduleSpec.key === "sessions" ||
        moduleSpec.key === "users" ||
        moduleSpec.key === "audit"
      ) {
        // Adaptive server-side list: validate an atomic, stabilized snapshot so
        // the per-item viewport checks never race a re-fetch/remount.
        const itemSnapshots = await expectStableSessionItemSnapshot(
          moduleRoot,
          moduleSpec.maxItemsPerPage,
        );

        expect(itemSnapshots.length).toBeGreaterThan(0);
        expect(itemSnapshots.length).toBeLessThanOrEqual(moduleSpec.maxItemsPerPage);

        for (const item of itemSnapshots) {
          expectItemBoxInsideViewport(
            item,
            viewport,
            `${viewport.name} ${moduleSpec.key} item ${item.index + 1}`,
          );
        }
      } else {
        await expect(items.first()).toBeVisible({ timeout: 15_000 });
        const itemCount = await items.count();
        expect(itemCount).toBeGreaterThan(0);
        expect(itemCount).toBeLessThanOrEqual(moduleSpec.maxItemsPerPage);

        for (let index = 0; index < itemCount; index += 1) {
          await expectInsideViewport(
            items.nth(index),
            viewport,
            `${viewport.name} ${moduleSpec.key} item ${index + 1}`,
          );
        }
      }

      const pager = moduleRoot.getByRole("navigation", { name: moduleSpec.pagerName });
      await expectInsideViewport(pager, viewport, `${viewport.name} ${moduleSpec.key} pager`);

      const primaryAction = moduleRoot.getByRole("button", {
        name: moduleSpec.primaryActionName,
      }).first();
      await expectInsideViewport(
        primaryAction,
        viewport,
        `${viewport.name} ${moduleSpec.key} primary action`,
      );

      const pageOneLabels = await items.allTextContents();
      const nextButton = pager.getByRole("button", { name: /siguiente/i });
      await expect(nextButton).toBeEnabled();
      await nextButton.click();
      await expect
        .poll(async () => (await items.allTextContents()).join("|"))
        .not.toBe(pageOneLabels.join("|"));

      assertModuleNoScrollContract(
        await readModuleNoScrollContract(page, moduleSelector),
        `${viewport.name} ${moduleSpec.key} page 2`,
      );
      await expectInsideViewport(pager, viewport, `${viewport.name} ${moduleSpec.key} page 2 pager`);

      await primaryAction.click();
      if (moduleSpec.key === "audit") {
        const dialog = page.getByRole("dialog", { name: "Filtrar auditoría" });
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      } else {
        await expect(primaryAction).toBeEnabled();
      }

      assertModuleNoScrollContract(
        await readModuleNoScrollContract(page, moduleSelector),
        `${viewport.name} ${moduleSpec.key} action`,
      );

      await page
        .locator('[data-dashboard-mobile-nav="admin"]')
        .filter({ visible: true })
        .getByRole("button", { name: "Inicio", exact: true })
        .click();
      await expect(page.locator('[data-admin-mobile-hub-launcher="true"]')).toBeVisible({
        timeout: 15_000,
      });
    });
  }
}

for (const moduleSpec of OPS_MODULES) {
  test(`Admin desktop preserves ${moduleSpec.key} layout at 1280x800`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setPopulatedAdminSession(page);
    await mockOpsApis(page);
    await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);

    // El fallback de Suspense deja una segunda copia del drawer en staging
    // (0x0 dentro de un ancestro display:none), asi que el atributo por si solo
    // resuelve a dos nodos y viola strict mode. Se ancla al drawer admin
    // efectivamente visible: cero visibles falla, dos visibles falla por
    // strictness, y la copia de staging queda fuera sin relajar el contrato.
    await expect(
      page
        .locator('[data-dashboard-navigation-drawer="admin"]')
        .filter({ visible: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
    // Zero PAINTED bars, for the same reason the core-modules spec spells out:
    // the Suspense staging copy makes the bare selector resolve to two nodes
    // and `toBeHidden()` violates strict mode before visibility is considered.
    await expect(
      page
        .locator('[data-dashboard-mobile-nav="admin"]')
        .filter({ visible: true }),
    ).toHaveCount(0);
    await expect(
      page.locator(`[data-dashboard-module-workspace="${moduleSpec.moduleId}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-admin-mobile-ops-module="${moduleSpec.key}"]`),
    ).toBeHidden();
  });
}

test("Admin mobile sessions Tipo/Estado selects render their full option text uncut", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await setPopulatedAdminSession(page);
  await mockOpsApis(page);
  await page.goto("/dashboard/admin?module=admin-sessions");

  const moduleRoot = page.locator('[data-admin-mobile-ops-module="sessions"]');
  await expect(moduleRoot).toBeVisible({ timeout: 15_000 });

  const tipoSelect = moduleRoot.getByLabel("Tipo");
  const estadoSelect = moduleRoot.getByLabel("Estado");
  await expect(tipoSelect).toBeVisible();
  await expect(estadoSelect).toBeVisible();

  for (const [select, label] of [
    [tipoSelect, "Tipo"],
    [estadoSelect, "Estado"],
  ] as const) {
    const metrics = await select.evaluate((element) => {
      const select = element as HTMLSelectElement;
      const style = window.getComputedStyle(select);
      const fontSizePx = parseFloat(style.fontSize);
      const paddingY =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      return {
        contentHeight: select.clientHeight - paddingY,
        // Browsers render a single line of text at roughly 1.15-1.2x the
        // font size even under `line-height: 1`; this is the minimum
        // content box needed to avoid clipping the glyph's top/bottom.
        minTextHeight: fontSizePx * 1.15,
      };
    });
    expect(
      metrics.contentHeight,
      `${label}: content height must fit a full text line (no vertical clipping)`,
    ).toBeGreaterThanOrEqual(metrics.minTextHeight);
  }

  // PR-SRV-1: sessions is adaptive; wait for a stabilized snapshot instead of a
  // raw count (which CI can read as 0 mid fetch+measurement). Ceiling is the
  // superset cap, not 10.
  const itemSnapshots = await expectStableSessionItemSnapshot(moduleRoot, 32);
  expect(
    itemSnapshots.length,
    "sessions: within adaptive superset cap",
  ).toBeGreaterThan(0);
  expect(
    itemSnapshots.length,
    "sessions: within adaptive superset cap",
  ).toBeLessThanOrEqual(32);
});
