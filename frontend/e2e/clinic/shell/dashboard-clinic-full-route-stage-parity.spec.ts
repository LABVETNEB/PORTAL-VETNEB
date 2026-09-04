import { expect, test, type Browser, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
] as const;

const FULL_ROUTES = [
  { id: "informes-full", route: "/dashboard/informes" },
  { id: "logistica-full", route: "/dashboard/logistica" },
  { id: "logistica-visitas", route: "/dashboard/logistica/visitas" },
  { id: "logistica-rutas", route: "/dashboard/logistica/rutas" },
  { id: "logistica-metricas", route: "/dashboard/logistica/metricas" },
] as const;

type FrameMetric = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly bottomGap: number;
};

type SurfaceContract = {
  readonly stage: FrameMetric;
  readonly workspace: FrameMetric;
  readonly viewport: FrameMetric;
  readonly card: FrameMetric;
  readonly header: FrameMetric | null;
  readonly metrics: FrameMetric | null;
  readonly body: FrameMetric | null;
  readonly footer: FrameMetric | null;
  readonly surfaceCount: number;
  readonly directSurfaceCount: number;
  readonly display: string;
  readonly minHeight: string;
  readonly borderTopWidth: string;
  readonly borderTopLeftRadius: string;
  readonly backgroundColor: string;
  readonly overflowX: string;
  readonly overflowY: string;
  readonly pageScrollsX: boolean;
  readonly pageScrollsY: boolean;
};

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    { name: "app_session_id", value: "e2e_test_clinic_session", url: "http://127.0.0.1:3000" },
  ]);
}

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    { name: "admin_session_id", value: "e2e_test_admin_session", url: "http://127.0.0.1:3000" },
  ]);
}

async function openClinicRoute(page: Page, route: string, moduleId: string) {
  await page.goto(route);
  await expect(
    page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
  ).toBeVisible({ timeout: 15_000 });
}

async function readSurfaceContract(page: Page, moduleId: string): Promise<SurfaceContract> {
  return page.evaluate((id) => {
    const frame = (element: Element | null): FrameMetric | null => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        bottomGap: window.innerHeight - box.bottom,
      };
    };
    const required = <T extends Element>(selector: string) => {
      const element = document.querySelector<T>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element;
    };
    const stage = required<HTMLElement>('[data-dashboard-module-stage="true"]');
    const workspace = required<HTMLElement>(`[data-dashboard-module-workspace="${id}"]`);
    const viewport = required<HTMLElement>(`[data-dashboard-module-viewport="${id}"]`);
    const cards = Array.from(viewport.querySelectorAll<HTMLElement>(".dashboard-surface")).filter(
      (candidate) => {
        const style = window.getComputedStyle(candidate);
        const box = candidate.getBoundingClientRect();
        return style.display !== "none" && box.width > 0 && box.height > 0;
      },
    );
    const directCards = Array.from(
      viewport.querySelectorAll<HTMLElement>(":scope > section.dashboard-surface"),
    );
    const card = cards[0];
    if (!card) throw new Error(`Missing module card for ${id}`);
    const style = window.getComputedStyle(card);
    const children = Array.from(card.children);
    const namedChild = (selector: string) => children.find((child) => child.matches(selector)) ?? null;
    const contentChild = namedChild("[data-slot='card-content']") ?? children.at(-1) ?? null;
    const documentElement = document.documentElement;
    const body = document.body;

    return {
      stage: frame(stage)!,
      workspace: frame(workspace)!,
      viewport: frame(viewport)!,
      card: frame(card)!,
      header: frame(namedChild("[data-slot='card-header']") ?? children[0] ?? null),
      metrics: frame(card.querySelector("[data-dashboard-b14-metrics]")),
      body: frame(contentChild),
      footer: frame(namedChild("[data-slot='card-footer']")),
      surfaceCount: cards.length,
      directSurfaceCount: directCards.length,
      display: style.display,
      minHeight: style.minHeight,
      borderTopWidth: style.borderTopWidth,
      borderTopLeftRadius: style.borderTopLeftRadius,
      backgroundColor: style.backgroundColor,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      pageScrollsX: documentElement.scrollWidth > documentElement.clientWidth || body.scrollWidth > body.clientWidth,
      pageScrollsY: documentElement.scrollHeight > documentElement.clientHeight || body.scrollHeight > body.clientHeight,
    };
  }, moduleId);
}

function expectFrameParity(actual: FrameMetric, reference: FrameMetric, label: string) {
  for (const key of ["x", "y", "width", "height", "bottomGap"] as const) {
    expect(actual[key], `${label}: ${key} parity with Admin runtime`).toBeCloseTo(reference[key], 0);
  }
}

async function readAdminReference(browser: Browser, viewport: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    await setAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-sessions");
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-sessions"]'),
    ).toBeVisible({ timeout: 15_000 });
    return await readSurfaceContract(page, "admin-sessions");
  } finally {
    await context.close();
  }
}

for (const viewport of VIEWPORTS) {
  for (const fullRoute of FULL_ROUTES) {
    test(`CMP-06 · ${fullRoute.id} uses the Admin module frame at ${viewport.name}`, async ({
      browser,
    }) => {
      const admin = await readAdminReference(browser, viewport);
      const clinicContext = await browser.newContext({ viewport });
      const clinicPage = await clinicContext.newPage();

      try {
        await setClinicSession(clinicPage);
        await openClinicRoute(clinicPage, fullRoute.route, fullRoute.id);
        const clinic = await readSurfaceContract(clinicPage, fullRoute.id);

        expect(clinic.surfaceCount, `${fullRoute.id}: exactly one outer module card`).toBe(1);
        expect(
          clinic.directSurfaceCount,
          `${fullRoute.id}: module card is the viewport's direct child`,
        ).toBe(1);
        expectFrameParity(clinic.stage, admin.stage, `${fullRoute.id}: stage`);
        expectFrameParity(clinic.workspace, admin.workspace, `${fullRoute.id}: workspace`);
        expectFrameParity(clinic.viewport, admin.viewport, `${fullRoute.id}: viewport`);
        expectFrameParity(clinic.card, admin.card, `${fullRoute.id}: module card`);

        for (const metric of [clinic.header, clinic.metrics, clinic.body]) {
          expect(metric, `${fullRoute.id}: header, metric run and body are measurable`).not.toBeNull();
          expect(metric!.width, `${fullRoute.id}: measured child width`).toBeGreaterThan(0);
          expect(metric!.height, `${fullRoute.id}: measured child height`).toBeGreaterThan(0);
        }
        if (clinic.footer) {
          expect(clinic.footer.width, `${fullRoute.id}: measured footer width`).toBeGreaterThan(0);
        }

        expect(clinic.display, `${fullRoute.id}: card display`).toBe(admin.display);
        expect(clinic.minHeight, `${fullRoute.id}: card min-height`).toBe(admin.minHeight);
        expect(clinic.borderTopWidth, `${fullRoute.id}: canonical border`).toBe(admin.borderTopWidth);
        expect(clinic.borderTopLeftRadius, `${fullRoute.id}: canonical radius`).toBe(admin.borderTopLeftRadius);
        expect(clinic.backgroundColor, `${fullRoute.id}: canonical color`).toBe(admin.backgroundColor);
        expect(clinic.overflowX, `${fullRoute.id}: card owns horizontal clipping`).toBe("hidden");
        expect(clinic.overflowY, `${fullRoute.id}: card owns vertical clipping`).toBe("hidden");
        expect(clinic.pageScrollsX, `${fullRoute.id}: no page horizontal overflow`).toBe(false);
        expect(clinic.pageScrollsY, `${fullRoute.id}: no page vertical overflow`).toBe(false);
      } finally {
        await clinicContext.close();
      }
    });
  }
}
