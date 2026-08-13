import { type Page, expect, test } from "@playwright/test";

const STORAGE_KEY = "vetneb-theme-mode";
const NORMAL_THEME_COLOR = "#0c354e";
const DARK_GRAY_THEME_COLOR = "#1c1f21";

/**
 * The public shell publishes its own readiness: `PublicRouteControl` stamps
 * `data-public-route-controls-hydrated` on `<html>` from its mount effect, and
 * `public/theme-init.js` reads that same flag to stand its pre-hydration
 * navigation fallback down. React hydrates a root in one commit, so the flag is
 * the runtime's statement that every handler of the public tree — the theme
 * toggle's included — is attached.
 *
 * Without it the click is delivered to a button that is visible, enabled and
 * stable but not yet wired, so it is swallowed and the theme never changes
 * (observed in CI: the assertion polled `data-theme="normal"` five times before
 * the flag appeared at all). Waiting for an application state, not a duration.
 */
async function waitForPublicShellHydration(page: Page) {
  await expect(
    page.locator("html"),
    "public route controls hydrated",
  ).toHaveAttribute("data-public-route-controls-hydrated", "true", {
    timeout: 30_000,
  });
}

function collectHydrationFailures(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return {
    assertClean() {
      const hydrationConsoleErrors = consoleErrors.filter((message) =>
        /hydration|server rendered html|text content does not match/i.test(
          message,
        ),
      );

      expect(pageErrors).toEqual([]);
      expect(hydrationConsoleErrors).toEqual([]);
    },
  };
}

test("theme toggle switches to dark gray, persists, and returns to normal", async ({
  page,
}) => {
  const hydrationFailures = collectHydrationFailures(page);

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.ok(), "/ should render successfully").toBeTruthy();

  const html = page.locator("html");
  const themeColor = page.locator('meta[name="theme-color"]');
  const toggle = page.locator('[data-theme-toggle="true"]').first();

  await expect(html).toHaveAttribute("data-theme", "normal");
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute("content", NORMAL_THEME_COLOR);
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAccessibleName("Cambiar a modo oscuro");

  await waitForPublicShellHydration(page);
  await toggle.click();

  await expect(html).toHaveAttribute("data-theme", "dark-gray");
  await expect(themeColor).toHaveAttribute("content", DARK_GRAY_THEME_COLOR);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAccessibleName("Cambiar a modo normal");

  const storedAfterEnable = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    STORAGE_KEY,
  );
  expect(storedAfterEnable).toBe("dark-gray");

  const colorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  expect(colorScheme).toBe("dark");

  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(html).toHaveAttribute("data-theme", "dark-gray");
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute("content", DARK_GRAY_THEME_COLOR);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // The reload restarts the same race: the persisted theme is applied by
  // `theme-init.js` before hydration, so every visible assertion above can pass
  // against a tree whose handlers are not attached yet.
  await waitForPublicShellHydration(page);
  await toggle.click();

  await expect(html).toHaveAttribute("data-theme", "normal");
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute("content", NORMAL_THEME_COLOR);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  const storedAfterDisable = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    STORAGE_KEY,
  );
  expect(storedAfterDisable).toBe("normal");

  const normalColorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  expect(normalColorScheme).toBe("light");

  hydrationFailures.assertClean();
});

test("persisted dark gray theme applies before hydration without mismatch", async ({
  page,
}) => {
  const hydrationFailures = collectHydrationFailures(page);

  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [STORAGE_KEY, "dark-gray"] as const,
  );

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.ok(), "/ should render successfully").toBeTruthy();

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark-gray");

  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute("content", DARK_GRAY_THEME_COLOR);

  const toggle = page.locator('[data-theme-toggle="true"]').first();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAccessibleName("Cambiar a modo normal");

  hydrationFailures.assertClean();
});
