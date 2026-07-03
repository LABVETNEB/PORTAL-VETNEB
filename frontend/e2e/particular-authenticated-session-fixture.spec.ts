import { expect, test } from "@playwright/test";

import {
  MOCK_PARTICULAR_SESSION,
  PARTICULAR_MOBILE_VIEWPORT,
  assertParticularNoScrollContract,
  mockParticularAuthenticatedSession,
  readParticularDocumentNoScrollContract,
  setParticularSessionCookie,
} from "./helpers/particular-session-contracts";

// R-17: first e2e fixture for an authenticated/token-gated Particular
// session. Covers /particulares in its authenticated state (previously only
// the unauthenticated entry was covered, see public-routes.spec.ts PR-PUX1/
// PR-PUX4) and establishes the first no-scroll baseline for this role.
test.describe("particular authenticated session fixture (R-17)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PARTICULAR_MOBILE_VIEWPORT);
    await setParticularSessionCookie(page);
    await mockParticularAuthenticatedSession(page);
  });

  test("renders the authenticated /particulares state from the token-gated session fixture", async ({
    page,
  }) => {
    await page.goto("/particulares");

    const sessionPanel = page.locator('[data-particular-session-panel="true"]');
    await expect(sessionPanel).toBeVisible({ timeout: 12_000 });

    await expect(page.getByText("Sesión particular activa")).toBeVisible();

    const mobileSummary = page.locator('[data-particular-mobile-safe-summary="true"]');
    await expect(mobileSummary).toBeVisible();
    await expect(mobileSummary.getByText(MOCK_PARTICULAR_SESSION.tutorLastName)).toBeVisible();
    await expect(mobileSummary.getByText(MOCK_PARTICULAR_SESSION.petName)).toBeVisible();

    const trackingCard = page.locator('[data-particular-mobile-flat-card="tracking"]');
    await expect(trackingCard).toBeVisible();
    await expect(trackingCard.getByText("Informe disponible / Publicado")).toBeVisible();

    const reportCard = page.locator(
      '[data-particular-mobile-flat-card="report"][data-particulares-report-state="available"]',
    );
    await expect(reportCard).toBeVisible();
    await expect(reportCard.getByRole("button", { name: "Ver informe" })).toBeVisible();
    await expect(reportCard.getByRole("button", { name: "Descargar" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Cerrar sesión particular" })).toBeVisible();

    // Unauthenticated token form must not be present once the session is active.
    await expect(page.locator("#particular-token")).toHaveCount(0);
  });

  test("keeps the authenticated state free of horizontal overflow and forbidden internal scroll at 390x844", async ({
    page,
  }) => {
    await page.goto("/particulares");

    await expect(
      page.locator('[data-particular-session-panel="true"]'),
    ).toBeVisible({ timeout: 12_000 });
    await expect(
      page.locator('[data-particular-mobile-flat-card="report"]'),
    ).toBeVisible();

    const contract = await readParticularDocumentNoScrollContract(page);
    assertParticularNoScrollContract(
      contract,
      `${PARTICULAR_MOBILE_VIEWPORT.name} /particulares authenticated`,
    );
  });
});
