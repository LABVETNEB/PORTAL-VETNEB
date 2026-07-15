import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN_MOBILE_TOLERANCE,
  ADMIN_MOBILE_VIEWPORTS,
  assertModuleNoScrollContract,
  expectInsideViewport,
  readModuleNoScrollContract,
  setPopulatedAdminSession,
  suppressNextDevIndicator,
} from "../../helpers/admin-mobile-contracts";

// CAP-A3 — real Admin Usuarios/Roles mobile list (AdminMobileOpsPager)
// against the CAP-A1 5000-user fixture. Mirrors admin-users-workspace-5000.spec.ts
// (desktop) but exercises the mobile card-list + AdminMobileOpsPager rendering
// path instead of the desktop table/footer. Production code is untouched: the
// real AdminUsersRolesReadOnlyCard keeps issuing its normal limit/offset
// requests and only the wire URL gains the opt-in `dataset=high-volume` flag.

const HIGH_VOLUME_TOTAL = 5000;
const HIGH_VOLUME_ADMIN_TOTAL = 250;
const HIGH_VOLUME_CLINIC_OWNER_TOTAL = 2375;
const LAST_FIXTURE_USERNAME = "usuario_clinica_fixture_4742";
// Zero-Scroll adaptive contract of the real mobile list: floor of one row (it
// may shrink freely on short phones), superset cap of thirty-six.
const MOBILE_ADAPTIVE_LIMIT_FLOOR = 1;
const MOBILE_ADAPTIVE_LIMIT_CAP = 36;

const WORKSPACE_SELECTOR = '[data-dashboard-module-workspace="admin-users-roles"]';
const MOBILE_MODULE_SELECTOR = '[data-admin-mobile-ops-module="users"]';
const MOBILE_PAGINATION_LABEL = "Paginación de usuarios";

type MobileItemBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  visible: boolean;
};

type MobileWorkspaceState = {
  usernames: string[];
  itemBoxes: MobileItemBox[];
  headerTotal: string | null;
  rangeText: string | null;
  pageText: string | null;
  bodyText: string;
};

// Mirrors the deterministic USERS ordering of
// e2e/fixtures/admin-populated-api-server.mjs: 9 legacy users, then 249
// synthetic admins, then 4742 synthetic clinic users.
function expectedUsernameAt(index: number): string {
  if (index === 0) return "admin_operaciones";
  if (index < 9) return `usuario_clinica_${String(index).padStart(2, "0")}`;
  if (index < 258) return `admin_fixture_${String(index - 8).padStart(4, "0")}`;
  return `usuario_clinica_fixture_${String(index - 257).padStart(4, "0")}`;
}

// Test-only opt-in: rewrite every browser GET to /api/admin/users-roles so it
// carries `dataset=high-volume`. `route.continue({ url })` overrides are not
// reflected back into the Playwright Request/Response objects, so the handler
// records each rewritten URL for later assertion instead of waitForResponse.
async function routeHighVolumeUsersRoles(page: Page, rewrittenUrls: string[]) {
  await page.route(
    (url) => url.pathname === "/api/admin/users-roles",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      const rewritten = new URL(route.request().url());
      rewritten.searchParams.set("dataset", "high-volume");
      rewrittenUrls.push(rewritten.toString());
      await route.continue({ url: rewritten.toString() });
    },
  );
}

async function openUsersRolesWorkspaceMobile(page: Page) {
  await page.goto("/dashboard/admin?module=admin-users-roles");
  await suppressNextDevIndicator(page);
  await expect(page.locator(WORKSPACE_SELECTOR)).toBeVisible({
    timeout: 12_000,
  });
  await expect(page).toHaveURL(/module=admin-users-roles(?:&|$)/);
  await expect(page.locator(MOBILE_MODULE_SELECTOR)).toBeVisible({
    timeout: 8_000,
  });
}

async function readMobileWorkspaceState(page: Page): Promise<MobileWorkspaceState> {
  return page.evaluate(
    ({ moduleSelector, paginationLabel }) => {
      const root = document.querySelector<HTMLElement>(moduleSelector);
      const items = root
        ? Array.from(
            root.querySelectorAll<HTMLElement>('[data-admin-mobile-ops-item="true"]'),
          )
        : [];

      const usernames = items.map(
        (item) => item.querySelector("p")?.textContent?.trim() ?? "",
      );
      const itemBoxes = items.map((item) => {
        const rect = item.getBoundingClientRect();
        const style = window.getComputedStyle(item);
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0",
        };
      });

      const headerText = root?.querySelector("header p")?.textContent?.trim() ?? "";
      const headerTotalMatch = headerText.match(/^(\d+) usuarios$/);

      const nav = root?.querySelector<HTMLElement>(
        `nav[aria-label="${paginationLabel}"]`,
      );
      const rangeText =
        nav?.querySelector('span[aria-live="polite"]')?.textContent?.trim() ?? null;
      const pageText = nav
        ? (Array.from(nav.querySelectorAll(":scope > span")).find(
            (span) => !span.hasAttribute("aria-live"),
          )?.textContent?.trim() ?? null)
        : null;

      return {
        usernames,
        itemBoxes,
        headerTotal: headerTotalMatch ? headerTotalMatch[1] : null,
        rangeText,
        pageText,
        bodyText: document.body.innerText,
      };
    },
    { moduleSelector: MOBILE_MODULE_SELECTOR, paginationLabel: MOBILE_PAGINATION_LABEL },
  );
}

function stateSignature(state: MobileWorkspaceState): string {
  return [
    state.usernames.join(","),
    state.itemBoxes
      .map(
        (box) =>
          `${Math.round(box.x)}:${Math.round(box.y)}:${Math.round(box.width)}:${Math.round(box.height)}`,
      )
      .join(","),
    state.headerTotal,
    state.rangeText,
    state.pageText,
  ].join("::");
}

// Waits until the adaptive runtime settles: the rendered mobile slice, the
// header total and the pager text must agree across two consecutive reads
// before assertions run (mirrors the sessions/users stable-snapshot pattern
// established for the ResizeObserver-driven remount race in
// admin-mobile-ops-modules-no-scroll.spec.ts).
async function readStableMobileState(
  page: Page,
  expectedTotal: number,
): Promise<MobileWorkspaceState> {
  let stable: MobileWorkspaceState | null = null;
  let previousSignature = "";

  await expect
    .poll(
      async () => {
        const state = await readMobileWorkspaceState(page);
        const valid =
          state.headerTotal === String(expectedTotal) &&
          state.usernames.length > 0 &&
          state.usernames.length <= MOBILE_ADAPTIVE_LIMIT_CAP &&
          state.itemBoxes.every((box) => box.visible);

        if (!valid) {
          previousSignature = "";
          return "__invalid__";
        }

        const signature = stateSignature(state);
        if (signature === previousSignature) {
          stable = state;
          return "__stable__";
        }
        previousSignature = signature;
        return "__changing__";
      },
      { timeout: 12_000, intervals: [100, 150, 250, 500, 750] },
    )
    .toBe("__stable__");

  return stable!;
}

function mobilePagination(page: Page) {
  return page
    .locator(MOBILE_MODULE_SELECTOR)
    .getByRole("navigation", { name: MOBILE_PAGINATION_LABEL });
}

// Hydration guard for AdminMobileOpsPager: the step button can be painted
// before React attaches its handler, silently losing the first click. The
// click is only retried while the pager has not reached the expected page, so
// a slow but successful click is never repeated (a repeat would step an extra
// page).
async function stepMobilePage(
  page: Page,
  buttonName: "Siguiente" | "Anterior",
  expectedPageText: string,
) {
  await expect(async () => {
    const before = await readMobileWorkspaceState(page);
    if (before.pageText !== expectedPageText) {
      await mobilePagination(page)
        .getByRole("button", { name: buttonName })
        .click();
    }
    await expect
      .poll(async () => (await readMobileWorkspaceState(page)).pageText, {
        timeout: 2_000,
      })
      .toBe(expectedPageText);
  }).toPass({ timeout: 15_000 });
}

test.describe("admin users-roles workspace 5000-user fixture mobile (CAP-A3)", () => {
  test.beforeEach(async ({ page }) => {
    await setPopulatedAdminSession(page);
  });

  test.describe("primary mobile viewport", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
    });

    test("first mobile page renders a bounded slice with coherent 5000-user totals", async ({
      page,
    }) => {
      const rewrittenUrls: string[] = [];
      await routeHighVolumeUsersRoles(page, rewrittenUrls);
      await openUsersRolesWorkspaceMobile(page);

      const state = await readStableMobileState(page, HIGH_VOLUME_TOTAL);
      const limit = state.usernames.length;

      // The opt-in actually reached the wire for every workspace request.
      expect(rewrittenUrls.length).toBeGreaterThan(0);
      for (const url of rewrittenUrls) {
        expect(url).toContain("dataset=high-volume");
      }

      // Bounded slice: the mobile adaptive contract keeps the list inside its
      // floor and superset cap — never the 5000-user dataset.
      expect(limit).toBeGreaterThanOrEqual(MOBILE_ADAPTIVE_LIMIT_FLOOR);
      expect(limit).toBeLessThanOrEqual(MOBILE_ADAPTIVE_LIMIT_CAP);

      // First slice preserves the legacy users at the head of the dataset.
      expect(state.usernames[0]).toBe("admin_operaciones");
      expect(state.usernames).toEqual(
        Array.from({ length: limit }, (_, index) => expectedUsernameAt(index)),
      );

      // Pager coherent with the server-side slicing.
      const pageCount = Math.ceil(HIGH_VOLUME_TOTAL / limit);
      expect(state.rangeText).toBe(`1–${limit} de ${HIGH_VOLUME_TOTAL}`);
      expect(state.pageText).toBe(`Pág. 1 / ${pageCount}`);

      // The tail of the fixture must never be rendered on the first page.
      expect(state.bodyText).not.toContain(LAST_FIXTURE_USERNAME);
    });

    test("pagination advances and returns via AdminMobileOpsPager without rendering the full fixture", async ({
      page,
    }) => {
      const rewrittenUrls: string[] = [];
      await routeHighVolumeUsersRoles(page, rewrittenUrls);
      await openUsersRolesWorkspaceMobile(page);

      const firstPage = await readStableMobileState(page, HIGH_VOLUME_TOTAL);
      const limit = firstPage.usernames.length;
      const pageCount = Math.ceil(HIGH_VOLUME_TOTAL / limit);

      await stepMobilePage(page, "Siguiente", `Pág. 2 / ${pageCount}`);

      const secondPage = await readStableMobileState(page, HIGH_VOLUME_TOTAL);
      expect(secondPage.rangeText).toBe(
        `${limit + 1}–${limit * 2} de ${HIGH_VOLUME_TOTAL}`,
      );
      expect(secondPage.pageText).toBe(`Pág. 2 / ${pageCount}`);
      expect(secondPage.usernames).toEqual(
        Array.from({ length: limit }, (_, index) => expectedUsernameAt(limit + index)),
      );
      expect(secondPage.usernames).not.toContain("admin_operaciones");

      await stepMobilePage(page, "Anterior", `Pág. 1 / ${pageCount}`);

      const backToFirst = await readStableMobileState(page, HIGH_VOLUME_TOTAL);
      expect(backToFirst.rangeText).toBe(`1–${limit} de ${HIGH_VOLUME_TOTAL}`);
      expect(backToFirst.pageText).toBe(`Pág. 1 / ${pageCount}`);
      expect(backToFirst.usernames[0]).toBe("admin_operaciones");
    });

    test("userType and role filters keep totals and mobile slice coherent", async ({
      page,
    }) => {
      const rewrittenUrls: string[] = [];
      await routeHighVolumeUsersRoles(page, rewrittenUrls);
      await openUsersRolesWorkspaceMobile(page);
      await readStableMobileState(page, HIGH_VOLUME_TOTAL);

      const moduleRoot = page.locator(MOBILE_MODULE_SELECTOR);

      // userType=admin narrows to the 250 fixture admins.
      await moduleRoot.getByLabel("Tipo").selectOption("admin");

      const adminState = await readStableMobileState(page, HIGH_VOLUME_ADMIN_TOTAL);
      const adminLimit = adminState.usernames.length;
      expect(adminState.usernames[0]).toBe("admin_operaciones");
      expect(adminState.rangeText).toBe(
        `1–${adminLimit} de ${HIGH_VOLUME_ADMIN_TOTAL}`,
      );
      expect(adminState.pageText).toBe(
        `Pág. 1 / ${Math.ceil(HIGH_VOLUME_ADMIN_TOTAL / adminLimit)}`,
      );

      // userType=clinic + role=clinic_owner matches the CAP-A1 endpoint totals.
      await moduleRoot.getByLabel("Tipo").selectOption("clinic");
      await moduleRoot.getByLabel("Rol").selectOption("clinic_owner");

      const ownerState = await readStableMobileState(
        page,
        HIGH_VOLUME_CLINIC_OWNER_TOTAL,
      );
      const ownerLimit = ownerState.usernames.length;
      // Legacy clinic owners lead the filtered dataset.
      expect(ownerState.usernames.slice(0, Math.min(4, ownerLimit))).toEqual(
        ["usuario_clinica_02", "usuario_clinica_04", "usuario_clinica_06", "usuario_clinica_08"].slice(
          0,
          Math.min(4, ownerLimit),
        ),
      );
      expect(ownerState.pageText).toBe(
        `Pág. 1 / ${Math.ceil(HIGH_VOLUME_CLINIC_OWNER_TOTAL / ownerLimit)}`,
      );
    });
  });

  for (const viewport of ADMIN_MOBILE_VIEWPORTS) {
    test(`high-volume dataset preserves the no-scroll app-shell contract and item viewport fit at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const rewrittenUrls: string[] = [];
      await routeHighVolumeUsersRoles(page, rewrittenUrls);
      await openUsersRolesWorkspaceMobile(page);

      const state = await readStableMobileState(page, HIGH_VOLUME_TOTAL);
      expect(state.usernames.length).toBeGreaterThan(0);
      expect(state.usernames.length).toBeLessThanOrEqual(MOBILE_ADAPTIVE_LIMIT_CAP);

      for (const [index, box] of state.itemBoxes.entries()) {
        const label = `${viewport.name} item ${index + 1}`;
        expect(box.visible, `${label}: visible`).toBe(true);
        expect(box.x, `${label}: left`).toBeGreaterThanOrEqual(-ADMIN_MOBILE_TOLERANCE);
        expect(box.y, `${label}: top`).toBeGreaterThanOrEqual(-ADMIN_MOBILE_TOLERANCE);
        expect(box.right, `${label}: right`).toBeLessThanOrEqual(
          viewport.width + ADMIN_MOBILE_TOLERANCE,
        );
        expect(box.bottom, `${label}: bottom`).toBeLessThanOrEqual(
          viewport.height + ADMIN_MOBILE_TOLERANCE,
        );
      }

      await expectInsideViewport(
        mobilePagination(page),
        viewport,
        `${viewport.name} users pager`,
      );

      assertModuleNoScrollContract(
        await readModuleNoScrollContract(page, MOBILE_MODULE_SELECTOR),
        `${viewport.name} users mobile high-volume`,
      );
    });
  }
});
