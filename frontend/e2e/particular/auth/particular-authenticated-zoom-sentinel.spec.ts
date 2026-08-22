import { expect, test } from "@playwright/test";

import {
  assertParticularOperationalViewportContract,
  mockParticularAuthenticatedSession,
  readParticularOperationalGeometry,
  setParticularSessionCookie,
} from "../../helpers/particular-session-contracts";

/*
  Sentinel de cohorte `ci`: el mínimo que reproduce el fallo original de
  adaptación a zoom en /particulares autenticado, para que la regresión bloquee
  merges sin pagar la matriz completa en cada PR (esa vive en `extended`/`full`,
  en particular-authenticated-no-scroll.spec.ts).

  Reproduce exactamente el caso reportado en producción: desktop short-height
  (1536x696 ≈ 125% de zoom sobre 1920x870), sesión activa, `report = null` y
  `currentStage = reception`, que es el estado donde el último control operativo
  del panel es el logout.
*/
test.describe("particular authenticated zoom sentinel (CI)", () => {
  test("desktop short-height keeps the operational surface adaptable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1536, height: 696 });
    await setParticularSessionCookie(page);
    await mockParticularAuthenticatedSession(page, "report-pending");

    await page.goto("/particulares");

    await expect(
      page.locator('[data-particular-session-panel="true"]'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('html[data-particular-operational-viewport="true"]'),
    ).toHaveCount(1, { timeout: 10_000 });

    const report = page.locator("#particular-report");
    await expect(
      page.locator("#particular-study-tracking"),
      "sentinel: tracking visible",
    ).toBeVisible();
    await expect(report, "sentinel: pending report surface visible").toBeVisible();
    await expect(report, "sentinel: pending explanation kept").toContainText(
      "Sin informe vinculado todavía",
    );
    await expect(
      page.getByRole("button", { name: "Cerrar sesión particular" }),
      "sentinel: logout rendered",
    ).toBeVisible();

    await expect(async () => {
      const geometry = await readParticularOperationalGeometry(page);
      assertParticularOperationalViewportContract(geometry, "sentinel 1536x696");
      expect(
        geometry.logoutVisibleWithoutScroll,
        "sentinel: logout must fit without scroll at this height",
      ).toBe(true);
    }).toPass({ timeout: 12_000 });
  });
});
