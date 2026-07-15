import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

// 40 clinics (R-02): guarantees a page 2 exists for any effectiveLimit <= 36
// (HY superset cap), same margin used by Sessions/Users/Alerts.
const MOCK_CLINICS = Array.from({ length: 40 }, (_, index) => {
  const id = index + 1;

  return {
    clinicId: id,
    clinicName: `Clínica Mobile ${id}`,
    contactEmail: `clinica.mobile.${id}@example.test`,
    contactPhone: `+54 11 5555-${String(id).padStart(4, "0")}`,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: `2026-06-${String((id % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
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
    const limit = Number(url.searchParams.get("limit") ?? "10");
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
  cardsShowingEmail: number;
  secondaryDetailLineCount: number;
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

    const cardsShowingEmail = mobileCards.filter((card) =>
      /@/.test((card as HTMLElement).innerText),
    ).length;
    const secondaryDetailLineCount = mobileCards.filter((card) =>
      /Usuario:|Actualizada:/.test((card as HTMLElement).innerText),
    ).length;

    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      visibleMobileCards: mobileCards.length,
      visibleDesktopTables: desktopTables.length,
      cardsShowingEmail,
      secondaryDetailLineCount,
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

// R-02: the mobile page size is derived from the measured list container (HY
// cap 36), not a fixed constant, so the contract asserts bounds and internal
// consistency instead of an exact count.
function assertMobileClinicsContract(
  contract: MobileClinicsContract,
  label: string,
) {
  expect(
    contract.visibleMobileCards,
    `${label}: mobile page must show at least one clinic`,
  ).toBeGreaterThan(0);
  expect(
    contract.visibleMobileCards,
    `${label}: mobile page size must stay within the HY superset cap (36)`,
  ).toBeLessThanOrEqual(36);
  expect(contract.visibleDesktopTables, `${label}: desktop table hidden on mobile`).toBe(0);
  expect(
    contract.cardsShowingEmail,
    `${label}: every card must show the clinic email`,
  ).toBe(contract.visibleMobileCards);
  expect(
    contract.secondaryDetailLineCount,
    `${label}: secondary details (user/updated date) must not render on the card body`,
  ).toBe(0);

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
      .locator("[data-admin-clinic-mobile-card='true']")
      .first()
      .getByRole("button", { name: /^editar clínica/i })
      .click();

    const dialog = page.getByRole("dialog", { name: /editar clínica/i });
    await expect(dialog).toBeVisible();

    // The username/updated-date detail removed from the card body must stay
    // reachable from Editar.
    await expect(dialog.locator('input[value="mobile-owner-1"]')).toBeVisible();
  });
}

// R-02: the mobile page size is measured (HY cap 36), not a fixed 10, so the
// page count is derived from the settled first-page count instead of assumed.
test("admin clinics mobile pagination advances through adaptive pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAdminSession(page);
  await mockAdminClinics(page);

  await page.goto("/dashboard/admin?module=admin-clinics");
  await expect(
    page.locator('[data-dashboard-module-workspace="admin-clinics"]'),
  ).toBeVisible({ timeout: 15_000 });

  const list = page.locator("[data-admin-clinics-mobile-list='true']");
  await expect(list).toBeVisible();

  const cards = page.locator("[data-admin-clinic-mobile-card='true']");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });

  // The first fetch can use the pre-measurement fallback before the real row
  // is measured and a follow-up fetch settles the final count (documented
  // measurement<->fetch settle risk, same as Sessions/Users/Alerts). Wait for
  // two consecutive equal reads before trusting the count.
  let settledCount: number | null = null;
  await expect(async () => {
    const current = await cards.count();
    expect(current, "clinics mobile item count settles").toBeGreaterThan(0);
    if (settledCount !== current) {
      settledCount = current;
      throw new Error(`count not yet stable: ${current}`);
    }
  }).toPass({ intervals: [200, 300, 400, 600, 800], timeout: 6_000 });

  const firstPageCount = settledCount!;
  const firstPageLabels = await cards.allTextContents();
  expect(firstPageLabels.length).toBe(firstPageCount);
  expect(firstPageCount).toBeLessThanOrEqual(36);

  const pageCount = Math.max(1, Math.ceil(MOCK_CLINICS.length / firstPageCount));
  const pager = page.locator("[data-admin-mobile-core-pager='true']");
  await expect(pager.getByText(`Pág. 1 / ${pageCount}`)).toBeVisible();

  await pager.getByRole("button", { name: "Página siguiente" }).click();

  await expect
    .poll(async () => (await cards.allTextContents()).join("|"), {
      message: "clinics mobile page changes after pagination",
    })
    .not.toBe(firstPageLabels.join("|"));

  await expect(list.getByText("Clínica Mobile 1", { exact: true })).toHaveCount(0);
  await expect(pager.getByText(`Pág. 2 / ${pageCount}`)).toBeVisible();
});
