import { expect, test, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// VIS-MOBILE-001 — Clinic dashboard mobile low-height content access.
//
// Root cause: `.dashboard-module-body` (the ModuleSurface content region) was
// `overflow: hidden` on clinic mobile, so Operaciones and Perfil — the two
// modules without pagination/tabs bounding every card to the viewport — could
// clip real content below the fold with no way to reach it (measured deficit
// at 360×640: dashboard-module-body scrollHeight ≈559 vs clientHeight ≈271).
//
// Fix: `.dashboard-module-body` becomes the single, reachable scroll owner for
// ONLY these two modules on clinic mobile (`frontend/src/styles/dashboard/mobile-clinic.css`),
// scoped by the existing `[data-clinic-mobile-module]` hook. Every other clinic
// module (informes/logistica/tokens) and the whole admin dashboard keep their
// prior no-scroll-owner behavior untouched.
// ─────────────────────────────────────────────────────────────────────────────

const TOLERANCE = 2;

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

type ScrollOwnerMetrics = {
  found: boolean;
  overflowY: string | null;
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  reachedEnd: boolean;
};

async function readScrollOwner(
  page: Page,
  selector: string,
): Promise<ScrollOwnerMetrics> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) {
      return {
        found: false,
        overflowY: null,
        clientHeight: 0,
        scrollHeight: 0,
        scrollTop: 0,
        reachedEnd: false,
      };
    }
    el.scrollTop = el.scrollHeight;
    const reachedEnd =
      Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 2;
    return {
      found: true,
      overflowY: getComputedStyle(el).overflowY,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      reachedEnd,
    };
  }, selector);
}

async function readHorizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

test.describe("VIS-MOBILE-001 — operaciones content reachability", () => {
  test("360x640: last card is reachable, no horizontal overflow, no double scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 15_000 });

    const owner = await readScrollOwner(
      page,
      '[data-clinic-mobile-module="operaciones"] .dashboard-module-body',
    );
    expect(owner.found, "scroll owner present").toBe(true);
    expect(owner.overflowY, "single controlled scroll owner").toBe("auto");
    expect(
      owner.reachedEnd,
      `reached end (scrollHeight=${owner.scrollHeight}, clientHeight=${owner.clientHeight}, scrollTop=${owner.scrollTop})`,
    ).toBe(true);

    const hOverflow = await readHorizontalOverflow(page);
    expect(hOverflow.scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(
      hOverflow.clientWidth + TOLERANCE,
    );

    // No other element inside the module workspace introduces a second
    // independent scroll container.
    const secondaryScrollCount = await page.evaluate(() => {
      const workspace = document.querySelector(
        '[data-dashboard-module-workspace="operaciones"]',
      );
      if (!workspace) return -1;
      return Array.from(workspace.querySelectorAll<HTMLElement>("*")).filter(
        (el) =>
          !el.classList.contains("dashboard-module-body") &&
          ["auto", "scroll"].includes(getComputedStyle(el).overflowY),
      ).length;
    });
    expect(secondaryScrollCount, "no second scroll owner").toBe(0);
  });

  test("390x844: stable, no regression (matches strict no-internal-scroll baseline when content fits taller viewport)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 15_000 });

    const main = page.locator("main.dashboard-main");
    const mainOverflowY = await main.evaluate(
      (el) => getComputedStyle(el).overflowY,
    );
    expect(mainOverflowY, "main never becomes a scroll container").not.toBe(
      "auto",
    );
    expect(mainOverflowY).not.toBe("scroll");

    const hOverflow = await readHorizontalOverflow(page);
    expect(hOverflow.scrollWidth).toBeLessThanOrEqual(
      hOverflow.clientWidth + TOLERANCE,
    );
  });
});

test.describe("VIS-MOBILE-001 — perfil content reachability", () => {
  test("375x667: last section is reachable, actions stay accessible, no double scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=perfil");
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 15_000 });

    const owner = await readScrollOwner(
      page,
      '[data-clinic-mobile-module="perfil"] .dashboard-module-body',
    );
    expect(owner.found, "scroll owner present").toBe(true);
    expect(owner.overflowY, "single controlled scroll owner").toBe("auto");
    expect(
      owner.reachedEnd,
      `reached end (scrollHeight=${owner.scrollHeight}, clientHeight=${owner.clientHeight}, scrollTop=${owner.scrollTop})`,
    ).toBe(true);

    // The profile tab-content wrapper no longer clips internally on its own.
    const fieldsOverflowY = await page.evaluate(() => {
      const fields = document.querySelector('[data-clinic-profile-fields="true"]');
      return fields ? getComputedStyle(fields).overflowY : null;
    });
    expect(fieldsOverflowY, "profile fields do not self-clip").not.toBe("hidden");

    // "Guardar perfil público" stays reachable/clickable after the fix.
    const saveButton = page.getByRole("button", {
      name: "Guardar perfil público",
      exact: true,
    });
    await expect(saveButton).toBeVisible();

    const hOverflow = await readHorizontalOverflow(page);
    expect(hOverflow.scrollWidth).toBeLessThanOrEqual(
      hOverflow.clientWidth + TOLERANCE,
    );

    const secondaryScrollCount = await page.evaluate(() => {
      const editor = document.querySelector('[data-clinic-profile-editor="true"]');
      if (!editor) return -1;
      return Array.from(editor.querySelectorAll<HTMLElement>("*")).filter(
        (el) =>
          !el.classList.contains("dashboard-module-body") &&
          ["auto", "scroll"].includes(getComputedStyle(el).overflowY),
      ).length;
    });
    expect(secondaryScrollCount, "no second scroll owner").toBe(0);
  });

  test("390x844: stable, no regression", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=perfil");
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 15_000 });

    const main = page.locator("main.dashboard-main");
    const mainOverflowY = await main.evaluate(
      (el) => getComputedStyle(el).overflowY,
    );
    expect(mainOverflowY).not.toBe("auto");
    expect(mainOverflowY).not.toBe("scroll");

    const hOverflow = await readHorizontalOverflow(page);
    expect(hOverflow.scrollWidth).toBeLessThanOrEqual(
      hOverflow.clientWidth + TOLERANCE,
    );
  });
});

test.describe("VIS-MOBILE-001 — desktop composition preserved", () => {
  test("1366x768: main/body/html do not acquire accidental scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 15_000 });

    const metrics = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const main = document.querySelector("main.dashboard-main");
      const moduleBody = document.querySelector(
        '[data-clinic-mobile-module="operaciones"] .dashboard-module-body',
      );
      return {
        htmlScrollHeight: html.scrollHeight,
        htmlClientHeight: html.clientHeight,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        mainOverflowY: main ? getComputedStyle(main).overflowY : null,
        moduleBodyOverflowY: moduleBody
          ? getComputedStyle(moduleBody).overflowY
          : null,
      };
    });

    expect(metrics.htmlScrollHeight).toBeLessThanOrEqual(
      metrics.htmlClientHeight + TOLERANCE,
    );
    expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(
      metrics.bodyClientHeight + TOLERANCE,
    );
    expect(metrics.mainOverflowY).not.toBe("auto");
    // The VIS-MOBILE-001 scroll-owner CSS is mobile-only (max-width: 767px);
    // desktop keeps the original bounded (overflow: hidden) module body.
    expect(metrics.moduleBodyOverflowY, "desktop module body unaffected").toBe(
      "hidden",
    );

    const hOverflow = await readHorizontalOverflow(page);
    expect(hOverflow.scrollWidth).toBeLessThanOrEqual(
      hOverflow.clientWidth + TOLERANCE,
    );
  });
});
