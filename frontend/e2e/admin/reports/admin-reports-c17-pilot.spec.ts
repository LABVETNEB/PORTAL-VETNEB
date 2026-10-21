import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { A03_ADMIN_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE } from "../../helpers/dashboard-adaptive-limit-matrix";
import { addAppCookies } from "../../helpers/session";

const workspace = '[data-dashboard-module-workspace="admin-report-upload"]';

test.beforeEach(async ({ page }) => {
  await addAppCookies(page, [A03_ADMIN_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE]);
});

test("C17 desktop keeps the server window while search, selection and detail compose", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const requests: Array<{ limit: number; offset: number }> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/admin/report-workflow") requests.push({ limit: Number(url.searchParams.get("limit")), offset: Number(url.searchParams.get("offset")) });
  });
  await page.goto("/dashboard/admin?module=admin-report-upload");
  const reports = page.locator(workspace);
  await expect(reports.locator("tbody tr")).toHaveCount(14);
  await expect(reports.getByRole("search", { name: "Filtros avanzados de informes" })).toHaveCount(1);
  await expect(reports.getByRole("search")).toHaveCount(1);
  await expect(reports.locator('[data-collection-header="true"]')).toBeVisible();
  await expect(reports.locator('[data-collection-workspace="true"]')).toBeVisible();
  expect(requests.at(-1)).toEqual({ limit: 14, offset: 0 });
  const cardBox = await reports.locator('[data-dashboard-b12-module-card="true"]').boundingBox();
  const refreshBox = await reports.getByRole("button", { name: "Actualizar" }).boundingBox();
  const uploadBox = await reports.getByRole("button", { name: "Subir informe" }).boundingBox();
  if (!cardBox || !refreshBox || !uploadBox) throw new Error("C17 desktop actions must have measurable bounds");
  expect(refreshBox.x + refreshBox.width).toBeLessThan(uploadBox.x);
  expect(cardBox.x + cardBox.width - (uploadBox.x + uploadBox.width)).toBeLessThanOrEqual(32);

  const search = reports.getByRole("searchbox", { name: "Buscar informe" });
  await search.fill("#7400");
  await expect(reports.locator("tbody tr")).toHaveCount(14);
  await reports.getByRole("button", { name: "Aplicar" }).click();
  await expect(reports.locator("tbody tr")).toHaveCount(1);
  await expect(reports.locator('[data-active-filter-chips="true"]')).toBeVisible();
  expect(requests.at(-1)).toEqual({ limit: 14, offset: 0 });
  await reports.getByRole("button", { name: "Limpiar", exact: true }).click();
  await expect(reports.locator("tbody tr")).toHaveCount(14);

  await reports.getByRole("checkbox", { name: "Seleccionar página de informes" }).check();
  await expect(reports.locator('[data-selection-count="true"]')).toContainText("14 seleccionados");
  await reports.getByRole("button", { name: "Limpiar selección" }).click();
  await expect(reports.locator('[data-selection-toolbar="true"]')).toHaveCount(0);
  await reports.locator("tbody tr").first().getByRole("button", { name: "Acciones del informe #7400" }).click();
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const dialog = page.getByRole("dialog", { name: /Informe #/ });
  await expect(dialog.locator('[data-details-pane="true"]')).toBeVisible();
  await expect(dialog.locator('[data-details-metadata="true"]')).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Marcar resuelta" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(reports.locator("tbody tr").first().getByRole("button", { name: "Acciones del informe #7400" })).toBeFocused();
  expect((await new AxeBuilder({ page }).include(workspace).analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("C17 mobile sheet, selection and zero-scroll stay operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/admin?module=admin-report-upload");
  const reports = page.locator(workspace);
  await expect(reports.locator('[data-admin-mobile-core-item="true"]')).toHaveCount(13);
  // G11-a: below 640 px the refresh button keeps its name without visible text.
  await expect(reports.getByRole("button", { name: "Actualizar", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).include(workspace).analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
  await reports.getByRole("button", { name: "Filtros" }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrar informes" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("search", { name: "Filtros avanzados de informes mobile" })).toHaveCount(1);
  await expect(reports.getByRole("search")).toHaveCount(0);
  await expect(sheet.getByRole("searchbox", { name: "Buscar informe" })).toBeFocused();
  await expect(sheet.locator("input, select")).toHaveCount(8);
  await page.keyboard.press("Escape");
  await expect(reports.getByRole("button", { name: "Filtros" })).toBeFocused();
  await reports.getByRole("checkbox", { name: "Seleccionar página de informes" }).check();
  await expect(reports.locator('[data-selection-count="true"]')).toContainText("13 seleccionados");
  await reports.getByRole("button", { name: "Limpiar selección" }).click();
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(overflow).toEqual({ x: 0, y: 0 });
});

test("C17 reports failed reads through the collection error state", async ({ page }) => {
  await addAppCookies(page, [{ name: "e2e_c17_report_error", value: "1" }]);
  await page.goto("/dashboard/admin?module=admin-report-upload");
  await expect(page.locator(`${workspace} [data-collection-state="error"]`).first()).toBeVisible();
});

test("C17 opens verified image in C15 viewer and returns focus", async ({ page }) => {
  await page.route(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/sign\//, (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xuoAAAAASUVORK5CYII=", "base64"),
  }));
  await page.goto("/dashboard/admin?module=admin-report-upload");
  const reports = page.locator(workspace);
  await reports.locator("tbody tr").first().getByRole("button", { name: /Acciones del informe/ }).click();
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.getByRole("dialog", { name: /Informe #/ });
  const trigger = detail.getByRole("button", { name: "Ver informe" });
  await trigger.click();
  const viewer = page.locator('[data-c15-viewer="true"]');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("img", { name: /Informe #/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("C17 reports a failed viewer download in the detail pane without an unhandled rejection", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/sign\//, (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xuoAAAAASUVORK5CYII=", "base64"),
  }));
  await page.goto("/dashboard/admin?module=admin-report-upload");
  await page.locator(workspace).locator("tbody tr").first().getByRole("button", { name: /Acciones del informe/ }).click();
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.getByRole("dialog", { name: /Informe #/ });
  const trigger = detail.getByRole("button", { name: "Ver informe" });
  await trigger.click();
  const viewer = page.locator('[data-c15-viewer="true"]');
  await expect(viewer.getByRole("img", { name: /Informe #/ })).toBeVisible();
  // The fixture serves no viewer download descriptor: the request fails.
  await viewer.getByRole("button", { name: "Descargar documento" }).click();
  await expect(viewer).toHaveCount(0);
  await expect(detail.locator('[data-admin-report-viewer-download-error="true"]')).toBeVisible();
  await expect(detail.locator('[data-admin-report-viewer-download-error="true"]')).toHaveAttribute("role", "alert");
  await expect(trigger).toBeFocused();
  expect(pageErrors, "the failed download is handled, not an unhandled rejection").toEqual([]);
});

test("C17 fails closed when the server cannot verify a historical document", async ({ page }) => {
  await addAppCookies(page, [{ name: "e2e_c17_unverifiable", value: "1" }]);
  await page.goto("/dashboard/admin?module=admin-report-upload");
  await page.locator(workspace).locator("tbody tr").first().getByRole("button", { name: /Acciones del informe/ }).click();
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.getByRole("dialog", { name: /Informe #/ });
  await detail.getByRole("button", { name: "Ver informe" }).click();
  await expect(detail.getByRole("alert")).toContainText("Documento no verificable");
  await expect(page.locator('[data-c15-viewer="true"]')).toHaveCount(0);
});
