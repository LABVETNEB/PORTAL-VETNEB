import { expect, test, type Page } from "@playwright/test";
import { setSession, type SessionRole } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

// PR-DRV-02 · skip-to-content on the private dashboard (proposal DRV-08). The
// shell router mounts the public SkipToContent button as the first tab stop;
// Enter moves focus to the surface's main#main-content without navigating,
// fetching, changing the module or scrolling any box. Geometry stays owned by
// A02/A08: the control is fixed and offscreen until it holds focus.

const SKIP_NAME = "Saltar al contenido principal";
const MAIN = "main#main-content";
const DESKTOP = { width: 1366, height: 768 };
const PHONE = { width: 390, height: 844 };

const SURFACES: ReadonlyArray<{ name: string; role: SessionRole; path: string }> = [
  { name: "Administración", role: "admin", path: "/dashboard/admin?module=admin-report-upload" },
  { name: "Clínica dashboard", role: "clinic", path: "/dashboard?module=informes" },
  { name: "Clínica ruta completa Informes", role: "clinic", path: "/dashboard/informes" },
];

async function openSurface(page: Page, role: SessionRole, path: string) {
  await setSession(page, role, "populated");
  await page.goto(path);
  const main = page.locator(MAIN);
  await expect(main).toBeVisible({ timeout: 25_000 });
  const skip = page.getByRole("button", { name: SKIP_NAME });
  await expect
    .poll(() => skip.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"))), { timeout: 15_000 })
    .toBe(true);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  return { main, skip };
}

// Scroll offsets of main and every ancestor box: the jump must not move any of them.
async function scrollChain(page: Page) {
  return page.locator(MAIN).evaluate((main) => {
    const offsets: string[] = [];
    for (let node: Element | null = main; node; node = node.parentElement) {
      offsets.push(`${node.tagName}:${node.scrollTop}:${node.scrollLeft}`);
    }
    return offsets;
  });
}

async function documentScroll(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    return Math.max(html.scrollHeight - html.clientHeight, html.scrollWidth - html.clientWidth);
  });
}

async function currentModules(page: Page) {
  return page.locator('[aria-current="page"]').evaluateAll((items) => items.map((item) => item.textContent?.trim() ?? ""));
}

test.describe("PR-DRV-02 · skip to content on the dashboard", () => {
  for (const surface of SURFACES) {
    for (const [label, viewport] of [["1366x768", DESKTOP], ["390x844", PHONE]] as const) {
      test(`${surface.name} ${label}: first Tab reveals the skip control and Enter focuses main`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const { main, skip } = await openSurface(page, surface.role, surface.path);

        await expect(page.locator('[id="main-content"]')).toHaveCount(1);
        await expect(page.getByRole("button", { name: SKIP_NAME })).toHaveCount(1);
        expect(await skip.getAttribute("aria-controls")).toBe("main-content");
        expect(await page.evaluate(() => document.activeElement === document.body), "nothing holds focus before the first Tab").toBe(true);
        const hidden = await skip.boundingBox();
        expect(hidden && hidden.y + hidden.height, "offscreen until focused").toBeLessThanOrEqual(0);

        const url = page.url();
        const historyLength = await page.evaluate(() => history.length);
        const modules = await currentModules(page);
        const chain = await scrollChain(page);
        const navigations: string[] = [];
        page.on("request", (request) => {
          if (request.resourceType() === "document" || request.url().includes("_rsc=") || request.headers()["rsc"]) {
            navigations.push(request.url());
          }
        });

        await page.keyboard.press("Tab");
        await expect(skip).toBeFocused();
        const shown = await skip.boundingBox();
        expect(shown, "focused skip control is painted").not.toBeNull();
        expect(shown!.y).toBeGreaterThanOrEqual(0);
        expect(shown!.x).toBeGreaterThanOrEqual(0);
        expect(shown!.x + shown!.width).toBeLessThanOrEqual(viewport.width);
        expect(await documentScroll(page), "A08 with the skip control focused").toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);

        await page.keyboard.press("Enter");
        await expect(main).toBeFocused();
        expect(await skip.evaluate((el) => document.getElementById(el.getAttribute("aria-controls") ?? "") === document.querySelector("main"))).toBe(true);
        const box = await main.boundingBox();
        expect(box && box.y < viewport.height && box.x < viewport.width, "main is inside the viewport").toBe(true);
        expect(await documentScroll(page), "A08 after the jump").toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
        expect(await scrollChain(page), "no box scrolls on the jump").toEqual(chain);

        await page.keyboard.press("Tab");
        expect(await main.evaluate((el) => el !== document.activeElement && el.contains(document.activeElement)), "next Tab lands inside main").toBe(true);
        expect(await main.getAttribute("tabindex"), "temporary tabindex is retired on blur").toBeNull();

        expect(page.url()).toBe(url);
        expect(await page.evaluate(() => history.length)).toBe(historyLength);
        expect(await currentModules(page)).toEqual(modules);
        expect(navigations, "the jump triggers no document or RSC request").toEqual([]);
      });
    }
  }

  test("Shift+Tab leaves the skip control and it returns offscreen", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const { skip } = await openSurface(page, "admin", SURFACES[0].path);

    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(skip).not.toBeFocused();
    // The page no longer holds focus here; read the settled box.
    await expect
      .poll(async () => {
        const box = await skip.boundingBox();
        return box ? box.y + box.height : 0;
      })
      .toBeLessThanOrEqual(0);
  });

  test("forced-colors keeps a real outline on the focused skip control", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const { skip } = await openSurface(page, "clinic", SURFACES[1].path);
    await page.emulateMedia({ forcedColors: "active" });

    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    const outline = await skip.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) || 0 };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });
});
