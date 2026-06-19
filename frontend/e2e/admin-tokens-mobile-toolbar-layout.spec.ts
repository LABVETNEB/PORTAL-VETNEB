import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const MOCK_TOKENS = Array.from({ length: 9 }, (_, index) => ({
  id: 9101 + index,
  clinicId: 12 + index,
  reportId: index % 3 === 0 ? 7301 + index : null,
  tokenLast4: String(4201 + index),
  tutorLastName: ["Gómez", "Pérez", "Luna"][index % 3],
  petName: ["Mora", "Simón", "Lola", "Bruno", "Kira", "Toby", "Nina", "Rocco", "Uma"][
    index
  ],
  petAge: `${2 + index} años`,
  petBreed: index % 2 === 0 ? "Mestizo" : "Labrador",
  petSex: index % 2 === 0 ? "female" : "male",
  petSpecies: index % 2 === 0 ? "canine" : "feline",
  sampleLocation: "Piel",
  sampleEvolution: `${3 + index} semanas`,
  detailsLesion: "Lesión nodular para evaluación anatomopatológica.",
  extractionDate: "2026-06-10T10:00:00.000Z",
  shippingDate: "2026-06-11T10:00:00.000Z",
  isActive: index !== 7,
  lastLoginAt: index % 2 === 0 ? "2026-06-17T16:20:00.000Z" : null,
  createdAt: "2026-06-12T09:15:00.000Z",
  updatedAt: "2026-06-17T16:20:00.000Z",
  createdByAdminId: 41,
  createdByClinicUserId: null,
  hasLinkedReport: index % 3 === 0,
}));

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function mockAdminParticularTokens(page: Page) {
  await page.route("**/api/admin/particular-tokens**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() !== "GET" ||
      url.pathname !== "/api/admin/particular-tokens"
    ) {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const clinicIdParam = url.searchParams.get("clinicId");
    const clinicId = clinicIdParam ? Number(clinicIdParam) : null;
    const filteredTokens = clinicId
      ? MOCK_TOKENS.filter((token) => token.clinicId === clinicId)
      : MOCK_TOKENS;
    const particularTokens = filteredTokens.slice(offset, offset + limit);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        count: particularTokens.length,
        particularTokens,
        pagination: { limit, offset },
        filters: { clinicId },
      }),
    });
  });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`admin tokens toolbar stays operable — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await setAdminSession(page);
    await mockAdminParticularTokens(page);

    await page.goto("/dashboard/admin?module=admin-particular-tokens");

    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-particular-tokens"]',
    );
    const toolbar = workspace.locator('[data-admin-particulars-toolbar="true"]');
    const mobileList = workspace.locator(
      '[data-admin-particulars-mobile-list="true"]',
    );

    await expect(workspace).toBeVisible({ timeout: 15_000 });
    await expect(toolbar).toBeVisible();
    await expect(mobileList).toBeVisible();

    await toolbar.getByRole("spinbutton", { name: "ID de clínica" }).fill("12");
    await toolbar.getByRole("button", { name: "Filtrar", exact: true }).click();

    await expect(
      toolbar.getByRole("button", { name: "Limpiar", exact: true }),
    ).toBeVisible();

    const updateButton = toolbar.getByRole("button", {
      name: "Actualizar",
      exact: true,
    });

    await expect(updateButton).toBeVisible();
    await expect(updateButton).toBeEnabled();
    await expect(
      workspace.locator(".dashboard-table-responsive table:visible"),
    ).toHaveCount(0);

    const overflow = await page.evaluate(() => ({
      htmlScrollWidth: document.documentElement.scrollWidth,
      htmlClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
    }));

    expect(
      overflow.htmlScrollWidth,
      `${viewport.name}: documentElement horizontal overflow`,
    ).toBeLessThanOrEqual(overflow.htmlClientWidth + TOLERANCE);
    expect(
      overflow.bodyScrollWidth,
      `${viewport.name}: body horizontal overflow`,
    ).toBeLessThanOrEqual(overflow.bodyClientWidth + TOLERANCE);

    const updateMetrics = await updateButton.evaluate((button) => {
      const rect = button.getBoundingClientRect();

      return {
        left: rect.left,
        right: rect.right,
        height: rect.height,
        viewportWidth: window.innerWidth,
      };
    });

    expect(
      updateMetrics.right,
      `${viewport.name}: Actualizar clipped on the right`,
    ).toBeLessThanOrEqual(updateMetrics.viewportWidth + TOLERANCE);
    expect(
      updateMetrics.left,
      `${viewport.name}: Actualizar clipped on the left`,
    ).toBeGreaterThanOrEqual(-TOLERANCE);
    expect(
      updateMetrics.height,
      `${viewport.name}: Actualizar touch target height`,
    ).toBeGreaterThanOrEqual(34);
  });
}
