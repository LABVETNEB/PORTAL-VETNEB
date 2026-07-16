import { expect, test } from "@playwright/test";

import {
  assertParticularNoScrollContract,
  mockParticularAuthenticatedSession,
  readParticularDocumentNoScrollContract,
  setParticularSessionCookie,
} from "../../helpers/particular-session-contracts";

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "1366x768", width: 1366, height: 768 },
] as const;

test.describe("particular authenticated session — fixed-viewport no-scroll (R-18)", () => {
  for (const viewport of VIEWPORTS) {
    test(`authenticated /particulares fits the viewport at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setParticularSessionCookie(page);
      await mockParticularAuthenticatedSession(page);

      await page.goto("/particulares");

      // Authenticated operational state ready.
      await expect(
        page.locator('[data-particular-session-panel="true"]'),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator('html[data-particular-operational-viewport="true"]'),
      ).toHaveCount(1, { timeout: 10_000 });

      // Core operational content visible without scroll: tracking + report +
      // primary actions.
      const isMobile = viewport.width < 640;
      const tracking = isMobile
        ? page.locator('[data-particular-mobile-flat-card="tracking"]')
        : page.locator("#particular-study-tracking");
      const report = isMobile
        ? page.locator('[data-particular-mobile-flat-card="report"]')
        : page.locator("#particular-report");

      await expect(tracking, `${viewport.name}: tracking visible`).toBeVisible();
      await expect(report, `${viewport.name}: report visible`).toBeVisible();
      await expect(
        report.getByRole("button", { name: "Ver informe" }),
        `${viewport.name}: primary action Ver informe`,
      ).toBeVisible();
      await expect(
        report.getByRole("button", { name: "Descargar" }),
        `${viewport.name}: primary action Descargar`,
      ).toBeVisible();

      // Fixed-viewport contract: zero external scroll in both axes plus the
      // pre-existing forbidden-overflow invariant.
      await expect(async () => {
        const contract = await readParticularDocumentNoScrollContract(page);
        assertParticularNoScrollContract(contract, `authenticated ${viewport.name}`);
        expect(
          contract.html.scrollHeight,
          `${viewport.name}: external vertical scroll delta`,
        ).toBeLessThanOrEqual(contract.html.clientHeight + TOLERANCE);
        expect(
          contract.body.scrollHeight,
          `${viewport.name}: body vertical scroll delta`,
        ).toBeLessThanOrEqual(contract.body.clientHeight + TOLERANCE);
      }).toPass({ timeout: 12_000 });

      // Operational content must not escape below the viewport (bottom escape
      // delta = 0).
      for (const [label, locator] of [
        ["tracking", tracking],
        ["report", report],
      ] as const) {
        const box = await locator.boundingBox();
        expect(box, `${viewport.name}: ${label} box`).not.toBeNull();
        expect(
          box!.y + box!.height,
          `${viewport.name}: ${label} must not escape below the viewport`,
        ).toBeLessThanOrEqual(viewport.height + TOLERANCE);
      }
    });
  }

  test("logout restores the public marketing document flow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setParticularSessionCookie(page);
    await mockParticularAuthenticatedSession(page);

    await page.route("**/api/particular/auth/logout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/particulares");
    await expect(
      page.locator('html[data-particular-operational-viewport="true"]'),
    ).toHaveCount(1, { timeout: 15_000 });

    await page
      .getByRole("button", { name: "Cerrar sesión particular" })
      .click();

    await expect(
      page.locator('html[data-particular-operational-viewport="true"]'),
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /Ingresar/ }),
    ).toBeVisible();
  });
});
