import { expect, test, type Page } from "@playwright/test";

import { clearDashboardModuleMemory, suppressNextDevChrome } from "../../helpers/dashboard-geometry-matrix";
import { setAdminSession, setClinicSession } from "../../helpers/session";

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION_TRUNCATED_STREAM_RECOVERY (PR-NAV-01, D-01) — a client navigation
// whose router payload answers 200 with a Flight body cut short must leave a
// recoverable error state, never a dead app that only a Reload brings back.
//
// The cut is a real 200 response truncated with `route.fulfill`: `route.abort`
// is a network failure, which Next turns into a document navigation that
// recovers on its own and proves nothing about the boundaries. Every router
// payload of the destination (prefetch included) is cut while armed, so the
// navigation cannot reuse an intact prefetch; the cut is lifted before
// "Reintentar", which must recover without a document request.
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORT = { width: 1366, height: 768 } as const;

const INTERNAL_DETAIL = /digest|stack|Error:|Connection closed|\bat \S+ \(|This page couldn.t load/i;

type Surface = {
  readonly name: string;
  readonly boundary: "global" | "dashboard";
  readonly signIn: (page: Page) => Promise<void>;
  readonly origin: string;
  readonly destination: RegExp;
  readonly isDestinationPayload: (url: URL) => boolean;
  readonly navigate: (page: Page) => Promise<void>;
  readonly expectDestination: (page: Page) => Promise<void>;
};

const SURFACES: readonly Surface[] = [
  {
    name: "public",
    // Leaving `/` also changes the root metadata: its reference is cut too and
    // fails above the root layout, so the settled state is global-error (the
    // page's own failure lands on app/error first).
    boundary: "global",
    signIn: async () => {},
    origin: "/",
    destination: /\/servicios$/,
    isDestinationPayload: (url) => url.pathname === "/servicios",
    navigate: (page) =>
      page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByRole("button", { name: "Servicios", exact: true })
        .click(),
    expectDestination: (page) => expect(page.locator("h1").first()).toBeVisible(),
  },
  {
    name: "admin",
    boundary: "dashboard",
    signIn: (page) => setAdminSession(page, "populated"),
    origin: "/dashboard/admin?module=admin",
    destination: /\/dashboard\/admin\?module=admin-sessions$/,
    isDestinationPayload: (url) => url.searchParams.get("module") === "admin-sessions",
    navigate: (page) =>
      page.locator('[data-dashboard-navigation-drawer="admin"] [data-dashboard-navigation-item="admin-sessions"]').click(),
    expectDestination: (page) =>
      expect(page.locator('[data-dashboard-module-workspace="admin-sessions"]')).toBeVisible(),
  },
  {
    name: "clinic",
    boundary: "dashboard",
    signIn: (page) => setClinicSession(page, "populated"),
    origin: "/dashboard?module=operaciones",
    destination: /\/dashboard\?module=tokens$/,
    isDestinationPayload: (url) => url.pathname === "/dashboard" && url.searchParams.get("module") === "tokens",
    navigate: (page) =>
      page.locator('[data-dashboard-navigation-drawer="clinic"] [data-dashboard-navigation-item="tokens"]').click(),
    expectDestination: (page) =>
      expect(page.locator('[data-dashboard-module-workspace="tokens"]')).toBeVisible(),
  },
];

/**
 * Cuts every router payload of the destination to half its body while armed.
 * The matcher names the three page paths literally: E2E-GLOBAL-11 resolves it
 * statically and proves that no fixture API route can be fulfilled here.
 */
async function truncateDestinationPayloads(page: Page, matches: (url: URL) => boolean) {
  let armed = false;
  let cut = 0;
  await page.route(
    (url) =>
      (url.pathname === "/servicios" || url.pathname === "/dashboard" || url.pathname === "/dashboard/admin") &&
      url.searchParams.has("_rsc"),
    async (route) => {
      if (!armed || !matches(new URL(route.request().url()))) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = await response.body();
      const headers = { ...response.headers() };
      delete headers["content-length"];
      delete headers["content-encoding"];
      cut += 1;
      await route.fulfill({
        status: 200,
        headers,
        body: body.subarray(0, Math.floor(body.length / 2)),
      });
    },
  );
  return {
    arm() {
      armed = true;
    },
    disarm() {
      armed = false;
    },
    cut: () => cut,
  };
}

/** Every main-frame document request after `arm()` is a reload; iframes are not. */
function watchDocuments(page: Page) {
  const documents: string[] = [];
  let armed = false;
  page.on("request", (request) => {
    if (armed && request.resourceType() === "document" && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  return {
    arm() {
      armed = true;
    },
    documents,
  };
}

for (const surface of SURFACES) {
  test(`NAVIGATION_TRUNCATED_STREAM_RECOVERY · ${surface.name}: a truncated payload shows a recoverable error and "Reintentar" recovers without a reload`, async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await suppressNextDevChrome(page);
    await clearDashboardModuleMemory(page);
    await surface.signIn(page);

    const cutter = await truncateDestinationPayloads(page, surface.isDestinationPayload);
    const documents = watchDocuments(page);

    await page.goto(surface.origin);
    await page.waitForLoadState("networkidle");

    cutter.arm();
    documents.arm();
    await surface.navigate(page);

    const errorState = page.locator(`[data-route-error-boundary="${surface.boundary}"]`);
    await expect(errorState).toBeVisible({ timeout: 15_000 });
    await expect(errorState).toHaveAttribute("role", "alert");
    await expect(page.locator("[data-route-error-boundary]")).toHaveCount(1);
    expect(cutter.cut()).toBeGreaterThan(0);
    await expect(page.locator("body")).not.toContainText(INTERNAL_DETAIL);
    await expect(page).toHaveURL(surface.destination);

    cutter.disarm();
    await errorState.getByRole("button", { name: "Reintentar" }).click();

    await expect(errorState).toHaveCount(0, { timeout: 15_000 });
    await surface.expectDestination(page);
    await expect(page).toHaveURL(surface.destination);
    expect(documents.documents).toEqual([]);
  });
}
