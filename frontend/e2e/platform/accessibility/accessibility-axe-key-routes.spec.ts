import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { setSession } from "../../helpers/session";

type SessionSurface = "admin" | "clinic";

type RouteCase = {
  label: string;
  path: string;
  ready: string;
  readyUrl?: RegExp;
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
    // The admin hub is retired at every width: a bare /dashboard/admin with no
    // persisted module lands on Resumen, replaced in place to its canonical URL.
    label: "admin dashboard landing",
    path: "/dashboard/admin",
    ready: '[data-dashboard-module-workspace="admin"]',
    readyUrl: /\/dashboard\/admin\?module=admin$/,
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

  await setSession(page, surface, "populated");
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
        await expect(page.locator(routeCase.ready).first()).toBeVisible({ timeout: 8_000 });
        if (routeCase.readyUrl) {
          await expect(page).toHaveURL(routeCase.readyUrl, { timeout: 8_000 });
          await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
        }
        // A client navigation re-renders the route's metadata: the <title>
        // leaves the head in the commit that lands the route and is back a few
        // milliseconds later. The admin landing lands through one (its bare
        // entry is normalized by a router.replace), and that same commit is what
        // makes the workspace and the URL above ready. The page is ready for an
        // audit once it has its title; the document-title rule stays enforced.
        await expect(page).toHaveTitle(/\S/);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        expect(results.violations, formatViolations(results.violations)).toEqual([]);
      });
    }
  }
});
