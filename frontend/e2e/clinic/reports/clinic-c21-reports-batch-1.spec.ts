import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { settleInformesRows, trackInformesWindowRequests } from "../../helpers/informes-adaptive-settle";
import { addAppCookies, sessionCookie, setClinicSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function expectNoDocumentScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.vertical, `${label}: vertical document scroll`).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  expect(overflow.horizontal, `${label}: horizontal document scroll`).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
}

async function expectHydrated(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber$"))), { timeout: 15_000 })
    .toBe(true);
}

const borderBottom = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).borderBottomWidth);

async function expectNoSeriousAxe(page: Page, include: string) {
  const { violations } = await new AxeBuilder({ page }).include(include).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
}

async function openModule(page: Page) {
  await page.goto("/dashboard?module=informes");
  const card = page.locator('[data-dashboard-module-workspace="informes"] [aria-label="Informes recientes de la clínica"]').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  return card;
}

test.describe("C21 · clinic Informes module", () => {
  test("desktop table is the C01 collection, filters apply and clear, and the detail is the C13 pane", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "populated");
    const card = await openModule(page);

    const canvas = card.locator('[data-clinic-reports-list-body="true"]');
    const head = canvas.locator("thead");
    const rows = canvas.locator('[data-clinic-reports-table-row="true"]');
    await expect(canvas).toHaveAttribute("data-collection-workspace", "true");
    await expect(head).toHaveAttribute("data-collection-header", "true");
    await expect(canvas.locator("tbody")).toHaveAttribute("data-content-list", "true");
    await expect(rows.first()).toHaveAttribute("data-content-list-item", "true");
    expect(await rows.count()).toBeGreaterThan(1);

    // A03: the painted head equals the reserve the capacity engine subtracts; separators stay 1px.
    const geometry = await canvas.evaluate((element) => ({
      reserved: parseFloat(getComputedStyle(element).getPropertyValue("--dash-canvas-reserved")),
      head: element.querySelector("thead")!.getBoundingClientRect().height,
    }));
    expect(Math.abs(geometry.head - geometry.reserved)).toBeLessThanOrEqual(0.5);
    expect(await borderBottom(rows.first())).toBe("1px");
    expect(await borderBottom(rows.last())).toBe("0px");

    const bar = card.locator('[data-clinic-report-filter-bar="advanced"]');
    await expect(bar).toBeVisible();
    await expect(card.getByRole("search", { name: "Filtros avanzados de informes clínica" })).toHaveCount(1);
    await expect(card.getByRole("search")).toHaveCount(1);
    await expectHydrated(bar);
    const reportField = bar.getByLabel("Informe");
    await reportField.fill("8401");
    await bar.getByRole("button", { name: "Aplicar" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Informe #8401");

    await bar.getByLabel("Paciente").fill("zz-c21-sin-coincidencias");
    await bar.getByRole("button", { name: "Aplicar" }).click();
    await expect(card.locator('[data-collection-state="empty"]')).toContainText("Sin informes para los filtros aplicados");
    await expect(bar, "PR-BUG-01: the bar stays with an empty result").toBeVisible();

    await bar.getByRole("button", { name: "Limpiar" }).click();
    await expect(reportField).toHaveValue("");
    await expect.poll(() => rows.count()).toBeGreaterThan(1);

    await rows.first().getByRole("button", { name: "Ver", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const pane = dialog.locator('[data-details-pane="true"]');
    await expect(pane).toHaveAttribute("aria-label", /^Detalle del informe #\d+$/);
    for (const item of ["estudio", "fecha", "archivo"]) {
      await expect(pane.locator(`[data-details-metadata-item="${item}"]`)).toBeVisible();
    }
    await expect(pane.getByRole("button", { name: /^Abrir informe \d+ en el módulo completo$/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await expectNoDocumentScroll(page, "module desktop");
    await expectNoSeriousAxe(page, '[data-dashboard-module-workspace="informes"]');
  });

  test("mobile list is the C01 list and the CMP-12 pager pages it without document scroll", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await setClinicSession(page, "populated");
    const card = await openModule(page);

    const list = card.locator('[data-clinic-reports-mobile-list="true"]');
    const rows = list.locator('[data-clinic-reports-mobile-row="true"]');
    await expect(list).toHaveAttribute("data-content-list", "true");
    await expect(rows.first()).toHaveAttribute("data-content-list-item", "true");
    await expect(rows.first()).toHaveAttribute("data-dashboard-adaptive-row", "true");
    expect(await borderBottom(rows.first())).toBe("1px");

    await card.getByRole("button", { name: "Filtros", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Filtrar informes" });
    await expect(sheet.getByRole("search", { name: "Filtros avanzados de informes clínica mobile" })).toHaveCount(1);
    await expect(card.getByRole("search")).toHaveCount(0);
    await page.keyboard.press("Escape");

    const pager = card.locator('[data-clinic-reports-pagination-controls="true"]');
    await expect(pager).toBeVisible();
    expect(await pager.getAttribute("data-collection-pager")).toBeNull();
    const firstRow = await rows.first().textContent();
    await expectHydrated(pager);
    await pager.getByRole("button", { name: "Página siguiente" }).click();
    await expect(pager).toContainText("Pág. 2 /");
    expect(await rows.first().textContent()).not.toBe(firstRow);
    await expectNoDocumentScroll(page, "module phone");
  });
});

test.describe("C21 · clinic Informes full route", () => {
  test("rows canvas, C02 pager and deep link keep the server-adaptive contract", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "populated");
    const requests = trackInformesWindowRequests(page);
    await page.goto("/dashboard/informes");
    const count = await settleInformesRows(page, requests, "full route", 15_000);

    await expect(page.locator('[data-informes-master-detail-canvas="true"]')).toHaveAttribute("data-collection-workspace", "true");
    const canvas = page.locator('[data-informes-rows-canvas="true"]');
    await expect(canvas).toHaveAttribute("data-content-list", "true");
    expect(await canvas.evaluate((element) => element.children.length)).toBe(count);

    const pager = page.getByRole("navigation", { name: "Paginación de informes" });
    await expect(pager).toHaveAttribute("data-collection-pager", "centered");
    await expect(pager).toHaveAttribute("data-dashboard-adaptive-reserved-region", "pager");
    const pagerBox = (await pager.boundingBox())!;
    expect(Math.abs(pagerBox.height - 40)).toBeLessThanOrEqual(0.5);
    expect(pagerBox.y + pagerBox.height).toBeLessThanOrEqual(DESKTOP.height);
    const state = pager.locator("[data-dashboard-pager-state] .dashboard-pagination-context");
    expect((await state.boundingBox())!.width).toBeGreaterThanOrEqual(71.5);

    const previous = pager.getByRole("button", { name: "Página anterior" });
    const next = pager.getByRole("button", { name: "Página siguiente" });
    await expect(previous).toBeDisabled();
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    const firstId = await canvas.locator("[id^='report-']").first().getAttribute("id");
    await expectHydrated(pager);
    await next.click();
    await expect(state).toContainText("Pág. 2 /");
    await settleInformesRows(page, requests, "full route page 2", 15_000);
    expect(await canvas.locator("[id^='report-']").first().getAttribute("id")).not.toBe(firstId);
    await expect(previous).toBeEnabled();
    await expectNoDocumentScroll(page, "full route");
    await expectNoSeriousAxe(page, "main.dashboard-main");

    await page.goto("/dashboard/informes?reportId=8403");
    await expect(page.locator("#report-detail h2#report-detail-heading")).toContainText("Informe #8403");
    await expect(page.locator("#report-8403")).toHaveAttribute("aria-label", /^Informe seleccionado:/);
  });

  test("empty result keeps the filter bar and the C03 empty state", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "populated");
    await page.goto("/dashboard/informes?query=zz-c21-sin-coincidencias");
    await expect(page.locator('[data-collection-state="empty"]')).toContainText("No hay informes disponibles.");
    await expect(page.getByRole("search", { name: "Filtros compactos de informes" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Buscar informes" }).or(page.getByRole("textbox", { name: "Buscar informes" }))).toHaveValue("zz-c21-sin-coincidencias");
    await expectNoDocumentScroll(page, "full route empty");
  });

  test("load failure is the C03 alert on both surfaces and the filter bars stay", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "default");
    await page.goto("/dashboard/informes");
    const error = page.locator('[data-collection-state="error"]');
    await expect(error).toContainText("No se pudieron cargar los informes. Intente nuevamente.");
    await expect(error).toHaveAttribute("role", "alert");
    await expect(page.getByRole("search", { name: "Filtros compactos de informes" })).toBeVisible();
    await expectNoDocumentScroll(page, "full route error");

    const card = await openModule(page);
    await expect(card.locator('.clinical-alert-warning[role="alert"]')).toContainText("No se pudieron cargar los informes recientes.");
    await expect(card.locator('[data-clinic-report-filter-bar="advanced"]'), "PR-BUG-01").toBeVisible();
    await expectNoDocumentScroll(page, "module error");
  });

  test("the full route is clinic-only: no session and an admin-only session reach the login", async ({ page }) => {
    await page.goto("/dashboard/informes");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Finformes$/);

    await addAppCookies(page, [sessionCookie("admin", "populated")]);
    await page.goto("/dashboard/informes");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Finformes$/);
    await expect(page.locator('[data-informes-workspace="true"]')).toHaveCount(0);
  });
});
