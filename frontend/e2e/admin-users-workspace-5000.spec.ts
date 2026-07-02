import { expect, test, type Page } from "@playwright/test";

// CAP-A2 — real Admin Usuarios/Roles workspace against the CAP-A1 5000-user
// fixture. The fixture keeps the 9-user LEGACY_USERS pool for requests without
// the explicit opt-in, so this spec rewrites the browser requests with
// `dataset=high-volume` via Playwright route interception. Production code is
// untouched: the real AdminUsersRolesReadOnlyCard keeps issuing its normal
// limit/offset requests and only the wire URL gains the opt-in flag.

const POPULATED_ADMIN_COOKIE = "e2e_populated_admin_session";
const HIGH_VOLUME_TOTAL = 5000;
const HIGH_VOLUME_ADMIN_TOTAL = 250;
const HIGH_VOLUME_CLINIC_TOTAL = 4750;
const HIGH_VOLUME_CLINIC_OWNER_TOTAL = 2375;
const LAST_FIXTURE_USERNAME = "usuario_clinica_fixture_4742";
// Zero-Scroll adaptive contract of the real card: desktop floor of nine rows,
// superset cap of thirty-six.
const ADAPTIVE_LIMIT_FLOOR = 9;
const ADAPTIVE_LIMIT_CAP = 36;
const NO_SCROLL_TOLERANCE = 2;

const WORKSPACE_SELECTOR = '[data-dashboard-module-workspace="admin-users-roles"]';
const USERS_TABLE_NAME = "Tabla de usuarios y roles administrativos";
const DESKTOP_PAGINATION_LABEL = "Paginación de usuarios y roles";
const DESKTOP_FILTERS_LABEL = "Filtros de usuarios y roles";

type WorkspaceState = {
  usernames: string[];
  perPage: number | null;
  summary: Record<string, string>;
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

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: POPULATED_ADMIN_COOKIE,
      url: "http://127.0.0.1:3000",
    },
  ]);
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

async function openUsersRolesWorkspace(page: Page) {
  await page.goto("/dashboard/admin?module=admin-users-roles");
  await expect(page.locator(WORKSPACE_SELECTOR)).toBeVisible({
    timeout: 12_000,
  });
  await expect(page).toHaveURL(/module=admin-users-roles(?:&|$)/);
  await expect(
    page.getByRole("table", { name: USERS_TABLE_NAME }),
  ).toBeVisible({ timeout: 8_000 });
}

async function readWorkspaceState(page: Page): Promise<WorkspaceState> {
  return page.evaluate(
    ({ tableName, paginationLabel }) => {
      const table = document.querySelector<HTMLTableElement>(
        `table[aria-label="${tableName}"]`,
      );
      const usernames = table
        ? Array.from(table.querySelectorAll("tbody tr")).map(
            (row) => row.querySelector("td p")?.textContent?.trim() ?? "",
          )
        : [];

      const perPageLabel = Array.from(document.querySelectorAll("span"))
        .map((node) => node.textContent?.trim() ?? "")
        .find((text) => /^\d+ por página$/.test(text));
      const perPage = perPageLabel ? Number(perPageLabel.split(" ")[0]) : null;

      const summary: Record<string, string> = {};
      for (const label of ["Total filtrado", "Admins", "Clínicas"]) {
        const span = Array.from(document.querySelectorAll("span")).find(
          (node) => node.textContent?.trim() === label,
        );
        const strong = span?.parentElement?.querySelector("strong");
        summary[label] = strong?.textContent?.trim() ?? "";
      }

      const footer = document.querySelector<HTMLElement>(
        `footer[aria-label="${paginationLabel}"]`,
      );
      const rangeText =
        footer
          ?.querySelector(':scope > span[aria-live="polite"]')
          ?.textContent?.trim() ?? null;
      const pageText =
        footer
          ?.querySelector(".dashboard-pagination-context")
          ?.textContent?.trim() ?? null;

      return {
        usernames,
        perPage,
        summary,
        rangeText,
        pageText,
        bodyText: document.body.innerText,
      };
    },
    { tableName: USERS_TABLE_NAME, paginationLabel: DESKTOP_PAGINATION_LABEL },
  );
}

// Waits until the adaptive runtime settles: the rendered slice, the "N por
// página" label and the filtered total must agree before assertions run.
async function readStableState(
  page: Page,
  expectedTotal: number,
): Promise<WorkspaceState> {
  let state: WorkspaceState | null = null;

  await expect(async () => {
    const current = await readWorkspaceState(page);

    expect(current.perPage).not.toBeNull();
    expect(current.summary["Total filtrado"]).toBe(String(expectedTotal));
    expect(current.usernames).toHaveLength(
      Math.min(current.perPage ?? 0, expectedTotal),
    );
    state = current;
  }).toPass({ timeout: 10_000 });

  return state!;
}

function desktopPagination(page: Page) {
  return page.locator(`footer[aria-label="${DESKTOP_PAGINATION_LABEL}"]`);
}

test.describe("admin users-roles workspace 5000-user fixture (CAP-A2)", () => {
  test.beforeEach(async ({ page }) => {
    // Pin the shortest supported desktop viewport used by the no-scroll
    // contract so the adaptive page size stays at its established floor.
    await page.setViewportSize({ width: 1366, height: 768 });
    await setPopulatedAdminSession(page);
  });

  test("first page renders a bounded slice with coherent 5000-user totals", async ({
    page,
  }) => {
    const rewrittenUrls: string[] = [];
    await routeHighVolumeUsersRoles(page, rewrittenUrls);
    await openUsersRolesWorkspace(page);

    const state = await readStableState(page, HIGH_VOLUME_TOTAL);
    const limit = state.perPage!;

    // The opt-in actually reached the wire for every workspace request.
    expect(rewrittenUrls.length).toBeGreaterThan(0);
    for (const url of rewrittenUrls) {
      expect(url).toContain("dataset=high-volume");
    }

    // Bounded slice: the adaptive contract keeps the page inside its floor
    // and superset cap — never the 5000-user dataset.
    expect(limit).toBeGreaterThanOrEqual(ADAPTIVE_LIMIT_FLOOR);
    expect(limit).toBeLessThanOrEqual(ADAPTIVE_LIMIT_CAP);
    expect(state.usernames).toHaveLength(limit);

    // First slice preserves the legacy users at the head of the dataset.
    expect(state.usernames.slice(0, 3)).toEqual([
      "admin_operaciones",
      "usuario_clinica_01",
      "usuario_clinica_02",
    ]);
    expect(state.usernames).toEqual(
      Array.from({ length: limit }, (_, index) => expectedUsernameAt(index)),
    );

    // Totals strip coherent with the 5000-user dataset.
    expect(state.summary["Total filtrado"]).toBe(String(HIGH_VOLUME_TOTAL));
    expect(state.summary.Admins).toBe(String(HIGH_VOLUME_ADMIN_TOTAL));
    expect(state.summary["Clínicas"]).toBe(String(HIGH_VOLUME_CLINIC_TOTAL));

    // Pagination footer coherent with the server-side slicing.
    const pageCount = Math.ceil(HIGH_VOLUME_TOTAL / limit);
    expect(state.rangeText).toBe(`1–${limit} de ${HIGH_VOLUME_TOTAL}`);
    expect(state.pageText).toBe(`Pág. 1 / ${pageCount}`);

    // The tail of the fixture must never be rendered on the first page.
    expect(state.bodyText).not.toContain(LAST_FIXTURE_USERNAME);
  });

  test("pagination advances and returns without rendering the full fixture", async ({
    page,
  }) => {
    const rewrittenUrls: string[] = [];
    await routeHighVolumeUsersRoles(page, rewrittenUrls);
    await openUsersRolesWorkspace(page);

    const firstPage = await readStableState(page, HIGH_VOLUME_TOTAL);
    const limit = firstPage.perPage!;
    const pageCount = Math.ceil(HIGH_VOLUME_TOTAL / limit);

    await desktopPagination(page)
      .getByRole("button", { name: "Siguiente" })
      .click();

    await expect(async () => {
      const state = await readWorkspaceState(page);

      expect(state.rangeText).toBe(
        `${limit + 1}–${limit * 2} de ${HIGH_VOLUME_TOTAL}`,
      );
      expect(state.pageText).toBe(`Pág. 2 / ${pageCount}`);
      expect(state.usernames).toEqual(
        Array.from({ length: limit }, (_, index) =>
          expectedUsernameAt(limit + index),
        ),
      );
      expect(state.usernames).not.toContain("admin_operaciones");
    }).toPass({ timeout: 10_000 });

    await desktopPagination(page)
      .getByRole("button", { name: "Anterior" })
      .click();

    await expect(async () => {
      const state = await readWorkspaceState(page);

      expect(state.rangeText).toBe(`1–${limit} de ${HIGH_VOLUME_TOTAL}`);
      expect(state.pageText).toBe(`Pág. 1 / ${pageCount}`);
      expect(state.usernames[0]).toBe("admin_operaciones");
    }).toPass({ timeout: 10_000 });
  });

  test("userType and role filters keep totals and slices coherent", async ({
    page,
  }) => {
    const rewrittenUrls: string[] = [];
    await routeHighVolumeUsersRoles(page, rewrittenUrls);
    await openUsersRolesWorkspace(page);
    await readStableState(page, HIGH_VOLUME_TOTAL);

    const filters = page.locator(`[aria-label="${DESKTOP_FILTERS_LABEL}"]`);

    // userType=admin narrows to the 250 fixture admins.
    await filters.getByLabel("Tipo usuario").selectOption("admin");

    await expect(async () => {
      const state = await readWorkspaceState(page);
      const limit = state.perPage!;

      expect(state.summary["Total filtrado"]).toBe(
        String(HIGH_VOLUME_ADMIN_TOTAL),
      );
      expect(state.summary.Admins).toBe(String(HIGH_VOLUME_ADMIN_TOTAL));
      expect(state.summary["Clínicas"]).toBe("0");
      expect(state.usernames[0]).toBe("admin_operaciones");
      expect(state.rangeText).toBe(
        `1–${limit} de ${HIGH_VOLUME_ADMIN_TOTAL}`,
      );
      expect(state.pageText).toBe(
        `Pág. 1 / ${Math.ceil(HIGH_VOLUME_ADMIN_TOTAL / limit)}`,
      );
    }).toPass({ timeout: 10_000 });

    // userType=clinic + role=clinic_owner matches the CAP-A1 endpoint totals.
    await filters.getByLabel("Tipo usuario").selectOption("clinic");
    await filters.getByLabel("Rol").selectOption("clinic_owner");

    await expect(async () => {
      const state = await readWorkspaceState(page);
      const limit = state.perPage!;

      expect(state.summary["Total filtrado"]).toBe(
        String(HIGH_VOLUME_CLINIC_OWNER_TOTAL),
      );
      expect(state.summary.Admins).toBe("0");
      expect(state.summary["Clínicas"]).toBe(
        String(HIGH_VOLUME_CLINIC_OWNER_TOTAL),
      );
      // Legacy clinic owners lead the filtered dataset.
      expect(state.usernames.slice(0, 4)).toEqual([
        "usuario_clinica_02",
        "usuario_clinica_04",
        "usuario_clinica_06",
        "usuario_clinica_08",
      ]);
      expect(state.pageText).toBe(
        `Pág. 1 / ${Math.ceil(HIGH_VOLUME_CLINIC_OWNER_TOTAL / limit)}`,
      );
    }).toPass({ timeout: 10_000 });
  });

  test("high-volume dataset preserves the no-scroll app-shell contract", async ({
    page,
  }) => {
    const rewrittenUrls: string[] = [];
    await routeHighVolumeUsersRoles(page, rewrittenUrls);
    await openUsersRolesWorkspace(page);
    await readStableState(page, HIGH_VOLUME_TOTAL);

    await expect(async () => {
      const metrics = await page.evaluate(() => {
        function overflowOf(element: Element | null) {
          const target = element as HTMLElement | null;

          return {
            present: target !== null,
            overflowY: target ? target.scrollHeight - target.clientHeight : 0,
            overflowX: target ? target.scrollWidth - target.clientWidth : 0,
          };
        }

        const worstInternalScroll = { overflowY: 0, overflowX: 0 };
        document
          .querySelectorAll<HTMLElement>("main.dashboard-main *")
          .forEach((el) => {
            const style = window.getComputedStyle(el);
            const overflowY =
              style.overflowY === "auto" || style.overflowY === "scroll"
                ? el.scrollHeight - el.clientHeight
                : 0;
            const overflowX =
              style.overflowX === "auto" || style.overflowX === "scroll"
                ? el.scrollWidth - el.clientWidth
                : 0;

            worstInternalScroll.overflowY = Math.max(
              worstInternalScroll.overflowY,
              overflowY,
            );
            worstInternalScroll.overflowX = Math.max(
              worstInternalScroll.overflowX,
              overflowX,
            );
          });

        return {
          documentElement: overflowOf(document.documentElement),
          body: overflowOf(document.body),
          main: overflowOf(document.querySelector("main.dashboard-main")),
          workspace: overflowOf(
            document.querySelector("[data-dashboard-module-workspace]"),
          ),
          worstInternalScroll,
        };
      });

      for (const [name, metric] of Object.entries({
        documentElement: metrics.documentElement,
        body: metrics.body,
        main: metrics.main,
        workspace: metrics.workspace,
      })) {
        expect(metric.present, `${name} present`).toBe(true);
        expect(
          metric.overflowY,
          `${name} vertical overflow`,
        ).toBeLessThanOrEqual(NO_SCROLL_TOLERANCE);
        expect(
          metric.overflowX,
          `${name} horizontal overflow`,
        ).toBeLessThanOrEqual(NO_SCROLL_TOLERANCE);
      }

      expect(
        metrics.worstInternalScroll.overflowY,
        "internal vertical scroll",
      ).toBeLessThanOrEqual(NO_SCROLL_TOLERANCE);
      expect(
        metrics.worstInternalScroll.overflowX,
        "internal horizontal scroll",
      ).toBeLessThanOrEqual(NO_SCROLL_TOLERANCE);
    }).toPass({ timeout: 10_000 });
  });
});
