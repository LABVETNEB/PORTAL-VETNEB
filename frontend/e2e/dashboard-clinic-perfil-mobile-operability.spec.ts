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

async function expectClinicMobileBottomNav(page: Page, label: string) {
  const clinicNav = page.locator('[data-clinic-mobile-bottom-nav="true"]');
  await expect(clinicNav, `${label}: clinic bottom nav visible`).toBeVisible();
  await expect(
    clinicNav.locator('[data-clinic-mobile-bottom-nav-item="true"]'),
    `${label}: clinic bottom nav item count`,
  ).toHaveCount(6);
  await expect(
    page.locator('[data-admin-mobile-bottom-nav="true"]'),
    `${label}: admin bottom nav absent`,
  ).toHaveCount(0);
  await expect(
    page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
    `${label}: horizontal nav hidden on clinic mobile`,
  ).toBeHidden();
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

async function expectNoProfileInternalScroll(page: Page, label: string) {
  const scrollState = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>(
      '[data-clinic-profile-editor="true"]',
    );
    const fields = document.querySelector<HTMLElement>(
      '[data-clinic-profile-fields="true"]',
    );
    const scrollContainers = editor
      ? [editor, ...Array.from(editor.querySelectorAll<HTMLElement>("*"))].flatMap(
          (element) => {
            const style = window.getComputedStyle(element);
            return ["auto", "scroll"].includes(style.overflowY)
              ? [
                  {
                    tag: element.tagName,
                    overflowY: style.overflowY,
                  },
                ]
              : [];
          },
        )
      : [];
    const fieldStyle = fields ? window.getComputedStyle(fields) : null;

    return {
      hasEditor: editor !== null,
      hasFields: fields !== null,
      fieldOverflowY: fieldStyle?.overflowY ?? "missing",
      fieldScrollHeight: fields?.scrollHeight ?? 0,
      fieldClientHeight: fields?.clientHeight ?? 0,
      scrollContainers,
    };
  });

  expect(scrollState.hasEditor, `${label}: profile editor present`).toBe(true);
  expect(scrollState.hasFields, `${label}: active profile fields present`).toBe(true);
  expect(
    ["auto", "scroll"],
    `${label}: active fields must not expose vertical scroll`,
  ).not.toContain(scrollState.fieldOverflowY);
  expect(
    scrollState.fieldScrollHeight,
    `${label}: active fields must fit without hidden clipping`,
  ).toBeLessThanOrEqual(scrollState.fieldClientHeight + TOLERANCE);
  expect(
    scrollState.scrollContainers,
    `${label}: profile editor must not contain internal scroll containers`,
  ).toEqual([]);
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
    const workspace = page.locator('[data-dashboard-module-workspace="perfil"]');
    await expect(workspace).toBeVisible({ timeout: 12_000 });

    await expect(async () => {
      await expect(
        workspace.getByRole("tab", { name: "Acceso", exact: true }),
      ).toHaveCount(0);
      await expect(
        workspace.getByRole("tab", { name: "Perfil público", exact: true }),
      ).toHaveCount(0);
      await expect(page.locator("#clinic-public-profile")).toBeVisible();
    }).toPass({ timeout: 12_000 });

    const editor = page.locator('[data-clinic-profile-editor="true"]');
    await expect(editor).toBeVisible();
    await expectClinicMobileBottomNav(page, viewport.name);

    for (const tabName of [
      "Estado",
      "Datos",
      "Contacto",
      "Contenido",
      "Cambiar contraseña",
    ]) {
      await expect(
        editor.getByRole("tab", { name: tabName, exact: true }),
      ).toBeVisible();
    }
    await expect(
      editor.getByRole("tab", { name: "Acceso", exact: true }),
    ).toHaveCount(0);

    await editor
      .getByRole("tab", { name: "Cambiar contraseña", exact: true })
      .click();
    const passwordPanel = editor.locator("#clinic-password-change");
    await expect(passwordPanel).toBeVisible();
    await expect(passwordPanel.locator('input[name="currentPassword"]')).toBeVisible();
    await expect(passwordPanel.locator('input[name="newPassword"]')).toBeVisible();
    await expect(passwordPanel.locator('input[name="confirmPassword"]')).toBeVisible();

    await expect(async () => {
      await editor.getByRole("tab", { name: "Datos", exact: true }).click();
      await expect(
        editor.locator('[data-clinic-profile-fields="true"]'),
      ).toBeVisible();
    }).toPass({ timeout: 12_000 });

    const fields = editor.locator('[data-clinic-profile-fields="true"]');
    await expect(fields).toBeVisible();
    await expectNoProfileInternalScroll(page, `${viewport.name}: datos tab`);

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

    await editor.getByRole("tab", { name: "Contacto", exact: true }).click();
    await expectNoProfileInternalScroll(page, `${viewport.name}: contacto tab`);

    const mapLink = page.locator("#clinic-profile-map-link");
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
    await expect(editor.getByText("Usuarios y roles")).toHaveCount(0);
    await expect(editor.getByText("Auditoría")).toHaveCount(0);
    await expect(editor.getByText("Mantenimiento")).toHaveCount(0);
  });
}
