import { expect, test } from "@playwright/test";

type Locator = import("@playwright/test").Locator;
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

// B09 unified navigation contract: every clinic module reaches every other one
// from ONE owner. `/dashboard` used to be the exception — the clinic bottom nav
// returned null there and `DashboardModuleRail` took over — so this surface had
// a different navigation owner than the rest of the role. The bar covers it now
// and the rail is retired, together with its prev/next pager: that pager was a
// SECOND grammar over the same ordered modules, not a destination, so it is not
// reproduced. What the rail actually delivered — the five modules, the deep
// link and `aria-current` — is asserted here against the new owner.
async function expectClinicMobileNav(
  page: Page,
  label: string,
  activeModule: "operaciones" | "informes" | "logistica" | "perfil" | "tokens",
) {
  // `DashboardMobileNav` streams through a Suspense boundary whose fallback
  // mounts a SECOND `DashboardMobileNavBar` carrying the same attributes, so
  // the bare owner can resolve to two nodes while exactly one is painted.
  // Filtering the OWNER keeps every slot/aria-current count below measuring the
  // painted bar; zero visible bars still fail, two still fail on strictness.
  const nav = page
    .locator('[data-dashboard-mobile-nav="clinic"]')
    .filter({ visible: true });
  await expect(nav, `${label}: clinic mobile navigation visible`).toBeVisible();

  for (const moduleId of [
    "operaciones",
    "informes",
    "logistica",
    "perfil",
    "tokens",
  ] as const) {
    await expect(
      nav.locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`),
      `${label}: navigation exposes ${moduleId}`,
    ).toHaveCount(1);
  }

  // B09_CLINIC_HOME_ITEM = PRESERVE: six primary slots, Inicio included.
  await expect(
    nav.locator("[data-dashboard-mobile-nav-item]"),
    `${label}: six clinic primary destinations`,
  ).toHaveCount(6);
  await expect(
    nav.locator('[data-dashboard-mobile-nav-item="home"]'),
    `${label}: Inicio preserved`,
  ).toHaveCount(1);

  await expect(
    nav.locator(`[data-dashboard-mobile-nav-item="${activeModule}"]`),
    `${label}: active module ${activeModule} marked current`,
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.locator("[aria-current='page']"),
    `${label}: exactly one current destination`,
  ).toHaveCount(1);

  // Clinic has five modules and six slots, so it never grows an overflow.
  await expect(
    nav.locator('[data-dashboard-mobile-nav-item="overflow"]'),
    `${label}: clinic needs no destination overflow`,
  ).toHaveCount(0);

  // The retired owners must not come back next to it.
  await expect(
    page.locator("[data-dashboard-module-rail]"),
    `${label}: retired module rail absent`,
  ).toHaveCount(0);
  await expect(
    page.locator('[data-dashboard-mobile-nav="admin"]'),
    `${label}: admin mobile navigation absent`,
  ).toHaveCount(0);
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
    // VIS-MOBILE-001: `.dashboard-module-body` is the single sanctioned scroll
    // owner for the perfil module on low-height mobile viewports (it makes
    // otherwise-clipped tab content reachable). Any OTHER internal scroll
    // container would mean a second, unintended scroll owner, which is still
    // disallowed.
    const scrollContainers = editor
      ? [editor, ...Array.from(editor.querySelectorAll<HTMLElement>("*"))].flatMap(
          (element) => {
            if (element.classList.contains("dashboard-module-body")) return [];
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

async function expectLocatorInsideViewport(
  locator: Locator,
  viewport: (typeof VIEWPORTS)[number],
  label: string,
) {
  const box = await locator.boundingBox();

  expect(box, `${label}: bounds`).not.toBeNull();
  expect(box!.x, `${label}: left cut`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.y, `${label}: top cut`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right cut`).toBeLessThanOrEqual(
    viewport.width + TOLERANCE,
  );
  expect(box!.y + box!.height, `${label}: bottom cut`).toBeLessThanOrEqual(
    viewport.height + TOLERANCE,
  );
}

async function expectNoGlobalDashboardScroll(page: Page, label: string) {
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

  expect(
    shellMetrics.html.scrollWidth,
    `${label}: html horizontal scroll`,
  ).toBeLessThanOrEqual(shellMetrics.html.clientWidth + TOLERANCE);
  expect(
    shellMetrics.body.scrollWidth,
    `${label}: body horizontal scroll`,
  ).toBeLessThanOrEqual(shellMetrics.body.clientWidth + TOLERANCE);
  expect(
    shellMetrics.html.scrollHeight,
    `${label}: html vertical scroll`,
  ).toBeLessThanOrEqual(shellMetrics.html.clientHeight + TOLERANCE);
  expect(
    shellMetrics.body.scrollHeight,
    `${label}: body vertical scroll`,
  ).toBeLessThanOrEqual(shellMetrics.body.clientHeight + TOLERANCE);
  expect(shellMetrics.main, `${label}: dashboard main`).not.toBeNull();
  expect(
    shellMetrics.main!.scrollHeight,
    `${label}: main vertical scroll`,
  ).toBeLessThanOrEqual(shellMetrics.main!.clientHeight + TOLERANCE);
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
    await expectClinicMobileNav(page, viewport.name, "perfil");

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
    const currentPassword = passwordPanel.locator(
      'input[name="currentPassword"]',
    );
    const newPassword = passwordPanel.locator('input[name="newPassword"]');
    const confirmPassword = passwordPanel.locator(
      'input[name="confirmPassword"]',
    );
    const submitPassword = passwordPanel.getByRole("button", {
      name: "Actualizar contraseña",
      exact: true,
    });
    await expect(currentPassword).toBeVisible();
    await expect(newPassword).toBeVisible();
    await expect(confirmPassword).toBeVisible();
    await expect(submitPassword).toBeVisible();
    await expectLocatorInsideViewport(
      currentPassword,
      viewport,
      `${viewport.name}: contraseña actual`,
    );
    await expectLocatorInsideViewport(
      newPassword,
      viewport,
      `${viewport.name}: nueva contraseña`,
    );
    await expectLocatorInsideViewport(
      confirmPassword,
      viewport,
      `${viewport.name}: confirmar contraseña`,
    );
    await expectLocatorInsideViewport(
      submitPassword,
      viewport,
      `${viewport.name}: actualizar contraseña`,
    );
    await expectNoGlobalDashboardScroll(
      page,
      `${viewport.name}: cambiar contraseña`,
    );

    await expect(async () => {
      await editor.getByRole("tab", { name: "Datos", exact: true }).click();
      await expect(
        editor.locator('[data-clinic-profile-fields="true"]'),
      ).toBeVisible();
    }).toPass({ timeout: 12_000 });

    const fields = editor.locator('[data-clinic-profile-fields="true"]');
    await expect(fields).toBeVisible();
    await expectNoProfileInternalScroll(page, `${viewport.name}: datos tab`);

    await expectNoGlobalDashboardScroll(page, `${viewport.name}: datos tab`);

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
