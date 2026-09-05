import { expect, test, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2B — Clinic dashboard mobile compaction / operational density.
//
// Every clinic mobile module rendered a second, redundant title+subtitle pair
// inside its own ModuleSurface toolbar on top of the module's own header
// (DashboardModuleWorkspace already renders the module title once). This spec
// pins: the duplicated copy stays removed, secondary CTAs share a compact
// (h-8/32px) scale, the operational chrome cannot be selected by accident
// while form fields remain editable, and pinch-zoom stays available on the
// clinic mobile shell (low-vision accessibility) while interactive controls
// use `touch-action: manipulation` to suppress accidental double-tap zoom.
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
] as const;

const COMPACT_BUTTON_MAX_HEIGHT = 34;

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

for (const viewport of VIEWPORTS) {
  test.describe(`clinic mobile operational density — ${viewport.name}`, () => {
    test("informes: redundant header removed, filter/link CTAs compact", async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await setPopulatedClinicSession(page);
      await page.goto("/dashboard?module=informes");
      const workspace = page.locator(
        '[data-dashboard-module-workspace="informes"]',
      );
      await expect(workspace).toBeVisible({ timeout: 15_000 });

      await expect(
        workspace.getByText("Informes recientes", { exact: true }),
      ).toHaveCount(0);
      await expect(
        workspace.getByText("Últimos estudios cargados", { exact: false }),
      ).toHaveCount(0);

      const openFullModule = workspace.getByRole("button", {
        name: "Abrir módulo completo de informes",
      });
      await expect(openFullModule).toBeVisible();
      const box = await openFullModule.boundingBox();
      expect(box?.height ?? 0).toBeLessThanOrEqual(COMPACT_BUTTON_MAX_HEIGHT);
    });

    test("logistica: redundant header removed, link CTA compact", async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await setPopulatedClinicSession(page);
      await page.goto("/dashboard?module=logistica");
      const workspace = page.locator(
        '[data-dashboard-module-workspace="logistica"]',
      );
      await expect(workspace).toBeVisible({ timeout: 15_000 });

      await expect(
        workspace.getByText("Visitas de campo recientes", { exact: true }),
      ).toHaveCount(0);
      await expect(
        workspace.getByText("Programación logística activa", { exact: false }),
      ).toHaveCount(0);

      const openFullModule = workspace.getByRole("button", {
        name: "Abrir módulo completo de logística",
      });
      await expect(openFullModule).toBeVisible();
      const box = await openFullModule.boundingBox();
      expect(box?.height ?? 0).toBeLessThanOrEqual(COMPACT_BUTTON_MAX_HEIGHT);
    });

    test("perfil: redundant header removed, save CTA compact, content reachable", async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await setPopulatedClinicSession(page);
      await page.goto("/dashboard?module=perfil");
      const workspace = page.locator(
        '[data-dashboard-module-workspace="perfil"]',
      );
      await expect(workspace).toBeVisible({ timeout: 15_000 });

      await expect(
        workspace.getByText("Perfil para banco de especialidades", {
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        workspace.getByText("Publicación, calidad, avatar", { exact: false }),
      ).toHaveCount(0);

      const saveButton = workspace.getByRole("button", {
        name: "Guardar perfil público",
        exact: true,
      });
      await expect(saveButton).toBeVisible();
      const box = await saveButton.boundingBox();
      expect(box?.height ?? 0).toBeLessThanOrEqual(COMPACT_BUTTON_MAX_HEIGHT);
    });

    test("tokens: redundant header removed (module title kept once), CTAs compact", async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await setPopulatedClinicSession(page);
      await page.goto("/dashboard?module=tokens");
      const workspace = page.locator(
        '[data-dashboard-module-workspace="tokens"]',
      );
      await expect(workspace).toBeVisible({ timeout: 15_000 });

      await expect(
        workspace.getByText("Generación, actualización, estado", {
          exact: false,
        }),
      ).toHaveCount(0);
      // The outer DashboardModuleWorkspace header still renders the module
      // title exactly once — it must not be duplicated.
      await expect(
        workspace.getByText("Tokens particulares", { exact: true }),
      ).toHaveCount(1);

      const updateButton = workspace.getByRole("button", { name: "Actualizar" });
      await expect(updateButton).toBeVisible();
      const updateBox = await updateButton.boundingBox();
      expect(updateBox?.height ?? 0).toBeLessThanOrEqual(COMPACT_BUTTON_MAX_HEIGHT);

      // This suite is mobile-only (360/375/390, all below `md`), where the
      // create control paints its short label; the long one is a
      // `hidden md:inline` fragment and is excluded from the accessible name
      // here. `exact` on purpose: a substring match would also accept the
      // desktop label and stop distinguishing the two contracts.
      const generateButton = workspace.getByRole("button", {
        name: "Generar token",
        exact: true,
      });
      await expect(generateButton).toBeVisible();
      const generateBox = await generateButton.boundingBox();
      expect(generateBox?.height ?? 0).toBeLessThanOrEqual(
        COMPACT_BUTTON_MAX_HEIGHT,
      );
    });

    test("no horizontal overflow on any of the four compacted modules", async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await setPopulatedClinicSession(page);

      for (const moduleId of ["informes", "logistica", "perfil", "tokens"]) {
        await page.goto(`/dashboard?module=${moduleId}`);
        await expect(
          page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
        ).toBeVisible({ timeout: 15_000 });
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          overflow.scrollWidth,
          `${moduleId}: no horizontal overflow`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 2);
      }
    });
  });
}

test.describe("clinic mobile shell — anti-selection and anti-zoom", () => {
  test("operational chrome is not selectable, form fields remain editable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 15_000 });

    const shellStyles = await page.evaluate(() => {
      const heading = document.querySelector(
        ".dashboard-section-heading",
      ) as HTMLElement | null;
      return {
        headingUserSelect: heading
          ? getComputedStyle(heading).userSelect
          : null,
      };
    });

    expect(
      shellStyles.headingUserSelect,
      "operational headings are not selectable",
    ).toBe("none");
  });

  test("pinch-zoom stays available on the shell, interactive controls use manipulation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 15_000 });

    const touchActions = await page.evaluate(() => {
      const computedTouchAction = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        return el ? getComputedStyle(el).touchAction : null;
      };
      return {
        shell: computedTouchAction('[data-vetneb-app-shell-surface="clinic"]'),
        button: computedTouchAction(
          '[data-vetneb-app-shell-surface="clinic"] button',
        ),
        tab: computedTouchAction(
          '[data-vetneb-app-shell-surface="clinic"] [role="tab"]',
        ),
      };
    });

    // Low-vision accessibility: the shell must never opt out of pinch-zoom.
    // `auto` and `manipulation` both allow pinch-zoom; any pan-* value that
    // omits pinch-zoom (or `none`) blocks it.
    const allowsPinchZoom = (touchAction: string | null) =>
      touchAction === "auto" ||
      touchAction === "manipulation" ||
      (touchAction ?? "").includes("pinch-zoom");
    expect(touchActions.shell, "shell computed touch-action").not.toBeNull();
    expect(
      allowsPinchZoom(touchActions.shell),
      `shell touch-action "${touchActions.shell}" must allow pinch-zoom`,
    ).toBe(true);
    expect(touchActions.shell).not.toBe("pan-x pan-y");

    // Interactive controls suppress accidental double-tap zoom / tap delay
    // without blocking pinch-zoom.
    expect(
      touchActions.button,
      "clinic buttons use touch-action: manipulation",
    ).toBe("manipulation");
    expect(
      touchActions.tab,
      "clinic tabs use touch-action: manipulation",
    ).toBe("manipulation");
  });

  test("perfil form inputs stay selectable and editable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=perfil");
    await expect(
      page.locator('[data-dashboard-module-workspace="perfil"]'),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("tab", { name: "Datos", exact: true }).click();
    const nameInput = page.locator("#clinic-profile-display-name");
    await expect(nameInput).toBeVisible();

    const inputUserSelect = await nameInput.evaluate(
      (el) => getComputedStyle(el).userSelect,
    );
    expect(inputUserSelect, "profile inputs stay selectable").toBe("text");

    await nameInput.fill("Clínica de prueba editable");
    await expect(nameInput).toHaveValue("Clínica de prueba editable");
  });

  test("desktop (1280x800) is unaffected by the mobile-only anti-select/anti-zoom rules", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=operaciones");
    await expect(
      page.locator('[data-dashboard-module-workspace="operaciones"]'),
    ).toBeVisible({ timeout: 15_000 });

    const heading = page.locator(".dashboard-section-heading").first();
    const headingUserSelect = await heading.evaluate(
      (el) => getComputedStyle(el).userSelect,
    );
    // The mobile-only rule block (max-width: 767px) must not apply at desktop.
    expect(headingUserSelect).not.toBe("none");
  });
});
