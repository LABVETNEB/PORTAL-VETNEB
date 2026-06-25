import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

// PR-CL3 — Clinic mobile nav/stage parity evidence (test-only, no production
// change). Decides whether Clinic needs an Admin-style persistent module
// stage ([data-dashboard-module-stage], CL-GAP-1) and/or sync mobile-nav
// signaling (CL-GAP-5) before either is built.
//
// Confirmed by reading frontend/src/app/globals.css (admin-mobile-real-device
// -layer-isolation / admin-mobile-stage-layer blocks): the opaque-ancestor
// forcing and the GPU-promoted persistent stage that Admin uses to prevent
// mobile bleed-through/ghosting are BOTH explicitly scoped to
// `[data-vetneb-app-shell-surface="admin"]`. The blocks say so directly:
// "Scoped to Admin mobile only... desktop, Clinic and the data/layout of
// every module stay untouched" / "desktop and Clinic keep the stage as a
// transparent flex passthrough". Clinic's controller
// (ClinicDashboardWorkspaceController) swaps Hub<->module the same way Admin
// did BEFORE that fix: two differently-typed branches returned directly,
// no persistent stage wrapper.
//
// Headless Chromium cannot reproduce the real-device GPU tile recycling
// itself (documented limitation in admin-mobile-hub-stale-layer-stage.spec.ts
// and admin-mobile-module-layer-isolation.spec.ts too), so this spec does not
// assert opacity/isolation contracts that would fail today and that nothing
// in this PR fixes. It instead pins what IS verifiable headlessly: real
// nav-driven swaps leave no stale/duplicate DOM mount, frame/main keep their
// own node identity across the swap (no remount), and the mobile no-scroll
// contract holds through a realistic multi-step round trip (not just single
// fresh `goto`s, which is what PR-CL1 already covered).

const VIEWPORT = { width: 390, height: 844 } as const;
const TOLERANCE = 2;

const FRAME_SELECTOR = '[data-vetneb-app-shell-frame="true"]';
const MAIN_SELECTOR = "main.dashboard-main";

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function stampNode(page: Page, selector: string, token: string) {
  await page.evaluate(
    ({ selector, token }) => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) throw new Error(`node missing while stamping: ${selector}`);
      (node as unknown as Record<string, string>).__e2eIdentityToken = token;
    },
    { selector, token },
  );
}

async function readStampedToken(page: Page, selector: string) {
  return page.evaluate((selector) => {
    const node = document.querySelector<HTMLElement>(selector);
    return node
      ? ((node as unknown as Record<string, string>).__e2eIdentityToken ?? null)
      : null;
  }, selector);
}

type NoScrollContract = {
  htmlOverflowX: number;
  bodyOverflowX: number;
  mainOverflowY: number;
  workspaceCount: number;
  hubCount: number;
};

async function readNoScrollContract(page: Page): Promise<NoScrollContract> {
  return page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    return {
      htmlOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
      mainOverflowY: main ? main.scrollHeight - main.clientHeight : 0,
      workspaceCount: document.querySelectorAll(
        "[data-dashboard-module-workspace]",
      ).length,
      hubCount: document.querySelectorAll('[data-dashboard-module-hub="true"]')
        .length,
    };
  });
}

async function expectNoScrollContract(page: Page, label: string) {
  await expect(async () => {
    const contract = await readNoScrollContract(page);
    expect(contract.htmlOverflowX, `${label}: html horizontal overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.bodyOverflowX, `${label}: body horizontal overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(contract.mainOverflowY, `${label}: main vertical overflow`).toBeLessThanOrEqual(
      TOLERANCE,
    );
  }).toPass({ timeout: 10_000 });

  return readNoScrollContract(page);
}

function navItem(page: Page, label: string) {
  return page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: label, exact: true });
}

test.describe("clinic mobile nav/stage parity evidence (PR-CL3)", () => {
  test("frame and main keep node identity across a real hub->module->hub round trip — 390x844", async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize(VIEWPORT);
    await setClinicSession(page);
    await page.goto("/dashboard");
    await suppressNextDevIndicator(page);
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toBeVisible({
      timeout: 8_000,
    });

    const frameToken = "frame-390x844";
    const mainToken = "main-390x844";
    await stampNode(page, FRAME_SELECTOR, frameToken);
    await stampNode(page, MAIN_SELECTOR, mainToken);

    let contract = await expectNoScrollContract(page, "initial hub");
    expect(contract.hubCount, "initial hub: exactly one hub mounted").toBe(1);
    expect(contract.workspaceCount, "initial hub: no module workspace mounted").toBe(0);

    // Hub -> operaciones via the real horizontal nav (same path desktop uses;
    // Clinic has no separate mobile-only nav component, unlike Admin's
    // dedicated bottom nav).
    await navItem(page, "Resumen").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });
    expect(
      await readStampedToken(page, FRAME_SELECTOR),
      "operaciones: app-shell frame node persisted (no remount)",
    ).toBe(frameToken);
    expect(
      await readStampedToken(page, MAIN_SELECTOR),
      "operaciones: dashboard-main node persisted (no remount)",
    ).toBe(mainToken);
    contract = await expectNoScrollContract(page, "operaciones");
    expect(contract.hubCount, "operaciones: hub unmounted").toBe(0);
    expect(contract.workspaceCount, "operaciones: exactly one workspace mounted").toBe(1);

    // operaciones -> tokens: the previous module must be fully gone, not just
    // covered.
    await navItem(page, "Tokens").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="tokens"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toHaveCount(0);
    expect(
      await readStampedToken(page, FRAME_SELECTOR),
      "tokens: app-shell frame node persisted",
    ).toBe(frameToken);
    expect(
      await readStampedToken(page, MAIN_SELECTOR),
      "tokens: dashboard-main node persisted",
    ).toBe(mainToken);
    await expectNoScrollContract(page, "tokens");

    // tokens -> perfil
    await navItem(page, "Perfil").click();
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[data-dashboard-module-workspace="tokens"]'),
    ).toHaveCount(0);
    expect(
      await readStampedToken(page, FRAME_SELECTOR),
      "perfil: app-shell frame node persisted",
    ).toBe(frameToken);
    expect(
      await readStampedToken(page, MAIN_SELECTOR),
      "perfil: dashboard-main node persisted",
    ).toBe(mainToken);
    await expectNoScrollContract(page, "perfil");

    // perfil -> hub via the workspace "Vista general" back control (Clinic's
    // nav has no item that targets the bare hub; see CL-GAP-7).
    await page
      .locator('[data-dashboard-module-workspace="perfil"]')
      .locator('button[aria-label="Vista general"]')
      .click();
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toBeVisible({
      timeout: 8_000,
    });
    contract = await expectNoScrollContract(page, "hub after round trip");
    expect(contract.hubCount, "hub after round trip: exactly one hub mounted").toBe(1);
    expect(
      contract.workspaceCount,
      "hub after round trip: no stale module workspace left mounted",
    ).toBe(0);
    expect(
      await readStampedToken(page, FRAME_SELECTOR),
      "hub after round trip: app-shell frame node persisted",
    ).toBe(frameToken);
    expect(
      await readStampedToken(page, MAIN_SELECTOR),
      "hub after round trip: dashboard-main node persisted",
    ).toBe(mainToken);

    const screenshotDirectory = resolve(
      testInfo.config.rootDir,
      "..",
      "test-results",
      "dashboard-clinic-mobile-nav-stage-parity",
    );
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: resolve(screenshotDirectory, "390x844-hub-after-round-trip.png"),
      animations: "disabled",
      fullPage: false,
    });
  });

  test("active horizontal nav item stays visible through the round trip (Resumen/Tokens/Perfil) — 390x844", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await suppressNextDevIndicator(page);
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 8_000 });

    for (const [label, moduleId] of [
      ["Resumen", "operaciones"],
      ["Tokens", "tokens"],
      ["Perfil", "perfil"],
    ] as const) {
      await navItem(page, label).click();
      await expect(
        page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
      ).toBeVisible({ timeout: 8_000 });

      const item = navItem(page, label);
      await expect(item).toHaveAttribute("aria-current", "page");
      const box = await item.boundingBox();
      expect(box, `${label}: nav item has a bounding box`).not.toBeNull();
      expect(box!.x, `${label}: nav item left edge in viewport`).toBeGreaterThanOrEqual(
        -TOLERANCE,
      );
      expect(
        box!.x + box!.width,
        `${label}: nav item right edge in viewport`,
      ).toBeLessThanOrEqual(VIEWPORT.width + TOLERANCE);
    }
  });

  // CL-GAP-7 (documented in docs/audit/clinic-dashboard-admin-structure-parity-
  // audit.md): the horizontal nav items for Informes/Logística point at full
  // standalone routes, not at `?module=`, so they cannot be reached or
  // verified via nav click the way Resumen/Tokens/Perfil are above. This
  // exercises their `?module=` workspace directly (same access path the
  // controller itself supports) to confirm the swap-hygiene contract still
  // holds for them, without asserting an aria-current that the current
  // navigation structure does not produce.
  for (const moduleId of ["informes", "logistica"] as const) {
    test(`${moduleId} module leaves no stale previous module mounted — 390x844`, async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT);
      await setClinicSession(page);
      await page.goto("/dashboard?module=operaciones");
      await suppressNextDevIndicator(page);
      await expect(
        page.locator('[data-dashboard-module-workspace="operaciones"]'),
      ).toBeVisible({ timeout: 8_000 });

      await page.goto(`/dashboard?module=${moduleId}`);
      await expect(
        page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
      ).toBeVisible({ timeout: 8_000 });
      await expect(
        page.locator('[data-dashboard-module-workspace="operaciones"]'),
      ).toHaveCount(0);
      await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);

      const contract = await expectNoScrollContract(page, moduleId);
      expect(contract.workspaceCount, `${moduleId}: exactly one workspace mounted`).toBe(1);
    });
  }
});
