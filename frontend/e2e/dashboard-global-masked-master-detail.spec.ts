import { expect, test } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Global inline/masked Master-Detail / no-scroll contract for BOTH dashboards.
//
// Governing audit: docs/audit/dashboard-masked-master-detail-no-scroll-audit.md
// Governing contract: docs/implementation/dashboard-internal-no-scroll-contract.md
//
// PR-A blindó that the shell `main.dashboard-main` is never an operational
// scroll container, but explicitly DEFERRED the heavy in-card modules (clinic
// Tokens particulares — PR-B, Informes/Logística density — PR-C/E). This spec
// closes that gap: it asserts the migrated modules (clinic Tokens / Informes /
// Logística in-shell, admin resumen / mantenimiento / roles) keep main/body/html
// free of operational scroll on desktop and mobile, and — critically — that
// opening the Tokens "alta" form (now a dedicated ModuleDialog layer) does NOT
// turn `main` into a scroll container even though the form is long.
//
// The e2e server runs with NEXT_PUBLIC_API_URL="" so the modules render their
// degraded/empty frame; the fixed composition must still hold without scroll.
// ─────────────────────────────────────────────────────────────────────────────

type Page = import("@playwright/test").Page;

// Small tolerance for sub-pixel rounding only. Real scroll is far larger.
const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

type Surface = "clinic" | "admin";

type ModuleCase = {
  label: string;
  surface: Surface;
  path: string;
  moduleId: string;
};

const MODULES: ModuleCase[] = [
  {
    label: "clinic Tokens particulares (table actions + dialog alta)",
    surface: "clinic",
    path: "/dashboard?module=tokens",
    moduleId: "tokens",
  },
  {
    label: "clinic Informes (table actions)",
    surface: "clinic",
    path: "/dashboard?module=informes",
    moduleId: "informes",
  },
  {
    label: "clinic Logística (in-shell master-detail)",
    surface: "clinic",
    path: "/dashboard?module=logistica",
    moduleId: "logistica",
  },
  {
    label: "admin Resumen/Alertas (tabs)",
    surface: "admin",
    path: "/dashboard/admin?module=admin",
    moduleId: "admin",
  },
  {
    label: "admin Mantenimiento (tabs)",
    surface: "admin",
    path: "/dashboard/admin?module=admin-maintenance",
    moduleId: "admin-maintenance",
  },
  {
    label: "admin Roles clínica",
    surface: "admin",
    path: "/dashboard/admin?module=admin-users-roles",
    moduleId: "admin-users-roles",
  },
];

const MOCK_TOKENS = Array.from({ length: 6 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    clinicId: 10,
    reportId: id % 2 === 0 ? 200 + id : null,
    tokenLast4: String(9000 + id).slice(-4),
    tutorLastName: `Tutor ${id}`,
    petName: `Paciente ${id}`,
    petAge: `${id + 1} años`,
    petBreed: "Mestizo",
    petSex: id % 2 === 0 ? "Hembra" : "Macho",
    petSpecies: id % 2 === 0 ? "Felinos" : "Caninos",
    sampleLocation: "Piel",
    sampleEvolution: "Subaguda",
    detailsLesion: "Lesión nodular compatible con seguimiento.",
    extractionDate: "2026-06-01T00:00:00.000Z",
    shippingDate: "2026-06-02T00:00:00.000Z",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    createdByAdminId: null,
    createdByClinicUserId: 77,
    hasLinkedReport: id % 2 === 0,
  };
});

async function mockClinicTokens(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/particular-tokens",
    async (route) => {
    const request = route.request();

    if (request.method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Token particular generado.",
          token: "VETNEB-MOCK-TOKEN-1234",
          particularToken: MOCK_TOKENS[0],
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        count: MOCK_TOKENS.length,
        particularTokens: MOCK_TOKENS,
        pagination: { limit: 10, offset: 0 },
        filters: { clinicId: null },
      }),
    });
    },
  );

  await page.route(
    (url) => url.pathname === "/api/study-tracking",
    async (route) => {
    const url = new URL(route.request().url());
    const particularTokenId = Number(url.searchParams.get("particularTokenId") ?? "0");

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        count: 1,
        trackingCases: [
          {
            id: 500 + particularTokenId,
            clinicId: 10,
            reportId: null,
            particularTokenId,
            createdByAdminId: null,
            createdByClinicUserId: 77,
            labReceivedAt: "2026-06-03T00:00:00.000Z",
            receptionAt: "2026-06-03T00:00:00.000Z",
            estimatedDeliveryAt: "2026-06-08T00:00:00.000Z",
            estimatedDeliveryAutoCalculatedAt: "2026-06-03T00:00:00.000Z",
            estimatedDeliveryWasManuallyAdjusted: false,
            currentStage: "processing",
            processingAt: "2026-06-04T00:00:00.000Z",
            evaluationAt: null,
            reportDevelopmentAt: null,
            deliveredAt: null,
            specialStainRequired: particularTokenId === 2,
            specialStainNotifiedAt: null,
            paymentUrl: null,
            adminContactEmail: null,
            adminContactPhone: null,
            notes: null,
            createdAt: "2026-06-03T00:00:00.000Z",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        ],
        pagination: { limit: 1, offset: 0 },
      }),
    });
    },
  );
}

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function applySession(page: Page, surface: Surface) {
  if (surface === "clinic") {
    await setClinicSession(page);
  } else {
    await setAdminSession(page);
  }
}

type ScrollContract = {
  htmlScrollHeight: number;
  htmlClientHeight: number;
  bodyScrollHeight: number;
  bodyClientHeight: number;
  mainScrollHeight: number;
  mainClientHeight: number;
  mainOverflowY: string;
  mainClassName: string;
  hasMain: boolean;
};

async function readScrollContract(page: Page): Promise<ScrollContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector(
      "main.dashboard-main",
    ) as HTMLElement | null;

    return {
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
      mainOverflowY: main ? window.getComputedStyle(main).overflowY : "none",
      mainClassName: typeof main?.className === "string" ? main.className : "",
      hasMain: main !== null,
    };
  });
}

function assertNoInternalScroll(metrics: ScrollContract, label: string) {
  expect(metrics.hasMain, `${label}: main.dashboard-main present`).toBe(true);

  expect(
    metrics.mainOverflowY,
    `${label}: main must not be a scroll container (overflow-y=${metrics.mainOverflowY}, class="${metrics.mainClassName}")`,
  ).not.toBe("auto");
  expect(
    metrics.mainOverflowY,
    `${label}: main must not be a scroll container (overflow-y=${metrics.mainOverflowY})`,
  ).not.toBe("scroll");

  expect(
    metrics.mainScrollHeight,
    `${label}: main scrolled (${metrics.mainScrollHeight} > ${metrics.mainClientHeight})`,
  ).toBeLessThanOrEqual(metrics.mainClientHeight + TOLERANCE);
  expect(
    metrics.bodyScrollHeight,
    `${label}: body scrolled (${metrics.bodyScrollHeight} > ${metrics.bodyClientHeight})`,
  ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
  expect(
    metrics.htmlScrollHeight,
    `${label}: documentElement scrolled (${metrics.htmlScrollHeight} > ${metrics.htmlClientHeight})`,
  ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);
}

for (const viewport of VIEWPORTS) {
  test.describe(`global masked master-detail no-scroll — ${viewport.name}`, () => {
    for (const moduleCase of MODULES) {
      test(`${moduleCase.label} keeps main/body/html free of operational scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await applySession(page, moduleCase.surface);
        if (moduleCase.moduleId === "tokens") {
          await mockClinicTokens(page);
        }

        await page.goto(moduleCase.path);
        await expect(
          page
            .locator(
              `[data-dashboard-module-workspace="${moduleCase.moduleId}"]`,
            )
            .first(),
        ).toBeVisible({ timeout: 12_000 });

        await expect(async () => {
          const metrics = await readScrollContract(page);
          assertNoInternalScroll(metrics, `${viewport.name} ${moduleCase.label}`);
        }).toPass({ timeout: 10_000 });
      });
    }

    // The Tokens "alta" form lives in a dedicated ModuleDialog layer. Opening it
    // must NOT turn `main` into a scroll container, even though the 13-field form
    // is long — the dialog floats (fixed/portaled) and never grows the shell.
    test(`clinic Tokens alta dialog opens without turning main into a scroll container`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await setClinicSession(page);
      await mockClinicTokens(page);

      await page.goto("/dashboard?module=tokens");
      await expect(
        page.locator('[data-dashboard-module-workspace="tokens"]').first(),
      ).toBeVisible({ timeout: 12_000 });

      await page
        .getByRole("button", { name: "Generar token particular" })
        .first()
        .click();

      await expect(
        page.locator('[data-module-dialog="true"]').first(),
      ).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText("Paso 1 de 3: Vínculo")).toBeVisible();
      await page.locator("#clinic-token-particular-email").fill("particular@example.com");
      await page.locator("#clinic-token-tutor-last-name").fill("Tutor Demo");
      await page.getByRole("button", { name: "Siguiente" }).click();
      await expect(page.getByText("Paso 2 de 3: Paciente")).toBeVisible();
      await page.locator("#clinic-token-pet-name").fill("Paciente Demo");
      await page.locator("#clinic-token-pet-age").fill("4 años");
      await page.locator("#clinic-token-pet-breed").fill("Mestizo");
      await page.getByRole("button", { name: "Siguiente" }).click();
      await expect(page.getByText("Paso 3 de 3: Muestra")).toBeVisible();

      await expect(async () => {
        const metrics = await readScrollContract(page);
        assertNoInternalScroll(
          metrics,
          `${viewport.name} clinic Tokens alta dialog`,
        );
      }).toPass({ timeout: 10_000 });
    });
  });
}

test("clinic Tokens desktop limits the list and opens detail dialog without shell scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await setClinicSession(page);
  await mockClinicTokens(page);

  await page.goto("/dashboard?module=tokens");
  const workspace = page.locator('[data-dashboard-module-workspace="tokens"]').first();
  const card = page.locator("#clinic-particular-tokens");
  await expect(workspace).toBeVisible({
    timeout: 12_000,
  });
  await expect(card.locator('[data-clinic-access-table-row="true"]')).toHaveCount(4);
  await expect(
    card.locator('[data-clinic-access-pagination-footer="true"]'),
  ).toBeVisible();
  await expect(
    card.locator('[data-clinic-access-pagination-controls="true"]'),
  ).toBeVisible();
  await expect(card.locator('[data-clinic-access-future-slots="true"]')).toBeVisible();
  await expect(card.getByText(/1[\u2013-]4 de \d+ tokens/)).toHaveCount(0);

  await card.getByRole("button", { name: "Ver detalle", exact: true }).nth(1).click();
  await expect(
    card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
  ).toHaveCount(0);
  await expect(card.locator('[data-clinic-access-table-row="true"]')).toHaveCount(4);
  const detailDialog = page.locator('[data-clinic-access-detail-dialog="true"]');
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog).toContainText("Paciente 2 · Tutor 2");
  await expect(detailDialog.getByText("Alerta: Solicitud de tinción especial")).toBeVisible();

  const metrics = await readScrollContract(page);
  assertNoInternalScroll(metrics, "desktop clinic Tokens selected dialog");
});

test("clinic Tokens mobile keeps the list and opens the selected detail dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setClinicSession(page);
  await mockClinicTokens(page);

  await page.goto("/dashboard?module=tokens");
  const workspace = page.locator('[data-dashboard-module-workspace="tokens"]').first();
  const card = page.locator("#clinic-particular-tokens");
  await expect(workspace).toBeVisible({
    timeout: 12_000,
  });
  await expect(card.locator('[data-clinic-access-mobile-row="true"]').first()).toBeVisible();

  await card.getByRole("button", { name: "Ver detalle", exact: true }).nth(1).click();
  await expect(card.locator('[data-clinic-access-mobile-row="true"]')).toHaveCount(4);
  await expect(
    card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
  ).toHaveCount(0);
  const detailDialog = page.locator('[data-clinic-access-detail-dialog="true"]');
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog).toContainText("Paciente 2 · Tutor 2");

  const metrics = await readScrollContract(page);
  assertNoInternalScroll(metrics, "mobile clinic Tokens selected dialog");
});
