import { expect, test } from "@playwright/test";

import {
  assertParticularNoScrollContract,
  assertParticularOperationalViewportContract,
  mockParticularAuthenticatedSession,
  readParticularDocumentNoScrollContract,
  readParticularOperationalGeometry,
  setParticularSessionCookie,
  type ParticularSessionFixtureState,
} from "../../helpers/particular-session-contracts";

const TOLERANCE = 2;

// El zoom del navegador reduce el viewport CSS y sube devicePixelRatio; el
// layout responde exclusivamente al viewport CSS, así que la matriz usa el
// viewport reducido como reproducción determinista del zoom (los porcentajes
// están calculados sobre una superficie física de referencia de 1920x870).
const ZOOM_MATRIX = [
  { name: "zoom-100-1920x870", width: 1920, height: 870 },
  { name: "zoom-125-1536x696", width: 1536, height: 696 },
  { name: "zoom-150-1280x580", width: 1280, height: 580 },
  { name: "zoom-200-960x435", width: 960, height: 435 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-360x740", width: 360, height: 740 },
] as const;

// Fronteras medidas del fallo original: el recorte empezaba a 832px de alto y
// el logout se perdía a partir de 815px. Quedan como test de regresión exacta.
const HEIGHT_BOUNDARIES = [833, 832, 816, 815] as const;

const STATES = [
  { name: "report-available", fixture: "report-available" as const, hasReportActions: true },
  { name: "report-pending", fixture: "report-pending" as const, hasReportActions: false },
];

async function openAuthenticatedParticulares(
  page: import("@playwright/test").Page,
  width: number,
  height: number,
  state: ParticularSessionFixtureState,
) {
  await page.setViewportSize({ width, height });
  await setParticularSessionCookie(page);
  await mockParticularAuthenticatedSession(page, state);

  await page.goto("/particulares");

  await expect(
    page.locator('[data-particular-session-panel="true"]'),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator('html[data-particular-operational-viewport="true"]'),
  ).toHaveCount(1, { timeout: 10_000 });
}

test.describe("particular authenticated session — fixed-viewport no-scroll (R-18)", () => {
  for (const state of STATES) {
    for (const viewport of ZOOM_MATRIX) {
      test(`${state.name} adapts at ${viewport.name}`, async ({ page }) => {
        await openAuthenticatedParticulares(
          page,
          viewport.width,
          viewport.height,
          state.fixture,
        );

        const label = `${state.name} ${viewport.name}`;
        const isMobile = viewport.width < 640;
        const tracking = isMobile
          ? page.locator('[data-particular-mobile-flat-card="tracking"]')
          : page.locator("#particular-study-tracking");
        const report = isMobile && state.hasReportActions
          ? page.locator('[data-particular-mobile-flat-card="report"]')
          : page.locator("#particular-report");

        await expect(tracking, `${label}: tracking visible`).toBeVisible();
        await expect(report, `${label}: report surface visible`).toBeVisible();

        if (state.hasReportActions) {
          await expect(
            report.getByRole("button", { name: "Ver informe" }),
            `${label}: primary action Ver informe`,
          ).toBeVisible();
          await expect(
            report.getByRole("button", { name: "Descargar" }),
            `${label}: primary action Descargar`,
          ).toBeVisible();
        } else {
          await expect(
            report,
            `${label}: pending report keeps its explanation`,
          ).toContainText("Sin informe vinculado todavía");
        }

        await expect(async () => {
          const geometry = await readParticularOperationalGeometry(page);
          assertParticularOperationalViewportContract(geometry, label);

          const contract = await readParticularDocumentNoScrollContract(page);
          assertParticularNoScrollContract(contract, label);
          expect(
            contract.html.scrollHeight,
            `${label}: external vertical scroll delta`,
          ).toBeLessThanOrEqual(contract.html.clientHeight + TOLERANCE);
          expect(
            contract.body.scrollHeight,
            `${label}: body vertical scroll delta`,
          ).toBeLessThanOrEqual(contract.body.clientHeight + TOLERANCE);
        }).toPass({ timeout: 12_000 });
      });
    }

    for (const height of HEIGHT_BOUNDARIES) {
      test(`${state.name} holds the contract at 1536x${height}`, async ({ page }) => {
        await openAuthenticatedParticulares(page, 1536, height, state.fixture);

        await expect(async () => {
          const geometry = await readParticularOperationalGeometry(page);
          assertParticularOperationalViewportContract(
            geometry,
            `${state.name} 1536x${height}`,
          );
        }).toPass({ timeout: 12_000 });
      });
    }
  }

  test("insufficient height activates exactly one declared scroll owner", async ({
    page,
  }) => {
    await openAuthenticatedParticulares(page, 390, 400, "report-available");

    await expect(async () => {
      const geometry = await readParticularOperationalGeometry(page);
      assertParticularOperationalViewportContract(geometry, "390x400");

      expect(
        geometry.scrollOwners,
        "390x400: the operational body must own the only scroll",
      ).toHaveLength(1);
      expect(
        geometry.scrollOwners[0].scrollableY,
        "390x400: the declared owner must actually have content to scroll",
      ).toBeGreaterThan(0);
      expect(
        geometry.logoutVisibleWithoutScroll,
        "390x400: this régime is reached by scrolling, not by clipping",
      ).toBe(false);
    }).toPass({ timeout: 12_000 });
  });

  test("logout restores the public marketing document flow", async ({ page }) => {
    await page.route("**/api/particular/auth/logout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await openAuthenticatedParticulares(page, 390, 844, "report-available");

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
