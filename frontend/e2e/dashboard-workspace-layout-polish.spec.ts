import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const TOLERANCE = 2;

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

type Surface = "clinic" | "admin";

type FrameRouteCase = {
  label: string;
  surface: Surface;
  path: string;
  ready: string;
};

const FRAME_VIEWPORTS = [
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

const FRAME_ROUTES: FrameRouteCase[] = [
  {
    label: "clinic resumen",
    surface: "clinic",
    path: "/dashboard?module=operaciones",
    ready: '[data-dashboard-module-workspace="operaciones"]',
  },
  {
    label: "clinic informes",
    surface: "clinic",
    path: "/dashboard?module=informes",
    ready: '[data-dashboard-module-workspace="informes"]',
  },
  {
    label: "clinic tokens",
    surface: "clinic",
    path: "/dashboard?module=tokens",
    ready: '[data-dashboard-module-workspace="tokens"]',
  },
  {
    label: "clinic perfil",
    surface: "clinic",
    path: "/dashboard?module=perfil",
    ready: '[data-dashboard-module-workspace="perfil"]',
  },
  {
    label: "admin resumen",
    surface: "admin",
    path: "/dashboard/admin?module=admin",
    ready: '[data-dashboard-module-workspace="admin"]',
  },
];

type RectMetric = {
  present: boolean;
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type FrameFitMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  htmlScrollWidth: number;
  htmlClientWidth: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  mainScrollHeight: number;
  mainClientHeight: number;
  mainScrollWidth: number;
  mainClientWidth: number;
  mainOverflowY: string;
  mainPaddingLeft: string;
  mainPaddingRight: string;
  mainPaddingBottom: string;
  main: RectMetric;
  stage: RectMetric;
  surface: RectMetric;
};

async function applySession(page: Page, surface: Surface) {
  if (surface === "clinic") {
    await setClinicSession(page);
  } else {
    await setAdminSession(page);
  }
}

async function readFrameFitMetrics(page: Page): Promise<FrameFitMetrics> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const stage = document.querySelector<HTMLElement>(
      '[data-dashboard-module-stage="true"]',
    );
    const workspace = document.querySelector<HTMLElement>(
      "[data-dashboard-module-workspace]",
    );
    const hub = document.querySelector<HTMLElement>(
      '[data-dashboard-module-hub="true"]',
    );
    const surfaceRoot = workspace ?? hub;
    const surface =
      surfaceRoot?.querySelector<HTMLElement>(
        '[data-dashboard-module-surface="true"], .dashboard-surface, [data-module-tabs="true"]',
      ) ?? surfaceRoot;
    const mainStyle = main ? window.getComputedStyle(main) : null;

    const rectFor = (element: Element | null): RectMetric => {
      if (!element) {
        return {
          present: false,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: 0,
          height: 0,
        };
      }

      const rect = element.getBoundingClientRect();

      return {
        present: true,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
      mainScrollWidth: main?.scrollWidth ?? 0,
      mainClientWidth: main?.clientWidth ?? 0,
      mainOverflowY: mainStyle?.overflowY ?? "missing",
      mainPaddingLeft: mainStyle?.paddingLeft ?? "0px",
      mainPaddingRight: mainStyle?.paddingRight ?? "0px",
      mainPaddingBottom: mainStyle?.paddingBottom ?? "0px",
      main: rectFor(main),
      stage: rectFor(stage),
      surface: rectFor(surface ?? null),
    };
  });
}

function assertDashboardFrameFit(metrics: FrameFitMetrics, label: string) {
  expect(metrics.main.present, `${label}: main present`).toBe(true);
  expect(metrics.stage.present, `${label}: dashboard stage present`).toBe(true);
  expect(metrics.surface.present, `${label}: dashboard surface present`).toBe(true);

  expect(
    metrics.htmlScrollWidth,
    `${label}: documentElement horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.htmlClientWidth + TOLERANCE);
  expect(
    metrics.bodyScrollWidth,
    `${label}: body horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth + TOLERANCE);
  expect(
    metrics.mainScrollWidth,
    `${label}: main horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.mainClientWidth + TOLERANCE);
  expect(
    metrics.mainScrollHeight,
    `${label}: main vertical overflow`,
  ).toBeLessThanOrEqual(metrics.mainClientHeight + TOLERANCE);
  expect(
    metrics.mainOverflowY,
    `${label}: main must not become operational scroll`,
  ).not.toBe("auto");
  expect(
    metrics.mainOverflowY,
    `${label}: main must not become operational scroll`,
  ).not.toBe("scroll");

  const inlineStartInset = metrics.stage.left - metrics.main.left;
  const inlineEndInset = metrics.main.right - metrics.stage.right;
  const blockEndInset = metrics.main.bottom - metrics.stage.bottom;

  expect(
    Math.abs(inlineStartInset - inlineEndInset),
    `${label}: left/right frame inset parity`,
  ).toBeLessThanOrEqual(TOLERANCE);
  expect(
    Math.abs(blockEndInset - inlineStartInset),
    `${label}: bottom frame inset must match lateral inset (left=${inlineStartInset}, bottom=${blockEndInset}, css bottom=${metrics.mainPaddingBottom}, css left=${metrics.mainPaddingLeft})`,
  ).toBeLessThanOrEqual(TOLERANCE);
  expect(
    Math.abs(blockEndInset - inlineEndInset),
    `${label}: bottom frame inset must match lateral inset (right=${inlineEndInset}, bottom=${blockEndInset}, css bottom=${metrics.mainPaddingBottom}, css right=${metrics.mainPaddingRight})`,
  ).toBeLessThanOrEqual(TOLERANCE);

  expect(metrics.stage.left, `${label}: stage clipped left`).toBeGreaterThanOrEqual(
    metrics.main.left - TOLERANCE,
  );
  expect(metrics.stage.right, `${label}: stage clipped right`).toBeLessThanOrEqual(
    metrics.main.right + TOLERANCE,
  );
  expect(metrics.stage.bottom, `${label}: stage clipped bottom`).toBeLessThanOrEqual(
    metrics.main.bottom + TOLERANCE,
  );
  expect(
    metrics.surface.bottom,
    `${label}: module surface clipped by viewport bottom`,
  ).toBeLessThanOrEqual(metrics.viewportHeight + TOLERANCE);
  expect(
    metrics.surface.right,
    `${label}: module surface clipped by viewport right`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + TOLERANCE);
}

test.describe("dashboard workspace layout polish — smoke (PR-2)", () => {
  test("clinic /dashboard opens the default operaciones workspace via the shared rail (no hub)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    // No hub: the shared module rail and the default operaciones workspace load
    // directly; the legacy module-hub markup must be absent.
    await expect(
      page.locator('[data-dashboard-module-rail="true"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toHaveCount(0);
  });

  test("clinic /dashboard?module=operaciones renders workspace with enter class", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    await expect(workspace).toHaveClass(/dashboard-workspace-enter/);
  });

  test("admin /dashboard/admin loads module hub", async ({ page }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin");
    await expect(
      page.locator('[data-dashboard-module-hub="true"]'),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin /dashboard/admin?module=admin-clinics renders workspace with enter class", async ({
    page,
  }) => {
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-clinics"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    await expect(workspace).toHaveClass(/dashboard-workspace-enter/);
  });

  test("/dashboard/informes layout loads", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard/informes");
    await expect(page.locator("main.dashboard-main")).toBeVisible({
      timeout: 8_000,
    });
    await expect(
      page.getByRole("region", { name: "Lista de informes" }),
    ).toBeVisible({ timeout: 8_000 });
    // Inline master-detail: the detail expands inside the selected report row,
    // so there is no standalone "Detalle del informe" region without a selection.
    await expect(page.locator("#report-detail")).toHaveCount(0);
  });

  test("admin workspace Volver button keeps dashboard-btn-interactive (PR-1 contract preserved)", async ({
    page,
  }) => {
    // The clinic workspace no longer exposes a "Vista general" control — module
    // navigation is owned by the shared rail. The admin hub still uses the back
    // button, so the PR-1 interaction contract is asserted there.
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-clinics"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    const volverBtn = workspace.locator('button[aria-label="Vista general"]');
    await expect(volverBtn).toBeVisible();
    await expect(volverBtn).toHaveClass(/dashboard-btn-interactive/);
  });

  test("clinic workspace no longer exposes a Vista general control (rail owns nav)", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    await expect(
      workspace.locator('button[aria-label="Vista general"]'),
    ).toHaveCount(0);
  });

  test("reduced-motion: workspace still visible with prefers-reduced-motion: reduce", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    const workspace = page.locator(
      '[data-dashboard-module-workspace="operaciones"]',
    );
    await expect(workspace).toBeVisible({ timeout: 8_000 });
    await expect(workspace).toHaveClass(/dashboard-workspace-enter/);
  });

  test("no global scroll: shell keeps h-dvh overflow-hidden layout", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
    );
    expect(overflow).toBeLessThanOrEqual(5);
  });
});

for (const viewport of FRAME_VIEWPORTS) {
  test.describe(`dashboard frame inset parity — ${viewport.name}`, () => {
    for (const routeCase of FRAME_ROUTES) {
      test(`${routeCase.label} keeps contained frame`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await applySession(page, routeCase.surface);
        await page.goto(routeCase.path);
        await expect(page.locator(routeCase.ready).first()).toBeVisible({
          timeout: 12_000,
        });

        await expect(async () => {
          const metrics = await readFrameFitMetrics(page);
          assertDashboardFrameFit(
            metrics,
            `${viewport.name} ${routeCase.label}`,
          );
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}
