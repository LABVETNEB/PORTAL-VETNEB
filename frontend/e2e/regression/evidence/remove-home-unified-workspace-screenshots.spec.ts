import { test } from "@playwright/test";

// Evidence generator for the "remove dashboard home + unified module workspace"
// change. Each capture runs in its own isolated context (fresh storage) so a
// bare `/dashboard` always resolves to the operational default (operaciones)
// without the last-module restore interfering. Evidence is written to the
// Playwright-managed test output dir so the tracked tree stays clean.

type Page = import("@playwright/test").Page;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

const CAPTURES: Array<{
  url: string;
  width: number;
  height: number;
  file: string;
}> = [
  { url: "/dashboard", width: 360, height: 740, file: "dashboard-360x740.png" },
  { url: "/dashboard", width: 390, height: 844, file: "dashboard-390x844.png" },
  { url: "/dashboard", width: 1366, height: 768, file: "dashboard-1366x768.png" },
  { url: "/dashboard", width: 1440, height: 900, file: "dashboard-1440x900.png" },
  {
    url: "/dashboard?module=informes",
    width: 390,
    height: 844,
    file: "informes-390x844.png",
  },
  {
    url: "/dashboard?module=logistica",
    width: 390,
    height: 844,
    file: "logistica-390x844.png",
  },
  {
    url: "/dashboard?module=perfil",
    width: 390,
    height: 844,
    file: "perfil-390x844.png",
  },
  {
    url: "/dashboard?module=tokens",
    width: 390,
    height: 844,
    file: "tokens-390x844.png",
  },
  {
    url: "/dashboard?module=informes",
    width: 1366,
    height: 768,
    file: "informes-1366x768.png",
  },
  {
    url: "/dashboard?module=logistica",
    width: 1366,
    height: 768,
    file: "logistica-1366x768.png",
  },
];

for (const capture of CAPTURES) {
  test(`screenshot ${capture.file}`, async ({ page }, testInfo) => {
    await setClinicSession(page);
    await page.setViewportSize({ width: capture.width, height: capture.height });
    await page.goto(capture.url, { waitUntil: "networkidle" });

    // The unified workspace always renders the lateral navigation + an active
    // module. B08 moved that band off the legacy rail at >=768px, and every
    // capture below is a >=768px viewport.
    await page.waitForSelector('[data-dashboard-navigation-drawer="clinic"]', {
      timeout: 15_000,
    });
    await page.waitForSelector("[data-dashboard-module-workspace]", {
      timeout: 15_000,
    });
    // Let adaptive density settle before the frame is captured.
    await page.waitForTimeout(900);

    await page.screenshot({
      path: testInfo.outputPath(capture.file),
      fullPage: false,
    });
  });
}
