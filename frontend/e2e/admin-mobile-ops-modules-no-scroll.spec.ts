import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const MOCK_SESSIONS = Array.from({ length: 9 }, (_, index) => ({
  sessionType: (["admin", "clinic", "particular"] as const)[index % 3],
  sessionId: 8100 + index,
  actorType: (["admin_user", "clinic_user", "particular_token"] as const)[
    index % 3
  ],
  actorId: 310 + index,
  createdAt: "2026-06-15T09:00:00.000Z",
  lastAccess: "2026-06-19T18:45:00.000Z",
  expiresAt: "2026-06-30T09:00:00.000Z",
  status: index % 4 === 0 ? ("expired" as const) : ("active" as const),
}));

const MOCK_USERS = Array.from({ length: 9 }, (_, index) => {
  if (index === 0) {
    return {
      userType: "admin" as const,
      userId: 41,
      username: "admin_operaciones",
      role: "admin" as const,
      clinicId: null,
      clinicName: null,
      createdAt: "2026-01-10T10:00:00.000Z",
      updatedAt: "2026-06-18T12:00:00.000Z",
    };
  }

  return {
    userType: "clinic" as const,
    userId: 9100 + index,
    username: `usuario_clinica_${index}`,
    role: index % 2 === 0 ? ("clinic_owner" as const) : ("clinic_staff" as const),
    clinicId: 120 + index,
    clinicName: `Clínica Operativa ${index}`,
    clinicLocality: "Buenos Aires",
    createdAt: "2026-02-10T10:00:00.000Z",
    updatedAt: "2026-06-18T12:00:00.000Z",
  };
});

type OpsModule = {
  key: "audit" | "sessions" | "users";
  moduleId: "audit-log" | "admin-sessions" | "admin-users-roles";
  pagerName: RegExp;
  primaryActionName: RegExp;
};

const OPS_MODULES: OpsModule[] = [
  {
    key: "audit",
    moduleId: "audit-log",
    pagerName: /paginación de auditoría/i,
    primaryActionName: /filtros/i,
  },
  {
    key: "sessions",
    moduleId: "admin-sessions",
    pagerName: /paginación de sesiones/i,
    primaryActionName: /actualizar/i,
  },
  {
    key: "users",
    moduleId: "admin-users-roles",
    pagerName: /paginación de usuarios/i,
    primaryActionName: /actualizar/i,
  },
];

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

function fulfillJson(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockOpsApis(page: Page) {
  await page.route("**/api/admin/sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/api/admin/sessions") {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "8");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await fulfillJson(route, {
      success: true,
      sessions: MOCK_SESSIONS.slice(offset, offset + limit),
      total: MOCK_SESSIONS.length,
      limit,
      offset,
      currentAdminSessionId: 8100,
    });
  });

  await page.route("**/api/admin/users-roles**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/api/admin/users-roles") {
      await route.fallback();
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "9");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    await fulfillJson(route, {
      success: true,
      users: MOCK_USERS.slice(offset, offset + limit),
      total: MOCK_USERS.length,
      limit,
      offset,
      totals: { adminUsers: 1, clinicUsers: 8 },
    });
  });
}

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function openModuleFromMobileNavigation(page: Page, module: OpsModule) {
  await page.goto("/dashboard/admin");
  await suppressNextDevIndicator(page);

  const bottomNav = page.locator('[data-admin-mobile-bottom-nav="true"]');
  await expect(bottomNav).toBeVisible({ timeout: 15_000 });

  if (module.key === "audit") {
    await bottomNav.getByRole("button", { name: "Auditoría", exact: true }).click();
  } else if (module.key === "sessions") {
    await bottomNav.getByRole("button", { name: "Sesiones", exact: true }).click();
  } else {
    await bottomNav.getByRole("button", { name: "Más", exact: true }).click();
    const menu = page.locator('[data-admin-mobile-module-menu="true"]');
    await expect(menu).toBeVisible();
    await menu
      .getByRole("button", { name: "Página siguiente de módulos", exact: true })
      .click();
    await menu
      .locator('[data-admin-mobile-module-link="true"]')
      .filter({ hasText: "Usuarios" })
      .click();
  }

  await expect(
    page.locator(`[data-dashboard-module-workspace="${module.moduleId}"]`),
  ).toBeVisible({ timeout: 15_000 });
}

type NoScrollContract = {
  html: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  body: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  module: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  forbiddenOverflow: Array<{
    tag: string;
    className: string;
    overflowX: string;
    overflowY: string;
  }>;
};

async function readNoScrollContract(page: Page, selector: string): Promise<NoScrollContract> {
  return page.evaluate((moduleSelector) => {
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const moduleRoot = document.querySelector<HTMLElement>(moduleSelector);

    if (!moduleRoot) throw new Error(`Missing module root: ${moduleSelector}`);

    const candidates = [
      document.documentElement,
      document.body,
      ...(shell ? [shell] : []),
      ...(main ? [main] : []),
      moduleRoot,
      ...Array.from(moduleRoot.querySelectorAll<HTMLElement>("*")),
    ];

    const forbiddenOverflow = candidates.flatMap((element) => {
      const style = window.getComputedStyle(element);
      if (
        !["auto", "scroll"].includes(style.overflowX) &&
        !["auto", "scroll"].includes(style.overflowY)
      ) {
        return [];
      }

      return [
        {
          tag: element.tagName,
          className: element.className,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        },
      ];
    });

    const metrics = (element: HTMLElement) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    });

    return {
      html: metrics(document.documentElement),
      body: metrics(document.body),
      module: metrics(moduleRoot),
      forbiddenOverflow,
    };
  }, selector);
}

function assertNoScrollContract(contract: NoScrollContract, label: string) {
  for (const [surface, metrics] of Object.entries({
    html: contract.html,
    body: contract.body,
    module: contract.module,
  })) {
    expect(
      metrics.scrollHeight,
      `${label}: ${surface} vertical clipping/overflow`,
    ).toBeLessThanOrEqual(metrics.clientHeight + TOLERANCE);
    expect(
      metrics.scrollWidth,
      `${label}: ${surface} horizontal clipping/overflow`,
    ).toBeLessThanOrEqual(metrics.clientWidth + TOLERANCE);
  }

  expect(contract.forbiddenOverflow, `${label}: overflow auto/scroll`).toEqual([]);
}

async function expectInsideViewport(
  locator: Locator,
  viewport: { width: number; height: number },
  label: string,
) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(box!.x, `${label}: left`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.y, `${label}: top`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right`).toBeLessThanOrEqual(
    viewport.width + TOLERANCE,
  );
  expect(box!.y + box!.height, `${label}: bottom`).toBeLessThanOrEqual(
    viewport.height + TOLERANCE,
  );
}

for (const moduleSpec of OPS_MODULES) {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`Admin mobile ops ${moduleSpec.key} is absolute no-scroll at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setPopulatedAdminSession(page);
      await mockOpsApis(page);
      await openModuleFromMobileNavigation(page, moduleSpec);

      await expect(page.locator('[data-admin-mobile-app-bar="true"]')).toBeVisible();
      await expect(page.locator('[data-admin-mobile-bottom-nav="true"]')).toBeVisible();
      await expect(page.locator('[data-dashboard-horizontal-nav-shell="true"]')).toBeHidden();

      const moduleSelector = `[data-admin-mobile-ops-module="${moduleSpec.key}"]`;
      const moduleRoot = page.locator(moduleSelector);
      await expect(moduleRoot).toBeVisible({ timeout: 15_000 });

      const items = moduleRoot.locator('[data-admin-mobile-ops-item="true"]');
      await expect(items.first()).toBeVisible({ timeout: 15_000 });
      const itemCount = await items.count();
      expect(itemCount).toBeGreaterThan(0);
      expect(itemCount).toBeLessThanOrEqual(4);

      for (let index = 0; index < itemCount; index += 1) {
        await expectInsideViewport(
          items.nth(index),
          viewport,
          `${viewport.name} ${moduleSpec.key} item ${index + 1}`,
        );
      }

      const pager = moduleRoot.getByRole("navigation", { name: moduleSpec.pagerName });
      await expectInsideViewport(pager, viewport, `${viewport.name} ${moduleSpec.key} pager`);

      const primaryAction = moduleRoot.getByRole("button", {
        name: moduleSpec.primaryActionName,
      }).first();
      await expectInsideViewport(
        primaryAction,
        viewport,
        `${viewport.name} ${moduleSpec.key} primary action`,
      );

      const pageOneLabels = await items.allTextContents();
      const nextButton = pager.getByRole("button", { name: /siguiente/i });
      await expect(nextButton).toBeEnabled();
      await nextButton.click();
      await expect
        .poll(async () => (await items.allTextContents()).join("|"))
        .not.toBe(pageOneLabels.join("|"));

      assertNoScrollContract(
        await readNoScrollContract(page, moduleSelector),
        `${viewport.name} ${moduleSpec.key} page 2`,
      );
      await expectInsideViewport(pager, viewport, `${viewport.name} ${moduleSpec.key} page 2 pager`);

      await primaryAction.click();
      if (moduleSpec.key === "audit") {
        const dialog = page.getByRole("dialog", { name: "Filtrar auditoría" });
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      } else {
        await expect(primaryAction).toBeEnabled();
      }

      assertNoScrollContract(
        await readNoScrollContract(page, moduleSelector),
        `${viewport.name} ${moduleSpec.key} action`,
      );

      await page
        .locator('[data-admin-mobile-bottom-nav="true"]')
        .getByRole("button", { name: "Inicio", exact: true })
        .click();
      await expect(page.locator('[data-admin-mobile-hub-launcher="true"]')).toBeVisible({
        timeout: 15_000,
      });
    });
  }
}

for (const moduleSpec of OPS_MODULES) {
  test(`Admin desktop preserves ${moduleSpec.key} layout at 1280x800`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setPopulatedAdminSession(page);
    await mockOpsApis(page);
    await page.goto(`/dashboard/admin?module=${moduleSpec.moduleId}`);

    await expect(page.locator('[data-dashboard-horizontal-nav-shell="true"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-admin-mobile-bottom-nav="true"]')).toBeHidden();
    await expect(
      page.locator(`[data-dashboard-module-workspace="${moduleSpec.moduleId}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-admin-mobile-ops-module="${moduleSpec.key}"]`),
    ).toBeHidden();
  });
}
