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
  listScrollHeight: number;
  listOverflowY: string;
  moduleScrollContainers: Array<{ tag: string; overflowY: string }>;
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
      const limit = Number(url.searchParams.get("limit"));
      // R-16 (C6): the fetch limit is now derived from the adaptive
      // rowsPerPage superset (clamp(rowsPerPage * 3, 12, 36)), not a fixed
      // literal -- assert the observable contract (a valid superset bound),
      // not a specific number.
      expect(
        Number.isInteger(limit),
        "limit must be sent as an integer",
      ).toBe(true);
      expect(
        limit,
        "limit must respect the fetch superset fallback",
      ).toBeGreaterThanOrEqual(12);
      expect(
        limit,
        "limit must respect the fetch superset cap",
      ).toBeLessThanOrEqual(36);
      expect(url.searchParams.get("offset")).toBe("0");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: MOCK_TOKENS.length,
          particularTokens: MOCK_TOKENS,
          pagination: { limit, offset: 0 },
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
    const card = document.querySelector<HTMLElement>("#clinic-particular-tokens");
    const list = document.querySelector<HTMLElement>(
      '[data-clinic-access-list-body="true"]',
    );
    const moduleScrollContainers = card
      ? [card, ...Array.from(card.querySelectorAll<HTMLElement>("*"))].flatMap(
          (element) => {
            const style = window.getComputedStyle(element);
            return ["auto", "scroll"].includes(style.overflowY)
              ? [{ tag: element.tagName, overflowY: style.overflowY }]
              : [];
          },
        )
      : [];
    const listStyle = list ? window.getComputedStyle(list) : null;

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
      listScrollHeight: list?.scrollHeight ?? 0,
      listOverflowY: listStyle?.overflowY ?? "missing",
      moduleScrollContainers,
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
  expect(
    metrics.listScrollHeight,
    `${label}: token list must not clip hidden overflow`,
  ).toBeLessThanOrEqual(metrics.listClientHeight + TOLERANCE);
  expect(
    ["auto", "scroll"],
    `${label}: token list must not expose vertical scroll`,
  ).not.toContain(metrics.listOverflowY);
  expect(
    metrics.moduleScrollContainers,
    `${label}: tokens module must not contain internal scroll containers`,
  ).toEqual([]);
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

async function expectFooterBottomRightAligned(
  footer: Locator,
  controls: Locator,
  panel: Locator,
  label: string,
) {
  await expect(footer, `${label}: footer visible`).toBeVisible();
  await expect(controls, `${label}: controls visible`).toBeVisible();

  const footerBox = await footer.boundingBox();
  const controlsBox = await controls.boundingBox();
  const panelBox = await panel.boundingBox();

  expect(footerBox, `${label}: footer box`).not.toBeNull();
  expect(controlsBox, `${label}: controls box`).not.toBeNull();
  expect(panelBox, `${label}: panel box`).not.toBeNull();

  expect(
    Math.abs(footerBox!.y + footerBox!.height - (panelBox!.y + panelBox!.height)),
    `${label}: footer sits on panel bottom edge`,
  ).toBeLessThanOrEqual(TOLERANCE);
  expect(
    panelBox!.x + panelBox!.width - (controlsBox!.x + controlsBox!.width),
    `${label}: controls align to the right side of the footer`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    panelBox!.x + panelBox!.width - (controlsBox!.x + controlsBox!.width),
    `${label}: controls stay close to the right side of the footer`,
  ).toBeLessThanOrEqual(18);
}

// `useAdaptiveRowsPerPage` now actually reacts to the measured container
// (PR-FIX-1). Right after the list mounts it can briefly compute a transient
// value from not-yet-updated sub-measurements (row height / header height)
// before a follow-up render settles on the real value, so a naive read can
// catch that transient instead of the converged count. Wait until the count
// stops changing for a few consecutive polls before trusting it.
async function waitForSettledRowCount(
  locator: Locator,
  label: string,
): Promise<number> {
  let previousCount = -1;
  let stableReads = 0;

  await expect(async () => {
    const currentCount = await locator.count();
    if (currentCount === previousCount) {
      stableReads += 1;
    } else {
      previousCount = currentCount;
      stableReads = 0;
    }
    expect(
      stableReads,
      `${label}: adaptive row count must settle (currently ${currentCount})`,
    ).toBeGreaterThanOrEqual(3);
  }).toPass({ timeout: 8_000, intervals: [50] });

  return previousCount;
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
    const listPanel = card.locator('[data-clinic-access-list-panel="true"]');
    const tokenRows = card.locator('[data-clinic-access-mobile-row="true"]');
    const detailButtons = card.getByRole("button", {
      name: "Ver detalle",
      exact: true,
    });
    const refreshButton = card.getByRole("button", {
      name: "Actualizar",
      exact: true,
    });
    const createButton = card.getByRole("button", {
      name: "Generar token particular",
      exact: true,
    });
    const pager = card.locator(
      '[data-clinic-access-pagination-footer="true"]',
    );
    const pagerControls = card.locator(
      '[data-clinic-access-pagination-controls="true"]',
    );
    const futureSlots = card.locator(
      '[data-clinic-access-future-slots="true"]',
    );
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
      await expectClinicMobileBottomNav(page, viewport.name);
      await expect(refreshButton).toBeVisible();
      await expect(refreshButton).toBeEnabled();
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
      await expect(pager).toBeVisible();
      await expect(previousButton).toBeVisible();
      await expect(nextButton).toBeVisible();
      await expect(card.getByText(/1[–-]4 de \d+ tokens/)).toHaveCount(0);
      await expect(futureSlots).toBeVisible();
      await expect(card.getByText("Usuarios y roles")).toHaveCount(0);
      await expect(card.getByText("Auditoría")).toHaveCount(0);
      await expect(card.getByText("Mantenimiento")).toHaveCount(0);
    }).toPass({ timeout: 12_000 });

    // `rowsPerPage` is adaptive (useAdaptiveRowsPerPage), not the historical
    // fixed TOKENS_PAGE_SIZE=4 -- assert the observable contract instead of a
    // literal: a positive, settled row count bounded by the mocked dataset,
    // wired consistently to the detail buttons and the pagination footer.
    const rowCount = await waitForSettledRowCount(
      tokenRows,
      `${viewport.name}: initial list`,
    );
    expect(
      rowCount,
      `${viewport.name}: adaptive row count must be positive`,
    ).toBeGreaterThan(0);
    expect(
      rowCount,
      `${viewport.name}: adaptive row count must not exceed the mocked dataset`,
    ).toBeLessThanOrEqual(MOCK_TOKENS.length);
    await expect(detailButtons).toHaveCount(rowCount);

    for (let index = 0; index < rowCount; index += 1) {
      await expect(tokenRows.nth(index)).toBeVisible();
      await expect(detailButtons.nth(index)).toBeVisible();
    }

    const expectedPageCount = Math.ceil(MOCK_TOKENS.length / rowCount);
    await expect(
      pager.getByText(`Página 1 / ${expectedPageCount}`),
    ).toBeVisible();
    if (expectedPageCount > 1) {
      await expect(nextButton).toBeEnabled();
    } else {
      await expect(nextButton).toBeDisabled();
    }

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
      pagerControls,
      viewport.width,
      `${viewport.name}: controles de paginación`,
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
    await expectFooterBottomRightAligned(
      pager,
      pagerControls,
      listPanel,
      `${viewport.name}: footer de paginación`,
    );

    await expect(card.locator('[data-clinic-access-table="true"]')).toBeHidden();
    await expect(
      card.locator('[data-clinic-access-mobile-list="true"]'),
    ).toBeVisible();
    await expect(
      card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
    ).toHaveCount(0);

    await expect(async () => {
      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: initial layout`);
    }).toPass({ timeout: 10_000 });

    await detailButtons.nth(1).click();

    await expect(async () => {
      await expect(tokenRows).toHaveCount(rowCount);
      await expect(tokenRows.nth(0)).toBeVisible();
      await expect(tokenRows.nth(1)).toBeVisible();
      await expect(
        card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
      ).toHaveCount(0);

      const detailDialog = page.locator(
        '[data-clinic-access-detail-dialog="true"]',
      );
      await expect(detailDialog).toBeVisible();
      await expect(
        detailDialog.getByText(
          /Paciente veterinario 2 .* Apellido compuesto del tutor 2/,
        ),
      ).toBeVisible();

      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: modal detail`);
    }).toPass({ timeout: 10_000 });
  });
}
