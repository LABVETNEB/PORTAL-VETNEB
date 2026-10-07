import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_MOBILE_VIEWPORTS,
  assertDocumentNoScrollContract,
  expectInsideViewport,
  fulfillJson,
  readDocumentNoScrollContract,
  suppressNextDevIndicator,
} from "../../helpers/admin-mobile-contracts";
import { A03_ADAPTIVE_DATASET_COOKIE } from "../../helpers/dashboard-adaptive-limit-matrix";
import {
  addAppCookies,
  sessionCookie,
  setAdminSession,
} from "../../helpers/session";

// 40 clinics (R-02): guarantees a page 2 exists for any effectiveLimit <= 36
// (HY superset cap), same margin used by Sessions/Users/Alerts.
const MOCK_CLINICS = Array.from({ length: 40 }, (_, index) => {
  const id = index + 1;
  return {
    clinicId: id,
    clinicName: `Clínica Core ${id}`,
    contactEmail: `clinica.core.${id}@example.test`,
    contactPhone: `+54 11 5555-${String(id).padStart(4, "0")}`,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: `2026-06-${String((id % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    users: [
      {
        userId: 100 + id,
        username: `core-owner-${id}`,
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  };
});

async function mockAdminClinics(page: Page) {
  await page.route("**/api/admin/clinics**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const clinics = MOCK_CLINICS.slice(offset, offset + limit);
    await fulfillJson(route, {
      success: true,
      clinics,
      total: MOCK_CLINICS.length,
      limit,
      offset,
    });
  });
}

type ModuleSpec = {
  key: "clinics" | "reports" | "tokens";
  moduleId: string;
  mock?: (page: Page) => Promise<void>;
  // Viewport-safe page-size ceiling for this module's mobile list; differs per module.
  maxItemsPerPage: number;
};

const MODULES: ModuleSpec[] = [
  // Clinics: R-02 raised the ceiling to the HY superset cap (36); the real
  // guarantee is per-item viewport fit, not a fixed page size.
  { key: "clinics", moduleId: "admin-clinics", mock: mockAdminClinics, maxItemsPerPage: 36 },
  { key: "reports", moduleId: "admin-report-upload", maxItemsPerPage: 36 },
  // R-05 raised the ceiling to the OF superset cap (30); the real guarantee
  // is per-item viewport fit, not a fixed page size.
  { key: "tokens", moduleId: "admin-particular-tokens", maxItemsPerPage: 30 },
];

async function prepareModuleDataset(page: Page, moduleSpec: ModuleSpec) {
  if (moduleSpec.mock) {
    await setAdminSession(page, "default");
    await moduleSpec.mock(page);
    return;
  }

  await addAppCookies(page, [
    sessionCookie("admin", "populated"),
    A03_ADAPTIVE_DATASET_COOKIE,
  ]);
}

for (const moduleSpec of MODULES) {
  for (const viewport of ADMIN_MOBILE_VIEWPORTS) {
    test(`Admin mobile core module "${moduleSpec.key}" is no-scroll at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareModuleDataset(page, moduleSpec);
      await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);
      await suppressNextDevIndicator(page);

      const workspace = page.locator(
        `[data-dashboard-module-workspace="${moduleSpec.moduleId}"]`,
      );
      await expect(workspace, `${viewport.name}: module workspace visible`).toBeVisible({
        timeout: 15_000,
      });

      const moduleRoot = page.locator(
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      await expect(moduleRoot, `${viewport.name}: module root visible`).toBeVisible();

      await expect(
        page.locator('[data-admin-mobile-app-bar="true"]'),
        `${viewport.name}: app bar visible`,
      ).toBeVisible();
      await expect(
        page
          .locator('[data-dashboard-mobile-nav="admin"]')
          .filter({ visible: true }),
        `${viewport.name}: bottom nav visible`,
      ).toBeVisible();
      await expect(
        page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
        `${viewport.name}: horizontal nav absent`,
      ).toBeHidden();

      const contract = await readDocumentNoScrollContract(
        page,
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      assertDocumentNoScrollContract(contract, `${viewport.name} ${moduleSpec.key} page 1`);

      const itemSelector = `[data-admin-mobile-core-module="${moduleSpec.key}"] [data-admin-mobile-core-item="true"]`;
      const items = page.locator(itemSelector);
      await expect(
        items.first(),
        `${viewport.name}: ${moduleSpec.key} first item visible`,
      ).toBeVisible({ timeout: 15_000 });

      // R-02: clinics derives its page size from the measured list container
      // (adaptive, HY cap 36), so the first paint can render the fallback
      // count and a follow-up fetch re-renders with the settled fit. Reading
      // count() once mid-settle made .nth(i) chase items from a superseded
      // render (CI failure: "item 10/13/15 not found"). Wait for two
      // consecutive equal counts before iterating; harmless for the fixed-size
      // modules (reports/tokens), whose count is stable immediately.
      let settledCount = -1;
      await expect(async () => {
        const current = await items.count();
        expect(
          current,
          `${viewport.name}: ${moduleSpec.key} has visible items`,
        ).toBeGreaterThan(0);
        if (settledCount !== current) {
          settledCount = current;
          throw new Error(
            `${moduleSpec.key} item count not yet stable: ${current}`,
          );
        }
      }).toPass({ intervals: [250, 350, 500, 750, 1_000], timeout: 10_000 });

      const itemCount = settledCount;
      expect(itemCount, `${viewport.name}: ${moduleSpec.key} has visible items`).toBeGreaterThan(0);
      expect(
        itemCount,
        `${viewport.name}: ${moduleSpec.key} page size must remain viewport-safe`,
      ).toBeLessThanOrEqual(moduleSpec.maxItemsPerPage);

      for (let index = 0; index < itemCount; index += 1) {
        await expectInsideViewport(
          items.nth(index),
          viewport,
          `${viewport.name}: ${moduleSpec.key} item ${index + 1}`,
        );
      }

      const pager = page.locator(
        `[data-admin-mobile-core-module="${moduleSpec.key}"] [data-admin-mobile-core-pager="true"]`,
      );
      await expectInsideViewport(
        pager,
        viewport,
        `${viewport.name}: ${moduleSpec.key} pager`,
      );

      const nextButton = pager.getByRole("button", { name: /siguiente|próxim/i });
      await expect(nextButton, `${viewport.name}: ${moduleSpec.key} next page button`).toBeVisible();
      await expect(nextButton, `${viewport.name}: ${moduleSpec.key} next page button enabled`).toBeEnabled();

      const firstPageLabels = await items.allTextContents();
      await nextButton.click();
      await expect
        .poll(async () => (await items.allTextContents()).join("|"), {
          message: `${viewport.name}: ${moduleSpec.key} page changes after pagination`,
        })
        .not.toBe(firstPageLabels.join("|"));

      const page2Contract = await readDocumentNoScrollContract(
        page,
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      assertDocumentNoScrollContract(page2Contract, `${viewport.name} ${moduleSpec.key} page 2`);

      const bottomNav = page
        .locator('[data-dashboard-mobile-nav="admin"]')
        .filter({ visible: true });
      // Pre-C05: the admin mobile Inicio (hub) is retired; the bar has no slot for it.
      await expect(
        bottomNav.getByRole("button", { name: "Inicio", exact: true }),
        `${viewport.name}: no Inicio slot`,
      ).toHaveCount(0);
    });
  }
}

test("Admin mobile core modules reachable from bottom nav and Más menu", async ({ page }) => {
  const viewport = ADMIN_MOBILE_VIEWPORTS[0];
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await addAppCookies(page, [
    sessionCookie("admin", "populated"),
    A03_ADAPTIVE_DATASET_COOKIE,
  ]);
  await mockAdminClinics(page);
  await page.goto("/dashboard/admin?hub=1");
  await suppressNextDevIndicator(page);

  const bottomNav = page
    .locator('[data-dashboard-mobile-nav="admin"]')
    .filter({ visible: true });
  await expect(bottomNav).toBeVisible();

  await bottomNav.getByRole("button", { name: "Clínicas", exact: true }).click();
  await expect(
    page.locator('[data-admin-mobile-core-module="clinics"]'),
  ).toBeVisible({ timeout: 15_000 });

  await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
  const moduleMenu = page.locator('[data-dashboard-mobile-nav-overflow="true"]');
  await expect(moduleMenu).toBeVisible();
  await moduleMenu
    .locator('[data-dashboard-mobile-nav-overflow-link]')
    .filter({ hasText: "Informes" })
    .click();
  await expect(
    page.locator('[data-admin-mobile-core-module="reports"]'),
  ).toBeVisible({ timeout: 15_000 });

  await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
  await expect(moduleMenu).toBeVisible();
  await moduleMenu
    .locator('[data-dashboard-mobile-nav-overflow-link]')
    .filter({ hasText: "Tokens" })
    .click();
  await expect(
    page.locator('[data-admin-mobile-core-module="tokens"]'),
  ).toBeVisible({ timeout: 15_000 });
});

test("Admin mobile reports pagination advances through measured pages with pager anchored at the bottom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addAppCookies(page, [
    sessionCookie("admin", "populated"),
    A03_ADAPTIVE_DATASET_COOKIE,
  ]);

  await page.goto("/dashboard/admin?module=admin-report-upload");
  await expect(
    page.locator('[data-dashboard-module-workspace="admin-report-upload"]'),
  ).toBeVisible({ timeout: 15_000 });

  const list = page.locator("[data-admin-reports-mobile-list='true']");
  await expect(list).toBeVisible();
  // R-03: the page size is measured (HY cap 36), not a fixed 10. The first
  // record is always on page 1; assert the adaptive contract instead of a
  // hard-coded per-page count.
  const items = list.locator("[data-admin-mobile-core-item='true']");
  await expect(items.first()).toBeVisible();
  await expect(list.getByText("#7400 ", { exact: false })).toBeVisible();

  // Wait for the measurement↔fetch settle (two consecutive equal counts)
  // before reading the page-1 contents, same pattern as the no-scroll loop.
  let settledCount = -1;
  await expect(async () => {
    const current = await items.count();
    expect(current).toBeGreaterThan(0);
    if (settledCount !== current) {
      settledCount = current;
      throw new Error(`reports item count not yet stable: ${current}`);
    }
  }).toPass({ intervals: [250, 350, 500, 750, 1_000], timeout: 10_000 });
  expect(settledCount).toBeGreaterThan(0);
  expect(settledCount).toBeLessThanOrEqual(36);

  const pager = page.locator("[data-admin-mobile-core-pager='true']");
  await expect(pager.getByText("Pág. 1")).toBeVisible();

  const [pagerBox, bottomNavBox] = await Promise.all([
    pager.boundingBox(),
    page
      .locator('[data-dashboard-mobile-nav="admin"]')
      .filter({ visible: true })
      .boundingBox(),
  ]);
  expect(pagerBox).not.toBeNull();
  expect(bottomNavBox).not.toBeNull();
  expect(pagerBox!.y + pagerBox!.height).toBeLessThanOrEqual(bottomNavBox!.y + 2);

  const firstPageLabels = (await items.allTextContents()).join("|");
  await pager.getByRole("button", { name: "Página siguiente" }).click();
  // Page 2 shows different records; the first record (#7400) is no longer here.
  await expect
    .poll(async () => (await items.allTextContents()).join("|"))
    .not.toBe(firstPageLabels);
  await expect(list.getByText("#7400 ", { exact: false })).toHaveCount(0);
  await expect(pager.getByText("Pág. 2")).toBeVisible();
});

for (const moduleSpec of MODULES) {
  test(`Admin desktop preserves ${moduleSpec.key} layout at 1280x800`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepareModuleDataset(page, moduleSpec);
    await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);

    await expect(
      page
        .locator('[data-dashboard-navigation-drawer="admin"]')
        .filter({ visible: true }),
      `${moduleSpec.key} desktop: lateral nav visible`,
    ).toBeVisible({ timeout: 15_000 });
    // `DashboardMobileNav` streams through a Suspense boundary whose fallback
    // mounts a SECOND <nav> carrying the same attribute, so the bare selector
    // resolves to two nodes and `toBeHidden()` dies on strict mode BEFORE
    // visibility is ever considered. The desktop contract is "no PAINTED bar",
    // not "at most one DOM node": assert zero VISIBLE bars, which still fails
    // with one visible and with two, and excludes only the hidden staging copy.
    await expect(
      page
        .locator('[data-dashboard-mobile-nav="admin"]')
        .filter({ visible: true }),
      `${moduleSpec.key} desktop: bottom nav absent`,
    ).toHaveCount(0);
    await expect(
      page.locator(`[data-admin-mobile-core-module="${moduleSpec.key}"]`),
      `${moduleSpec.key} desktop: mobile core module root absent`,
    ).toBeHidden();
  });
}

// ── PRE-C05 · mobile space ───────────────────────────────────────────────────
// Below md the internal descriptors are retired and the marked controls MOVED;
// "N en página" is retired at every breakpoint. The page-size contract is the
// measured adaptive one: limit = rendered page, offset advances by limit.

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: ReturnType<Page["locator"]>, label: string): Promise<Box> {
  await expect(locator, `${label}: visible`).toBeVisible();
  const rect = await locator.boundingBox();
  expect(rect, `${label}: box`).not.toBeNull();
  return rect!;
}

function centerY(rect: Box) {
  return rect.y + rect.height / 2;
}

function trackQueries(page: Page, path: string) {
  const queries: Array<{ limit: number; offset: number }> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== path) return;
    queries.push({
      limit: Number(url.searchParams.get("limit")),
      offset: Number(url.searchParams.get("offset")),
    });
  });
  return queries;
}

for (const viewport of ADMIN_MOBILE_VIEWPORTS) {
  test(`PRE-C05 Informes mobile: descriptor and page count retired, Filtros up, upload in place at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await addAppCookies(page, [sessionCookie("admin", "populated"), A03_ADAPTIVE_DATASET_COOKIE]);
    const queries = trackQueries(page, "/api/admin/report-workflow");
    await page.goto("/dashboard/admin?module=admin-report-upload");
    await suppressNextDevIndicator(page);

    const workspace = page.locator('[data-dashboard-module-workspace="admin-report-upload"]');
    const items = page.locator('[data-admin-mobile-core-module="reports"] [data-dashboard-adaptive-row="true"]');
    await expect(items.first()).toBeVisible({ timeout: 15_000 });

    await expect(workspace.getByText("Cola administrativa, trazabilidad y documentos en una sola vista.")).toBeHidden();
    await expect(workspace.getByText(/\d+ en página/)).toHaveCount(0);
    await expect(workspace.locator('[data-admin-reports-toolbar="true"]')).toBeHidden();

    const uploadButton = workspace.getByRole("button", { name: "Subir informe", exact: true });
    const filtros = await box(workspace.getByRole("button", { name: "Filtros", exact: true }), `${viewport.name} Filtros`);
    const refresh = await box(uploadButton.locator("xpath=preceding-sibling::button[1]"), `${viewport.name} Actualizar`);
    const upload = await box(uploadButton, `${viewport.name} Subir informe`);
    expect(filtros.x + filtros.width, "Filtros left of Actualizar").toBeLessThanOrEqual(refresh.x);
    expect(refresh.x + refresh.width, "Actualizar left of Subir informe").toBeLessThanOrEqual(upload.x);
    expect(Math.abs(centerY(filtros) - centerY(upload)), "Filtros shares the header band with Subir informe").toBeLessThanOrEqual(4);
    expect(viewport.width - (upload.x + upload.width), "Subir informe keeps the trailing slot").toBeLessThanOrEqual(40);

    const firstRow = await box(items.first(), `${viewport.name} first row`);
    expect(firstRow.y - (upload.y + upload.height), "the list starts right below the header").toBeLessThanOrEqual(32);
    const rowHeights = await items.evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)));
    const pitch = await items.first().evaluate((row) => Math.round(parseFloat(getComputedStyle(row).getPropertyValue("--dash-row-pitch-regular"))));
    expect(new Set(rowHeights), "C05 row pitch unchanged (regular token)").toEqual(new Set([pitch]));

    // Filtros opens the same dialog it always did.
    await workspace.getByRole("button", { name: "Filtros", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Filtrar informes" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filtrar informes" })).toHaveCount(0);

    // Page-size contract: limit = rendered page, offset 0, then advances by limit.
    // The adaptive list settles in two fetches; wait until the rendered page
    // and the last request agree before reading the contract.
    await expect
      .poll(async () => {
        const count = await items.count();
        const last = queries.at(-1);
        return last && last.limit === count && last.offset === 0 ? "settled" : `${count} rows vs ${JSON.stringify(last)}`;
      })
      .toBe("settled");
    const rendered = await items.count();
    await page.locator('[data-admin-mobile-core-pager="true"]').getByRole("button", { name: "Página siguiente" }).click();
    await expect.poll(() => queries.at(-1)).toEqual({ limit: rendered, offset: rendered });

    assertDocumentNoScrollContract(
      await readDocumentNoScrollContract(page, '[data-admin-mobile-core-module="reports"]'),
      `${viewport.name} PRE-C05 reports`,
    );
  });

  test(`PRE-C05 Clínicas mobile: descriptor retired, actions above the search, search right below them at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setAdminSession(page, "default");
    await mockAdminClinics(page);
    const queries = trackQueries(page, "/api/admin/clinics");
    await page.goto("/dashboard/admin?module=admin-clinics");
    await suppressNextDevIndicator(page);

    const workspace = page.locator('[data-dashboard-module-workspace="admin-clinics"]');
    const cards = page.locator('[data-admin-clinic-mobile-card="true"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await expect(workspace.getByText("Administración de clínicas registradas · alto volumen.")).toBeHidden();

    const create = await box(workspace.getByRole("button", { name: "Nueva clínica", exact: true }), `${viewport.name} Nueva clínica`);
    const refresh = await box(workspace.getByRole("button", { name: "Actualizar", exact: true }), `${viewport.name} Actualizar`);
    const search = await box(workspace.getByRole("textbox", { name: "Buscar clínicas" }), `${viewport.name} search`);
    expect(create.y + create.height, "Nueva clínica above the search").toBeLessThanOrEqual(search.y);
    expect(refresh.y + refresh.height, "Actualizar above the search").toBeLessThanOrEqual(search.y);
    expect(search.y - (refresh.y + refresh.height), "the search sits right under the actions").toBeLessThanOrEqual(12);
    const firstCard = await box(cards.first(), `${viewport.name} first card`);
    expect(firstCard.y - (search.y + search.height), "the cards start right below the search").toBeLessThanOrEqual(24);
    const cardHeights = await cards.evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)));
    const pitch = await cards.first().evaluate((row) => Math.round(parseFloat(getComputedStyle(row).getPropertyValue("--dash-row-pitch-regular"))));
    expect(new Set(cardHeights), "C05 row pitch unchanged (regular token)").toEqual(new Set([pitch]));

    // The adaptive list settles in two fetches; wait until the rendered page
    // and the last request agree before reading the contract.
    await expect
      .poll(async () => {
        const count = await cards.count();
        const last = queries.at(-1);
        return last && last.limit === count && last.offset === 0 ? "settled" : `${count} rows vs ${JSON.stringify(last)}`;
      })
      .toBe("settled");
    const rendered = await cards.count();
    await page.locator('[data-admin-mobile-core-pager="true"]').getByRole("button", { name: "Página siguiente" }).click();
    await expect.poll(() => queries.at(-1)).toEqual({ limit: rendered, offset: rendered });

    assertDocumentNoScrollContract(
      await readDocumentNoScrollContract(page, '[data-admin-mobile-core-module="clinics"]'),
      `${viewport.name} PRE-C05 clinics`,
    );
  });
}

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
] as const) {
  test(`desktop/tablet space pass at ${viewport.width}x${viewport.height}: descriptors and summary retired, actions relocated, page count retired`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await addAppCookies(page, [sessionCookie("admin", "populated"), A03_ADAPTIVE_DATASET_COOKIE]);
    await mockAdminClinics(page);
    await page.goto("/dashboard/admin?module=admin-report-upload");
    await suppressNextDevIndicator(page);

    const reports = page.locator('[data-dashboard-module-workspace="admin-report-upload"]');
    const upload = reports.getByRole("button", { name: "Subir informe" }).filter({ visible: true });
    await expect(upload).toBeVisible({ timeout: 15_000 });
    await expect(reports.getByText("Cola administrativa, trazabilidad y documentos en una sola vista.")).toHaveCount(0);
    await expect(reports.locator('[data-admin-reports-toolbar="true"]')).toHaveCount(0);
    await expect(reports.getByText(/\d+ en página|por página|Página \d+/)).toHaveCount(0);
    const uploadBox = await upload.boundingBox();
    const filtersBox = await reports.locator('[data-admin-report-upload-filter-bar="advanced"]').boundingBox();
    expect(uploadBox && filtersBox && uploadBox.y + uploadBox.height <= filtersBox.y + 1, "Subir informe sits above the filters").toBe(true);

    await page.goto("/dashboard/admin?module=admin-clinics");
    const clinics = page.locator('[data-dashboard-module-workspace="admin-clinics"]');
    const search = clinics.getByPlaceholder("Buscar clínica por nombre, email o usuario...");
    await expect(search).toBeVisible({ timeout: 15_000 });
    await expect(clinics.getByText("Administración de clínicas registradas · alto volumen.")).toHaveCount(0);
    await expect(clinics.getByPlaceholder("Buscar clínica...")).toBeHidden();
    const create = clinics.getByRole("button", { name: "Nueva clínica" }).filter({ visible: true });
    const refresh = clinics.getByRole("button", { name: "Actualizar" }).filter({ visible: true });
    const [searchBox, createBox, refreshBox] = await Promise.all([search.boundingBox(), create.boundingBox(), refresh.boundingBox()]);
    expect(searchBox && createBox && refreshBox).toBeTruthy();
    for (const box of [createBox!, refreshBox!]) {
      expect(Math.abs(box.y + box.height / 2 - (searchBox!.y + searchBox!.height / 2)), "same row as the search").toBeLessThanOrEqual(2);
    }
    expect(searchBox!.x < createBox!.x && createBox!.x < refreshBox!.x, "[search] [Nueva clínica] [Actualizar]").toBe(true);
  });
}
