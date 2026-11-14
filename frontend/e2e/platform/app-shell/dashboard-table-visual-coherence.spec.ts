import { expect, test, type Page } from "@playwright/test";
import {
  addAppCookies,
  sessionCookie,
  setClinicSession,
} from "../../helpers/session";

// Standard dashboard tables paint no permanent row separators and no decorative
// row lines in their empty region; the admin tokens loading skeleton is a
// full-width block, not an orphan vertical box. Everything is read from computed
// styles and rendered geometry, never from class names.

const DESKTOP_VIEWPORTS = [
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "tablet-landscape-1024x768", width: 1024, height: 768 },
] as const;

function token(id: number) {
  return {
    id,
    clinicId: 10,
    reportId: id % 2 === 0 ? 200 + id : null,
    tokenLast4: String(9000 + id).slice(-4),
    tutorLastName: `Tutor${id}`,
    petName: `Paciente${id}`,
    petAge: "2 años",
    petBreed: "Mestizo",
    petSex: "Macho",
    petSpecies: "Caninos",
    sampleLocation: "Dorso",
    sampleEvolution: "Subaguda",
    detailsLesion: "Nódulo",
    extractionDate: "2026-06-01T00:00:00.000Z",
    shippingDate: "2026-06-02T00:00:00.000Z",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    createdByAdminId: null,
    createdByClinicUserId: 77,
  };
}

async function stubClinicTokens(page: Page, tokens: ReturnType<typeof token>[]) {
  await page.route(
    (url) => url.pathname === "/api/particular-tokens",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: tokens.length,
          particularTokens: tokens,
          pagination: { limit: 36, offset: 0 },
        }),
      });
    },
  );
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`clinic tokens table paints no row separators or filler lines · ${viewport.name} · ${colorScheme}`, async ({
      page,
    }) => {
      await page.addInitScript((mode) => {
        window.localStorage.setItem("vetneb-theme-mode", mode);
      }, colorScheme === "dark" ? "dark-gray" : "normal");
      await page.setViewportSize(viewport);
      await setClinicSession(page, "default");
      await stubClinicTokens(page, [token(1), token(2), token(3)]);
      await page.goto("/dashboard?module=tokens");

      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme === "dark" ? "dark-gray" : "normal",
      );
      const table = page.locator('[data-clinic-access-table="true"]');
      const rows = table.locator('tbody [data-clinic-access-table-row="true"]');
      await expect(rows).toHaveCount(3, { timeout: 15_000 });

      const rowBorders = await rows.evaluateAll((elements) =>
        elements.flatMap((row) =>
          [row, ...Array.from(row.querySelectorAll("td"))].map((node) => {
            const style = getComputedStyle(node);
            return [style.borderTopWidth, style.borderBottomWidth].join("/");
          }),
        ),
      );
      expect(new Set(rowBorders)).toEqual(new Set(["0px/0px"]));

      const filler = await page
        .locator('[data-clinic-access-future-slots="true"]')
        .evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            borders: [style.borderTopWidth, style.borderBottomWidth].join("/"),
            backgroundImage: style.backgroundImage,
            height: node.getBoundingClientRect().height,
          };
        });
      expect(filler.borders).toBe("0px/0px");
      expect(filler.backgroundImage).toBe("none");

      // Real rows stay readable and actionable.
      await expect(rows.first()).toContainText("****9001");
      await expect(rows.first().getByRole("button", { name: "Ver detalle" })).toBeVisible();
      await rows.nth(1).hover();
    });
  }
}

test("admin tokens loading state is a full-width block, then the loaded table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await addAppCookies(page, [sessionCookie("admin", "populated")]);
  let releaseTokens: () => void = () => undefined;
  const tokensGate = new Promise<void>((resolve) => {
    releaseTokens = resolve;
  });
  // Hold the fixture response, never replace it: the fixture stays the only payload source.
  await page.route(
    (url) => url.pathname === "/api/admin/particular-tokens",
    async (route) => {
      await tokensGate;
      await route.continue();
    },
  );
  await page.goto("/dashboard/admin?module=admin-particular-tokens");

  const workspace = page.locator(
    '[data-dashboard-module-workspace="admin-particular-tokens"]',
  );
  await expect(workspace).toBeVisible({ timeout: 15_000 });

  const loading = workspace.locator('[data-collection-state="loading"]:visible');
  await expect(loading).toHaveCount(1);
  const [box, host] = await loading.evaluate((node) => {
    const parent = node.parentElement as HTMLElement;
    const own = node.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return [
      { width: own.width, height: own.height },
      { width: parentRect.width, height: parentRect.height },
    ];
  });
  expect(box.width).toBeGreaterThanOrEqual(host.width - 2);
  expect(box.height).toBeLessThan(box.width);

  releaseTokens();
  await expect(loading).toHaveCount(0, { timeout: 15_000 });
  await expect(workspace.locator("tbody tr").first()).toBeVisible();
  await expect(workspace.locator('[data-collection-state="empty"]:visible')).toHaveCount(0);
});
