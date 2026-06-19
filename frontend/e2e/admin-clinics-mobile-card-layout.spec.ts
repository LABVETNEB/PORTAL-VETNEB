import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const MOCK_CLINICS = Array.from({ length: 9 }, (_, index) => {
  const id = index + 1;

  return {
    clinicId: id,
    clinicName: `Clínica Mobile ${id}`,
    contactEmail: `clinica.mobile.${id}@example.test`,
    contactPhone: `+54 11 5555-${String(id).padStart(4, "0")}`,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: `2026-06-${String(id).padStart(2, "0")}T12:00:00.000Z`,
    users: [
      {
        userId: 100 + id,
        username: `mobile-owner-${id}`,
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  };
});

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
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

type MobileClinicsContract = {
  htmlScrollWidth: number;
  htmlClientWidth: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  visibleMobileCards: number;
  visibleDesktopTables: number;
  clippedActions: Array<{
    label: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  }>;
  undersizedActions: Array<{
    label: string;
    width: number;
    height: number;
  }>;
};

async function readMobileClinicsContract(
  page: Page,
): Promise<MobileClinicsContract> {
  return page.evaluate((tolerance) => {
    const html = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const isVisible = (element: Element) => {
      const el = element as HTMLElement;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };

    const mobileCards = Array.from(
      document.querySelectorAll("[data-admin-clinic-mobile-card='true']"),
    ).filter(isVisible);

    const desktopTables = Array.from(
      document.querySelectorAll(".dashboard-table-responsive table"),
    ).filter(isVisible);

    const editActions = Array.from(
      document.querySelectorAll(
        "[data-admin-clinics-mobile-list='true'] button[aria-label^='Editar clínica']",
      ),
    ).filter(isVisible);

    const metricFor = (element: Element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();

      return {
        label:
          (element as HTMLElement).getAttribute("aria-label") ||
          (element as HTMLElement).innerText ||
          element.tagName.toLowerCase(),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      visibleMobileCards: mobileCards.length,
      visibleDesktopTables: desktopTables.length,
      clippedActions: editActions
        .filter((element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();

          return (
            rect.left < -tolerance ||
            rect.right > viewportWidth + tolerance ||
            rect.top < -tolerance ||
            rect.bottom > viewportHeight + tolerance
          );
        })
        .map(metricFor),
      undersizedActions: editActions
        .filter((element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return rect.width < 36 || rect.height < 36;
        })
        .map((element) => {
          const metric = metricFor(element);
          return {
            label: metric.label,
            width: metric.width,
            height: metric.height,
          };
        }),
    };
  }, TOLERANCE);
}

function assertMobileClinicsContract(
  contract: MobileClinicsContract,
  label: string,
) {
  expect(contract.visibleMobileCards, `${label}: mobile cards visible`).toBeGreaterThan(0);
  expect(
    contract.visibleMobileCards,
    `${label}: mobile page size must remain viewport-safe`,
  ).toBeLessThanOrEqual(3);
  expect(contract.visibleDesktopTables, `${label}: desktop table hidden on mobile`).toBe(0);

  expect(
    contract.htmlScrollWidth,
    `${label}: documentElement horizontal overflow`,
  ).toBeLessThanOrEqual(contract.htmlClientWidth + TOLERANCE);

  expect(
    contract.bodyScrollWidth,
    `${label}: body horizontal overflow`,
  ).toBeLessThanOrEqual(contract.bodyClientWidth + TOLERANCE);

  expect(
    contract.clippedActions,
    `${label}: edit actions must not be clipped`,
  ).toEqual([]);

  expect(
    contract.undersizedActions,
    `${label}: edit actions must keep touch target >=36px`,
  ).toEqual([]);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`admin clinics mobile cards stay operable — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await setAdminSession(page);
    await mockAdminClinics(page);

    await page.goto("/dashboard/admin?module=admin-clinics");

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.locator("[data-admin-clinics-mobile-list='true']"),
    ).toBeVisible();

    await expect(
      page.locator("[data-admin-clinic-mobile-card='true']").first(),
    ).toBeVisible();

    const contract = await readMobileClinicsContract(page);
    assertMobileClinicsContract(contract, viewport.name);

    await page
      .getByRole("button", { name: /editar clínica clínica mobile 1/i })
      .click();

    await expect(
      page.getByRole("dialog", { name: /editar clínica/i }),
    ).toBeVisible();
  });
}
