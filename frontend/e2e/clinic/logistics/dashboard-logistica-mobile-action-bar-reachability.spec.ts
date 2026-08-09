import { expect, test, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Logistics hub mobile reachability contract.
//
// Two stacked pieces of bottom chrome live on this route below `md`: the role
// bottom nav (`z-65`) and StickyActionBar. Two defects made real controls
// unreachable while every Playwright visibility check still passed:
//
//   1. the bar anchored to the viewport (`fixed bottom-0`), landing UNDER the
//      bottom nav, which swallowed the pointer events of its lowest action row;
//   2. the bar left the flow, so `main` handed its full height to the hub and
//      the lower list's pager rendered underneath the bar.
//
// Visibility is therefore not the contract here — HIT-TESTABILITY is. Each
// assertion resolves `elementFromPoint` at the control's own click point and
// requires the control itself to answer, then performs a REAL click. No
// `force`, no `dispatchEvent`, no keyboard fallback.
// ─────────────────────────────────────────────────────────────────────────────

const MOBILE_VIEWPORTS = [
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-compact-375x812", width: 375, height: 812 },
  { name: "android-small-360x800", width: 360, height: 800 },
] as const;

const MD_BOUNDARY = { name: "tablet-boundary-768x1024", width: 768, height: 1024 } as const;

const BAR = '[data-sticky-action-bar="true"]';
const VISITS_PAGER = 'nav[aria-label="Paginación de visitas recientes"]';
const PLANS_PAGER = 'nav[aria-label="Paginación de planes recientes"]';
const NEXT = '[data-dashboard-pager-next="true"] button';
const BAR_ACTIONS = ["Ver visitas", "Ver rutas", "Ver métricas"] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
    // Opt-in deep dataset already shipped by the fixture server: both lists need
    // more than one page for the second-page transition to exist at all.
    {
      name: "e2e_a03_adaptive_pagination",
      value: "1",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function openHub(page: Page) {
  await page.goto("/dashboard/logistica");
  await expect(page.locator(PLANS_PAGER)).toBeVisible({ timeout: 30_000 });
  // The reserve is published on hydration; without it the layout below is the
  // pre-measurement one and the assertions would read a transient state.
  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--dash-sticky-action-h")
        .trim().length > 0,
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** True only when the control itself answers a hit test at its own centre. */
async function isHitTestable(page: Page, selector: string): Promise<string> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) return "missing";
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return "zero-box";
    const hit = document.elementFromPoint(
      Math.round(box.x + box.width / 2),
      Math.round(box.y + box.height / 2),
    );
    if (!hit) return "nothing";
    return element.contains(hit) ? "self" : hit.tagName.toLowerCase();
  }, selector);
}

async function expectSecondPageReachable(page: Page, pager: string, label: string) {
  const next = page.locator(`${pager} ${NEXT}`);

  await expect(next, `${label}: next control visible`).toBeVisible();
  await expect(next, `${label}: next control enabled`).toBeEnabled();
  expect(
    await isHitTestable(page, `${pager} ${NEXT}`),
    `${label}: next control must answer its own hit test (not chrome painted over it)`,
  ).toBe("self");

  await next.click();

  await expect(
    page.locator(`${pager} [data-dashboard-pager-state="true"]`),
    `${label}: second page reached by a real click`,
  ).toHaveText(/Página[\s ]*2/);
  await expect(next, `${label}: pager still reachable after paging`).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const html = document.documentElement;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    return {
      document: html.scrollWidth - html.clientWidth,
      shell: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.document, `${label}: document horizontal overflow`).toBeLessThanOrEqual(1);
  expect(overflow.shell, `${label}: shell horizontal overflow`).toBeLessThanOrEqual(1);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`logistics hub keeps every bottom control reachable at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setClinicSession(page);
    await openHub(page);

    // 1 · The bar must clear the role bottom nav instead of hiding under it.
    const chrome = await page.evaluate((bar) => {
      const element = document.querySelector(bar)!;
      const nav = document.querySelector(".clinic-mobile-bottom-nav");
      const box = element.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        reserve: getComputedStyle(document.documentElement)
          .getPropertyValue("--dash-sticky-action-h")
          .trim(),
        height: Math.round(box.height),
        overlapWithNav: nav
          ? Math.round(Math.max(0, box.bottom - nav.getBoundingClientRect().top))
          : 0,
      };
    }, BAR);

    expect(chrome.position, `${viewport.name}: bar is out of flow on mobile`).toBe("absolute");
    expect(
      chrome.overlapWithNav,
      `${viewport.name}: action bar must not sit under the role bottom nav`,
    ).toBe(0);
    expect(
      chrome.reserve,
      `${viewport.name}: the shell must reserve the measured bar height`,
    ).toBe(`${chrome.height}px`);

    // 2 · Every quick action answers its own hit test, and one really navigates.
    for (const action of BAR_ACTIONS) {
      const byLabel = page.locator(`${BAR} button`).filter({ hasText: action }).first();
      await expect(byLabel, `${viewport.name}: "${action}" visible`).toBeVisible();
      await expect(byLabel, `${viewport.name}: "${action}" enabled`).toBeEnabled();
      expect(
        await page.evaluate(
          ({ bar, label }) => {
            const button = Array.from(
              document.querySelectorAll<HTMLElement>(`${bar} button`),
            ).find((candidate) => (candidate.textContent ?? "").includes(label));
            if (!button) return "missing";
            const box = button.getBoundingClientRect();
            const hit = document.elementFromPoint(
              Math.round(box.x + box.width / 2),
              Math.round(box.y + box.height / 2),
            );
            if (!hit) return "nothing";
            return button.contains(hit) ? "self" : hit.tagName.toLowerCase();
          },
          { bar: BAR, label: action },
        ),
        `${viewport.name}: quick action "${action}" must answer its own hit test`,
      ).toBe("self");
    }

    await page.locator(`${BAR} button`).filter({ hasText: "Ver métricas" }).first().click();
    await expect(
      page,
      `${viewport.name}: the lowest quick action really navigates`,
    ).toHaveURL(/\/dashboard\/logistica\/metricas/);

    // 3 · Both hub pagers reach their second page with a real click.
    await openHub(page);
    await expectSecondPageReachable(page, VISITS_PAGER, `${viewport.name}: visits pager`);
    await expectSecondPageReachable(page, PLANS_PAGER, `${viewport.name}: plans pager`);

    await expectNoHorizontalOverflow(page, viewport.name);
  });
}

test(`logistics hub keeps the desktop action bar contract at ${MD_BOUNDARY.name}`, async ({
  page,
}) => {
  await page.setViewportSize({ width: MD_BOUNDARY.width, height: MD_BOUNDARY.height });
  await setClinicSession(page);
  await openHub(page);

  const chrome = await page.evaluate((bar) => ({
    position: getComputedStyle(document.querySelector(bar)!).position,
    reserve: getComputedStyle(document.documentElement)
      .getPropertyValue("--dash-sticky-action-h")
      .trim(),
  }), BAR);

  // From `md` the bar occupies flow, so it must contribute nothing to the ledger.
  expect(chrome.position, `${MD_BOUNDARY.name}: bar stays sticky`).toBe("sticky");
  expect(chrome.reserve, `${MD_BOUNDARY.name}: no mobile reserve`).toBe("0px");

  for (const action of BAR_ACTIONS) {
    expect(
      await page.evaluate(
        ({ bar, label }) => {
          const button = Array.from(
            document.querySelectorAll<HTMLElement>(`${bar} button`),
          ).find((candidate) => (candidate.textContent ?? "").includes(label));
          if (!button) return "missing";
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(
            Math.round(box.x + box.width / 2),
            Math.round(box.y + box.height / 2),
          );
          if (!hit) return "nothing";
          return button.contains(hit) ? "self" : hit.tagName.toLowerCase();
        },
        { bar: BAR, label: action },
      ),
      `${MD_BOUNDARY.name}: quick action "${action}" hit test`,
    ).toBe("self");
  }

  await expectSecondPageReachable(page, VISITS_PAGER, `${MD_BOUNDARY.name}: visits pager`);
  await expectSecondPageReachable(page, PLANS_PAGER, `${MD_BOUNDARY.name}: plans pager`);
  await expectNoHorizontalOverflow(page, MD_BOUNDARY.name);
});
