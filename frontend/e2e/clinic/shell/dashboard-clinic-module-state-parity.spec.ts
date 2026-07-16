import { expect, test, type Page, type Route } from "@playwright/test";

// PR-CL7 state parity. `operaciones`/`informes`/`logistica` get SSR data from
// page.tsx, so their recovery action is a client `router.refresh()` button.
// `tokens` and `perfil` fetch client-side and expose direct retry/reload paths.

const TOLERANCE = 2;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function expectMainNotScrollContainer(page: Page) {
  const metric = await page.evaluate(() => {
    const main = document.querySelector("main.dashboard-main") as HTMLElement | null;
    if (!main) return null;
    return {
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
      scrollWidth: main.scrollWidth,
      clientWidth: main.clientWidth,
    };
  });

  expect(metric, "main.dashboard-main present").not.toBeNull();
  expect(metric!.scrollHeight).toBeLessThanOrEqual(metric!.clientHeight + TOLERANCE);
  expect(metric!.scrollWidth).toBeLessThanOrEqual(metric!.clientWidth + TOLERANCE);
}

async function expectNoHorizontalOverflow(page: Page) {
  const metric = await page.evaluate(() => ({
    htmlScrollWidth: document.documentElement.scrollWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));

  expect(metric.htmlScrollWidth).toBeLessThanOrEqual(metric.htmlClientWidth + TOLERANCE);
  expect(metric.bodyScrollWidth).toBeLessThanOrEqual(metric.bodyClientWidth + TOLERANCE);
}

const RETRY_TOKEN = {
  id: 9201,
  clinicId: 12,
  reportId: null,
  tokenLast4: "4401",
  tutorLastName: "Gómez",
  petName: "Mora",
  petAge: "3 años",
  petBreed: "Mestizo",
  petSex: "Hembra",
  petSpecies: "Felinos",
  sampleLocation: "Piel",
  sampleEvolution: "2 semanas",
  detailsLesion: "Lesión nodular para evaluación anatomopatológica.",
  extractionDate: "2026-06-10T10:00:00.000Z",
  shippingDate: "2026-06-11T10:00:00.000Z",
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-06-12T09:15:00.000Z",
  updatedAt: "2026-06-17T16:20:00.000Z",
  createdByAdminId: null,
  createdByClinicUserId: 77,
  hasLinkedReport: false,
};

const BLANK_PROFILE = {
  clinicId: 1,
  displayName: "",
  specialtyText: "",
  servicesText: "",
  aboutText: "",
  email: "",
  phone: "",
  publicAddress: "",
  mapLink: "",
  locality: "",
  country: "",
  avatarUrl: null,
  isPublic: false,
  publication: {
    isSearchEligible: false,
    qualityScore: 10,
    minimumQualityScore: 75,
    hasRequiredPublicFields: false,
    missingRequiredFields: ["displayName", "specialtyText"],
    missingRecommendedFields: [],
    publicationErrors: [],
  },
};

test.describe("clinic operaciones/informes/logistica SSR module state parity (CL-GAP-6)", () => {
  test("default session: operaciones surfaces stats/reports/visits load errors with retry controls", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=operaciones");

    const commandCenter = page.locator('[data-clinic-command-center="true"]');
    await expect(commandCenter).toBeVisible({ timeout: 8_000 });

    const metricsAlert = commandCenter
      .getByRole("alert")
      .filter({ hasText: "métricas operativas" });
    await expect(metricsAlert).toBeVisible();
    await expect(
      metricsAlert.getByRole("button", { name: "Reintentar" }),
    ).toBeVisible();

    await commandCenter.getByRole("tab", { name: "Recientes" }).click();
    const reportsAlert = commandCenter
      .getByRole("alert")
      .filter({ hasText: "informes recientes" });
    const visitsAlert = commandCenter
      .getByRole("alert")
      .filter({ hasText: "visitas de campo recientes" });
    await expect(reportsAlert).toBeVisible();
    await expect(
      reportsAlert.getByRole("button", { name: "Reintentar" }),
    ).toBeVisible();
    await expect(visitsAlert).toBeVisible();
    await expect(
      visitsAlert.getByRole("button", { name: "Reintentar" }),
    ).toBeVisible();

    await commandCenter.getByRole("tab", { name: "Estado" }).click();
    await expect(
      commandCenter.locator('[data-clinic-command-continuity="true"]'),
    ).toContainText("Estado degradado");
  });

  test("default session: informes workspace shows the load error, not the empty state", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=informes");

    await expect(
      page.locator('[data-dashboard-module-workspace="informes"]'),
    ).toBeVisible({ timeout: 8_000 });

    const card = page.locator('[aria-label="Informes recientes de la clínica"]');
    await expect(card.getByRole("alert")).toContainText(
      "No se pudieron cargar los informes recientes. Intente nuevamente.",
    );
    await expect(card.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(card.getByText("Sin informes recientes")).toHaveCount(0);
  });

  test("default session: logistica workspace shows the load error, not the empty state", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=logistica");

    await expect(
      page.locator('[data-dashboard-module-workspace="logistica"]'),
    ).toBeVisible({ timeout: 8_000 });

    const card = page.locator('[aria-label="Visitas de campo recientes de la clínica"]');
    await expect(card.getByRole("alert")).toContainText(
      "No se pudieron cargar las visitas de campo. Intente nuevamente.",
    );
    await expect(card.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(card.getByText("Sin visitas recientes")).toHaveCount(0);
  });

  test("populated session: stats resolve through route-plans and the operativo state is reachable", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=operaciones");

    const commandCenter = page.locator('[data-clinic-command-center="true"]');
    await expect(commandCenter).toBeVisible({ timeout: 8_000 });

    // The e2e fixture serves /api/logistics/route-plans for the populated
    // clinic session even without pagination params, so getDashboardStats()
    // resolves and the healthy KPI path renders (no degraded alert).
    await expect(
      commandCenter.getByRole("alert").filter({ hasText: "métricas operativas" }),
    ).toHaveCount(0);

    await commandCenter.getByRole("tab", { name: "Recientes" }).click();
    await expect(
      commandCenter.getByRole("alert").filter({ hasText: "informes recientes" }),
    ).toHaveCount(0);
    await expect(
      commandCenter.getByRole("alert").filter({ hasText: "visitas de campo recientes" }),
    ).toHaveCount(0);
    await expect(commandCenter.getByText("Mora", { exact: true })).toBeVisible();

    await commandCenter.getByRole("tab", { name: "Estado" }).click();
    // hasAnyError = statsLoadError || reportsLoadError || visitsLoadError: all
    // three reads succeed under the populated fixture, so the "Operativo" copy
    // (previously unreachable) is the asserted healthy state.
    await expect(
      commandCenter.locator('[data-clinic-command-continuity="true"]'),
    ).toContainText("Operativo");
  });

  test("390x844: SSR load-error states for operaciones/informes/logistica still fit without overflow or main scroll", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.setViewportSize(MOBILE_VIEWPORT);

    for (const moduleId of ["operaciones", "informes", "logistica"] as const) {
      await page.goto(`/dashboard?module=${moduleId}`);
      await expect(
        page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
      ).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole("alert").first()).toBeVisible();

      await expectNoHorizontalOverflow(page);
      await expectMainNotScrollContainer(page);
    }
  });
});

test.describe("clinic tokens module state parity (client-driven, CL-GAP-6)", () => {
  test("loading: Actualizar reflects the in-flight fetch before tokens resolve", async ({
    page,
  }) => {
    await setClinicSession(page);

    // Hold the response open until the test has asserted the loading state,
    // instead of racing a fixed delay against hydration timing.
    let releaseResponse: () => void = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route(
      (url) => url.pathname === "/api/particular-tokens",
      async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        await responseGate;
        return fulfillJson(route, 200, {
          success: true,
          count: 0,
          particularTokens: [],
          pagination: { limit: 10, offset: 0 },
        });
      },
    );

    await page.goto("/dashboard?module=tokens");
    const card = page.locator("#clinic-particular-tokens");
    await expect(card).toBeVisible({ timeout: 8_000 });

    // Matches both text states: a locator pinned to the exact idle label would
    // stop resolving once the button's accessible name changes while loading.
    const refreshButton = card.getByRole("button", {
      name: /^(Actualizar|Actualizando\.\.\.)$/,
    });
    await expect(refreshButton).toHaveText("Actualizando...", { timeout: 8_000 });
    await expect(refreshButton).toBeDisabled();
    await expect(card.getByText("Cargando tokens particulares...")).toBeVisible();

    releaseResponse();

    await expect(refreshButton).toHaveText("Actualizar", { timeout: 4_000 });
  });

  test("empty: zero tokens renders the shared EmptyState pattern", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.route(
      (url) => url.pathname === "/api/particular-tokens",
      (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        return fulfillJson(route, 200, {
          success: true,
          count: 0,
          particularTokens: [],
          pagination: { limit: 10, offset: 0 },
        });
      },
    );

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/dashboard?module=tokens");

    const card = page.locator("#clinic-particular-tokens");
    await expect(
      card.getByText("No hay tokens particulares generados por esta clínica."),
    ).toBeVisible();
    await expect(card.getByText("Sin tokens particulares")).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Generar token particular", exact: true }),
    ).toBeEnabled();

    await expectNoHorizontalOverflow(page);
    await expectMainNotScrollContainer(page);
  });

  test("error: failed load surfaces an alert and Actualizar stays available", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.route(
      (url) => url.pathname === "/api/particular-tokens",
      (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        return fulfillJson(route, 500, { error: "E2E forced failure" });
      },
    );

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/dashboard?module=tokens");

    const card = page.locator("#clinic-particular-tokens");
    await expect(card.getByRole("alert")).toHaveText("E2E forced failure");

    const refreshButton = card.getByRole("button", { name: "Actualizar", exact: true });
    await expect(refreshButton).toBeEnabled();

    await expectNoHorizontalOverflow(page);
    await expectMainNotScrollContainer(page);
  });

  test("retry: a successful Actualizar after a failed load clears the stale error banner", async ({
    page,
  }) => {
    await setClinicSession(page);
    let tokensCallCount = 0;

    await page.route(
      (url) => url.pathname === "/api/particular-tokens",
      (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        tokensCallCount += 1;

        if (tokensCallCount === 1) {
          return fulfillJson(route, 500, { error: "E2E forced failure" });
        }

        return fulfillJson(route, 200, {
          success: true,
          count: 1,
          particularTokens: [RETRY_TOKEN],
          pagination: { limit: 10, offset: 0 },
        });
      },
    );

    await page.route(
      (url) => url.pathname === "/api/study-tracking",
      (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        return fulfillJson(route, 200, {
          success: true,
          count: 0,
          trackingCases: [],
          pagination: { limit: 1, offset: 0 },
        });
      },
    );

    await page.goto("/dashboard?module=tokens");
    const card = page.locator("#clinic-particular-tokens");
    const errorBanner = card.getByRole("alert");
    await expect(errorBanner).toHaveText("E2E forced failure");

    const refreshButton = card.getByRole("button", { name: "Actualizar", exact: true });
    await refreshButton.click();

    // Fix verification: loadTokens() now clears errorMessage at the start of
    // every load (success or failure), so a successful retry leaves no stale
    // failure banner from the first attempt next to the freshly loaded token.
    await expect(errorBanner).toHaveCount(0);
    // The `clinic-particular-token-*` id lives on the mobile row (md:hidden
    // since #1145), so at the desktop viewport the visible row is the table
    // variant tagged with data-clinic-access-table-row.
    const recoveredTokenRow = card
      .locator('[data-clinic-access-table-row="true"]')
      .filter({ hasText: "****4401" });
    await expect(recoveredTokenRow).toBeVisible();
    await expect(recoveredTokenRow).toContainText("Mora");
  });

  test("retry: a second failed load after a first failure still surfaces the new error", async ({
    page,
  }) => {
    await setClinicSession(page);

    await page.route(
      (url) => url.pathname === "/api/particular-tokens",
      (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        return fulfillJson(route, 500, { error: "E2E forced failure" });
      },
    );

    await page.goto("/dashboard?module=tokens");
    const card = page.locator("#clinic-particular-tokens");
    const errorBanner = card.getByRole("alert");
    await expect(errorBanner).toHaveText("E2E forced failure");

    // A second failed attempt must still surface a real error: clearing the
    // stale banner up front must never hide a genuine new failure.
    const refreshButton = card.getByRole("button", { name: "Actualizar", exact: true });
    await refreshButton.click();
    await expect(errorBanner).toHaveText("E2E forced failure");
  });
});

test.describe("clinic perfil → perfil público module state parity (client-driven, CL-GAP-6)", () => {
  test("loading: profile load exposes explicit loading copy", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.route("**/api/clinic/profile**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 700));
      return fulfillJson(route, 200, { success: true, profile: BLANK_PROFILE });
    });

    await page.goto("/dashboard?module=perfil");

    const editor = page.locator('[data-clinic-profile-editor="true"]');
    await expect(editor).toBeVisible();

    await expect(editor.getByText("Cargando perfil público...")).toBeVisible();

    // Since #1144 the publication label renders twice (header badge + Estado
    // tile), so pin to one match to avoid a strict-mode violation.
    await expect(editor.getByText("Borrador privado").first()).toBeVisible({
      timeout: 4_000,
    });
  });

  test("error: failed profile load shows an alert with in-app retry control", async ({
    page,
  }) => {
    await setClinicSession(page);
    await page.route("**/api/clinic/profile**", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return fulfillJson(route, 500, { error: "No se pudo cargar el perfil." });
    });

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/dashboard?module=perfil");

    const editor = page.locator('[data-clinic-profile-editor="true"]');
    await expect(editor.getByRole("alert")).toContainText("No se pudo cargar el perfil.");
    await expect(
      editor.getByRole("button", { name: "Reintentar carga", exact: true }),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectMainNotScrollContainer(page);
  });
});

test.describe("clinic perfil → cambiar contraseña module state parity (CL-GAP-6)", () => {
  test("validation error is local and needs no network mock", async ({ page }) => {
    await setClinicSession(page);
    await page.goto("/dashboard?module=perfil");

    await page.getByRole("tab", { name: "Cambiar contraseña", exact: true }).click();
    const panel = page.locator("#clinic-password-change");
    await expect(panel).toBeVisible({ timeout: 8_000 });

    await panel.locator('input[name="currentPassword"]').fill("oldpassword1");
    await panel.locator('input[name="newPassword"]').fill("newpassword1");
    await panel.locator('input[name="confirmPassword"]').fill("different1");
    await panel.getByRole("button", { name: "Actualizar contraseña" }).click();

    await expect(panel.getByRole("alert")).toHaveText(
      "La nueva contraseña y su confirmación no coinciden.",
    );
  });

  test("retry-by-resubmit leaves no stale error on a successful second attempt", async ({
    page,
  }) => {
    await setClinicSession(page);
    let passwordCallCount = 0;

    await page.route("**/api/auth/change-password", (route) => {
      passwordCallCount += 1;

      if (passwordCallCount === 1) {
        return fulfillJson(route, 401, { error: "Contraseña actual incorrecta." });
      }

      return fulfillJson(route, 200, { success: true });
    });

    await page.goto("/dashboard?module=perfil");
    await page.getByRole("tab", { name: "Cambiar contraseña", exact: true }).click();
    const panel = page.locator("#clinic-password-change");
    await expect(panel).toBeVisible({ timeout: 8_000 });

    async function fillAndSubmit() {
      await panel.locator('input[name="currentPassword"]').fill("oldpassword1");
      await panel.locator('input[name="newPassword"]').fill("newpassword1");
      await panel.locator('input[name="confirmPassword"]').fill("newpassword1");
      await panel.getByRole("button", { name: "Actualizar contraseña" }).click();
    }

    await fillAndSubmit();
    await expect(panel.getByRole("alert")).toHaveText(
      "No pudimos cambiar la contraseña. Verificá los datos e intentá nuevamente.",
    );

    await fillAndSubmit();
    // Contrast with the tokens retry gap above: here a full retry cycle (field
    // edits + resubmit) leaves no stale error, because handleSubmit() clears
    // errorMessage up front on every attempt.
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(panel.getByText("Contraseña actualizada correctamente.")).toBeVisible();
  });
});
