import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { addAppCookies, sessionCookie, setClinicSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const TOKENS = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    clinicId: 10,
    reportId: id % 2 === 0 ? 300 + id : null,
    tokenLast4: String(7000 + id).slice(-4),
    tutorLastName: `Tutor C22 ${id}`,
    petName: `Paciente C22 ${id}`,
    petAge: "3 años",
    petBreed: "Mestizo",
    petSex: id % 2 === 0 ? "Hembra" : "Macho",
    petSpecies: id % 2 === 0 ? "Felinos" : "Caninos",
    sampleLocation: "Región torácica",
    sampleEvolution: "Subaguda",
    detailsLesion: "Lesión nodular de prueba sintética.",
    extractionDate: "2026-06-01T00:00:00.000Z",
    shippingDate: "2026-06-02T00:00:00.000Z",
    isActive: id !== 4,
    lastLoginAt: id % 2 === 0 ? "2026-06-05T12:30:00.000Z" : null,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    createdByAdminId: null,
    createdByClinicUserId: 77,
    hasLinkedReport: id % 2 === 0,
  };
});

async function mockClinicTokens(page: Page, outcome: "populated" | "failure") {
  await page.route(
    (url) => url.pathname === "/api/particular-tokens",
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const limit = Number(new URL(route.request().url()).searchParams.get("limit"));
      if (outcome === "failure") {
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, message: "Error interno" }) });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, count: TOKENS.length, particularTokens: TOKENS, pagination: { limit, offset: 0 } }),
      });
    },
  );
}

async function expectNoDocumentScroll(page: Page, label: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const html = document.documentElement;
          return Math.max(html.scrollHeight - html.clientHeight, html.scrollWidth - html.clientWidth);
        }),
      { message: `${label}: document scroll` },
    )
    .toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
}

async function expectHydrated(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber$"))), { timeout: 15_000 })
    .toBe(true);
}

const borderBottom = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).borderBottomWidth);

async function expectNoSeriousAxe(page: Page, include: string, preexisting: string[] = []) {
  const { violations } = await new AxeBuilder({ page }).include(include).disableRules(preexisting).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
}

async function expectHeadEqualsReserve(canvas: Locator) {
  const geometry = await canvas.evaluate((element) => ({
    reserved: parseFloat(getComputedStyle(element).getPropertyValue("--dash-canvas-reserved")),
    head: element.querySelector("thead")!.getBoundingClientRect().height,
  }));
  expect(Math.abs(geometry.head - geometry.reserved), JSON.stringify(geometry)).toBeLessThanOrEqual(0.5);
}

async function openTokens(page: Page) {
  await page.goto("/dashboard?module=tokens");
  const card = page.locator("#clinic-particular-tokens");
  await expect(card).toBeVisible({ timeout: 15_000 });
  return card;
}

test.describe("C22 · clinic Tokens (S7)", () => {
  test("desktop table is the C01 collection; filters apply, empty and clear with the bar visible; rows open the detail", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "default");
    await mockClinicTokens(page, "populated");
    const card = await openTokens(page);

    const canvas = card.locator('[data-clinic-access-list-body="true"]');
    const rows = canvas.locator('[data-clinic-access-table-row="true"]');
    await expect.poll(() => rows.count()).toBeGreaterThan(1);
    await expect(canvas.locator("thead")).toHaveAttribute("data-collection-header", "true");
    await expect(canvas.locator("tbody")).toHaveAttribute("data-content-list", "true");
    await expect(rows.first()).toHaveAttribute("data-content-list-item", "true");
    await expectHeadEqualsReserve(canvas);
    expect(await borderBottom(rows.first())).toBe("1px");
    await expect(rows.first()).toContainText("****");

    const pager = card.locator('[data-clinic-access-pagination-controls="true"]');
    expect(await pager.getAttribute("data-collection-pager")).toBeNull();

    const bar = card.locator('[data-clinic-access-filter-bar="advanced"]');
    await expect(bar).toBeVisible();
    await expect(card.getByRole("search", { name: "Filtros avanzados de tokens clínica" })).toHaveCount(1);
    await expect(card.getByRole("search")).toHaveCount(1);
    await expectHydrated(bar);
    await bar.getByLabel("Paciente").fill("zz-c22-sin-coincidencias");
    await bar.getByRole("button", { name: "Aplicar" }).click();
    await expect(card.locator('[data-collection-state="empty"]')).toContainText("Sin tokens para los filtros aplicados");
    await expect(bar, "PR-BUG-01: the bar stays with an empty result").toBeVisible();
    await bar.getByRole("button", { name: "Limpiar" }).click();
    await expect.poll(() => rows.count()).toBeGreaterThan(1);

    await rows.first().getByRole("button", { name: "Ver detalle" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Token ****");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await expectNoDocumentScroll(page, "tokens desktop");
    await expectNoSeriousAxe(page, "#clinic-particular-tokens");
  });

  test("mobile list is the C01 list locked to the pitch and its own pager pages it", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await setClinicSession(page, "default");
    await mockClinicTokens(page, "populated");
    const card = await openTokens(page);

    const list = card.locator('[data-clinic-access-mobile-list="true"]');
    const rows = list.locator('[data-clinic-access-mobile-row="true"]');
    await expect.poll(() => rows.count()).toBeGreaterThan(1);
    await expect(list).toHaveAttribute("data-content-list", "true");
    await expect(rows.first()).toHaveAttribute("data-content-list-item", "true");
    await expect(rows.first()).toHaveAttribute("data-dashboard-adaptive-row", "true");
    expect(await borderBottom(rows.first())).toBe("1px");

    await card.getByRole("button", { name: "Filtros", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Filtrar tokens" });
    await expect(sheet.getByRole("search", { name: "Filtros avanzados de tokens clínica mobile" })).toHaveCount(1);
    await expect(card.getByRole("search")).toHaveCount(0);
    await page.keyboard.press("Escape");

    const pager = card.locator('[data-clinic-access-pagination-controls="true"]');
    const firstRow = await rows.first().textContent();
    await expectHydrated(pager);
    await pager.getByRole("button", { name: "Página siguiente" }).click();
    await expect(card.locator('[data-clinic-access-pagination-status="true"]')).toContainText("Página 2 /");
    expect(await rows.first().textContent()).not.toBe(firstRow);
    await expectNoDocumentScroll(page, "tokens phone");
  });

  test("a failed read is announced, keeps the filter bar and shows the C03 empty panel", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "default");
    await mockClinicTokens(page, "failure");
    const card = await openTokens(page);

    await expect(card.locator('p[role="alert"]')).toBeVisible();
    await expect(card.locator('[data-clinic-access-filter-bar="advanced"]'), "PR-BUG-01").toBeVisible();
    await expect(card.locator('[data-collection-state="empty"]')).toContainText("Sin tokens particulares");
    await expect(card.getByRole("button", { name: "Actualizar" })).toBeEnabled();
    await expectNoDocumentScroll(page, "tokens error");
  });
});

test.describe("C22 · clinic Logística", () => {
  test("module list is the C01 workspace and list; the C02 pager and the keyboard open the visit", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "populated");
    await page.goto("/dashboard?module=logistica");
    const workspace = page.locator('[data-dashboard-module-workspace="logistica"]');
    const panel = workspace.locator('[data-clinic-logistics-list-panel="true"]');
    await expect(panel).toHaveAttribute("data-collection-workspace", "true", { timeout: 15_000 });
    const canvas = panel.locator('[data-clinic-logistics-list-body="true"]');
    await expect(canvas).toHaveAttribute("data-content-list", "true");
    const rows = canvas.locator('[data-clinic-logistics-row="true"]');
    expect(await rows.count()).toBeGreaterThan(0);
    expect(await canvas.evaluate((element) => element.children.length)).toBe(await rows.count());

    const pager = panel.getByRole("navigation", { name: "Paginación de visitas recientes" });
    await expect(pager).toHaveAttribute("data-collection-pager", "centered");
    await expect(pager).toHaveAttribute("data-dashboard-adaptive-reserved-region", "pager");

    await expectHydrated(rows.first());
    await rows.first().focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('[data-clinic-logistics-detail-dialog="true"]')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Abrir visitas de campo en el módulo completo" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expectNoDocumentScroll(page, "logistics module");
  });

  test("hub recent lists are C01 lists with the C02 pager", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "populated");
    await page.goto("/dashboard/logistica");
    for (const name of ["Paginación de visitas recientes", "Paginación de planes recientes"]) {
      const pager = page.getByRole("navigation", { name });
      await expect(pager).toHaveAttribute("data-collection-pager", "centered", { timeout: 15_000 });
      const root = page.locator('[data-collection-workspace="true"][data-dashboard-adaptive-reservation="true"]').filter({ has: pager });
      await expect(root).toHaveCount(1);
      const canvas = root.locator('[data-logistics-recent-list-canvas="true"]');
      await expect(canvas).toHaveAttribute("data-content-list", "true");
      expect(await canvas.locator("[data-logistics-recent-row]").count()).toBeGreaterThan(0);
    }
    await expectNoDocumentScroll(page, "logistics hub");
    await expectNoSeriousAxe(page, "main.dashboard-main");
  });

  for (const [path, label, table] of [
    ["/dashboard/logistica/rutas", "Paginación de planes de ruta", true],
    ["/dashboard/logistica/visitas", "Paginación de visitas", true],
    ["/dashboard/logistica/metricas", "Paginación de métricas de ruta", false],
  ] as const) {
    test(`${path}: the URL pager is the C02 owner and the collection is C01 at desktop and phone`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await setClinicSession(page, "populated");
      await page.goto(path);
      const pager = page.getByRole("navigation", { name: label });
      await expect(pager).toHaveAttribute("data-collection-pager", "centered", { timeout: 15_000 });
      await expect(pager).toHaveAttribute("data-dashboard-adaptive-reserved-region", "pager");
      await expect(async () => {
        expect(page.url()).toMatch(/[?&]limit=\d+/);
      }).toPass({ timeout: 15_000 });
      const pagerBox = (await pager.boundingBox())!;
      expect(Math.abs(pagerBox.height - 40)).toBeLessThanOrEqual(0.5);
      expect(pagerBox.y + pagerBox.height).toBeLessThanOrEqual(DESKTOP.height);
      const state = pager.locator("[data-dashboard-pager-state] .dashboard-pagination-context");
      await expect(state).toHaveText("Página 1");
      expect((await state.boundingBox())!.width).toBeGreaterThanOrEqual(71.5);
      await expect(pager.getByRole("button", { name: "Página anterior" })).toBeDisabled();

      if (table) {
        const canvas = page.locator('[data-dashboard-table-canvas]:visible');
        await expect(canvas.locator("thead")).toHaveAttribute("data-collection-header", "true");
        await expect(canvas.locator("tbody")).toHaveAttribute("data-content-list", "true");
        await expect(canvas.locator("tbody tr").first()).toHaveAttribute("data-content-list-item", "true");
        await expectHeadEqualsReserve(canvas);
      }
      await expectNoDocumentScroll(page, `${path} desktop`);
      // Pre-C22 finding, outside this scope: the Rutas progress cell renders an unnamed role="progressbar".
      await expectNoSeriousAxe(page, "main.dashboard-main", path.endsWith("/rutas") ? ["aria-progressbar-name"] : []);

      await page.setViewportSize(PHONE);
      await page.goto(path);
      const list = page.locator("[data-logistics-mobile-list]");
      await expect(list).toHaveAttribute("data-content-list", "true", { timeout: 15_000 });
      expect(await list.locator(":scope > *").count()).toBeGreaterThan(0);
      await expect(page.getByRole("navigation", { name: label })).toBeVisible();
      await expectNoDocumentScroll(page, `${path} phone`);
    });
  }

  test("the logistics routes are clinic-only: no session and an admin-only session reach the login", async ({ page }) => {
    await page.goto("/dashboard/logistica/rutas");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Flogistica%2Frutas$/);
    await addAppCookies(page, [sessionCookie("admin", "populated")]);
    await page.goto("/dashboard/logistica/visitas");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Flogistica%2Fvisitas$/);
    await expect(page.locator("[data-logistics-mobile-list]")).toHaveCount(0);
  });
});

test.describe("C22 · clinic Operaciones and Perfil", () => {
  test("Operaciones recent lists are C01 lists that keep their row spacing; Perfil is not a collection", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setClinicSession(page, "populated");
    await page.goto("/dashboard?module=operaciones");
    const center = page.locator('[data-clinic-command-center="true"]');
    await expect(center).toBeVisible({ timeout: 15_000 });
    await expectHydrated(center.getByRole("tab", { name: "Recientes" }));
    await center.getByRole("tab", { name: "Recientes" }).click();
    const lists = center.locator('[data-content-list="true"]');
    await expect(lists).toHaveCount(2);
    for (const index of [0, 1]) {
      const items = lists.nth(index).locator(':scope > [data-content-list-item="true"].dashboard-list-row');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      expect(await lists.nth(index).evaluate((element) => getComputedStyle(element).display)).toBe("contents");
      if (count > 1) {
        const gap = (await items.nth(1).boundingBox())!.y - ((await items.nth(0).boundingBox())!.y + (await items.nth(0).boundingBox())!.height);
        expect(Math.abs(gap - 6)).toBeLessThanOrEqual(0.5);
      }
    }
    await expectNoDocumentScroll(page, "operaciones");

    await page.goto("/dashboard?module=perfil");
    const profile = page.locator('[data-dashboard-module-workspace="perfil"]');
    await expect(profile.locator("#clinic-public-profile-form")).toBeAttached({ timeout: 15_000 });
    await expect(profile.locator("[data-content-list], [data-collection-workspace], [data-collection-pager]")).toHaveCount(0);
    await expectNoDocumentScroll(page, "perfil");
  });
});
