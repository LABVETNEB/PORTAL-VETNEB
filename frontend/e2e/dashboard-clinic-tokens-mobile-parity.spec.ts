import { expect, test, type Locator, type Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const MOCK_TOKENS = Array.from({ length: 6 }, (_, index) => {
  const id = index + 1;

  return {
    id,
    clinicId: 10,
    reportId: id % 2 === 0 ? 200 + id : null,
    tokenLast4: String(9000 + id).slice(-4),
    tutorLastName: `Apellido compuesto del tutor ${id} con contenido operativo extenso`,
    petName: `Paciente veterinario ${id} con nombre clínico extenso`,
    petAge: `${id + 1} años y 6 meses`,
    petBreed: "Mestizo de pelo largo con descripción clínica extensa",
    petSex: id % 2 === 0 ? "Hembra" : "Macho",
    petSpecies: id % 2 === 0 ? "Felinos" : "Caninos",
    sampleLocation:
      "Región torácica lateral derecha con múltiples lesiones nodulares",
    sampleEvolution:
      "Evolución subaguda de varias semanas con crecimiento progresivo",
    detailsLesion:
      "Lesión nodular firme, irregular y pigmentada compatible con seguimiento anatomopatológico prioritario.",
    extractionDate: "2026-06-01T00:00:00.000Z",
    shippingDate: "2026-06-02T00:00:00.000Z",
    isActive: id !== 6,
    lastLoginAt: id % 2 === 0 ? "2026-06-05T12:30:00.000Z" : null,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    createdByAdminId: null,
    createdByClinicUserId: 77,
    hasLinkedReport: id % 2 === 0,
  };
});

type LayoutContract = {
  htmlScrollWidth: number;
  htmlClientWidth: number;
  htmlScrollHeight: number;
  htmlClientHeight: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  bodyScrollHeight: number;
  bodyClientHeight: number;
  mainScrollHeight: number;
  mainClientHeight: number;
  mainOverflowY: string;
  listClientHeight: number;
  hasMain: boolean;
  hasList: boolean;
};

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function mockClinicTokens(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/particular-tokens",
    async (route) => {
      const request = route.request();

      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }

      const url = new URL(request.url());
      expect(url.searchParams.get("limit")).toBe("10");
      expect(url.searchParams.get("offset")).toBe("0");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: MOCK_TOKENS.length,
          particularTokens: MOCK_TOKENS,
          pagination: { limit: 10, offset: 0 },
        }),
      });
    },
  );
}

async function readLayoutContract(page: Page): Promise<LayoutContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const list = document.querySelector<HTMLElement>(".dashboard-inline-scroll");

    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
      mainOverflowY: main ? window.getComputedStyle(main).overflowY : "none",
      listClientHeight: list?.clientHeight ?? 0,
      hasMain: main !== null,
      hasList: list !== null,
    };
  });
}

function assertNoGlobalOverflow(metrics: LayoutContract, label: string) {
  expect(metrics.hasMain, `${label}: main.dashboard-main present`).toBe(true);
  expect(
    metrics.htmlScrollWidth,
    `${label}: documentElement horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.htmlClientWidth + TOLERANCE);
  expect(
    metrics.bodyScrollWidth,
    `${label}: body horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth + TOLERANCE);
  expect(
    metrics.htmlScrollHeight,
    `${label}: documentElement global scroll`,
  ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);
  expect(
    metrics.bodyScrollHeight,
    `${label}: body global scroll`,
  ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
  expect(metrics.mainScrollHeight, `${label}: dashboard shell scroll`).toBeLessThanOrEqual(
    metrics.mainClientHeight + TOLERANCE,
  );
  expect(
    ["auto", "scroll"],
    `${label}: dashboard shell must not be a scroll container`,
  ).not.toContain(metrics.mainOverflowY);
  expect(metrics.hasList, `${label}: inline list present`).toBe(true);
  expect(
    metrics.listClientHeight,
    `${label}: inline list must keep an operable height`,
  ).toBeGreaterThanOrEqual(44);
}

async function expectHorizontallyUnclipped(
  locator: Locator,
  viewportWidth: number,
  label: string,
) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const box = await locator.boundingBox();

  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(box!.x, `${label}: left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right edge`).toBeLessThanOrEqual(
    viewportWidth + TOLERANCE,
  );
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`clinic Tokens mobile parity at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setClinicSession(page);
    await mockClinicTokens(page);

    await page.goto("/dashboard?module=tokens");

    const workspace = page
      .locator('[data-dashboard-module-workspace="tokens"]')
      .first();
    const card = page.locator("#clinic-particular-tokens");
    const tokenRows = card.locator('[id^="clinic-particular-token-"]');
    const refreshButton = card.getByRole("button", {
      name: "Actualizar",
      exact: true,
    });
    const createButton = card.getByRole("button", {
      name: "Generar token particular",
      exact: true,
    });
    const pager = card.locator('[data-dashboard-compact-pager="true"]');
    const previousButton = pager.getByRole("button", {
      name: "Página anterior",
      exact: true,
    });
    const nextButton = pager.getByRole("button", {
      name: "Página siguiente",
      exact: true,
    });

    await expect(async () => {
      await expect(workspace).toBeVisible();
      await expect(card).toBeVisible();
      await expect(tokenRows).toHaveCount(4);

      for (let index = 0; index < 4; index += 1) {
        await expect(tokenRows.nth(index)).toBeVisible();
      }

      await expect(refreshButton).toBeVisible();
      await expect(refreshButton).toBeEnabled();
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
      await expect(pager).toBeVisible();
      await expect(previousButton).toBeVisible();
      await expect(nextButton).toBeVisible();
      await expect(nextButton).toBeEnabled();
    }).toPass({ timeout: 12_000 });

    await expectHorizontallyUnclipped(
      refreshButton,
      viewport.width,
      `${viewport.name}: Actualizar`,
    );
    await expectHorizontallyUnclipped(
      createButton,
      viewport.width,
      `${viewport.name}: Generar token particular`,
    );
    await expectHorizontallyUnclipped(
      pager,
      viewport.width,
      `${viewport.name}: paginador`,
    );
    await expectHorizontallyUnclipped(
      previousButton,
      viewport.width,
      `${viewport.name}: Página anterior`,
    );
    await expectHorizontallyUnclipped(
      nextButton,
      viewport.width,
      `${viewport.name}: Página siguiente`,
    );

    await expect(card.locator("table")).toHaveCount(0);

    await expect(async () => {
      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: initial layout`);
    }).toPass({ timeout: 10_000 });

    const secondToken = page.locator("#clinic-particular-token-2");
    await secondToken.click();

    await expect(async () => {
      await expect(secondToken).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      const inlineDetail = card.locator('[data-detail-state="selected"]');
      await expect(inlineDetail).toHaveCount(1);
      await expect(inlineDetail).toBeVisible();
      await expect(
        inlineDetail.getByRole("heading", {
          name: /Paciente veterinario 2 .* Apellido compuesto del tutor 2/,
        }),
      ).toBeVisible();

      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: expanded inline detail`);
    }).toPass({ timeout: 10_000 });
  });
}
