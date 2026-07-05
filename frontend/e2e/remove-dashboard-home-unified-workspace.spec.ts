import { expect, test } from "@playwright/test";

// Behavioural contract for "remove dashboard home + unified module workspace":
// the clinic dashboard has NO home/hub of modules; `/dashboard` opens the
// operational default; every module shares ONE navigation/pager (the rail); and
// the shell stays free of external/horizontal scroll on the mandated viewports.

type Page = import("@playwright/test").Page;

type ClinicModule =
  | "operaciones"
  | "informes"
  | "logistica"
  | "perfil"
  | "tokens";

const CLINIC_MODULES: ClinicModule[] = [
  "operaciones",
  "informes",
  "logistica",
  "perfil",
  "tokens",
];

const MANDATORY_VIEWPORTS = [
  { name: "android-360x740", width: 360, height: 740 },
  { name: "iphone-390x844", width: 390, height: 844 },
  { name: "laptop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

function rail(page: Page) {
  return page.locator('[data-dashboard-module-rail="true"]');
}

function railItem(page: Page, moduleId: ClinicModule) {
  return page.locator(`[data-dashboard-module-rail-item="${moduleId}"]`);
}

test.beforeEach(async ({ page }) => {
  await setClinicSession(page);
});

// 1 + 5 + default: no home/hub/tile grid, no "Módulos clínicos".
test("/dashboard renders no home/hub/tile grid and opens the default operaciones module", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(
    page.locator('[data-dashboard-module-workspace="operaciones"]'),
  ).toBeVisible({ timeout: 12_000 });

  await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
  await expect(page.locator('[data-clinic-cockpit="true"]')).toHaveCount(0);
  await expect(page.locator('[data-clinic-cockpit-modules="true"]')).toHaveCount(0);
  await expect(page.getByText("Módulos clínicos")).toHaveCount(0);
});

// 2: default operative module + the rail marks it active.
test("/dashboard resolves to operaciones with the rail marking it active", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(rail(page)).toBeVisible({ timeout: 12_000 });
  await expect(railItem(page, "operaciones")).toHaveAttribute(
    "aria-current",
    "page",
  );
});

// 3: deep links to each module work and mark the module active.
for (const moduleId of CLINIC_MODULES) {
  test(`deep link /dashboard?module=${moduleId} opens the ${moduleId} workspace`, async ({
    page,
  }) => {
    await page.goto(`/dashboard?module=${moduleId}`);
    await expect(
      page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
    ).toBeVisible({ timeout: 12_000 });
    await expect(railItem(page, moduleId)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
  });
}

// 4: the same navigation/pager appears identically for every module.
test("the shared rail (with all 5 modules + pager) appears on every module", async ({
  page,
}) => {
  for (const moduleId of CLINIC_MODULES) {
    await page.goto(`/dashboard?module=${moduleId}`);
    const nav = rail(page);
    await expect(nav).toBeVisible({ timeout: 12_000 });
    await expect(nav).toHaveAttribute(
      "aria-label",
      "Navegación de módulos de clínica",
    );
    // Every module is reachable from the rail, on every module page.
    for (const other of CLINIC_MODULES) {
      await expect(railItem(page, other)).toHaveCount(1);
    }
    // The pager (prev/next) is part of the same single control.
    await expect(
      nav.locator('[data-dashboard-module-rail-prev="true"]'),
    ).toHaveCount(1);
    await expect(
      nav.locator('[data-dashboard-module-rail-next="true"]'),
    ).toHaveCount(1);
    await expect(nav).toHaveAttribute("data-dashboard-pager", "module");
  }
});

// 6: no external vertical or horizontal scroll on the mandated viewports.
for (const viewport of MANDATORY_VIEWPORTS) {
  test(`no external/horizontal scroll on /dashboard at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 12_000 });

    await expect(async () => {
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        return {
          vertical: Math.max(
            doc.scrollHeight - doc.clientHeight,
            body.scrollHeight - body.clientHeight,
          ),
          horizontal: Math.max(
            doc.scrollWidth - doc.clientWidth,
            body.scrollWidth - body.clientWidth,
          ),
        };
      });
      expect(overflow.vertical, `${viewport.name}: external vertical scroll`).toBeLessThanOrEqual(2);
      expect(overflow.horizontal, `${viewport.name}: horizontal scroll`).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 10_000 });
  });
}
