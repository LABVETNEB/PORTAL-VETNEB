import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const APP_SHELL_RELEASE = "app-shell-visible-2026-06-17";
const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "1366x650", width: 1366, height: 650 },
  { name: "1280x650", width: 1280, height: 650 },
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

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function mockBrowserApis(page: Page) {
  await page.route("**/api/clinic/profile**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        profile: {
          clinicId: 1,
          displayName: "Clinica Perfil App Shell",
          specialtyText: "Anatomia patologica veterinaria",
          servicesText: "Citologia, histopatologia, inmunohistoquimica",
          aboutText: "Perfil institucional para contrato visual App Shell.",
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
      }),
    });
  });

  await page.route("**/api/admin/clinics**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        clinics: Array.from({ length: 5 }, (_, index) => ({
          clinicId: index + 1,
          clinicName: `Clinica App Shell ${index + 1}`,
          contactEmail: `clinic${index + 1}@example.test`,
          contactPhone: `+54 11 5555-${1000 + index}`,
          createdAt: "2026-01-15T10:00:00.000Z",
          updatedAt: "2026-06-17T10:00:00.000Z",
          users: [
            {
              userType: "clinic",
              userId: 1000 + index,
              username: `clinic_user_${index + 1}`,
              role: "clinic_owner",
              clinicId: index + 1,
              clinicName: `Clinica App Shell ${index + 1}`,
              createdAt: "2026-01-15T10:00:00.000Z",
              updatedAt: "2026-06-17T10:00:00.000Z",
            },
          ],
        })),
        total: 5,
        limit: 5,
        offset: 0,
      }),
    });
  });

  await page.route("**/api/admin/sessions**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        sessions: Array.from({ length: 3 }, (_, index) => ({
          sessionType: index === 0 ? "admin" : "clinic",
          sessionId: 5000 + index,
          actorType: index === 0 ? "admin_user" : "clinic_user",
          actorId: 200 + index,
          createdAt: "2026-06-15T09:00:00.000Z",
          lastAccess: "2026-06-16T18:45:00.000Z",
          expiresAt: "2026-06-30T09:00:00.000Z",
          status: "active",
        })),
        total: 3,
        limit: 3,
        offset: 0,
        currentAdminSessionId: 5000,
      }),
    });
  });

  await page.route("**/api/admin/pricing**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        categories: [
          {
            category: "Histopatologia",
            items: [
              {
                id: 1,
                studyName: "Histopatologia App Shell",
                priceLabel: "$15000",
                displayOrder: 1,
                isActive: true,
                updatedAt: "2026-06-17T10:00:00.000Z",
              },
            ],
          },
        ],
      }),
    });
  });
}

async function expectAppShellVisible(page: Page, expectedSurface: "clinic" | "admin") {
  const shell = page.locator(
    `[data-vetneb-app-shell="true"][data-vetneb-app-shell-release="${APP_SHELL_RELEASE}"][data-vetneb-app-shell-surface="${expectedSurface}"]`,
  );

  await expect(shell).toBeVisible({ timeout: 12_000 });
  await expect(page.locator("main.dashboard-main")).toBeVisible({
    timeout: 12_000,
  });

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>("[data-vetneb-app-shell='true']");
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const beforeShell = shell ? window.getComputedStyle(shell, "::before") : null;
    const afterShell = shell ? window.getComputedStyle(shell, "::after") : null;
    const mainStyle = main ? window.getComputedStyle(main) : null;

    return {
      url: location.href,
      release: shell?.getAttribute("data-vetneb-app-shell-release") ?? null,
      surface: shell?.getAttribute("data-vetneb-app-shell-surface") ?? null,
      documentOverflowY:
        document.documentElement.scrollHeight - document.documentElement.clientHeight,
      bodyOverflowY: document.body.scrollHeight - document.body.clientHeight,
      mainOverflowY: main ? main.scrollHeight - main.clientHeight : 0,
      mainOverflowMode: mainStyle?.overflowY ?? null,
      shellBeforeBorder: beforeShell?.borderTopWidth ?? null,
      shellAfterHeight: afterShell?.height ?? null,
    };
  });

  expect(metrics.release).toBe(APP_SHELL_RELEASE);
  expect(metrics.surface).toBe(expectedSurface);

  expect(
    metrics.documentOverflowY,
    `${expectedSurface} document vertical overflow`,
  ).toBeLessThanOrEqual(TOLERANCE);

  expect(
    metrics.bodyOverflowY,
    `${expectedSurface} body vertical overflow`,
  ).toBeLessThanOrEqual(TOLERANCE);

  // App Shell contract: `main` is not an operational scroll container. Module
  // fit (`scrollHeight ≤ clientHeight`) is asserted by the dedicated no-scroll
  // specs at the supported viewports (≥768px height); this visibility spec runs
  // at intentionally short 650px viewports to verify shell chrome only.
  expect(
    metrics.mainOverflowMode,
    `${expectedSurface} main must NOT be an operational scroll container`,
  ).not.toBe("auto");
  expect(
    metrics.mainOverflowMode,
    `${expectedSurface} main must NOT be an operational scroll container`,
  ).not.toBe("scroll");

  expect(metrics.shellBeforeBorder, `${expectedSurface} shell visual border`).not.toBe("0px");
  expect(metrics.shellAfterHeight, `${expectedSurface} shell top rail`).not.toBe("0px");
}

for (const viewport of VIEWPORTS) {
  test.describe(`visible App Shell release contract ${viewport.name}`, () => {
    test("clinic dashboard exposes visible App Shell release", async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await setClinicSession(page);
      await mockBrowserApis(page);
      await page.goto("/dashboard?module=operaciones");

      await expect(
        page.locator('[data-dashboard-module-workspace="operaciones"]'),
      ).toBeVisible({ timeout: 12_000 });

      await expectAppShellVisible(page, "clinic");
    });

    test("admin dashboard exposes visible App Shell release", async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await setAdminSession(page);
      await mockBrowserApis(page);
      await page.goto("/dashboard/admin?module=admin-clinics");

      await expect(
        page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
      ).toBeVisible({ timeout: 12_000 });

      await expectAppShellVisible(page, "admin");
    });
  });
}