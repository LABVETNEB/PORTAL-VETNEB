import { expect, type Locator, type Page, type Route } from "@playwright/test";

export const ADMIN_MOBILE_TOLERANCE = 2;

export const ADMIN_MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

export type AdminMobileViewport = (typeof ADMIN_MOBILE_VIEWPORTS)[number];

export async function setAdminSessionCookie(
  page: Page,
  value: string = "e2e_test_admin_session",
) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

export function setTestAdminSession(page: Page) {
  return setAdminSessionCookie(page, "e2e_test_admin_session");
}

export function setPopulatedAdminSession(page: Page) {
  return setAdminSessionCookie(page, "e2e_populated_admin_session");
}

export async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

export function fulfillJson(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function expectInsideViewport(
  locator: Locator,
  viewport: { width: number; height: number },
  label: string,
) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(box!.x, `${label}: left`).toBeGreaterThanOrEqual(-ADMIN_MOBILE_TOLERANCE);
  expect(box!.y, `${label}: top`).toBeGreaterThanOrEqual(-ADMIN_MOBILE_TOLERANCE);
  expect(box!.x + box!.width, `${label}: right`).toBeLessThanOrEqual(
    viewport.width + ADMIN_MOBILE_TOLERANCE,
  );
  expect(box!.y + box!.height, `${label}: bottom`).toBeLessThanOrEqual(
    viewport.height + ADMIN_MOBILE_TOLERANCE,
  );
}

// Document-level no-scroll contract (html/body) used by the core modules spec.
export type DocumentNoScrollContract = {
  html: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  body: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
  forbiddenOverflow: Array<{ tag: string; cls: string; overflowX: string; overflowY: string }>;
};

export async function readDocumentNoScrollContract(
  page: Page,
  moduleSelector: string,
): Promise<DocumentNoScrollContract> {
  return page.evaluate((selector) => {
    const shell = document.querySelector<HTMLElement>(
      '[data-vetneb-app-shell-surface="admin"]',
    );
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const moduleRoot = document.querySelector<HTMLElement>(selector);

    const candidates: HTMLElement[] = [];
    if (shell) candidates.push(shell);
    if (main) candidates.push(main);
    if (moduleRoot) {
      candidates.push(moduleRoot, ...Array.from(moduleRoot.querySelectorAll<HTMLElement>("*")));
    }

    const forbiddenOverflow = candidates.flatMap((element) => {
      const style = window.getComputedStyle(element);
      return ["auto", "scroll"].includes(style.overflowX) ||
        ["auto", "scroll"].includes(style.overflowY)
        ? [
            {
              tag: element.tagName,
              cls: element.className,
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
      forbiddenOverflow,
    };
  }, moduleSelector);
}

export function assertDocumentNoScrollContract(
  contract: DocumentNoScrollContract,
  label: string,
) {
  expect(contract.html.scrollHeight, `${label}: html vertical overflow`).toBeLessThanOrEqual(
    contract.html.clientHeight + ADMIN_MOBILE_TOLERANCE,
  );
  expect(contract.body.scrollHeight, `${label}: body vertical overflow`).toBeLessThanOrEqual(
    contract.body.clientHeight + ADMIN_MOBILE_TOLERANCE,
  );
  expect(contract.html.scrollWidth, `${label}: html horizontal overflow`).toBeLessThanOrEqual(
    contract.html.clientWidth + ADMIN_MOBILE_TOLERANCE,
  );
  expect(contract.body.scrollWidth, `${label}: body horizontal overflow`).toBeLessThanOrEqual(
    contract.body.clientWidth + ADMIN_MOBILE_TOLERANCE,
  );
  expect(contract.forbiddenOverflow, `${label}: forbidden overflow auto/scroll`).toEqual([]);
}

// Module-level no-scroll contract (html/body/module) used by the ops modules spec.
export type ModuleNoScrollContract = {
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

export async function readModuleNoScrollContract(
  page: Page,
  selector: string,
): Promise<ModuleNoScrollContract> {
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

export function assertModuleNoScrollContract(
  contract: ModuleNoScrollContract,
  label: string,
) {
  for (const [surface, metrics] of Object.entries({
    html: contract.html,
    body: contract.body,
    module: contract.module,
  })) {
    expect(
      metrics.scrollHeight,
      `${label}: ${surface} vertical clipping/overflow`,
    ).toBeLessThanOrEqual(metrics.clientHeight + ADMIN_MOBILE_TOLERANCE);
    expect(
      metrics.scrollWidth,
      `${label}: ${surface} horizontal clipping/overflow`,
    ).toBeLessThanOrEqual(metrics.clientWidth + ADMIN_MOBILE_TOLERANCE);
  }

  expect(contract.forbiddenOverflow, `${label}: overflow auto/scroll`).toEqual([]);
}

// Color-mode emulation shared by the admin mobile status/config specs: persists
// the dark theme preference and pins reduced motion for deterministic captures.
export async function applyColorMode(page: Page, mode: "light" | "dark") {
  if (mode === "dark") {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vetneb-theme-mode", "dark-gray");
      } catch {
        /* localStorage unavailable: emulateMedia still hints dark */
      }
    });
  }
  await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
}

// Balanced bottom-gutter contract shared by the admin mobile status/config
// specs: the bottom margin mirrors the side gutter (never pegged, never a void).
export function assertGutterContract(
  gutters: { bottomGutter: number; sideGutter: number },
  label: string,
) {
  expect(
    gutters.bottomGutter,
    `${label}: bottom gutter not pegged (>= 10px); got ${gutters.bottomGutter}`,
  ).toBeGreaterThanOrEqual(10);
  expect(
    gutters.bottomGutter,
    `${label}: bottom gutter >= side gutter (${gutters.sideGutter})`,
  ).toBeGreaterThanOrEqual(gutters.sideGutter - 2);
  expect(
    gutters.bottomGutter,
    `${label}: bottom gutter balanced with side gutter ${gutters.sideGutter} (no void)`,
  ).toBeLessThanOrEqual(gutters.sideGutter + 24);
}
