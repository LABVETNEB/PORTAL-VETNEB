import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

// R-05 (admin-particular-tokens-server-adaptive-pagination): the mobile page
// size is now measured (OF cap 30) instead of a fixed limit of 10, so the
// fixture must have enough rows to fill the tallest measured page and still
// leave a populated page 2 (same reasoning as the R-02/R-03 bumps to 40).
const MOCK_TOKENS = Array.from({ length: 40 }, (_, index) => ({
  id: 9101 + index,
  clinicId: 12 + index,
  reportId: index % 3 === 0 ? 7301 + index : null,
  tokenLast4: String(4201 + index),
  tutorLastName: ["Gómez", "Pérez", "Luna"][index % 3],
  petName: ["Mora", "Simón", "Lola", "Bruno", "Kira", "Toby", "Nina", "Rocco", "Uma"][
    index % 9
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

async function mockAdminParticularTokens(page: Page, sourceTokens = MOCK_TOKENS) {
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
      ? sourceTokens.filter((token) => token.clinicId === clinicId)
      : sourceTokens;
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

const MOCK_TOKENS_SHORT = MOCK_TOKENS.slice(0, 6);

async function mockAdminUsersRolesClinicCatalog(page: Page) {
  await page.route("**/api/admin/users-roles**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        users: [
          {
            userType: "clinic",
            userId: 601,
            username: "clinica.doce",
            role: "clinic_owner",
            clinicId: 12,
            clinicName: "Clínica Doce",
            clinicLocality: "Buenos Aires",
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
        totals: { adminUsers: 0, clinicUsers: 1 },
      }),
    });
  });
}

const PAGER_BOTTOM_TOLERANCE = 28;

async function assertPagerAnchoredToModuleBottom(
  page: Page,
  label: string,
) {
  const moduleRoot = page.locator('[data-admin-mobile-core-module="tokens"]');
  const pager = moduleRoot.locator('[data-admin-mobile-core-pager="true"]');

  await expect(pager, `${label}: pager visible`).toBeVisible();

  const moduleBox = await moduleRoot.boundingBox();
  const pagerBox = await pager.boundingBox();
  expect(moduleBox, `${label}: module bounding box`).not.toBeNull();
  expect(pagerBox, `${label}: pager bounding box`).not.toBeNull();

  const moduleBottom = moduleBox!.y + moduleBox!.height;
  const pagerBottom = pagerBox!.y + pagerBox!.height;

  expect(
    moduleBottom - pagerBottom,
    `${label}: gap below pager inside module`,
  ).toBeLessThanOrEqual(PAGER_BOTTOM_TOLERANCE);
}

const CENTER_TOLERANCE = 6;
const RANGE_TEXT_PATTERN = /^\d+[–-]\d+$/;

async function assertPagerHasNoRangeText(page: Page, label: string) {
  const pager = page.locator(
    '[data-admin-mobile-core-module="tokens"] [data-admin-mobile-core-pager="true"]',
  );
  await expect(
    pager.getByText(RANGE_TEXT_PATTERN),
    `${label}: pager range text removed`,
  ).toHaveCount(0);
}

async function assertPagerControlsCentered(page: Page, label: string) {
  const pager = page.locator(
    '[data-admin-mobile-core-module="tokens"] [data-admin-mobile-core-pager="true"]',
  );
  const pagerBox = await pager.boundingBox();
  const anteriorBox = await pager
    .getByRole("button", { name: "Anterior" })
    .boundingBox();
  const siguienteBox = await pager
    .getByRole("button", { name: "Siguiente" })
    .boundingBox();

  expect(pagerBox, `${label}: pager bounding box`).not.toBeNull();
  expect(anteriorBox, `${label}: Anterior bounding box`).not.toBeNull();
  expect(siguienteBox, `${label}: Siguiente bounding box`).not.toBeNull();

  const leftGap = anteriorBox!.x - pagerBox!.x;
  const rightGap =
    pagerBox!.x + pagerBox!.width - (siguienteBox!.x + siguienteBox!.width);

  expect(
    Math.abs(leftGap - rightGap),
    `${label}: pager controls not centered (left=${leftGap}, right=${rightGap})`,
  ).toBeLessThanOrEqual(CENTER_TOLERANCE);
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
    await mockAdminUsersRolesClinicCatalog(page);

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

    await expect(
      workspace.getByRole("heading", { name: "Tokens particulares" }),
      `${viewport.name}: redundant intro header hidden on mobile`,
    ).toBeHidden();
    await expect(
      workspace.getByText("En página", { exact: true }),
      `${viewport.name}: metrics row hidden on mobile`,
    ).toBeHidden();

    const items = workspace.locator('[data-admin-mobile-core-item="true"]');
    // R-05: the mobile page size is measured (OF cap 30), not a fixed 10, so
    // the fallback-sized first paint can settle to a different count once the
    // real row is measured. Wait for two consecutive equal reads before
    // trusting it, same pattern as Clinics/Reports.
    let settledCount: number | null = null;
    await expect(async () => {
      const current = await items.count();
      expect(current, `${viewport.name}: tokens mobile item count settles`).toBeGreaterThan(0);
      if (settledCount !== current) {
        settledCount = current;
        throw new Error(`count not yet stable: ${current}`);
      }
    }).toPass({ intervals: [200, 300, 400, 600, 800], timeout: 6_000 });
    expect(
      settledCount,
      `${viewport.name}: tokens mobile page size must remain viewport-safe`,
    ).toBeLessThanOrEqual(30);

    await expect(
      items.first(),
      `${viewport.name}: clinic name shown instead of id under each token`,
    ).toContainText("Clínica Doce");

    const verticalOverflow = await page.evaluate(() => ({
      htmlScrollHeight: document.documentElement.scrollHeight,
      htmlClientHeight: document.documentElement.clientHeight,
      bodyScrollHeight: document.body.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
    }));
    expect(
      verticalOverflow.htmlScrollHeight,
      `${viewport.name}: documentElement vertical overflow`,
    ).toBeLessThanOrEqual(verticalOverflow.htmlClientHeight + TOLERANCE);
    expect(
      verticalOverflow.bodyScrollHeight,
      `${viewport.name}: body vertical overflow`,
    ).toBeLessThanOrEqual(verticalOverflow.bodyClientHeight + TOLERANCE);

    const forbiddenOverflow = await page.evaluate((selector) => {
      const root = document.querySelector(selector);
      if (!root) return [];
      const elements = [root, ...Array.from(root.querySelectorAll("*"))];
      return elements.flatMap((element) => {
        const style = window.getComputedStyle(element);
        return ["auto", "scroll"].includes(style.overflowX) ||
          ["auto", "scroll"].includes(style.overflowY)
          ? [`${element.tagName}.${(element as HTMLElement).className}`]
          : [];
      });
    }, '[data-admin-mobile-core-module="tokens"]');
    expect(
      forbiddenOverflow,
      `${viewport.name}: forbidden overflow auto/scroll`,
    ).toEqual([]);

    await toolbar.getByRole("textbox", { name: "Nombre de clínica" }).fill("Clínica Doce");
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

for (const viewport of MOBILE_VIEWPORTS) {
  test(`admin tokens mobile pager stays bottom-anchored with a full page — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setAdminSession(page);
    await mockAdminParticularTokens(page, MOCK_TOKENS);
    await page.goto("/dashboard/admin?module=admin-particular-tokens");

    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-particular-tokens"]',
    );
    await expect(workspace).toBeVisible({ timeout: 15_000 });

    const items = page.locator(
      '[data-admin-mobile-core-module="tokens"] [data-admin-mobile-core-item="true"]',
    );
    // R-05: the mobile page size is measured (OF cap 30), not a fixed 10.
    // MOCK_TOKENS (40 rows) guarantees the first page is entirely full for any
    // measured page size up to the cap; wait for the settle before reading it.
    let settledCount: number | null = null;
    await expect(async () => {
      const current = await items.count();
      expect(current, `${viewport.name}: full-page item count settles`).toBeGreaterThan(0);
      if (settledCount !== current) {
        settledCount = current;
        throw new Error(`count not yet stable: ${current}`);
      }
    }).toPass({ intervals: [200, 300, 400, 600, 800], timeout: 6_000 });
    expect(settledCount, `${viewport.name}: full page size stays within cap`).toBeLessThanOrEqual(30);

    await assertPagerAnchoredToModuleBottom(
      page,
      `${viewport.name}: full page (${settledCount} tokens)`,
    );
    await assertPagerHasNoRangeText(page, `${viewport.name}: full page (${settledCount} tokens)`);
    await assertPagerControlsCentered(page, `${viewport.name}: full page (${settledCount} tokens)`);
  });

  test(`admin tokens mobile pager stays bottom-anchored with a short dataset — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setAdminSession(page);
    await mockAdminParticularTokens(page, MOCK_TOKENS_SHORT);
    await page.goto("/dashboard/admin?module=admin-particular-tokens");

    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-particular-tokens"]',
    );
    await expect(workspace).toBeVisible({ timeout: 15_000 });

    const items = page.locator(
      '[data-admin-mobile-core-module="tokens"] [data-admin-mobile-core-item="true"]',
    );
    // R-05: the measured page size could in principle be smaller than the
    // 6-row dataset on an unusually cramped viewport; settle first, then only
    // assert it never exceeds the dataset itself.
    let settledCount: number | null = null;
    await expect(async () => {
      const current = await items.count();
      expect(current, `${viewport.name}: short-dataset item count settles`).toBeGreaterThan(0);
      if (settledCount !== current) {
        settledCount = current;
        throw new Error(`count not yet stable: ${current}`);
      }
    }).toPass({ intervals: [200, 300, 400, 600, 800], timeout: 6_000 });
    expect(settledCount, `${viewport.name}: short dataset never exceeds fetched rows`).toBeLessThanOrEqual(6);

    await assertPagerHasNoRangeText(page, `${viewport.name}: short dataset (6 tokens)`);
    await assertPagerControlsCentered(page, `${viewport.name}: short dataset (6 tokens)`);

    await assertPagerAnchoredToModuleBottom(
      page,
      `${viewport.name}: short dataset (6 tokens)`,
    );

    const forbiddenOverflow = await page.evaluate((selector) => {
      const root = document.querySelector(selector);
      if (!root) return [];
      const elements = [root, ...Array.from(root.querySelectorAll("*"))];
      return elements.flatMap((element) => {
        const style = window.getComputedStyle(element);
        return ["auto", "scroll"].includes(style.overflowX) ||
          ["auto", "scroll"].includes(style.overflowY)
          ? [`${element.tagName}.${(element as HTMLElement).className}`]
          : [];
      });
    }, '[data-admin-mobile-core-module="tokens"]');
    expect(
      forbiddenOverflow,
      `${viewport.name}: forbidden overflow auto/scroll (short dataset)`,
    ).toEqual([]);
  });
}

async function mockAdminUsersRolesClinics(page: Page) {
  await page.route("**/api/admin/users-roles**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        users: [
          {
            userType: "clinic",
            userId: 501,
            username: "clinica.norte",
            role: "clinic_owner",
            clinicId: 77,
            clinicName: "Clínica Norte",
            clinicLocality: "Rosario",
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
        totals: { adminUsers: 0, clinicUsers: 1 },
      }),
    });
  });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`admin tokens create dialog uses linked-clinic search and short copy — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setAdminSession(page);
    await mockAdminParticularTokens(page, MOCK_TOKENS_SHORT);
    await mockAdminUsersRolesClinics(page);
    await page.goto("/dashboard/admin?module=admin-particular-tokens");

    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-particular-tokens"]',
    );
    await expect(workspace).toBeVisible({ timeout: 15_000 });

    const toolbar = workspace.locator('[data-admin-particulars-toolbar="true"]');
    await toolbar.getByRole("tab", { name: "Generar token" }).click();

    const dialog = page.locator('[data-module-dialog="true"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await expect(
      dialog.getByText("Generar token particular"),
      `${viewport.name}: legacy long copy removed`,
    ).toHaveCount(0);
    await expect(
      dialog.getByText("ID informe vinculado"),
      `${viewport.name}: report-id label removed`,
    ).toHaveCount(0);

    const clinicSearchInput = dialog.getByLabel("Clínica vinculada");
    await expect(clinicSearchInput).toBeVisible();

    await clinicSearchInput.fill("Norte");
    const clinicOption = dialog.getByRole("option", { name: /Clínica Norte/ });
    await expect(clinicOption).toBeVisible();
    await clinicOption.click();
    await expect(clinicSearchInput).toHaveValue("Clínica Norte");

    await page.locator("#admin-token-particular-email").fill("particular@example.com");
    await dialog.getByRole("button", { name: "Siguiente" }).click();
    await expect(dialog.getByText("Paso 2 de 3: Paciente")).toBeVisible();

    await page.locator("#admin-token-tutor-last-name").fill("Tutor Demo");
    await page.locator("#admin-token-pet-name").fill("Paciente Demo");
    await page.locator("#admin-token-pet-age").fill("4 años");
    await page.locator("#admin-token-pet-breed").fill("Mestizo");
    await dialog.getByRole("button", { name: "Siguiente" }).click();
    await expect(dialog.getByText("Paso 3 de 3: Muestra")).toBeVisible();

    const limpiarButton = dialog.getByRole("button", { name: "Limpiar" });
    const anteriorButton = dialog.getByRole("button", { name: "Anterior" });
    const submitButton = dialog.getByRole("button", {
      name: "Generar token",
      exact: true,
    });

    await expect(limpiarButton).toBeVisible();
    await expect(anteriorButton).toBeVisible();
    await expect(submitButton).toBeVisible();

    for (const [label, button] of [
      ["Limpiar", limpiarButton],
      ["Anterior", anteriorButton],
      ["Generar token", submitButton],
    ] as const) {
      const box = await button.boundingBox();
      expect(box, `${viewport.name}: ${label} bounding box`).not.toBeNull();
      expect(
        box!.x,
        `${viewport.name}: ${label} clipped on the left`,
      ).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(
        box!.x + box!.width,
        `${viewport.name}: ${label} clipped on the right`,
      ).toBeLessThanOrEqual(viewport.width + TOLERANCE);
      expect(
        box!.height,
        `${viewport.name}: ${label} touch target height`,
      ).toBeGreaterThanOrEqual(36);
    }

    const overflow = await page.evaluate(() => ({
      htmlScrollWidth: document.documentElement.scrollWidth,
      htmlClientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.htmlScrollWidth,
      `${viewport.name}: dialog causes horizontal page overflow`,
    ).toBeLessThanOrEqual(overflow.htmlClientWidth + TOLERANCE);
  });
}
