import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const MOCK_TOKENS = Array.from({ length: 11 }, (_, index) => ({
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

    await expect(
      workspace.getByRole("heading", { name: "Tokens particulares" }),
      `${viewport.name}: redundant intro header hidden on mobile`,
    ).toBeHidden();
    await expect(
      workspace.getByText("En página", { exact: true }),
      `${viewport.name}: metrics row hidden on mobile`,
    ).toBeHidden();

    const items = workspace.locator('[data-admin-mobile-core-item="true"]');
    await expect(
      items,
      `${viewport.name}: ten tokens visible per mobile page`,
    ).toHaveCount(10);

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
    await expect(items).toHaveCount(10);

    await assertPagerAnchoredToModuleBottom(
      page,
      `${viewport.name}: full page (10 tokens)`,
    );
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
    await expect(items).toHaveCount(6);

    const pager = page.locator(
      '[data-admin-mobile-core-module="tokens"] [data-admin-mobile-core-pager="true"]',
    );
    await expect(pager.getByText("1–6", { exact: true })).toBeVisible();

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
