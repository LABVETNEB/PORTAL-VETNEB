import { type Page, expect, test } from "@playwright/test";

const STORAGE_KEY = "vetneb-theme-mode";

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
  const toggle = page.locator('[data-theme-toggle="true"]').first();

  await expect(html).toHaveAttribute("data-theme", "normal");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAccessibleName("Cambiar a modo oscuro");

  await toggle.click();

  await expect(html).toHaveAttribute("data-theme", "dark-gray");
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
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();

  await expect(html).toHaveAttribute("data-theme", "normal");
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

  const toggle = page.locator('[data-theme-toggle="true"]').first();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  hydrationFailures.assertClean();
});
