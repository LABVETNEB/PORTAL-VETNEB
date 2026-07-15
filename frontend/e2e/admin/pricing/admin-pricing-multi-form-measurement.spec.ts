import { expect, test, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// PR #1465 review P2 — Admin Pricing adaptive page size must measure EVERY
// visible form, not only the first.
//
// A per-item manual form grows when its status/error message appears after a
// save. When only the first form was measured, a later, taller errored form
// overflowed the region and pushed the compact pager out of the viewport. This
// behaviour test drives a real save failure on a NON-first visible form and
// asserts the region stays bounded: the pager remains fully visible, no form is
// clipped, the document never gains accidental scroll, and the errored form's
// message + action stay reachable (on the current page or via the pager).
// ─────────────────────────────────────────────────────────────────────────────

const TOLERANCE = 2;

// A deliberately long, multi-line error so the failed form grows ~100px beyond
// the others. At the chosen viewport this pushes the naive "measure only the
// first form" behaviour to render one form too many (which then overflows and
// clips), while the fix — measuring the tallest form — renders a fitting count.
const LONG_ERROR_MESSAGE =
  "Detalle extendido del rechazo del backend al validar el catálogo. ".repeat(
    13,
  ) + "Reintente en unos instantes.";

// One category with six studies so several forms render and a pager exists.
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

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

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

test.describe("admin pricing adaptive page size measures every visible form", () => {
  test("a taller errored non-first form keeps the pager visible and clips nothing", async ({
    page,
  }) => {
    // Viewport tuned (measured) so the forms region (~790px) fits exactly two
    // forms once one grows with the tall error: the fix renders two forms (the
    // errored one stays visible), whereas measuring only the short first form
    // would render three and clip the last one below the region.
    await page.setViewportSize({ width: 1440, height: 1240 });
    await setAdminSession(page);
    await mockPricing(page);

    await page.goto("/dashboard/admin?module=admin-pricing");

    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-pricing"]',
    );
    await expect(workspace).toBeVisible({ timeout: 15_000 });

    const forms = page.locator("[data-admin-pricing-item-form]");

    // Need at least two visible forms so the failure lands on a NON-first one.
    await expect(async () => {
      const count = await forms.count();
      expect(count, "at least two forms rendered").toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 12_000 });

    // Target the second visible form (a NON-first form).
    const secondForm = forms.nth(1);

    // Make an edit so the save actually fires a PATCH, then trigger the failure.
    const priceInput = secondForm.locator('input[placeholder="Consultar"]');
    await priceInput.fill("$9.999");
    await secondForm.getByRole("button", { name: "Guardar precio" }).click();

    // The tall error message appears on the second form.
    await expect(page.getByText(LONG_ERROR_MESSAGE).first()).toBeVisible({
      timeout: 10_000,
    });

    // Let the ResizeObserver/rAF settle the adaptive page size (two stable reads).
    await expect(async () => {
      const first = await forms.count();
      await page.waitForTimeout(160);
      const second = await forms.count();
      expect(second, "form count settled").toBe(first);
    }).toPass({ timeout: 10_000 });

    const viewport = page.viewportSize()!;

    // (1) No accidental scroll on document / body / main.
    await expect(async () => {
      const m = await readDocumentScroll(page);
      expect(m.htmlScrollH, "documentElement vertical").toBeLessThanOrEqual(
        m.htmlClientH + TOLERANCE,
      );
      expect(m.htmlScrollW, "documentElement horizontal").toBeLessThanOrEqual(
        m.htmlClientW + TOLERANCE,
      );
      expect(m.bodyScrollH, "body vertical").toBeLessThanOrEqual(
        m.bodyClientH + TOLERANCE,
      );
      expect(m.mainScrollH, "main vertical").toBeLessThanOrEqual(
        m.mainClientH + TOLERANCE,
      );
    }).toPass({ timeout: 10_000 });

    // (2) The compact pager is fully inside the viewport.
    const pager = page.locator('[data-dashboard-compact-pager="true"]');
    await expect(pager).toBeVisible();
    const pagerBox = await pager.boundingBox();
    expect(pagerBox, "pager bounding box").not.toBeNull();
    expect(pagerBox!.y, "pager top inside viewport").toBeGreaterThanOrEqual(
      -TOLERANCE,
    );
    expect(
      pagerBox!.y + pagerBox!.height,
      "pager bottom inside viewport",
    ).toBeLessThanOrEqual(viewport.height + TOLERANCE);

    // (3) No rendered form is clipped: each sits above the pager top and within
    //     the viewport, so nothing is hidden behind the pinned pager.
    const visibleForms = await forms.count();
    for (let index = 0; index < visibleForms; index += 1) {
      const box = await forms.nth(index).boundingBox();
      expect(box, `form ${index} bounding box`).not.toBeNull();
      expect(box!.y, `form ${index} top inside viewport`).toBeGreaterThanOrEqual(
        -TOLERANCE,
      );
      expect(
        box!.y + box!.height,
        `form ${index} bottom above pager`,
      ).toBeLessThanOrEqual(pagerBox!.y + TOLERANCE);
    }

    // (4) The errored second form's message AND its save action stay reachable —
    //     on the current page, or after paging to it if the adaptive count shrank.
    //     The errored form is the only one carrying the long error message.
    const erroredForm = page
      .locator("[data-admin-pricing-item-form]")
      .filter({ hasText: LONG_ERROR_MESSAGE });

    const nextButton = page.locator('[data-dashboard-pager-next="true"]');
    for (let hop = 0; hop < 6; hop += 1) {
      if (await erroredForm.count()) {
        break;
      }
      if (await nextButton.isDisabled()) {
        break;
      }
      await nextButton.click();
      await page.waitForTimeout(120);
    }

    await expect(erroredForm, "errored form is reachable").toHaveCount(1);
    await expect(
      erroredForm.getByText(LONG_ERROR_MESSAGE),
      "errored form message stays visible",
    ).toBeVisible();
    await expect(
      erroredForm.getByRole("button", { name: "Guardar precio" }),
      "errored form save action stays visible",
    ).toBeVisible();
  });
});
