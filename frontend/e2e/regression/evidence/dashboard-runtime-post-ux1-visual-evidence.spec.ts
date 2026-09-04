import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const TOLERANCE = 2;

const VIEWPORTS = [
  {
    name: "Android 360x740",
    slug: "android-360x740",
    width: 360,
    height: 740,
  },
  {
    name: "iPhone 390x844",
    slug: "iphone-390x844",
    width: 390,
    height: 844,
  },
  {
    name: "iPhone Pro Max 430x932",
    slug: "iphone-pro-max-430x932",
    width: 430,
    height: 932,
  },
  {
    name: "Desktop 1366x768",
    slug: "desktop-1366x768",
    width: 1366,
    height: 768,
  },
] as const;

const PROFILE_TABS = [
  { id: "estado", label: "Estado", slug: "estado" },
  { id: "datos", label: "Datos", slug: "datos" },
  { id: "contacto", label: "Contacto", slug: "contacto" },
  { id: "contenido", label: "Contenido", slug: "contenido" },
  {
    id: "cambiar-contrasena",
    label: "Cambiar contraseña",
    slug: "cambiar-contrasena",
  },
] as const;

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type VisualMetrics = {
  viewport: string;
  tab: string;
  html: {
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
  };
  body: {
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
  };
  main: {
    scrollHeight: number;
    clientHeight: number;
  } | null;
  tablist: {
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
    rows: number;
    bounds: Bounds | null;
  };
  activePanel: {
    id: string | null;
    scrollHeight: number;
    clientHeight: number;
    bounds: Bounds | null;
  };
  tabs: Array<{
    label: string;
    selected: boolean;
    bounds: Bounds | null;
  }>;
  criticalControls: Array<{
    label: string;
    bounds: Bounds | null;
    insideViewport: boolean;
  }>;
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

async function mockClinicProfile(page: Page) {
  await page.route("**/api/clinic/profile**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        profile: {
          clinicId: 1,
          displayName: "Clinica Perfil Runtime Evidence",
          specialtyText: "Anatomia patologica veterinaria especializada",
          servicesText:
            "Citologia, histopatologia, inmunohistoquimica y diagnostico integral veterinario.",
          aboutText:
            "Perfil institucional denso para auditar el dashboard Clinica post UX1.",
          email: "perfil-runtime@example.test",
          phone: "+54 11 5555-1234",
          publicAddress:
            "Avenida Veterinaria 1234, Ciudad Autonoma de Buenos Aires",
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
      }),
    });
  });
}

async function suppressDevChrome(page: Page) {
  await page.addStyleTag({
    content: `
      #nextjs-portal,
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-toast-wrapper],
      .__next-dev-overlay {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  });
}

function expectBoundsInsideViewport(
  bounds: Bounds | null,
  viewport: (typeof VIEWPORTS)[number],
  label: string,
) {
  expect(bounds, `${label}: bounds`).not.toBeNull();
  expect(bounds!.x, `${label}: left cut`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(bounds!.y, `${label}: top cut`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(bounds!.right, `${label}: right cut`).toBeLessThanOrEqual(
    viewport.width + TOLERANCE,
  );
  expect(bounds!.bottom, `${label}: bottom cut`).toBeLessThanOrEqual(
    viewport.height + TOLERANCE,
  );
}

function expectNoGlobalScroll(metrics: VisualMetrics, label: string) {
  expect(metrics.html.scrollWidth, `${label}: html horizontal scroll`).toBeLessThanOrEqual(
    metrics.html.clientWidth + TOLERANCE,
  );
  expect(metrics.body.scrollWidth, `${label}: body horizontal scroll`).toBeLessThanOrEqual(
    metrics.body.clientWidth + TOLERANCE,
  );
  expect(metrics.html.scrollHeight, `${label}: html vertical scroll`).toBeLessThanOrEqual(
    metrics.html.clientHeight + TOLERANCE,
  );
  expect(metrics.body.scrollHeight, `${label}: body vertical scroll`).toBeLessThanOrEqual(
    metrics.body.clientHeight + TOLERANCE,
  );
  expect(metrics.main, `${label}: dashboard main`).not.toBeNull();
  expect(metrics.main!.scrollHeight, `${label}: main vertical scroll`).toBeLessThanOrEqual(
    metrics.main!.clientHeight + TOLERANCE,
  );
}

async function captureScreen(page: Page, testInfo: TestInfo, fileName: string) {
  await page.screenshot({
    path: testInfo.outputPath(fileName),
    animations: "disabled",
    fullPage: false,
  });
}

async function writeMetrics(testInfo: TestInfo, metrics: VisualMetrics[]) {
  await writeFile(
    testInfo.outputPath("dashboard-runtime-post-ux1-metrics.json"),
    `${JSON.stringify(metrics, null, 2)}\n`,
    "utf8",
  );
}

async function collectMetrics(
  page: Page,
  viewport: (typeof VIEWPORTS)[number],
  tab: (typeof PROFILE_TABS)[number],
) {
  return page.evaluate(
    ({ tabId, viewportName, tabLabel, tabLabels }) => {
      function toBounds(element: Element | null) {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        };
      }

      function isInsideViewport(bounds: Bounds | null) {
        return (
          bounds !== null &&
          bounds.x >= -2 &&
          bounds.y >= -2 &&
          bounds.right <= window.innerWidth + 2 &&
          bounds.bottom <= window.innerHeight + 2
        );
      }

      function controlMetric(label: string, selector: string) {
        const bounds = toBounds(document.querySelector(selector));
        return {
          label,
          bounds,
          insideViewport: isInsideViewport(bounds),
        };
      }

      const main = document.querySelector<HTMLElement>("main.dashboard-main");
      const tablist = document.querySelector<HTMLElement>(
        '[data-clinic-profile-editor="true"] .dashboard-module-card-chips',
      );
      const tabButtons = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-clinic-profile-editor="true"] [role="tab"]',
        ),
      );
      const tabRows = new Set(
        tabButtons.map((button) => Math.round(button.getBoundingClientRect().y)),
      );
      const activePanel = document.querySelector<HTMLElement>(
        `[data-clinic-profile-panel="${tabId}"]`,
      );
      const criticalControls =
        tabId === "cambiar-contrasena"
          ? [
              controlMetric(
                "Contraseña actual",
                '#clinic-password-change input[name="currentPassword"]',
              ),
              controlMetric(
                "Nueva contraseña",
                '#clinic-password-change input[name="newPassword"]',
              ),
              controlMetric(
                "Confirmar nueva contraseña",
                '#clinic-password-change input[name="confirmPassword"]',
              ),
              controlMetric(
                "Actualizar contraseña",
                '#clinic-password-change button[type="submit"]',
              ),
            ]
          : [
              controlMetric(
                "Guardar perfil público",
                'button[form="clinic-public-profile-form"]',
              ),
            ];

      return {
        viewport: viewportName,
        tab: tabLabel,
        html: {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
        },
        body: {
          scrollWidth: document.body.scrollWidth,
          clientWidth: document.body.clientWidth,
          scrollHeight: document.body.scrollHeight,
          clientHeight: document.body.clientHeight,
        },
        main: main
          ? {
              scrollHeight: main.scrollHeight,
              clientHeight: main.clientHeight,
            }
          : null,
        tablist: tablist
          ? {
              scrollWidth: tablist.scrollWidth,
              clientWidth: tablist.clientWidth,
              scrollHeight: tablist.scrollHeight,
              clientHeight: tablist.clientHeight,
              rows: tabRows.size,
              bounds: toBounds(tablist),
            }
          : {
              scrollWidth: 0,
              clientWidth: 0,
              scrollHeight: 0,
              clientHeight: 0,
              rows: 0,
              bounds: null,
        },
        activePanel: {
          id: activePanel?.getAttribute("data-clinic-profile-panel") ?? null,
          scrollHeight: activePanel?.scrollHeight ?? 0,
          clientHeight: activePanel?.clientHeight ?? 0,
          bounds: toBounds(activePanel),
        },
        tabs: tabLabels.map((label) => {
          const button =
            tabButtons.find(
              (candidate) => candidate.textContent?.trim() === label,
            ) ?? null;
          return {
            label,
            selected: button?.getAttribute("aria-selected") === "true",
            bounds: toBounds(button),
          };
        }),
        criticalControls,
      } satisfies VisualMetrics;
    },
    {
      tabId: tab.id,
      viewportName: viewport.name,
      tabLabel: tab.label,
      tabLabels: PROFILE_TABS.map((profileTab) => profileTab.label),
    },
  );
}

test("clinic profile runtime visual evidence after UX1", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  const allMetrics: VisualMetrics[] = [];
  await mockClinicProfile(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await setClinicSession(page);
    await page.goto("/dashboard?module=perfil");
    await suppressDevChrome(page);

    const workspace = page.locator('[data-dashboard-module-workspace="perfil"]');
    await expect(workspace).toBeVisible({ timeout: 12_000 });
    await expect(page.locator("#clinic-public-profile")).toBeVisible();
    await expect(workspace.getByText("Acceso | Perfil público")).toHaveCount(0);
    await expect(
      workspace.getByRole("tab", { name: "Acceso", exact: true }),
    ).toHaveCount(0);
    await expect(
      workspace.getByRole("tab", { name: "Perfil público", exact: true }),
    ).toHaveCount(0);

    const editor = page.locator('[data-clinic-profile-editor="true"]');
    await expect(editor).toBeVisible();

    for (const profileTab of PROFILE_TABS) {
      await expect(
        editor.getByRole("tab", { name: profileTab.label, exact: true }),
      ).toBeVisible();
    }
    await expect(
      editor.getByRole("tab", { name: "Acceso", exact: true }),
    ).toHaveCount(0);

    for (const profileTab of PROFILE_TABS) {
      await editor
        .getByRole("tab", { name: profileTab.label, exact: true })
        .click();
      await expect(
        editor.locator(`[data-clinic-profile-panel="${profileTab.id}"]`),
      ).toBeVisible();

      if (profileTab.id === "cambiar-contrasena") {
        const passwordPanel = editor.locator("#clinic-password-change");
        await expect(passwordPanel).toBeVisible();
        await expect(
          passwordPanel.locator('input[name="currentPassword"]'),
        ).toBeVisible();
        await expect(
          passwordPanel.locator('input[name="newPassword"]'),
        ).toBeVisible();
        await expect(
          passwordPanel.locator('input[name="confirmPassword"]'),
        ).toBeVisible();
        await expect(
          passwordPanel.getByRole("button", {
            name: "Actualizar contraseña",
            exact: true,
          }),
        ).toBeVisible();
      } else {
        await expect(
          editor.locator('[data-clinic-profile-fields="true"]'),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: "Guardar perfil público",
            exact: true,
          }),
        ).toBeVisible();
      }

      const metrics = await collectMetrics(page, viewport, profileTab);
      expectNoGlobalScroll(metrics, `${viewport.name} ${profileTab.label}`);
      expect(metrics.tablist.scrollWidth).toBeLessThanOrEqual(
        metrics.tablist.clientWidth + TOLERANCE,
      );
      expectBoundsInsideViewport(
        metrics.tablist.bounds,
        viewport,
        `${viewport.name} ${profileTab.label}: tablist`,
      );
      expectBoundsInsideViewport(
        metrics.activePanel.bounds,
        viewport,
        `${viewport.name} ${profileTab.label}: active panel`,
      );
      if (profileTab.id === "cambiar-contrasena") {
        expect(metrics.activePanel.scrollHeight).toBeLessThanOrEqual(
          metrics.activePanel.clientHeight + TOLERANCE,
        );
        for (const controlMetric of metrics.criticalControls) {
          expect(
            controlMetric.insideViewport,
            `${viewport.name} ${profileTab.label}: ${controlMetric.label} inside viewport`,
          ).toBe(true);
          expectBoundsInsideViewport(
            controlMetric.bounds,
            viewport,
            `${viewport.name} ${profileTab.label}: ${controlMetric.label}`,
          );
        }
      }
      for (const tabMetric of metrics.tabs) {
        expectBoundsInsideViewport(
          tabMetric.bounds,
          viewport,
          `${viewport.name} ${profileTab.label}: tab ${tabMetric.label}`,
        );
      }

      await captureScreen(
        page,
        testInfo,
        `clinic-profile-${viewport.slug}-${profileTab.slug}.png`,
      );
      allMetrics.push(metrics);
    }
  }

  await writeMetrics(testInfo, allMetrics);
});
