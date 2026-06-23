import { expect, test, type Locator, type Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const MOCK_CLINICS = Array.from({ length: 13 }, (_, index) => {
  const id = index + 1;
  return {
    clinicId: id,
    clinicName: `Clínica Core ${id}`,
    contactEmail: `clinica.core.${id}@example.test`,
    contactPhone: `+54 11 5555-${String(id).padStart(4, "0")}`,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: `2026-06-${String(id).padStart(2, "0")}T12:00:00.000Z`,
    users: [
      {
        userId: 100 + id,
        username: `core-owner-${id}`,
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  };
});

const REPORT_STAGES = ["sample_received", "processing", "delivered"] as const;
const MOCK_REPORTS = Array.from({ length: 9 }, (_, index) => {
  const id = 7400 + index;
  return {
    id,
    clinicId: 20 + index,
    clinicName: `Clínica Informe ${index + 1}`,
    patientName: `Paciente ${index + 1}`,
    studyType: "histopatologia",
    workflowStage: REPORT_STAGES[index % REPORT_STAGES.length],
    specialStainRequested: index % 4 === 0,
    fileName: index % 2 === 0 ? `informe-${id}.pdf` : null,
    uploadDate: "2026-06-10T10:00:00.000Z",
    createdAt: "2026-06-09T10:00:00.000Z",
    workflowUpdatedAt: "2026-06-11T10:00:00.000Z",
  };
});

const MOCK_TOKENS = Array.from({ length: 13 }, (_, index) => ({
  id: 9300 + index,
  clinicId: 30 + index,
  reportId: index % 3 === 0 ? 7400 + index : null,
  tokenLast4: String(5100 + index),
  tutorLastName: ["Gómez", "Pérez", "Luna"][index % 3],
  petName: ["Mora", "Simón", "Lola", "Bruno", "Kira", "Toby", "Nina", "Rocco", "Uma"][index % 9],
  petAge: `${2 + index} años`,
  petBreed: index % 2 === 0 ? "Mestizo" : "Labrador",
  petSex: index % 2 === 0 ? "Hembra" : "Macho",
  petSpecies: index % 2 === 0 ? "Caninos" : "Felinos",
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

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function mockAdminClinics(page: Page) {
  await page.route("**/api/admin/clinics**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const clinics = MOCK_CLINICS.slice(offset, offset + limit);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        clinics,
        total: MOCK_CLINICS.length,
        limit,
        offset,
      }),
    });
  });
}

async function mockAdminReportWorkflow(page: Page) {
  await page.route("**/api/admin/report-workflow**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const reports = MOCK_REPORTS.slice(offset, offset + limit);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        reports,
        pagination: { limit, offset, hasMore: offset + limit < MOCK_REPORTS.length },
      }),
    });
  });
}

async function mockAdminParticularTokens(page: Page) {
  await page.route("**/api/admin/particular-tokens**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/api/admin/particular-tokens") {
      await route.fallback();
      return;
    }
    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const particularTokens = MOCK_TOKENS.slice(offset, offset + limit);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        count: particularTokens.length,
        particularTokens,
        pagination: { limit, offset },
        filters: { clinicId: null },
      }),
    });
  });
}

type ModuleSpec = {
  key: "clinics" | "reports" | "tokens";
  moduleId: string;
  mock: (page: Page) => Promise<void>;
  // Viewport-safe page-size ceiling for this module's mobile list; differs per module.
  maxItemsPerPage: number;
};

const MODULES: ModuleSpec[] = [
  { key: "clinics", moduleId: "admin-clinics", mock: mockAdminClinics, maxItemsPerPage: 10 },
  { key: "reports", moduleId: "admin-report-upload", mock: mockAdminReportWorkflow, maxItemsPerPage: 5 },
  { key: "tokens", moduleId: "admin-particular-tokens", mock: mockAdminParticularTokens, maxItemsPerPage: 10 },
];

type NoScrollContract = {
  html: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  body: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  forbiddenOverflow: Array<{ tag: string; cls: string; overflowX: string; overflowY: string }>;
};

async function readNoScrollContract(
  page: Page,
  moduleSelector: string,
): Promise<NoScrollContract> {
  return page.evaluate((selector) => {
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const moduleRoot = document.querySelector<HTMLElement>(selector);

    const candidates: HTMLElement[] = [];
    if (shell) candidates.push(shell);
    if (main) candidates.push(main);
    if (moduleRoot) {
      candidates.push(moduleRoot, ...Array.from(moduleRoot.querySelectorAll<HTMLElement>("*")));
    }

    const forbiddenOverflow = candidates.flatMap((element) => {
      const style = window.getComputedStyle(element);
      return ["auto", "scroll"].includes(style.overflowX) ||
        ["auto", "scroll"].includes(style.overflowY)
        ? [
            {
              tag: element.tagName,
              cls: element.className,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
            },
          ]
        : [];
    });

    return {
      html: {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      body: {
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
      },
      forbiddenOverflow,
    };
  }, moduleSelector);
}

function assertNoScrollContract(contract: NoScrollContract, label: string) {
  expect(contract.html.scrollHeight, `${label}: html vertical overflow`).toBeLessThanOrEqual(
    contract.html.clientHeight + TOLERANCE,
  );
  expect(contract.body.scrollHeight, `${label}: body vertical overflow`).toBeLessThanOrEqual(
    contract.body.clientHeight + TOLERANCE,
  );
  expect(contract.html.scrollWidth, `${label}: html horizontal overflow`).toBeLessThanOrEqual(
    contract.html.clientWidth + TOLERANCE,
  );
  expect(contract.body.scrollWidth, `${label}: body horizontal overflow`).toBeLessThanOrEqual(
    contract.body.clientWidth + TOLERANCE,
  );
  expect(contract.forbiddenOverflow, `${label}: forbidden overflow auto/scroll`).toEqual([]);
}

async function expectInsideViewport(
  locator: Locator,
  viewportWidth: number,
  viewportHeight: number,
  label: string,
) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(box!.x, `${label}: left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.y, `${label}: top edge`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right edge`).toBeLessThanOrEqual(
    viewportWidth + TOLERANCE,
  );
  expect(box!.y + box!.height, `${label}: bottom edge`).toBeLessThanOrEqual(
    viewportHeight + TOLERANCE,
  );
}

for (const moduleSpec of MODULES) {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`Admin mobile core module "${moduleSpec.key}" is no-scroll at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setAdminSession(page);
      await moduleSpec.mock(page);
      await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);
      await suppressNextDevIndicator(page);

      const workspace = page.locator(
        `[data-dashboard-module-workspace="${moduleSpec.moduleId}"]`,
      );
      await expect(workspace, `${viewport.name}: module workspace visible`).toBeVisible({
        timeout: 15_000,
      });

      const moduleRoot = page.locator(
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      await expect(moduleRoot, `${viewport.name}: module root visible`).toBeVisible();

      await expect(
        page.locator('[data-admin-mobile-app-bar="true"]'),
        `${viewport.name}: app bar visible`,
      ).toBeVisible();
      await expect(
        page.locator('[data-admin-mobile-bottom-nav="true"]'),
        `${viewport.name}: bottom nav visible`,
      ).toBeVisible();
      await expect(
        page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
        `${viewport.name}: horizontal nav absent`,
      ).toBeHidden();

      const contract = await readNoScrollContract(
        page,
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      assertNoScrollContract(contract, `${viewport.name} ${moduleSpec.key} page 1`);

      const itemSelector = `[data-admin-mobile-core-module="${moduleSpec.key}"] [data-admin-mobile-core-item="true"]`;
      const items = page.locator(itemSelector);
      await expect(
        items.first(),
        `${viewport.name}: ${moduleSpec.key} first item visible`,
      ).toBeVisible({ timeout: 15_000 });
      const itemCount = await items.count();
      expect(itemCount, `${viewport.name}: ${moduleSpec.key} has visible items`).toBeGreaterThan(0);
      expect(
        itemCount,
        `${viewport.name}: ${moduleSpec.key} page size must remain viewport-safe`,
      ).toBeLessThanOrEqual(moduleSpec.maxItemsPerPage);

      for (let index = 0; index < itemCount; index += 1) {
        await expectInsideViewport(
          items.nth(index),
          viewport.width,
          viewport.height,
          `${viewport.name}: ${moduleSpec.key} item ${index + 1}`,
        );
      }

      const pager = page.locator(
        `[data-admin-mobile-core-module="${moduleSpec.key}"] [data-admin-mobile-core-pager="true"]`,
      );
      await expectInsideViewport(
        pager,
        viewport.width,
        viewport.height,
        `${viewport.name}: ${moduleSpec.key} pager`,
      );

      const nextButton = pager.getByRole("button", { name: /siguiente|próxim/i });
      await expect(nextButton, `${viewport.name}: ${moduleSpec.key} next page button`).toBeVisible();
      await expect(nextButton, `${viewport.name}: ${moduleSpec.key} next page button enabled`).toBeEnabled();

      const firstPageLabels = await items.allTextContents();
      await nextButton.click();
      await expect
        .poll(async () => (await items.allTextContents()).join("|"), {
          message: `${viewport.name}: ${moduleSpec.key} page changes after pagination`,
        })
        .not.toBe(firstPageLabels.join("|"));

      const page2Contract = await readNoScrollContract(
        page,
        `[data-admin-mobile-core-module="${moduleSpec.key}"]`,
      );
      assertNoScrollContract(page2Contract, `${viewport.name} ${moduleSpec.key} page 2`);

      const bottomNav = page.locator('[data-admin-mobile-bottom-nav="true"]');
      await bottomNav.getByRole("button", { name: "Inicio", exact: true }).click();
      await expect(
        page.locator('[data-admin-mobile-hub-launcher="true"]'),
        `${viewport.name}: returning Inicio shows hub launcher`,
      ).toBeVisible({ timeout: 15_000 });
    });
  }
}

test("Admin mobile core modules reachable from bottom nav and Más menu", async ({ page }) => {
  const viewport = MOBILE_VIEWPORTS[0];
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await setAdminSession(page);
  await mockAdminClinics(page);
  await mockAdminReportWorkflow(page);
  await mockAdminParticularTokens(page);
  await page.goto("/dashboard/admin");
  await suppressNextDevIndicator(page);

  const bottomNav = page.locator('[data-admin-mobile-bottom-nav="true"]');
  await expect(bottomNav).toBeVisible();

  await bottomNav.getByRole("button", { name: "Clínicas", exact: true }).click();
  await expect(
    page.locator('[data-admin-mobile-core-module="clinics"]'),
  ).toBeVisible({ timeout: 15_000 });

  await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
  const moduleMenu = page.locator('[data-admin-mobile-module-menu="true"]');
  await expect(moduleMenu).toBeVisible();
  await moduleMenu
    .locator('[data-admin-mobile-module-link="true"]')
    .filter({ hasText: "Informes" })
    .click();
  await expect(
    page.locator('[data-admin-mobile-core-module="reports"]'),
  ).toBeVisible({ timeout: 15_000 });

  await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
  await expect(moduleMenu).toBeVisible();
  await moduleMenu
    .locator('[data-admin-mobile-module-link="true"]')
    .filter({ hasText: "Tokens" })
    .click();
  await expect(
    page.locator('[data-admin-mobile-core-module="tokens"]'),
  ).toBeVisible({ timeout: 15_000 });
});

for (const moduleSpec of MODULES) {
  test(`Admin desktop preserves ${moduleSpec.key} layout at 1280x800`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setAdminSession(page);
    await moduleSpec.mock(page);
    await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);

    await expect(
      page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
      `${moduleSpec.key} desktop: horizontal nav visible`,
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-admin-mobile-bottom-nav="true"]'),
      `${moduleSpec.key} desktop: bottom nav absent`,
    ).toBeHidden();
    await expect(
      page.locator(`[data-admin-mobile-core-module="${moduleSpec.key}"]`),
      `${moduleSpec.key} desktop: mobile core module root absent`,
    ).toBeHidden();
  });
}
