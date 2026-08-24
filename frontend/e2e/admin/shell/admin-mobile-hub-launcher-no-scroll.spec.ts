import { expect, test, type Locator, type Page } from "@playwright/test";

const TOLERANCE = 1;

const MOBILE_VIEWPORTS = [
  { name: "android-short-360x640", width: 360, height: 640 },
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
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

type NoScrollContract = {
  html: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  body: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  shellOverflowX: string;
  shellOverflowY: string;
  mainOverflowX: string;
  mainOverflowY: string;
  forbiddenLauncherOverflow: Array<{ selector: string; overflowX: string; overflowY: string }>;
};

async function readNoScrollContract(page: Page): Promise<NoScrollContract> {
  return page.evaluate(() => {
    const launcher = document.querySelector<HTMLElement>(
      '[data-admin-mobile-hub-launcher="true"]',
    );
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");

    if (!launcher || !shell || !main) {
      throw new Error("Admin mobile hub launcher contract is incomplete");
    }

    const shellStyle = window.getComputedStyle(shell);
    const mainStyle = window.getComputedStyle(main);

    const forbiddenLauncherOverflow = [
      launcher,
      ...Array.from(launcher.querySelectorAll<HTMLElement>("*")),
    ].flatMap((element) => {
      const style = window.getComputedStyle(element);
      return ["auto", "scroll"].includes(style.overflowX) ||
        ["auto", "scroll"].includes(style.overflowY)
        ? [
            {
              selector: element.tagName + "." + element.className,
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
      shellOverflowX: shellStyle.overflowX,
      shellOverflowY: shellStyle.overflowY,
      mainOverflowX: mainStyle.overflowX,
      mainOverflowY: mainStyle.overflowY,
      forbiddenLauncherOverflow,
    };
  });
}

async function expectModuleWorkspace(page: Page, moduleId: string) {
  await expect(
    page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
  ).toBeVisible({ timeout: 15_000 });
}

async function backToHubViaBottomNav(page: Page) {
  await page
    .locator('[data-dashboard-mobile-nav="admin"]')
    .filter({ visible: true })
    .getByRole("button", { name: "Inicio", exact: true })
    .click();
  await expect(
    page.locator('[data-admin-mobile-hub-launcher="true"]'),
  ).toBeVisible({ timeout: 15_000 });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`Admin mobile hub is a paginated no-scroll launcher at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setPopulatedAdminSession(page);
    await page.goto("/dashboard/admin");
    await suppressNextDevIndicator(page);

    const appBar = page.locator('[data-admin-mobile-app-bar="true"]');
    const bottomNav = page
      .locator('[data-dashboard-mobile-nav="admin"]')
      .filter({ visible: true });
    const horizontalNav = page.locator(
      '[data-dashboard-horizontal-nav-shell="true"]',
    );
    const launcher = page.locator('[data-admin-mobile-hub-launcher="true"]');
    const pager = page.locator('[data-admin-mobile-hub-pager="true"]');

    await expect(appBar).toBeVisible({ timeout: 15_000 });
    await expect(bottomNav).toBeVisible();
    await expect(horizontalNav).toBeHidden();
    await expect(launcher).toBeVisible({ timeout: 15_000 });
    await expect(pager).toBeVisible();

    // No-scroll contract: html/body never exceed the viewport.
    const contract = await readNoScrollContract(page);
    expect(contract.html.scrollHeight).toBeLessThanOrEqual(
      contract.html.clientHeight + TOLERANCE,
    );
    expect(contract.body.scrollHeight).toBeLessThanOrEqual(
      contract.body.clientHeight + TOLERANCE,
    );
    expect(contract.html.scrollWidth).toBeLessThanOrEqual(
      contract.html.clientWidth + TOLERANCE,
    );
    expect(contract.body.scrollWidth).toBeLessThanOrEqual(
      contract.body.clientWidth + TOLERANCE,
    );
    expect(["auto", "scroll"]).not.toContain(contract.shellOverflowX);
    expect(["auto", "scroll"]).not.toContain(contract.shellOverflowY);
    expect(["auto", "scroll"]).not.toContain(contract.mainOverflowX);
    expect(["auto", "scroll"]).not.toContain(contract.mainOverflowY);
    expect(contract.forbiddenLauncherOverflow).toEqual([]);

    // Pager must be fully inside the viewport.
    await expectInsideViewport(pager, viewport.width, viewport.height, `${viewport.name}: pager`);

    // Page 1 tiles must all be fully visible and inside the viewport (no clipped tiles).
    const page1Tiles = launcher.locator('[data-admin-mobile-hub-tile]');
    const page1Count = await page1Tiles.count();
    expect(page1Count).toBeGreaterThan(0);
    for (let index = 0; index < page1Count; index += 1) {
      await expectInsideViewport(
        page1Tiles.nth(index),
        viewport.width,
        viewport.height,
        `${viewport.name}: page1 tile ${index + 1}`,
      );
    }

    // Going to page 2 must not introduce scroll, and tiles must stay onscreen.
    const nextButton = pager.getByRole("button", { name: "Siguiente", exact: true });
    await nextButton.click();

    const page2Tiles = launcher.locator('[data-admin-mobile-hub-tile]');
    const page2Count = await page2Tiles.count();
    expect(page2Count).toBeGreaterThan(0);
    for (let index = 0; index < page2Count; index += 1) {
      await expectInsideViewport(
        page2Tiles.nth(index),
        viewport.width,
        viewport.height,
        `${viewport.name}: page2 tile ${index + 1}`,
      );
    }

    const contractAfterPaging = await readNoScrollContract(page);
    expect(contractAfterPaging.html.scrollHeight).toBeLessThanOrEqual(
      contractAfterPaging.html.clientHeight + TOLERANCE,
    );
    expect(contractAfterPaging.body.scrollHeight).toBeLessThanOrEqual(
      contractAfterPaging.body.clientHeight + TOLERANCE,
    );

    // All 10 modules must be reachable across the two pages.
    expect(page1Count + page2Count).toBe(10);

    // Go back to page 1.
    await pager.getByRole("button", { name: "Anterior", exact: true }).click();

    // Navigation: a page-1 tile (Clínicas) must navigate to its module.
    await launcher.locator('[data-admin-mobile-hub-tile="admin-clinics"]').click();
    await expectModuleWorkspace(page, "admin-clinics");
    await backToHubViaBottomNav(page);

    // Navigation: page-2 tiles (Auditoría, Sesiones) must navigate to their modules.
    await launcher
      .locator('[data-admin-mobile-hub-pager="true"]')
      .getByRole("button", { name: "Siguiente", exact: true })
      .click();
    await launcher.locator('[data-admin-mobile-hub-tile="audit-log"]').click();
    await expectModuleWorkspace(page, "audit-log");
    await backToHubViaBottomNav(page);

    await launcher
      .locator('[data-admin-mobile-hub-pager="true"]')
      .getByRole("button", { name: "Siguiente", exact: true })
      .click();
    await launcher.locator('[data-admin-mobile-hub-tile="admin-sessions"]').click();
    await expectModuleWorkspace(page, "admin-sessions");
    await backToHubViaBottomNav(page);
  });
}

test("Admin mobile hub tiles are borderless with a larger icon and preserved tile size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setPopulatedAdminSession(page);
  await page.goto("/dashboard/admin");
  await suppressNextDevIndicator(page);

  const launcher = page.locator('[data-admin-mobile-hub-launcher="true"]');
  await expect(launcher).toBeVisible({ timeout: 15_000 });

  const tiles = launcher.locator('[data-admin-mobile-hub-tile]');
  const tileCount = await tiles.count();
  expect(tileCount).toBeGreaterThan(0);

  for (let index = 0; index < tileCount; index += 1) {
    const tile = tiles.nth(index);
    const tileBox = await tile.boundingBox();
    expect(tileBox, `tile ${index + 1}: bounding box`).not.toBeNull();

    const border = await tile.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { width: style.borderWidth, style: style.borderStyle };
    });
    expect(border.style, `tile ${index + 1}: border style`).toBe("none");

    const icon = tile.locator(".admin-mobile-hub-tile-icon svg").first();
    await expect(icon, `tile ${index + 1}: icon visible`).toBeVisible();
    const iconBox = await icon.boundingBox();
    expect(iconBox, `tile ${index + 1}: icon bounding box`).not.toBeNull();
    expect(iconBox!.width, `tile ${index + 1}: icon width`).toBeGreaterThanOrEqual(20);

    // Icon must not overflow its rounded badge container.
    const badgeBox = await tile.locator(".admin-mobile-hub-tile-icon").boundingBox();
    expect(badgeBox, `tile ${index + 1}: icon badge bounding box`).not.toBeNull();
    expect(iconBox!.width).toBeLessThanOrEqual(badgeBox!.width + TOLERANCE);
    expect(iconBox!.height).toBeLessThanOrEqual(badgeBox!.height + TOLERANCE);
  }
});

test("Admin desktop hub keeps lateral navigation and has no mobile launcher", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setPopulatedAdminSession(page);
  await page.goto("/dashboard/admin");
  await suppressNextDevIndicator(page);

  await expect(
    page
      .locator('[data-dashboard-navigation-drawer="admin"]')
      .filter({ visible: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-dashboard-mobile-nav="admin"]')).toBeHidden();
  await expect(
    page.locator('[data-admin-mobile-hub-launcher="true"]'),
  ).toBeHidden();
  await expect(page.locator('[data-dashboard-module-hub="true"]')).toBeVisible();
});
