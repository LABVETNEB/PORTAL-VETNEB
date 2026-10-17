import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { addAppCookies, sessionCookie } from "../../helpers/session";

const tokens = '[data-dashboard-module-workspace="admin-particular-tokens"]';
const audit = '[data-dashboard-module-workspace="audit-log"]';

test.beforeEach(async ({ page }) => {
  await addAppCookies(page, [sessionCookie("admin", "populated")]);
});

test("C18 Tokens composes the collection, chips and details without touching its operations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard/admin?module=admin-particular-tokens");
  const card = page.locator(tokens);
  await expect(card.locator('[data-collection-workspace="true"] tbody tr')).toHaveCount(9);
  await expect(card.locator('[data-collection-header="true"]')).toBeVisible();

  await card.getByPlaceholder("Nombre o ID").fill("12");
  await card.getByRole("button", { name: "Aplicar" }).click();
  await expect(card.locator("tbody tr")).toHaveCount(1);
  const chips = card.locator('[data-active-filter-chips="true"]');
  await expect(chips).toBeVisible();
  await chips.getByRole("button", { name: /Quitar filtro Clínica: 12/ }).click();
  await expect(card.locator("tbody tr")).toHaveCount(9);
  await expect(chips).toHaveCount(0);

  await card.locator("tbody tr").first().getByRole("button", { name: "Ver detalle" }).click();
  const dialog = page.getByRole("dialog", { name: /Token \*\*\*\*/ });
  await expect(dialog.locator('[data-details-pane="true"]')).toBeVisible();
  await expect(dialog.locator('[data-details-metadata-item="masked-token"]')).toContainText("Token ****4201");
  await expect(dialog.getByRole("button", { name: "Eliminar token" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include(tokens).analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("C18 Tokens mobile search pill submits the same clinic filter with zero document scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/admin?module=admin-particular-tokens");
  const card = page.locator(tokens);
  const items = card.locator('[data-admin-mobile-core-item="true"]');
  await expect(items.first()).toBeVisible();
  const search = card.getByRole("searchbox", { name: "Nombre de clínica" });
  await expect(search).toHaveCSS("height", "40px");
  await search.fill("12");
  await search.press("Enter");
  await expect(items).toHaveCount(1);
  await card.getByRole("button", { name: "Limpiar", exact: true }).click();
  await expect(items.first()).toBeVisible();
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(overflow).toEqual({ x: 0, y: 0 });
});

test("C18 Auditoría mobile sheet keeps the S1 GET form and URL contract", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/admin?module=audit-log");
  const auditModule = page.locator(audit);
  await expect(auditModule.locator('[data-admin-mobile-ops-item="true"]').first()).toBeVisible();
  const trigger = auditModule.getByRole("button", { name: "Filtros", exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(page.locator('[data-advanced-filter-sheet="true"]')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  const sheet = page.getByRole("dialog", { name: "Filtrar auditoría" });
  const form = sheet.locator('form[method="get"][action="/dashboard/admin"]');
  await expect(form).toHaveCount(1);
  const fieldTint = await form.locator('select[name="event"]').evaluate((select) => {
    const shell = select.closest(".dashboard-app-shell");
    if (!shell) return null;
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--dash-color-field)";
    shell.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { actual: getComputedStyle(select).backgroundColor, expected };
  });
  expect(fieldTint, "the S1 sheet stays inside the dashboard scope (B05 field tint)").not.toBeNull();
  expect(fieldTint?.actual).toBe(fieldTint?.expected);
  await form.locator('select[name="event"]').selectOption("clinic_user.role.changed");
  await form.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/dashboard/admin" &&
    url.searchParams.get("module") === "audit-log" &&
    url.searchParams.get("event") === "clinic_user.role.changed",
  );
  await expect(page.locator('[data-advanced-filter-sheet="true"]')).toHaveCount(0);
  await expect(auditModule.locator('[data-admin-mobile-ops-item="true"]').first()).toBeVisible();
});

test("C18 Auditoría desktop detail renders the safe fields through the details pane", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/dashboard/admin?module=audit-log");
  const auditModule = page.locator(audit);
  const firstRow = auditModule.locator('[data-collection-workspace="true"] tbody tr').first();
  await expect(firstRow).toBeVisible();
  const trigger = firstRow.getByRole("button", { name: /Ver detalle del evento/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /Evento #/ });
  await expect(dialog.locator('[data-details-pane="true"] [data-details-metadata="true"]')).toBeVisible();
  for (const item of ["code", "date", "actor", "entity", "action", "safe-detail"]) {
    await expect(dialog.locator(`[data-details-metadata-item="${item}"]`)).toHaveCount(1);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
