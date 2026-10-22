import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { addAppCookies, sessionCookie } from "../../helpers/session";

const pricing = "#admin-pricing";

const category = (name: string, size: number, base: number) => ({
  category: name,
  items: Array.from({ length: size }, (_, index) => ({
    id: base + index,
    studyName: `${name} — estudio ${String(index + 1).padStart(2, "0")}`,
    priceLabel: index % 3 === 0 ? null : `$${1000 + index * 10}`,
    displayOrder: index,
    isActive: index % 5 !== 4,
    updatedAt: "2026-06-18T10:00:00.000Z",
  })),
});
const PRICING = [category("Histopatología", 40, 7000), category("Citología", 3, 7100)];

const CANDIDATES = Array.from({ length: 9 }, (_, index) => ({
  label: `Grupo C20 ${index + 1}`,
  category: `purge.c20.${index + 1}`,
  supported: index % 2 === 0,
  count: 20 + index,
  destructiveAction: null,
  reason: index % 3 === 0 ? "Pendiente de soporte backend." : null,
}));

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function mockPricing(page: Page, fail = false) {
  const patches: unknown[] = [];
  await page.route("**/api/admin/pricing**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/pricing") {
      await (fail ? json(route, { success: false, error: "Precios fuera de servicio" }, 503) : json(route, { success: true, categories: PRICING }));
      return;
    }
    if (request.method() === "PATCH" && /\/api\/admin\/pricing\/\d+$/.test(url.pathname)) {
      const patch = JSON.parse(request.postData() ?? "{}");
      patches.push(patch);
      const id = Number(url.pathname.split("/").pop());
      const item = PRICING.flatMap((group) => group.items).find((candidate) => candidate.id === id);
      await json(route, { success: true, pricingItem: { ...item, ...patch, category: "Histopatología" } });
      return;
    }
    await route.fallback();
  });
  return patches;
}

async function mockSchema(page: Page, mode: "ok" | "degraded" | "error") {
  await page.route("**/api/admin/system/schema-health**", (route) =>
    mode === "error"
      ? route.fulfill({ status: 500, body: "" })
      : json(route, {
          success: true,
          status: mode,
          generatedAt: "2026-06-18T14:30:00.000Z",
          checkedBy: { adminUserId: 41, username: "admin_operaciones" },
          summary: { requiredTables: 18, requiredColumns: 96, presentColumns: mode === "ok" ? 96 : 94, missingColumns: mode === "ok" ? 0 : 2 },
          missing: mode === "ok" ? [] : [{ schema: "public", table: "reports", column: "c20_a" }, { schema: "public", table: "reports", column: "c20_b" }],
        }),
  );
}

async function mockDryRun(page: Page, fail = false) {
  await page.route("**/api/admin/system/maintenance/purge-dry-run**", (route) =>
    fail
      ? json(route, { success: false, error: "Dry-run fuera de servicio" }, 503)
      : json(route, {
          success: true,
          dryRun: true,
          generatedAt: "2026-06-18T14:30:00.000Z",
          checkedBy: { adminUserId: 41, username: "admin_operaciones" },
          totals: { candidateRecords: 99, supportedCandidateRecords: 50, unsupportedGroups: 4 },
          candidates: CANDIDATES,
        }),
  );
}

const documentOverflow = (page: Page) =>
  page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));

const seriousAxe = async (page: Page, selector: string) =>
  (await new AxeBuilder({ page }).include(selector).analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""));

test.beforeEach(async ({ page }) => {
  await addAppCookies(page, [sessionCookie("admin", "populated")]);
});

test("C20 Precios keeps native form rows in the C01 workspace, pages overflow with C02 and saves the same payload", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const patches = await mockPricing(page);
  await page.goto("/dashboard/admin?module=admin-pricing");
  const canvas = page.locator(`${pricing} [data-collection-workspace="true"][data-dashboard-adaptive-rows-canvas="true"]`);
  const forms = canvas.locator('[data-content-list="true"] > form[data-admin-pricing-item-form]');
  await expect(forms.first()).toBeVisible({ timeout: 15_000 });
  // divide-y sits on the `contents` list, so the first form row keeps its 1px separator.
  expect(await forms.first().evaluate((form) => getComputedStyle(form).borderBottomWidth)).toBe("1px");

  const pager = page.locator(`${pricing} [data-collection-pager="compact"]`);
  await expect(pager).toBeVisible();
  const firstStudy = (await forms.first().innerText()).split("\n")[0];
  await pager.locator('[data-dashboard-pager-next="true"]').click();
  await expect(forms.first()).not.toContainText(firstStudy);
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });

  const row = forms.first();
  const priceField = row.getByRole("textbox", { name: /^Precio de / });
  await priceField.fill("$ 2026");
  await row.getByRole("button", { name: "Guardar precio" }).click();
  await expect(row.getByRole("status")).toHaveText("Precio actualizado.");
  expect(patches).toEqual([{ priceLabel: "$ 2026" }]);

  await page.getByRole("tab", { name: /Citología/ }).click();
  await expect(page.locator(`${pricing} [data-collection-pager="compact"]`)).toHaveCount(0);
  expect(await seriousAxe(page, pricing)).toEqual([]);
});

// G11-b: real category names carry spaces and parentheses; the tab/panel
// relation must survive them (aria-controls is an IDREF list).
test("G11-b Precios category tabs keep a valid tab/panel relation and keyboard selection with spaced names", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const names = ["Citología de líquidos", "Biopsia (piel)", "Necropsia completa"];
  await page.route("**/api/admin/pricing**", (route) =>
    json(route, { success: true, categories: names.map((name, index) => category(name, 3, 8000 + index * 100)) }),
  );
  await page.goto("/dashboard/admin?module=admin-pricing");
  const tablist = page.getByRole("tablist", { name: "Categorías de precios" });
  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveCount(3, { timeout: 15_000 });
  await expect.poll(() => tabs.first().evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber$")))).toBe(true);

  const relation = () =>
    tablist.evaluate((list) => {
      const panel = list.closest("[data-module-tabs]")!.querySelector<HTMLElement>(':scope > [role="tabpanel"], :scope > * > [role="tabpanel"]')!;
      const selected = [...list.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]')];
      const refs = (selected[0]?.getAttribute("aria-controls") ?? "").split(/\s+/).filter(Boolean);
      return {
        selected: selected.map((tab) => tab.dataset.moduleTab),
        refs: refs.length,
        controlsPanel: refs.length === 1 && document.getElementById(refs[0]) === panel,
        panelLabel: panel.getAttribute("aria-label"),
        focused: (document.activeElement as HTMLElement | null)?.dataset.moduleTab ?? null,
      };
    });

  expect(await relation()).toMatchObject({ selected: [names[0]], refs: 1, controlsPanel: true, panelLabel: names[0] });
  expect(await seriousAxe(page, pricing)).toEqual([]);

  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(relation).toEqual({ selected: [names[1]], refs: 1, controlsPanel: true, panelLabel: names[1], focused: names[1] });
  await page.keyboard.press("End");
  await expect.poll(relation).toEqual({ selected: [names[2]], refs: 1, controlsPanel: true, panelLabel: names[2], focused: names[2] });
  await page.keyboard.press("ArrowRight");
  await expect.poll(relation).toEqual({ selected: [names[0]], refs: 1, controlsPanel: true, panelLabel: names[0], focused: names[0] });
  await page.keyboard.press("ArrowLeft");
  await expect.poll(relation).toEqual({ selected: [names[2]], refs: 1, controlsPanel: true, panelLabel: names[2], focused: names[2] });
  await page.keyboard.press("Home");
  await expect.poll(relation).toEqual({ selected: [names[0]], refs: 1, controlsPanel: true, panelLabel: names[0], focused: names[0] });

  await tabs.nth(1).click();
  await expect.poll(relation).toMatchObject({ selected: [names[1]], refs: 1, controlsPanel: true, panelLabel: names[1] });
  await expect(page.locator(`${pricing} form[data-admin-pricing-item-form]`).first()).toContainText(`${names[1]} — estudio 01`);
  expect(await seriousAxe(page, pricing)).toEqual([]);
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
});

test("C20 Precios announces a load failure through the C03 alert and recovers with Actualizar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPricing(page, true);
  await page.goto("/dashboard/admin?module=admin-pricing");
  const alert = page.locator(`${pricing} [data-collection-state="error"][role="alert"]`);
  await expect(alert).toContainText("Precios no disponibles", { timeout: 15_000 });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockPricing(page);
  await page.locator(pricing).getByRole("button", { name: "Actualizar" }).click();
  await expect(page.locator(`${pricing} form[data-admin-pricing-item-form]`).first()).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test("C20 Precios mobile catalog keeps its selecting buttons inside the C01 list with zero document scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPricing(page);
  await page.goto("/dashboard/admin?module=admin-pricing");
  const moduleRoot = page.locator('[data-admin-mobile-config-module="admin-pricing"]');
  await expect(moduleRoot).toBeVisible({ timeout: 15_000 });
  await moduleRoot.locator('[data-admin-mobile-config-chip="catalogo"]').click();
  const rows = moduleRoot.locator('[data-content-list="true"] > button[data-admin-mobile-config-item="true"]');
  await expect(rows.nth(1)).toBeVisible();
  await rows.nth(1).click();
  await moduleRoot.locator('[data-admin-mobile-config-chip="editar"]').click();
  await expect(moduleRoot).toContainText(PRICING[0].items[1].studyName);
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
});

test("C20 Mantenimiento lists dry-run groups as C01 items, pages with C02 and announces failures", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockSchema(page, "ok");
  await mockDryRun(page);
  await page.goto("/dashboard/admin?module=admin-maintenance");
  await page.locator('[data-module-tab="dry-run"]').locator("visible=true").click();
  const card = page.locator("#admin-maintenance");
  await expect(card.locator('[data-collection-state="empty"]')).toContainText("Sin análisis ejecutado");
  await card.getByRole("button", { name: "Analizar limpieza" }).click();
  const rows = card.locator('[data-admin-maintenance-candidates-list="true"][data-content-list="true"] > [data-content-list-item="true"]');
  await expect(rows.first()).toContainText("Grupo C20 1");
  const pager = card.locator('[data-collection-pager="compact"]');
  await pager.locator('[data-dashboard-pager-next="true"]').click();
  await expect(rows.first()).not.toContainText("Grupo C20 1");
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockDryRun(page, true);
  await card.getByRole("button", { name: "Analizar limpieza" }).click();
  await expect(card.locator('[data-collection-state="error"][role="alert"]')).toContainText("Análisis no disponible");
  expect(await seriousAxe(page, "#admin-maintenance")).toEqual([]);
});

test("C20 Mantenimiento mobile dry-run rows are C01 items with zero document scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSchema(page, "ok");
  await mockDryRun(page);
  await page.goto("/dashboard/admin?module=admin-maintenance");
  const moduleRoot = page.locator('[data-admin-mobile-config-module="admin-maintenance"]');
  await expect(moduleRoot).toBeVisible({ timeout: 15_000 });
  await moduleRoot.locator('[data-admin-mobile-config-chip="dry-run"]').click();
  await expect(moduleRoot.locator('[data-collection-state="empty"]')).toContainText("Sin análisis ejecutado");
  await moduleRoot.getByRole("button", { name: "Analizar" }).click();
  const rows = moduleRoot.locator('[data-content-list="true"] > [data-content-list-item="true"][data-admin-mobile-maintenance-candidate-row="true"]');
  await expect(rows.nth(1)).toBeVisible();
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
});

test("C20 Estado lists missing columns as a C01 list and keeps the sanitized error alert", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockSchema(page, "degraded");
  await page.goto("/dashboard/admin?module=admin-health");
  await page.locator('[data-module-tab="esquema"]').locator("visible=true").click();
  const schema = page.locator("#admin-schema-health");
  await expect(schema.locator('ul[data-content-list="true"] > li[data-content-list-item="true"]')).toHaveCount(2);
  await expect(schema).toContainText("public.reports.c20_b");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockSchema(page, "error");
  await schema.getByRole("button", { name: "Reintentar" }).click();
  const alert = schema.locator('.clinical-alert-error[role="alert"]');
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText("HTTP");
});

test("C20 Estado mobile services are C01 items and Resumen exposes no collection grammar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/admin?module=admin-health");
  const health = page.locator('[data-admin-mobile-status-module="admin-health"]');
  await expect(health.locator('[data-content-list="true"] > [data-content-list-item="true"][data-admin-mobile-status-item="true"]')).toHaveCount(5, { timeout: 15_000 });
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard/admin?module=admin");
  const summary = page.locator("#admin-command-center");
  await expect(summary.getByRole("group", { name: "Métricas operativas" })).toBeVisible({ timeout: 15_000 });
  await expect(summary.getByRole("navigation", { name: "Módulos operativos" })).toBeVisible();
  await expect(summary.locator('[data-content-list], [data-collection-workspace], [data-collection-state]')).toHaveCount(0);
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
});
