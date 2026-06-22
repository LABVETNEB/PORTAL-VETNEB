import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

// PR — single persistent, opaque, isolated "module stage" for the admin
// Hub<->module swap. Root cause of the residual mobile bleed-through: the Hub
// and the active module mount as two DIFFERENTLY-typed isolated subtrees that
// REPLACE each other directly under <main>, so the stacking context at the swap
// site is destroyed and recreated (different bounds) on every navigation. On
// mobile GPUs that lets a recycled tile of the just-unmounted module survive
// behind the freshly-created Hub context — opaque ancestors below it in z-order
// cannot cover it. The fix wraps BOTH branches in ONE persistent stage node
// ([data-dashboard-module-stage]) that never unmounts (only its children swap),
// is opaque + isolated, and on mobile is promoted to a single stable compositor
// layer so the GPU repaints THAT layer in place instead of recycling an orphan.
//
// This guards the structural invariant deterministically (element identity is
// preserved across Hub->module->Hub; the stage is opaque, isolated and promoted
// on mobile). Headless Chromium does not reproduce the GPU recycling itself, so
// the screenshots are structural evidence and the persistence/paint invariants
// are the automated guard.

const STAGE_SELECTOR = '[data-dashboard-module-stage="true"]';

const MATRIX = [
  { width: 360, height: 740, mode: "light" as const },
  { width: 360, height: 740, mode: "dark" as const },
  { width: 390, height: 844, mode: "light" as const },
  { width: 430, height: 932, mode: "light" as const },
];

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

async function applyColorMode(page: Page, mode: "light" | "dark") {
  if (mode === "dark") {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vetneb-theme-mode", "dark-gray");
      } catch {
        /* localStorage unavailable: emulateMedia below still hints dark */
      }
    });
  }
  await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
}

function readCssAlpha(color: string) {
  const normalized = color.trim().toLowerCase();
  if (!normalized || normalized === "transparent") return 0;
  const commaAlpha = normalized.match(
    /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/,
  );
  if (commaAlpha) return Number(commaAlpha[1]);
  const slashAlpha = normalized.match(/\/\s*([\d.]+)(%)?\s*\)$/);
  if (slashAlpha) {
    const alpha = Number(slashAlpha[1]);
    return slashAlpha[2] ? alpha / 100 : alpha;
  }
  return 1;
}

/**
 * Stamp the live stage node so we can prove it survives the swap unchanged.
 * Stored as a plain JS property (not a `data-*` attribute) so the stamp never
 * touches the DOM attribute list React reconciles — an attribute written
 * outside React's render risks a hydration-mismatch warning on the next
 * render of this same node.
 */
async function stampStage(page: Page, token: string) {
  await page.evaluate(
    ({ selector, value }) => {
      const stage = document.querySelector<HTMLElement>(selector);
      if (!stage) throw new Error("module stage missing while stamping");
      (stage as unknown as Record<string, string>).__e2eStageToken = value;
    },
    { selector: STAGE_SELECTOR, value: token },
  );
}

async function readStageContract(page: Page, descendantSelector: string) {
  return page.evaluate(
    ({ selector, descendant }) => {
      const stages = document.querySelectorAll<HTMLElement>(selector);
      const stage = stages[0] ?? null;
      if (!stage) {
        throw new Error("module stage is not mounted");
      }
      const style = window.getComputedStyle(stage);
      const descendantNode =
        document.querySelector<HTMLElement>(descendant);
      return {
        stageCount: stages.length,
        token:
          (stage as unknown as Record<string, string>).__e2eStageToken ??
          null,
        backgroundColor: style.backgroundColor,
        isolation: style.isolation,
        transform: style.transform,
        overflowY: style.overflowY,
        descendantInsideStage: descendantNode
          ? stage.contains(descendantNode)
          : false,
      };
    },
    { selector: STAGE_SELECTOR, descendant: descendantSelector },
  );
}

async function expectStageContract(
  page: Page,
  descendantSelector: string,
  expectedToken: string,
  label: string,
) {
  await expect(async () => {
    const contract = await readStageContract(page, descendantSelector);
    expect(contract.stageCount, `${label}: exactly one stage`).toBe(1);
    expect(contract.token, `${label}: stage node persisted (same DOM node)`).toBe(
      expectedToken,
    );
    expect(
      readCssAlpha(contract.backgroundColor),
      `${label}: stage opaque background`,
    ).toBe(1);
    expect(contract.isolation, `${label}: stage isolates a stacking context`).toBe(
      "isolate",
    );
    // Mobile promotes the stage to a single stable compositor layer.
    expect(contract.transform, `${label}: stage promoted to its own layer`).not.toBe(
      "none",
    );
    // The active surface (hub launcher / module workspace) lives INSIDE the
    // persistent stage, so the swap happens within one stable layer.
    expect(
      contract.descendantInsideStage,
      `${label}: active surface nested in the stage`,
    ).toBe(true);
    // The stage never becomes an operational scroll container.
    expect(
      ["auto", "scroll"],
      `${label}: stage must not scroll`,
    ).not.toContain(contract.overflowY);
  }).toPass({ timeout: 10_000 });
}

async function openClinicsFromHub(page: Page) {
  const launcher = page.locator('[data-admin-mobile-hub-launcher="true"]');
  const tile = launcher.locator('[data-admin-mobile-hub-tile="admin-clinics"]');
  const workspace = page.locator(
    '[data-dashboard-module-workspace="admin-clinics"]',
  );
  await expect(async () => {
    await tile.click();
    await expect(workspace).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000 });
}

async function backToHub(page: Page) {
  await page
    .locator('[data-admin-mobile-bottom-nav="true"]')
    .getByRole("button", { name: "Inicio", exact: true })
    .click();
  const hub = page.locator('[data-admin-mobile-hub-launcher="true"]');
  await expect(hub).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(0);
}

for (const cell of MATRIX) {
  test(`admin mobile hub keeps one persistent isolated stage across the swap — ${cell.width}x${cell.height} ${cell.mode}`, async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize({ width: cell.width, height: cell.height });
    await applyColorMode(page, cell.mode);
    await setPopulatedAdminSession(page);

    await page.goto("/dashboard/admin");
    await suppressNextDevIndicator(page);

    const hub = page.locator('[data-admin-mobile-hub-launcher="true"]');
    await expect(hub).toBeVisible({ timeout: 15_000 });

    const token = `stage-${cell.width}-${cell.mode}`;
    await stampStage(page, token);
    await expectStageContract(
      page,
      '[data-admin-mobile-hub-launcher="true"]',
      token,
      `${token} initial hub`,
    );

    // Hub -> module: the stage node must persist (same stamped DOM node) and now
    // wrap the module workspace.
    await openClinicsFromHub(page);
    await expectStageContract(
      page,
      '[data-dashboard-module-workspace="admin-clinics"]',
      token,
      `${token} module`,
    );

    // module -> Hub: still the same persistent stage, no stale workspace left.
    await backToHub(page);
    await expectStageContract(
      page,
      '[data-admin-mobile-hub-launcher="true"]',
      token,
      `${token} hub after module`,
    );

    const screenshotDirectory = resolve(
      testInfo.config.rootDir,
      "..",
      "test-results",
      "admin-mobile-hub-stale-layer-stage",
    );
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: resolve(
        screenshotDirectory,
        `${cell.width}-${cell.mode}-hub-after-clinics.png`,
      ),
      animations: "disabled",
      fullPage: false,
    });
  });
}
