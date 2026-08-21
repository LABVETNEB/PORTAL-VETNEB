import { expect, test, type Page } from "@playwright/test";

// A03 PASS 3 — regression for the desktop minimum-rows clipping of
// Usuarios/Roles.
//
// The desktop page size used to be floored at nine rows unconditionally. At
// 1280x720 the measured rows region is ~347px and only seven rows fit, so the
// ninth row overflowed it by ~58px, painted over the pager and swallowed the
// hit-test of "Siguiente": with a real dataset an admin could not paginate at
// all. The floor is now conditional on the region being able to host nine rows,
// so it still holds at 1440x900 / 1366x768 — where the historical "nine
// populated rows" contract lives — and yields where the pixels do not exist.
//
// This spec does not replace the historical contracts
// (`dashboard-real-app-shell-no-scroll-contract`, `admin-users-workspace-5000`);
// it pins the defect they cannot see, using the same hermetic fixtures.
//
// B08 UPDATE. The paragraph above describes the ORIGINAL defect and its
// measurements at the time — it is history and stays as written. What changed:
// B08 retired the horizontal nav, returning ~37px of vertical budget, so the
// 1280x720 region now hosts nine rows. The 1280x720 case therefore no longer
// asserts "fewer than nine"; it asserts the property that premise stood for —
// the size is measured, and the pager stays reachable at it. The 1366x768 and
// 1440x900 cases still pin the historical nine-row contract, unchanged, because
// extra vertical budget cannot break a floor those viewports already cleared.

const POPULATED_ADMIN_COOKIE = "e2e_populated_admin_session";
const WORKSPACE = '[data-dashboard-module-workspace="admin-users-roles"]';
const HISTORICAL_DESKTOP_ROWS = 9;

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: POPULATED_ADMIN_COOKIE,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

/**
 * Test-only opt-in, identical to CAP-A2: the wire URL gains
 * `dataset=high-volume` while the card keeps issuing its own limit/offset, so
 * the observed page size stays the real adaptive one.
 */
async function routeHighVolumeUsersRoles(page: Page, seen: URL[]) {
  await page.route(
    (url) => url.pathname === "/api/admin/users-roles",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const rewritten = new URL(route.request().url());
      rewritten.searchParams.set("dataset", "high-volume");
      seen.push(rewritten);
      await route.continue({ url: rewritten.toString() });
    },
  );
}

type Geometry = {
  renderedRows: number;
  containerBottom: number;
  lastRowBottom: number;
  pagerTop: number;
  nextEnabled: boolean;
  nextHitIsOwn: boolean;
  nextOccludedByTable: boolean;
  regionScrolls: boolean;
  documentScrolls: boolean;
};

async function readGeometry(page: Page): Promise<Geometry> {
  return page.evaluate((workspace: string) => {
    const scope = document.querySelector(workspace);
    if (!scope) throw new Error("admin-users-roles workspace is not mounted");

    const table = scope.querySelector("table");
    const container =
      table?.closest("div.dashboard-table-responsive")?.parentElement ?? null;
    if (!container) throw new Error("measured rows region is not mounted");

    const rows = Array.from(scope.querySelectorAll("tbody tr"));
    const next = Array.from(scope.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Siguiente",
    );
    if (!next) throw new Error('"Siguiente" control is not mounted');

    const pager = next.getBoundingClientRect();
    const hit = document.elementFromPoint(
      pager.x + pager.width / 2,
      pager.y + pager.height / 2,
    );
    const last = rows[rows.length - 1]?.getBoundingClientRect() ?? null;
    const root = document.documentElement;

    return {
      renderedRows: rows.length,
      containerBottom: container.getBoundingClientRect().bottom,
      lastRowBottom: last ? last.bottom : 0,
      pagerTop: pager.top,
      nextEnabled: !next.disabled,
      nextHitIsOwn: hit === next || next.contains(hit as Node),
      // A disabled "Siguiente" carries `pointer-events: none`, so the hit-test
      // legitimately falls through to the pager container. What must never
      // happen — the defect this spec pins — is the hit landing inside the
      // table, i.e. a row painted over the pager.
      nextOccludedByTable: Boolean(hit && table && table.contains(hit as Node)),
      regionScrolls: container.scrollHeight - container.clientHeight > 1,
      documentScrolls: root.scrollHeight - root.clientHeight > 1,
    };
  }, WORKSPACE);
}

function expectNoPagerInvasion(geometry: Geometry, label: string) {
  expect(geometry.nextEnabled, `${label}: "Siguiente" must be enabled`).toBe(true);
  expect(
    geometry.nextHitIsOwn,
    `${label}: the centre of "Siguiente" must hit the control itself, not a table cell painted over it`,
  ).toBe(true);
  expect(
    geometry.lastRowBottom,
    `${label}: the last row must stay inside the measured region`,
  ).toBeLessThanOrEqual(geometry.containerBottom + 0.5);
  expect(
    geometry.lastRowBottom,
    `${label}: the last row must not reach the pager`,
  ).toBeLessThanOrEqual(geometry.pagerTop);
  expect(geometry.regionScrolls, `${label}: rows region must not scroll`).toBe(false);
  expect(geometry.documentScrolls, `${label}: document must not scroll`).toBe(false);
}

/** Bounded fail-closed budget for the settle condition below. */
const WORKSPACE_SETTLE_ATTEMPTS = 10;

/**
 * A workspace with rows is NOT a workspace at rest.
 *
 * The adaptive measurement lands after the first paint and moves the effective
 * limit off `USERS_ROLES_FALLBACK_ROWS`, which refetches inside a
 * `useTransition`. React keeps the PREVIOUS page painted for the whole flight,
 * so "rows exist" is satisfiable mid-refetch — and the pager is legitimately
 * disabled there, because `disabled = !hasNextPage || isPending ||
 * isMutatingRole`. Reading the geometry in that window reported "Siguiente"
 * unreachable on a card that was merely busy.
 *
 * The gate is the runtime's own in-flight marker (`aria-busy`, already emitted
 * by the card) plus a rendered cardinality that survives a network-idle
 * boundary unchanged. It is a condition, not a duration: no sleep participates
 * and no assertion is relaxed. The runtime behaviour of disabling the pager
 * during a refetch is correct and is left untouched.
 */
async function settleWorkspace(page: Page) {
  const busy = page.locator(`${WORKSPACE} [aria-busy="true"]`);
  const rows = page.locator(`${WORKSPACE} tbody tr`);

  let previous = -1;
  for (let attempt = 0; attempt < WORKSPACE_SETTLE_ATTEMPTS; attempt += 1) {
    await expect(
      busy,
      "adaptive refetch must not be in flight before the geometry is read",
    ).toHaveCount(0, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    if ((await busy.count()) > 0) {
      previous = -1;
      continue;
    }

    const rendered = await rows.count();
    if (rendered > 0 && rendered === previous) return;
    previous = rendered;
  }

  throw new Error(
    `admin-users-roles never reached a settled page: ${WORKSPACE_SETTLE_ATTEMPTS} ` +
      "network-idle boundaries never produced two identical rendered cardinalities " +
      "with no transition in flight",
  );
}

async function openWorkspace(page: Page) {
  await page.goto("/dashboard/admin?module=admin-users-roles");
  await expect(page.locator(`${WORKSPACE} tbody tr`).first()).toBeVisible({
    timeout: 30_000,
  });
  await settleWorkspace(page);
}

test.describe("Admin Usuarios/Roles · pager reachability across desktop heights", () => {
  test("1280x720 adapts to the available geometry and keeps the pager clickable", async ({
    page,
  }) => {
    const requests: URL[] = [];
    await setPopulatedAdminSession(page);
    await routeHighVolumeUsersRoles(page, requests);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openWorkspace(page);

    const first = await readGeometry(page);
    // This assertion used to read `renderedRows < 9`: at 1280x720 the region
    // could not host the historical nine-row floor, so "smaller than nine" was
    // a usable stand-in for "measured, not floored". B08 retired the horizontal
    // nav and returned ~37px of vertical budget to the workspace, so nine rows
    // now DO fit here and that stand-in stopped being true — without anything
    // about the contract changing.
    //
    // The contract was never the number. It is: the page size is whatever the
    // measured region can host, and the pager stays reachable at that size.
    // Both halves are asserted below and neither pins a row count — `limit ===
    // renderedRows` proves the card requested exactly what it rendered, and
    // `expectNoPagerInvasion` proves the rows fit the region, clear the pager,
    // and scroll nothing. Freezing a new number here would re-introduce exactly
    // the coupling this spec exists to forbid.
    expect(first.renderedRows, "1280x720: the page must still render rows").toBeGreaterThan(0);
    expectNoPagerInvasion(first, "1280x720 page 1");

    const limit = Number(requests[requests.length - 1]?.searchParams.get("limit"));
    expect(limit, "1280x720: the request must carry the measured limit").toBe(
      first.renderedRows,
    );

    const before = requests.length;
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect
      .poll(() => requests.length, { timeout: 15_000 })
      .toBeGreaterThan(before);

    const transition = requests[requests.length - 1]!;
    expect(
      Number(transition.searchParams.get("offset")),
      "1280x720: the transition must advance the window",
    ).toBeGreaterThan(0);

    // The poll above proves the request STARTED; the page-2 geometry is only
    // readable once it has landed and the transition has left flight.
    await settleWorkspace(page);

    const second = await readGeometry(page);
    expect(
      second.renderedRows,
      "1280x720: the second page must be complete",
    ).toBe(first.renderedRows);
    expectNoPagerInvasion(second, "1280x720 page 2");
  });

  for (const viewport of [
    { slug: "1366x768", width: 1366, height: 768 },
    { slug: "1440x900", width: 1440, height: 900 },
  ]) {
    test(`${viewport.slug} preserves the nine populated desktop rows`, async ({
      page,
    }) => {
      await setPopulatedAdminSession(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openWorkspace(page);

      const geometry = await readGeometry(page);
      expect(
        geometry.renderedRows,
        `${viewport.slug}: the historical nine-row desktop page must survive`,
      ).toBe(HISTORICAL_DESKTOP_ROWS);
      expect(
        geometry.lastRowBottom,
        `${viewport.slug}: the ninth row must fit inside the measured region`,
      ).toBeLessThanOrEqual(geometry.containerBottom + 0.5);
      expect(geometry.regionScrolls, `${viewport.slug}: rows region must not scroll`).toBe(
        false,
      );
      expect(geometry.documentScrolls, `${viewport.slug}: document must not scroll`).toBe(
        false,
      );
      expect(
        geometry.lastRowBottom,
        `${viewport.slug}: the ninth row must not reach the pager`,
      ).toBeLessThanOrEqual(geometry.pagerTop);
      expect(
        geometry.nextOccludedByTable,
        `${viewport.slug}: no table row may be painted over the pager`,
      ).toBe(false);
    });
  }
});
