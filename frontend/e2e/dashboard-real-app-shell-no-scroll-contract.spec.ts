import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;
type Route = import("@playwright/test").Route;
type TestInfo = import("@playwright/test").TestInfo;

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
] as const;

type Surface = "clinic" | "admin";

type RouteCase = {
  label: string;
  surface: Surface;
  path: string;
  ready: string;
  populated?: string | RegExp;
  populatedAdminModule?: PopulatedAdminModule;
};

type PopulatedAdminModule =
  | "overview"
  | "tokens"
  | "reports"
  | "audit"
  | "users-roles";

const ROUTES: RouteCase[] = [
  {
    label: "clinic hub",
    surface: "clinic",
    path: "/dashboard",
    ready: '[data-dashboard-module-hub="true"]',
  },
  {
    label: "clinic operaciones",
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
    label: "clinic logistica",
    surface: "clinic",
    path: "/dashboard?module=logistica",
    ready: '[data-dashboard-module-workspace="logistica"]',
  },
  {
    label: "clinic perfil",
    surface: "clinic",
    path: "/dashboard?module=perfil",
    ready: '[data-dashboard-module-workspace="perfil"]',
  },
  {
    label: "admin hub",
    surface: "admin",
    path: "/dashboard/admin",
    ready: '[data-dashboard-module-hub="true"]',
  },
  {
    label: "admin overview populated",
    surface: "admin",
    path: "/dashboard/admin?module=admin",
    ready: '[data-dashboard-module-workspace="admin"]',
    populatedAdminModule: "overview",
  },
  {
    label: "admin clinics populated",
    surface: "admin",
    path: "/dashboard/admin?module=admin-clinics",
    ready: '[data-dashboard-module-workspace="admin-clinics"]',
    populated: "Clinica Veterinaria de Prueba Numero 1",
  },
  {
    label: "admin tokens populated",
    surface: "admin",
    path: "/dashboard/admin?module=admin-particular-tokens",
    ready: '[data-dashboard-module-workspace="admin-particular-tokens"]',
    populatedAdminModule: "tokens",
  },
  {
    label: "admin reports populated",
    surface: "admin",
    path: "/dashboard/admin?module=admin-report-upload",
    ready: '[data-dashboard-module-workspace="admin-report-upload"]',
    populatedAdminModule: "reports",
  },
  {
    label: "admin audit populated",
    surface: "admin",
    path: "/dashboard/admin?module=audit-log",
    ready: '[data-dashboard-module-workspace="audit-log"]',
    populatedAdminModule: "audit",
  },
  {
    label: "admin users and roles populated",
    surface: "admin",
    path: "/dashboard/admin?module=admin-users-roles",
    ready: '[data-dashboard-module-workspace="admin-users-roles"]',
    populatedAdminModule: "users-roles",
  },
  {
    label: "admin pricing populated",
    surface: "admin",
    path: "/dashboard/admin?module=admin-pricing",
    ready: '[data-dashboard-module-workspace="admin-pricing"]',
    populated: "Histopatologia",
  },
  {
    label: "admin sessions populated",
    surface: "admin",
    path: "/dashboard/admin?module=admin-sessions",
    ready: '[data-dashboard-module-workspace="admin-sessions"]',
    populated: "#5000",
  },
  {
    label: "admin health",
    surface: "admin",
    path: "/dashboard/admin?module=admin-health",
    ready: '[data-dashboard-module-workspace="admin-health"]',
  },
  {
    label: "admin maintenance alias",
    surface: "admin",
    path: "/dashboard/admin?module=maintenance",
    ready: '[data-dashboard-module-workspace="admin-maintenance"]',
  },
  {
    label: "admin upload report alias",
    surface: "admin",
    path: "/dashboard/admin?module=admin-upload-report",
    ready: '[data-dashboard-module-workspace="admin-report-upload"]',
  },
];

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function setAdminSession(page: Page, populated = false) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: populated
        ? "e2e_populated_admin_session"
        : "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function collectHydrationFailures(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return {
    async assertClean() {
      await page.waitForTimeout(500);

      const hydrationConsoleErrors = consoleErrors.filter((message) =>
        /hydration|server rendered html|text content does not match/i.test(message),
      );

      expect(pageErrors).toEqual([]);
      expect(hydrationConsoleErrors).toEqual([]);
    },
  };
}

function collectBrowserFailures(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return {
    async assertClean() {
      await page.waitForTimeout(500);
      const relevantConsoleErrors = consoleErrors.filter(
        (message) =>
          message !==
          "The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.",
      );
      expect(pageErrors).toEqual([]);
      expect(relevantConsoleErrors).toEqual([]);
    },
  };
}

async function expectActiveAdminNavigation(page: Page, label: string) {
  const navigation = page.getByRole("navigation", {
    name: "Navegación principal",
  });
  await expect(
    navigation.getByRole("button", { name: label, exact: true }),
  ).toHaveAttribute("aria-current", "page");
}

async function expectNinePopulatedRows(workspace: ReturnType<Page["locator"]>) {
  const table = workspace.getByRole("table").first();
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(10);
}

async function expectPopulatedAdminModule(
  page: Page,
  module: PopulatedAdminModule,
) {
  if (module === "overview") {
    const workspace = page.locator('[data-dashboard-module-workspace="admin"]');
    await expect(
      workspace.getByRole("heading", { name: "Resumen operativo", exact: true }),
    ).toBeVisible();
    // The Admin overview now ships a mobile-only (md:hidden) variant alongside
    // the desktop command center, so these metric labels exist twice in the DOM.
    // Scope to the visible (desktop) copy at these desktop viewports.
    await expect(
      workspace.getByText("47", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      workspace.getByText("9", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      workspace.getByText("Operativo", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      workspace.getByText("Login admin", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      workspace.getByText("Sin actividad de auditoría disponible."),
    ).toHaveCount(0);
    await expectActiveAdminNavigation(page, "Resumen");
    await expect(page).toHaveURL(/module=admin(?:&|$)/);
    return;
  }

  if (module === "tokens") {
    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-particular-tokens"]',
    );
    await expect(workspace.getByText("****4201", { exact: true })).toBeVisible();
    await expect(workspace.getByText("Mora · Gómez", { exact: true })).toBeVisible();
    await expect(workspace.getByText("Clínica #12", { exact: true })).toBeVisible();
    await expect(workspace.getByText("Activo", { exact: true }).first()).toBeVisible();
    await expect(workspace.getByText("#7301", { exact: true })).toBeVisible();
    await expect(
      workspace.getByText("No hay tokens particulares administrados."),
    ).toHaveCount(0);
    await expectNinePopulatedRows(workspace);
    await expectActiveAdminNavigation(page, "Tokens");
    await expect(page).toHaveURL(/module=admin-particular-tokens(?:&|$)/);
    return;
  }

  if (module === "reports") {
    const workspace = page.locator(
      '[data-dashboard-module-workspace="admin-report-upload"]',
    );
    const table = workspace.getByRole("table");
    await expect(table.getByText("Mora", { exact: true })).toBeVisible();
    await expect(table.getByText("Clínica E2E 01", { exact: true })).toBeVisible();
    await expect(table.getByText("Informe #7301", { exact: true })).toBeVisible();
    await expect(table.getByText("Muestra recibida", { exact: true }).first()).toBeVisible();
    await expect(table.getByText("informe-e2e-7301.pdf", { exact: true })).toBeVisible();
    await expect(
      workspace.getByText("No hay informes en esta página."),
    ).toHaveCount(0);
    await expectNinePopulatedRows(workspace);
    await expectActiveAdminNavigation(page, "Informes");
    await expect(page).toHaveURL(/module=admin-report-upload(?:&|$)/);
    return;
  }

  if (module === "audit") {
    const workspace = page.locator(
      '[data-dashboard-module-workspace="audit-log"]',
    );
    const table = workspace.getByRole("table");
    const firstDataRow = table.getByRole("row").nth(1);
    await expect(firstDataRow.getByText("Admin #41", { exact: true })).toBeVisible();
    await expect(firstDataRow.getByText("Login admin", { exact: true })).toBeVisible();
    await expect(firstDataRow.getByRole("cell").first()).not.toBeEmpty();
    await expect(workspace.getByText("47 coincidencias", { exact: true })).toBeVisible();
    await expect(
      workspace.getByText("No hay eventos de auditoría disponibles."),
    ).toHaveCount(0);
    await expectNinePopulatedRows(workspace);
    await expectActiveAdminNavigation(page, "Auditoría");
    await expect(page).toHaveURL(/module=audit-log(?:&|$)/);
    return;
  }

  const workspace = page.locator(
    '[data-dashboard-module-workspace="admin-users-roles"]',
  );
  const table = workspace.getByRole("table", {
    name: "Tabla de usuarios y roles administrativos",
  });
  await expect(table.getByText("admin_operaciones", { exact: true })).toBeVisible();
  await expect(table.getByText("usuario_clinica_02", { exact: true })).toBeVisible();
  await expect(table.getByText("Clínica E2E 02", { exact: true })).toBeVisible();
  await expect(table.getByText("Owner clínica", { exact: true }).first()).toBeVisible();
  await expect(table.getByText("Staff clínica", { exact: true }).first()).toBeVisible();
  await expect(
    workspace.getByText("No hay usuarios para los filtros seleccionados."),
  ).toHaveCount(0);
  await expectNinePopulatedRows(workspace);
  await expectActiveAdminNavigation(page, "Usuarios");
  await expect(page).toHaveURL(/module=admin-users-roles(?:&|$)/);
}

function denseClinicsSnapshot(limit: number) {
  const usersPerClinic = 3;
  const clinics = Array.from({ length: limit }, (_, i) => {
    const id = i + 1;
    return {
      clinicId: id,
      clinicName: `Clinica Veterinaria de Prueba Numero ${id}`,
      contactEmail: `clinica${id}@example.test`,
      contactPhone: `+54 9 11 5555-${String(1000 + id)}`,
      createdAt: "2026-01-15T10:00:00.000Z",
      updatedAt: "2026-06-10T12:30:00.000Z",
      users: Array.from({ length: usersPerClinic }, (_, userIndex) => ({
        userType: "clinic",
        userId: 1000 + id * 10 + userIndex,
        username: `usuario_clinica_${id}_${userIndex + 1}`,
        role: userIndex === 0 ? "clinic_owner" : "clinic_staff",
        clinicId: id,
        clinicName: `Clinica Veterinaria de Prueba Numero ${id}`,
        createdAt: "2026-01-15T10:00:00.000Z",
        updatedAt: "2026-06-10T12:30:00.000Z",
      })),
    };
  });

  return { success: true, clinics, total: 50, limit, offset: 0 };
}

function denseSessionsSnapshot(limit: number) {
  const sessionTypes = ["admin", "clinic", "particular"] as const;
  const sessions = Array.from({ length: limit }, (_, i) => ({
    sessionType: sessionTypes[i % 3],
    sessionId: 5000 + i,
    actorType:
      i % 3 === 0
        ? "admin_user"
        : i % 3 === 1
          ? "clinic_user"
          : "particular_token",
    actorId: 200 + i,
    createdAt: "2026-06-15T09:00:00.000Z",
    lastAccess: "2026-06-16T18:45:00.000Z",
    expiresAt: "2026-06-30T09:00:00.000Z",
    status: i % 4 === 0 ? "expired" : "active",
  }));

  return {
    success: true,
    sessions,
    total: 60,
    limit,
    offset: 0,
    currentAdminSessionId: 5000,
  };
}

function densePricingSnapshot() {
  const makeItems = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: prefix.length * 100 + i + 1,
      studyName: `Estudio ${prefix} de diagnostico veterinario ${i + 1}`,
      priceLabel: `$${(i + 1) * 1500}`,
      displayOrder: i + 1,
      isActive: i % 5 !== 0,
      updatedAt: "2026-06-12T11:00:00.000Z",
    }));

  return {
    success: true,
    categories: [
      { category: "Citologia", items: makeItems("Citologia", 12) },
      { category: "Histopatologia", items: makeItems("Histopatologia", 15) },
      { category: "Inmunohistoquimica", items: makeItems("IHQ", 9) },
    ],
  };
}

function denseClinicProfileSnapshot() {
  return {
    success: true,
    profile: {
      clinicId: 1,
      displayName: "Clinica Perfil Denso",
      specialtyText: "Anatomia patologica veterinaria",
      servicesText: "Citologia, histopatologia, inmunohistoquimica",
      aboutText: "Perfil institucional con contenido denso para e2e.",
      email: "perfil@example.test",
      phone: "+54 11 5555-1234",
      publicAddress: "Calle Falsa 123",
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
  };
}

function requestedLimit(route: Route, fallback: number): number {
  const value = Number(new URL(route.request().url()).searchParams.get("limit"));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function mockBrowserApis(page: Page) {
  await page.route("**/api/clinic/profile**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return json(route, denseClinicProfileSnapshot());
  });

  await page.route("**/api/admin/clinics**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return json(route, denseClinicsSnapshot(requestedLimit(route, 5)));
  });

  await page.route("**/api/admin/sessions**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return json(route, denseSessionsSnapshot(requestedLimit(route, 3)));
  });

  await page.route("**/api/admin/pricing**", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return json(route, densePricingSnapshot());
  });
}

async function expectPageNoOverflow(
  page: Page,
  testInfo: TestInfo,
  label: string,
  requireModuleContainers = true,
) {
  await expect(async () => {
    const metrics = await measure(page);
    const hasOverflow =
      metrics.documentElement.overflowY > TOLERANCE ||
      metrics.documentElement.overflowX > TOLERANCE ||
      metrics.body.overflowY > TOLERANCE ||
      metrics.body.overflowX > TOLERANCE ||
      metrics.main.overflowY > TOLERANCE ||
      metrics.main.overflowX > TOLERANCE ||
      metrics.workspace.overflowY > TOLERANCE ||
      metrics.workspace.overflowX > TOLERANCE ||
      metrics.viewport.overflowY > TOLERANCE ||
      metrics.viewport.overflowX > TOLERANCE ||
      metrics.surface.overflowY > TOLERANCE ||
      metrics.surface.overflowX > TOLERANCE ||
      metrics.worstInternalScroll.overflowY > TOLERANCE ||
      metrics.worstInternalScroll.overflowX > TOLERANCE;

    if (hasOverflow) {
      await testInfo.attach(`overflow-${label}`, {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });
    }

    expectNoOverflow(metrics.documentElement, true);
    expectNoOverflow(metrics.body, true);
    expectNoOverflow(metrics.main, true);
    expectNoOverflow(metrics.workspace, true);
    expectNoOverflow(metrics.viewport, requireModuleContainers);
    expectNoOverflow(metrics.surface, requireModuleContainers);
    expect(
      metrics.worstInternalScroll.overflowY,
      `internal vertical scroll on ${metrics.worstInternalScroll.selector ?? "none"}`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      metrics.worstInternalScroll.overflowX,
      `internal horizontal scroll on ${metrics.worstInternalScroll.selector ?? "none"}`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }).toPass({ timeout: 10_000 });
}

type ElementMetric = {
  selector: string;
  present: boolean;
  scrollHeight: number;
  clientHeight: number;
  overflowY: number;
  scrollWidth: number;
  clientWidth: number;
  overflowX: number;
};

type Metrics = {
  documentElement: ElementMetric;
  body: ElementMetric;
  main: ElementMetric;
  workspace: ElementMetric;
  viewport: ElementMetric;
  surface: ElementMetric;
  worstInternalScroll: {
    selector: string | null;
    overflowY: number;
    overflowX: number;
  };
};

async function measure(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    function readMetric(selector: string, element: Element | null): ElementMetric {
      const target = element as HTMLElement | null;

      return {
        selector,
        present: target !== null,
        scrollHeight: target?.scrollHeight ?? 0,
        clientHeight: target?.clientHeight ?? 0,
        overflowY: target ? target.scrollHeight - target.clientHeight : 0,
        scrollWidth: target?.scrollWidth ?? 0,
        clientWidth: target?.clientWidth ?? 0,
        overflowX: target ? target.scrollWidth - target.clientWidth : 0,
      };
    }

    function describeElement(element: HTMLElement) {
      const className =
        typeof element.className === "string"
          ? element.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".")
          : "";
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
        className ? `.${className}` : ""
      }`;
    }

    const main = document.querySelector("main.dashboard-main");
    const workspace = document.querySelector("[data-dashboard-module-workspace]");
    const hub = document.querySelector("[data-dashboard-module-hub='true']");
    const workspaceOrHub = workspace ?? hub;
    const viewport = document.querySelector("[data-dashboard-module-viewport]");
    const surface = document.querySelector(
      "[data-dashboard-module-surface='true'], [data-module-tabs='true'], .dashboard-surface",
    );
    const worstInternalScroll = {
      selector: null as string | null,
      overflowY: 0,
      overflowX: 0,
    };

    document.querySelectorAll<HTMLElement>("main.dashboard-main *").forEach((el) => {
      const style = window.getComputedStyle(el);
      const overflowY =
        style.overflowY === "auto" || style.overflowY === "scroll"
          ? el.scrollHeight - el.clientHeight
          : 0;
      const overflowX =
        style.overflowX === "auto" || style.overflowX === "scroll"
          ? el.scrollWidth - el.clientWidth
          : 0;

      if (
        overflowY > worstInternalScroll.overflowY ||
        overflowX > worstInternalScroll.overflowX
      ) {
        worstInternalScroll.selector = describeElement(el);
        worstInternalScroll.overflowY = overflowY;
        worstInternalScroll.overflowX = overflowX;
      }
    });

    return {
      documentElement: readMetric("document.documentElement", document.documentElement),
      body: readMetric("document.body", document.body),
      main: readMetric("main.dashboard-main", main),
      workspace: readMetric(
        "[data-dashboard-module-workspace] or [data-dashboard-module-hub]",
        workspaceOrHub,
      ),
      viewport: readMetric("[data-dashboard-module-viewport]", viewport),
      surface: readMetric(
        "[data-dashboard-module-surface], [data-module-tabs], .dashboard-surface",
        surface,
      ),
      worstInternalScroll,
    };
  });
}

function expectNoOverflow(metric: ElementMetric, requirePresent: boolean) {
  if (requirePresent) {
    expect(metric.present, `${metric.selector} present`).toBe(true);
  }

  if (!metric.present) return;

  expect(
    metric.scrollHeight,
    `${metric.selector} vertical scroll`,
  ).toBeLessThanOrEqual(metric.clientHeight + TOLERANCE);
  expect(
    metric.scrollWidth,
    `${metric.selector} horizontal scroll`,
  ).toBeLessThanOrEqual(metric.clientWidth + TOLERANCE);
}

for (const viewport of VIEWPORTS) {
  test.describe(`real App Shell no-scroll contract ${viewport.name}`, () => {
    for (const routeCase of ROUTES) {
      test(`${routeCase.label} fits without external or internal scroll`, async ({
        page,
      }, testInfo) => {
        const browserFailures = routeCase.populatedAdminModule
          ? collectBrowserFailures(page)
          : null;

        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        if (routeCase.surface === "clinic") {
          await setClinicSession(page);
        } else {
          await setAdminSession(page, Boolean(routeCase.populatedAdminModule));
        }

        await mockBrowserApis(page);
        await page.goto(routeCase.path);
        await expect(page.locator(routeCase.ready).first()).toBeVisible({
          timeout: 12_000,
        });

        if (routeCase.populated) {
          await expect(page.getByText(routeCase.populated).first()).toBeVisible({
            timeout: 12_000,
          });
        }

        if (routeCase.populatedAdminModule) {
          await expectPopulatedAdminModule(page, routeCase.populatedAdminModule);
        }

        await expectPageNoOverflow(
          page,
          testInfo,
          `${viewport.name}-${routeCase.label}`,
          routeCase.ready.includes("workspace"),
        );
        await browserFailures?.assertClean();
      });
    }

    test("clinic perfil public profile editor tabs fit without scroll", async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await setClinicSession(page);
      await mockBrowserApis(page);

      await page.goto("/dashboard?module=perfil");
      await expect(
        page.locator('[data-dashboard-module-workspace="perfil"]'),
      ).toBeVisible({ timeout: 12_000 });
      await expect(page.locator("#clinic-public-profile")).toBeVisible({
        timeout: 12_000,
      });

      for (const tabName of ["Estado", "Datos", "Contenido"]) {
        await page.getByRole("tab", { name: tabName }).click();
        await expectPageNoOverflow(
          page,
          testInfo,
          `${viewport.name}-perfil-publico-${tabName}`,
        );
      }
    });
  });
}

test("admin audit mobile filter keeps keyboard interaction hydration-safe", async ({
  page,
}) => {
  const hydrationFailures = collectHydrationFailures(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await setAdminSession(page, true);
  await mockBrowserApis(page);
  await page.goto("/dashboard/admin?module=audit-log");

  await expect(
    page.locator('[data-dashboard-module-workspace="audit-log"]'),
  ).toBeVisible({ timeout: 12_000 });

  const filterTrigger = page.getByRole("button", {
    name: "Filtros",
    exact: true,
  });
  await expect(filterTrigger).toBeVisible();
  await filterTrigger.focus();
  await filterTrigger.press("Enter");

  const filterDialog = page.getByRole("dialog", {
    name: "Filtrar auditoría",
  });
  await expect(filterDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filterDialog).toBeHidden();
  await expect(filterTrigger).toBeFocused();
  await hydrationFailures.assertClean();
});
