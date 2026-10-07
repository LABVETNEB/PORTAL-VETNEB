import { expect, test, type Page } from "@playwright/test";
import { waitForAdaptiveConvergence } from "../../helpers/dashboard-adaptive-limit-matrix";
import { setAdminSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

// ─────────────────────────────────────────────────────────────────────────────
// PR #1465 review P2 — a save message must never let a pricing form push the
// collection out of the viewport.
//
// Originally each study was a tall card whose error grew it, so the page size
// had to measure every form. Since the admin desktop/tablet space pass each
// study is ONE compact form row locked to the `regular` row pitch and a whole
// category fits one view: the message shares the study cell (accessible
// truncation: full text in role=alert and title) instead of growing the row.
// This behaviour test drives a real save failure with a deliberately long
// message on a NON-first row and asserts the row keeps the pitch, every study
// stays in view with no pager, the message and the save action stay reachable
// and the document never gains scroll.
// ─────────────────────────────────────────────────────────────────────────────

const TOLERANCE = 2;
const PRICING_WORKSPACE = '[data-dashboard-module-workspace="admin-pricing"]';

// A deliberately long error: under the old card it grew the failed form by
// ~100px; the compact row must absorb it without growing.
const LONG_ERROR_MESSAGE =
  "Detalle extendido del rechazo del backend al validar el catálogo. ".repeat(
    13,
  ) + "Reintente en unos instantes.";

// One category with six studies: several rows render, all inside one view.
const PRICING_SNAPSHOT = {
  success: true,
  categories: [
    {
      category: "Histopatología",
      items: Array.from({ length: 6 }, (_, index) => ({
        id: 5001 + index,
        studyName: `Histopatología — estudio ${index + 1}`,
        priceLabel: index % 2 === 0 ? `$${1000 + index * 100}` : null,
        displayOrder: index,
        isActive: index % 4 !== 3,
        updatedAt: "2026-06-18T10:00:00.000Z",
      })),
    },
  ],
};

async function mockPricing(page: Page) {
  await page.route("**/api/admin/pricing**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/api/admin/pricing") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PRICING_SNAPSHOT),
      });
      return;
    }

    // Every per-item save fails with a tall error message.
    if (
      request.method() === "PATCH" &&
      /\/api\/admin\/pricing\/\d+$/.test(url.pathname)
    ) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: LONG_ERROR_MESSAGE }),
      });
      return;
    }

    await route.fallback();
  });
}

async function readDocumentScroll(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    return {
      htmlScrollH: html.scrollHeight,
      htmlClientH: html.clientHeight,
      htmlScrollW: html.scrollWidth,
      htmlClientW: html.clientWidth,
      bodyScrollH: body.scrollHeight,
      bodyClientH: body.clientHeight,
      mainScrollH: main ? main.scrollHeight : 0,
      mainClientH: main ? main.clientHeight : 0,
    };
  });
}

test.describe("admin pricing keeps every study in view when a save fails", () => {
  test("a long error on a non-first row keeps the row pitch, every study visible and nothing clipped", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAdminSession(page, "default");
    await mockPricing(page);

    await page.goto("/dashboard/admin?module=admin-pricing");

    const workspace = page.locator(PRICING_WORKSPACE);
    await expect(workspace).toBeVisible({ timeout: 15_000 });

    const forms = page.locator("[data-admin-pricing-item-form]");
    const studies = PRICING_SNAPSHOT.categories[0].items.length;
    await expect(forms, "the whole category renders in one view").toHaveCount(studies, { timeout: 12_000 });
    await expect(page.locator('[data-admin-pricing-all-items="true"]')).toHaveCount(1);
    await expect(page.locator('[data-dashboard-compact-pager="true"]'), "no pager while the category fits").toHaveCount(0);
    const firstHeight = (await forms.nth(0).boundingBox())!.height;

    // Make an edit on the second (NON-first) row so the save fires a PATCH.
    const secondForm = forms.nth(1);
    await secondForm.getByRole("textbox", { name: /^Precio de / }).fill("$9.999");
    await secondForm.getByRole("button", { name: "Guardar precio" }).click();

    const message = secondForm.getByRole("alert");
    await expect(message, "the error is announced").toHaveText(LONG_ERROR_MESSAGE, { timeout: 10_000 });
    await expect(message).toBeVisible();
    await expect(message, "the full text stays available on hover").toHaveAttribute("title", LONG_ERROR_MESSAGE);
    expect(
      await message.evaluate((node) => node.scrollWidth > node.clientWidth),
      "the long message is truncated, not wrapped into a taller row",
    ).toBe(true);

    await waitForAdaptiveConvergence(page, PRICING_WORKSPACE, "rows settled after the error");

    // (1) No accidental scroll on document / body / main.
    await expect(async () => {
      const m = await readDocumentScroll(page);
      expect(m.htmlScrollH, "documentElement vertical").toBeLessThanOrEqual(m.htmlClientH + MAX_DOCUMENT_SCROLL_DELTA_PX);
      expect(m.htmlScrollW, "documentElement horizontal").toBeLessThanOrEqual(m.htmlClientW + MAX_DOCUMENT_SCROLL_DELTA_PX);
      expect(m.bodyScrollH, "body vertical").toBeLessThanOrEqual(m.bodyClientH + MAX_DOCUMENT_SCROLL_DELTA_PX);
      expect(m.mainScrollH, "main vertical").toBeLessThanOrEqual(m.mainClientH + TOLERANCE);
    }).toPass({ timeout: 10_000 });

    // (2) The errored row keeps the pitch and the category still fits: no pager.
    expect(Math.abs((await secondForm.boundingBox())!.height - firstHeight), "errored row keeps the row pitch").toBeLessThanOrEqual(0.5);
    await expect(forms).toHaveCount(studies);
    await expect(page.locator('[data-dashboard-compact-pager="true"]')).toHaveCount(0);

    // (3) No row is clipped: every row lies inside the rows canvas.
    const canvas = (await page.locator('[data-admin-pricing-all-items="true"]').boundingBox())!;
    for (let index = 0; index < studies; index += 1) {
      const box = (await forms.nth(index).boundingBox())!;
      expect(box.y, `row ${index} top inside the canvas`).toBeGreaterThanOrEqual(canvas.y - TOLERANCE);
      expect(box.y + box.height, `row ${index} bottom inside the canvas`).toBeLessThanOrEqual(canvas.y + canvas.height + TOLERANCE);
    }

    // (4) The errored row's save action stays visible and inside its row.
    const save = secondForm.getByRole("button", { name: "Guardar precio" });
    await expect(save, "errored row save action stays visible").toBeVisible();
    const [saveBox, rowBox] = await Promise.all([save.boundingBox(), secondForm.boundingBox()]);
    expect(saveBox!.y >= rowBox!.y - 0.5 && saveBox!.y + saveBox!.height <= rowBox!.y + rowBox!.height + 0.5, "save action inside the row").toBe(true);
  });
});
