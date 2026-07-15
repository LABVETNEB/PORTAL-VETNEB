import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type SessionSurface = "admin" | "clinic";

type RouteCase = {
  label: string;
  path: string;
  ready: string;
  mobileReady?: string;
  session?: SessionSurface;
};

const routeCases: RouteCase[] = [
  {
    label: "public home",
    path: "/",
    ready: "main",
  },
  {
    label: "login",
    path: "/login",
    ready: 'form[aria-label="Formulario de inicio de sesión"]',
  },
  {
    // The clinic dashboard resolves a bare /dashboard to the operational
    // default workspace (the clinic hub layer no longer exists).
    label: "clinic dashboard workspace",
    path: "/dashboard",
    ready: "[data-dashboard-module-workspace]",
    session: "clinic",
  },
  {
    label: "admin dashboard hub",
    path: "/dashboard/admin",
    ready: '[data-dashboard-module-hub="true"]',
    mobileReady: '[data-admin-mobile-hub-launcher="true"]',
    session: "admin",
  },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function applySession(page: Page, surface: SessionSurface | undefined) {
  if (!surface) {
    return;
  }

  await page.context().addCookies([
    {
      name: surface === "admin" ? "admin_session_id" : "app_session_id",
      value:
        surface === "admin"
          ? "e2e_populated_admin_session"
          : "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .flatMap((node) => node.target)
        .slice(0, 3)
        .join(", ");

      return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help} — ${targets}`;
    })
    .join("\n");
}

test.describe("PR-VIS-8 axe accessibility on key routes", () => {
  for (const viewport of viewports) {
    for (const routeCase of routeCases) {
      test(`${routeCase.label} has no axe violations on ${viewport.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await applySession(page, routeCase.session);

        const response = await page.goto(routeCase.path, {
          waitUntil: "domcontentloaded",
        });

        expect(
          response?.ok(),
          `${routeCase.path} should return a successful response`,
        ).toBeTruthy();
        await expect(
          page
            .locator(
              viewport.name === "mobile" && routeCase.mobileReady
                ? routeCase.mobileReady
                : routeCase.ready,
            )
            .first(),
        ).toBeVisible({ timeout: 8_000 });

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        expect(results.violations, formatViolations(results.violations)).toEqual([]);
      });
    }
  }
});
