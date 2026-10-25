import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Response } from "@playwright/test";

import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACE_COUNT,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  resizeSurfaceViewport,
  settleRenderAndData,
  suppressNextDevChrome,
  surfaceMeasurementRoots,
  trackDataRequests,
  waitForLayoutSettled,
  type DashboardGeometryMock,
  type DashboardGeometrySurface,
  type DashboardGeometryViewport,
} from "../../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../../helpers/session";
import {
  DARK_GRAY_THEME_MODE,
  NORMAL_THEME_MODE,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "../../../src/lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// G11 · formal axe gate of the dashboard: the 21 A02 surfaces × 2 themes, each
// case auditing 1366x768 and then 390x844 over ONE navigation (42 cases, 84
// audits). The gate is critical = 0 and serious = 0 on every audit, over the
// whole document (shell + surface), with no rule disabled and no exclusion.
//
// Readiness reuses A02 as-is: readiness selector, semantic loaded state, first
// network idle, then the causal render+data settlement before each audit and
// after the resize. clinic-tokens is the only surface G11 widens: the shared
// fixture answers 404 to the clinic tokens read, so A02 would audit its error
// state; the stub below is local to this spec and mirrors the Fastify contract.
// ─────────────────────────────────────────────────────────────────────────────

const G11_THEMES = [NORMAL_THEME_MODE, DARK_GRAY_THEME_MODE] as const satisfies readonly ThemeMode[];
const G11_VIEWPORT_SLUGS = ["w1366x768", "w390x844"] as const;
const G11_WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const G11_BLOCKING_IMPACTS = new Set(["critical", "serious"]);

const G11_EXPECTED_THEME_COUNT = 2;
const G11_EXPECTED_VIEWPORT_COUNT = 2;
const G11_EXPECTED_CASE_COUNT = 42;
const G11_EXPECTED_AUDIT_COUNT = 84;

const G11_VIEWPORTS: readonly DashboardGeometryViewport[] = G11_VIEWPORT_SLUGS.map((slug) => {
  const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find((candidate) => candidate.slug === slug);
  if (!viewport) throw new Error(`G11 viewport ${slug} is not a canonical A02 viewport`);
  return viewport;
});

// ── clinic-tokens: hermetic populated state ─────────────────────────────────
// Same contract as GET /api/particular-tokens (server/routes/particular-tokens
// .fastify.ts): limit 1..100 (default 50), offset >= 0, `count` is the returned
// page length. Synthetic, frozen values only: no real tutor, patient or token.

const CLINIC_TOKENS_PATH = "/api/particular-tokens";
const G11_TOKEN_PET_PREFIX = "Paciente G11";

const G11_CLINIC_TOKENS = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1;
  const suffix = String(id).padStart(2, "0");
  return {
    id,
    clinicId: 10,
    reportId: id % 2 === 0 ? 300 + id : null,
    tokenLast4: String(7000 + id).slice(-4),
    tutorLastName: `Tutor G11 ${suffix}`,
    petName: `${G11_TOKEN_PET_PREFIX} ${suffix}`,
    petAge: "3 años",
    petBreed: "Mestizo",
    petSex: id % 2 === 0 ? "Hembra" : "Macho",
    petSpecies: id % 2 === 0 ? "Felinos" : "Caninos",
    sampleLocation: "Región torácica",
    sampleEvolution: "Subaguda",
    detailsLesion: "Lesión nodular de prueba sintética.",
    extractionDate: "2026-06-01T00:00:00.000Z",
    shippingDate: "2026-06-02T00:00:00.000Z",
    isActive: id !== 4,
    lastLoginAt: id % 2 === 0 ? "2026-06-05T12:30:00.000Z" : null,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    createdByAdminId: null,
    createdByClinicUserId: 77,
    hasLinkedReport: id % 2 === 0,
  };
});

function readBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  return raw !== null && Number.isInteger(value) && value >= min ? Math.min(value, max) : fallback;
}

const CLINIC_TOKENS_MOCK: DashboardGeometryMock = {
  urlPattern: `**${CLINIC_TOKENS_PATH}**`,
  method: "GET",
  pathname: CLINIC_TOKENS_PATH,
  body: (url) => {
    const limit = readBoundedInt(url.searchParams.get("limit"), 50, 1, 100);
    const offset = readBoundedInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
    const particularTokens = G11_CLINIC_TOKENS.slice(offset, offset + limit);
    return { success: true, count: particularTokens.length, particularTokens, pagination: { limit, offset } };
  },
};

const tokenRow = (rowAttribute: string) =>
  `[${rowAttribute}="true"]:has-text("${G11_TOKEN_PET_PREFIX}")`;

const G11_SURFACES: readonly DashboardGeometrySurface[] = DASHBOARD_GEOMETRY_SURFACES.map(
  (surface): DashboardGeometrySurface =>
    surface.id === "clinic-tokens"
      ? {
          ...surface,
          mocks: [CLINIC_TOKENS_MOCK],
          // Desktop paints the table, the phone the list: one of them must hold
          // a synthetic row, so neither an empty nor an error state passes.
          loadedState: {
            anyVisible: [
              tokenRow("data-clinic-access-table-row"),
              tokenRow("data-clinic-access-mobile-row"),
            ],
            forbidden: [
              ".clinical-alert-error",
              '#clinic-particular-tokens [role="alert"]',
              "text=Sin tokens particulares",
              "text=Cargando tokens particulares",
            ],
          },
        }
      : surface,
);

const G11_CASES = G11_SURFACES.flatMap((surface) =>
  G11_THEMES.map((theme) => ({ surface, theme })),
);

// Fail at collection time: a lost or duplicated case can never pass silently.
if (
  G11_SURFACES.length !== DASHBOARD_GEOMETRY_SURFACE_COUNT ||
  G11_CASES.length !== G11_EXPECTED_CASE_COUNT ||
  G11_CASES.length * G11_VIEWPORTS.length !== G11_EXPECTED_AUDIT_COUNT
) {
  throw new Error(
    `G11 matrix drifted: ${G11_SURFACES.length} surfaces, ${G11_CASES.length} cases, ` +
      `${G11_CASES.length * G11_VIEWPORTS.length} audits`,
  );
}

test.beforeAll(() => {
  expect(G11_SURFACES.length, "surface cardinality").toBe(DASHBOARD_GEOMETRY_SURFACE_COUNT);
  expect(
    new Set(G11_SURFACES.map((surface) => surface.id)).size,
    "surface ids must be unique",
  ).toBe(DASHBOARD_GEOMETRY_SURFACE_COUNT);
  expect(G11_SURFACES.map((surface) => surface.id), "G11 surfaces are the A02 surfaces").toEqual(
    DASHBOARD_GEOMETRY_SURFACES.map((surface) => surface.id),
  );
  expect(new Set(G11_THEMES).size, "theme cardinality").toBe(G11_EXPECTED_THEME_COUNT);
  expect(new Set(G11_VIEWPORTS.map((viewport) => viewport.slug)).size, "viewport cardinality").toBe(
    G11_EXPECTED_VIEWPORT_COUNT,
  );
  expect(
    new Set(G11_CASES.map(({ surface, theme }) => `${surface.id}::${theme}`)).size,
    "case cardinality",
  ).toBe(G11_EXPECTED_CASE_COUNT);
  expect(G11_CASES.length * G11_VIEWPORTS.length, "axe audit cardinality").toBe(
    G11_EXPECTED_AUDIT_COUNT,
  );
  expect(
    G11_SURFACES.find((surface) => surface.id === "clinic-tokens")?.mocks,
    "clinic-tokens must be audited in its populated state",
  ).toEqual([CLINIC_TOKENS_MOCK]);
});

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type AxeResult = AxeResults["violations"][number];

function describeResults(label: string, results: readonly AxeResult[]): string {
  return results
    .map((result) => {
      const targets = result.nodes
        .slice(0, 5)
        .map((node) => node.target.join(" >>> "))
        .join(", ");
      return `${label} | ${result.id} | ${result.impact ?? "unknown"} | ${targets} | ${result.help}`;
    })
    .join("\n");
}

/** Visible `[role=alert]`/error/busy markers inside the surface, by selector. */
async function visibleSurfaceFailureMarkers(
  page: Page,
  surface: DashboardGeometrySurface,
): Promise<string[]> {
  const markers: string[] = [];
  for (const marker of ['[role="alert"]', ".clinical-alert-error", '[aria-busy="true"]']) {
    const count = await page.locator(`${surface.contentRootSelector} ${marker} >> visible=true`).count();
    if (count > 0) markers.push(`${marker} x${count}`);
  }
  return markers;
}

async function assertSurfaceIdentity(
  page: Page,
  surface: DashboardGeometrySurface,
  theme: ThemeMode,
  viewport: DashboardGeometryViewport,
  label: string,
): Promise<void> {
  const expected = new URL(surface.route, page.url());
  const actual = new URL(page.url());
  expect(actual.pathname, `${label}: route (no login redirect)`).toBe(expected.pathname);
  const expectedModule = expected.searchParams.get("module");
  if (expectedModule !== null) {
    expect(actual.searchParams.get("module"), `${label}: module`).toBe(expectedModule);
  }

  await expect(page.locator(surface.readinessSelector).first(), `${label}: readiness`).toBeVisible();
  await expect(page.locator("html"), `${label}: effective theme`).toHaveAttribute("data-theme", theme);

  const applied = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(applied, `${label}: applied viewport`).toEqual({
    width: viewport.width,
    height: viewport.height,
  });

  expect(await visibleSurfaceFailureMarkers(page, surface), `${label}: error/loading markers`).toEqual(
    [],
  );
}

async function auditViewport(page: Page, surface: DashboardGeometrySurface, label: string) {
  const results = await new AxeBuilder({ page }).withTags(G11_WCAG_TAGS).analyze();

  expect(results.url, `${label}: audit attributed to this document`).toBe(page.url());

  // Proof that axe evaluated the surface itself, not only the shell around it.
  const targets = [...results.passes, ...results.violations, ...results.incomplete]
    .flatMap((result) => result.nodes.map((node) => node.target[0]))
    .filter((target): target is string => typeof target === "string");
  const reachedInSurface = await page.evaluate(
    ({ root, selectors }) => {
      const container = document.querySelector(root);
      if (!container) return 0;
      let reached = 0;
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element && container.contains(element)) reached += 1;
        } catch {
          // axe emits shadow/frame-qualified selectors querySelector cannot parse.
        }
      }
      return reached;
    },
    { root: surface.contentRootSelector, selectors: targets },
  );
  expect(reachedInSurface, `${label}: axe nodes inside ${surface.contentRootSelector}`).toBeGreaterThan(0);

  const blocking = results.violations.filter((violation) =>
    G11_BLOCKING_IMPACTS.has(violation.impact ?? ""),
  );
  const blockingIncomplete = results.incomplete.filter((result) =>
    G11_BLOCKING_IMPACTS.has(result.impact ?? ""),
  );
  const nonBlocking = results.violations.filter((violation) => !blocking.includes(violation));

  // `incomplete` is never evidence of conformance: it is surfaced for review.
  if (blockingIncomplete.length > 0) {
    test.info().annotations.push({
      type: "g11-incomplete-needs-review",
      description: describeResults(label, blockingIncomplete),
    });
  }
  if (nonBlocking.length > 0) {
    test.info().annotations.push({
      type: "g11-non-blocking-violation",
      description: describeResults(label, nonBlocking),
    });
  }

  expect(blocking, describeResults(label, blocking)).toEqual([]);
}

test.describe("G11 · dashboard axe matrix 21 surfaces x 2 themes x 2 viewports", () => {
  for (const { surface, theme } of G11_CASES) {
    test(`${surface.id} · ${theme}: no critical or serious axe violation at ${G11_VIEWPORT_SLUGS.join(" and ")}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);

      await suppressNextDevChrome(page);
      await clearDashboardModuleMemory(page);
      await page.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key, value);
        },
        [THEME_STORAGE_KEY, theme] as const,
      );
      await page.emulateMedia({
        colorScheme: theme === DARK_GRAY_THEME_MODE ? "dark" : "light",
        reducedMotion: "reduce",
      });
      await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]]);
      await installSurfaceMocks(page, surface);

      // Hidden server or auth failures on data reads fail the case even when the
      // surface still paints something; 404 stays with the loaded-state gate.
      const failedDataResponses: string[] = [];
      page.on("response", (response: Response) => {
        const request = response.request();
        if (request.resourceType() !== "fetch" && request.resourceType() !== "xhr") return;
        const { pathname } = new URL(response.url());
        const status = response.status();
        if (pathname.startsWith("/api/") && (status >= 500 || status === 401 || status === 403)) {
          failedDataResponses.push(`${request.method()} ${pathname} -> ${status}`);
        }
      });

      const tokensResponse =
        surface.id === "clinic-tokens"
          ? page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname === CLINIC_TOKENS_PATH &&
                response.request().method() === "GET",
            )
          : null;

      const [entryViewport, ...resizedViewports] = G11_VIEWPORTS;
      await page.setViewportSize({ width: entryViewport.width, height: entryViewport.height });
      const navigation = await page.goto(surface.route);
      expect(navigation?.ok(), `${surface.id}: document response`).toBe(true);
      await expect(
        page.locator(surface.readinessSelector).first(),
        `${surface.id}: readiness`,
      ).toBeVisible({ timeout: 25_000 });

      if (tokensResponse) {
        const response = await tokensResponse;
        expect(response.status(), "clinic-tokens: stubbed read status").toBe(200);
        const payload = (await response.json()) as {
          success?: unknown;
          count?: unknown;
          particularTokens?: unknown[];
          pagination?: { limit?: unknown; offset?: unknown };
        };
        expect(payload.success, "clinic-tokens: contract success").toBe(true);
        expect(payload.particularTokens?.length ?? 0, "clinic-tokens: populated page").toBeGreaterThan(0);
        expect(payload.count, "clinic-tokens: count is the page length").toBe(
          payload.particularTokens?.length,
        );
        expect(typeof payload.pagination?.limit, "clinic-tokens: pagination.limit").toBe("number");
        expect(typeof payload.pagination?.offset, "clinic-tokens: pagination.offset").toBe("number");
      }

      // First idle of the only document this case loads (A02); every later
      // request is tracked causally by `flight`.
      await page.waitForLoadState("networkidle", { timeout: 20_000 });
      const flight = trackDataRequests(page);
      const roots = surfaceMeasurementRoots(surface);
      const audited: string[] = [];

      try {
        for (const viewport of G11_VIEWPORTS) {
          const label = `${surface.id} · ${theme} @ ${viewport.slug}`;

          if (resizedViewports.includes(viewport)) {
            await resizeSurfaceViewport(page, surface, viewport, flight);
          }

          await expect(page.locator(surface.readinessSelector).first(), `${label}: readiness`).toBeVisible({
            timeout: 25_000,
          });
          await assertSurfaceLoaded(page, surface, label);
          await settleRenderAndData(page, flight, label, roots);
          await waitForLayoutSettled(page);
          await assertSurfaceIdentity(page, surface, theme, viewport, label);
          expect(failedDataResponses, `${label}: failed data responses`).toEqual([]);

          await auditViewport(page, surface, label);
          audited.push(viewport.slug);
        }
      } finally {
        flight.dispose();
      }

      expect(audited, `${surface.id} · ${theme}: audited viewports`).toEqual([...G11_VIEWPORT_SLUGS]);
    });
  }
});
