import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function mockClinicProfile(page: Page) {
  await page.route("**/api/clinic/profile**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        profile: {
          clinicId: 1,
          displayName: "Clinica Perfil Mobile Operable",
          specialtyText: "Anatomia patologica veterinaria especializada",
          servicesText:
            "Citologia, histopatologia, inmunohistoquimica y diagnostico integral veterinario.",
          aboutText:
            "Perfil institucional denso para verificar la operabilidad completa del editor en mobile.",
          email: "perfil-mobile@example.test",
          phone: "+54 11 5555-1234",
          publicAddress: "Avenida Veterinaria 1234, Ciudad Autonoma de Buenos Aires",
          mapLink: "https://maps.google.com/maps?q=vetneb",
          locality: "Buenos Aires",
          country: "Argentina",
          avatarUrl: null,
          isPublic: true,
          publication: {
            isSearchEligible: true,
            qualityScore: 95,
            minimumQualityScore: 75,
            hasRequiredPublicFields: true,
            missingRequiredFields: [],
            missingRecommendedFields: [],
            publicationErrors: [],
          },
        },
      }),
    });
  });
}

for (const viewport of VIEWPORTS) {
  test(`clinic perfil public editor is operable at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await setClinicSession(page);
    await mockClinicProfile(page);

    await page.goto("/dashboard?module=perfil");
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 12_000 });

    await expect(async () => {
      const publicProfileTab = page
        .getByRole("tab", { name: "Perfil público", exact: true })
        .first();
      await expect(publicProfileTab).toBeVisible();
      await publicProfileTab.click();
      await expect(page.locator("#clinic-public-profile")).toBeVisible();
    }).toPass({ timeout: 12_000 });

    const editor = page.locator('[data-clinic-profile-editor="true"]');
    await expect(editor).toBeVisible();

    await expect(async () => {
      await editor.getByRole("tab", { name: "Datos", exact: true }).click();
      await expect(
        editor.locator('[data-clinic-profile-fields="true"]'),
      ).toBeVisible();
    }).toPass({ timeout: 12_000 });

    const fields = editor.locator('[data-clinic-profile-fields="true"]');
    await expect(fields).toBeVisible();

    const shellMetrics = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>("main.dashboard-main");
      return {
        html: {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
        },
        body: {
          scrollWidth: document.body.scrollWidth,
          clientWidth: document.body.clientWidth,
          scrollHeight: document.body.scrollHeight,
          clientHeight: document.body.clientHeight,
        },
        main: main
          ? {
              scrollHeight: main.scrollHeight,
              clientHeight: main.clientHeight,
            }
          : null,
      };
    });

    expect(shellMetrics.html.scrollWidth).toBeLessThanOrEqual(
      shellMetrics.html.clientWidth + TOLERANCE,
    );
    expect(shellMetrics.body.scrollWidth).toBeLessThanOrEqual(
      shellMetrics.body.clientWidth + TOLERANCE,
    );
    expect(shellMetrics.html.scrollHeight).toBeLessThanOrEqual(
      shellMetrics.html.clientHeight + TOLERANCE,
    );
    expect(shellMetrics.body.scrollHeight).toBeLessThanOrEqual(
      shellMetrics.body.clientHeight + TOLERANCE,
    );
    expect(shellMetrics.main).not.toBeNull();
    expect(shellMetrics.main!.scrollHeight).toBeLessThanOrEqual(
      shellMetrics.main!.clientHeight + TOLERANCE,
    );

    const mapLink = page.locator("#clinic-profile-map-link");
    await mapLink.scrollIntoViewIfNeeded();
    await expect(mapLink).toBeVisible();
    const mapLinkBox = await mapLink.boundingBox();
    expect(mapLinkBox).not.toBeNull();
    expect(mapLinkBox!.y).toBeGreaterThanOrEqual(-TOLERANCE);
    expect(mapLinkBox!.y + mapLinkBox!.height).toBeLessThanOrEqual(
      viewport.height + TOLERANCE,
    );

    const saveButton = page.getByRole("button", {
      name: "Guardar perfil público",
      exact: true,
    });
    await expect(saveButton).toBeVisible();
    const saveButtonBox = await saveButton.boundingBox();
    expect(saveButtonBox).not.toBeNull();
    expect(saveButtonBox!.x).toBeGreaterThanOrEqual(-TOLERANCE);
    expect(saveButtonBox!.x + saveButtonBox!.width).toBeLessThanOrEqual(
      viewport.width + TOLERANCE,
    );
    expect(saveButtonBox!.y + saveButtonBox!.height).toBeLessThanOrEqual(
      viewport.height + TOLERANCE,
    );
  });
}
