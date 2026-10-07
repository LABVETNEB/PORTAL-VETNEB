import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { A03_CLINIC_TOKENS } from "../../helpers/dashboard-adaptive-limit-matrix";
import { setClinicSession } from "../../helpers/session";

// CLINIC-DT-SPACE — clinic desktop/tablet space pass (reference captures in
// clinicas.zip: red = removed, yellow = kept and moved up). From 768px up the
// module header band, the summary runs and the section intros are retired, the
// filters share the top band with the actions, the pagers paint Anterior /
// Siguiente only, and Perfil becomes avatar + single-open section rows + save.
// Below 768px nothing changes; the last test pins that boundary.

const DT_VIEWPORTS = [
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1536x960", width: 1536, height: 960 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

const PHONE = { name: "390x844", width: 390, height: 844 } as const;

const TOLERANCE_PX = 1;

const PROFILE = {
  clinicId: 1,
  displayName: "Clinica Espacio Desktop",
  specialtyText: "Anatomia patologica veterinaria",
  servicesText: "Citologia, histopatologia",
  aboutText: "",
  email: "perfil-dt@example.test",
  phone: "+54 11 5555-0000",
  publicAddress: "Calle Sintetica 123",
  mapLink: "https://maps.google.com/maps?q=vetneb",
  locality: "Buenos Aires",
  country: "Argentina",
  avatarUrl: null,
  isPublic: true,
  publication: {
    isSearchEligible: true,
    qualityScore: 93,
    minimumQualityScore: 75,
    hasRequiredPublicFields: true,
    missingRequiredFields: [],
    missingRecommendedFields: ["aboutText"],
    publicationErrors: [],
  },
};

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function stubClientApis(page: Page) {
  await page.route("**/api/clinic/profile**", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return json(route, { success: true, profile: PROFILE });
  });
  await page.route("**/api/particular-tokens**", (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || url.pathname !== "/api/particular-tokens") {
      return route.fallback();
    }
    const limit = Number(url.searchParams.get("limit")) || 12;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const particularTokens = A03_CLINIC_TOKENS.slice(offset, offset + limit);
    return json(route, {
      success: true,
      count: particularTokens.length,
      particularTokens,
      pagination: { limit, offset },
    });
  });
  await page.route("**/api/study-tracking**", (route) => {
    if (new URL(route.request().url()).pathname !== "/api/study-tracking") return route.fallback();
    return json(route, { success: true, count: 0, trackingCases: [], pagination: { limit: 20, offset: 0 } });
  });
}

async function openModule(page: Page, moduleId: string) {
  await page.goto(`/dashboard?module=${moduleId}`);
  const workspace = page.locator(`[data-dashboard-module-workspace="${moduleId}"]`);
  await expect(workspace).toBeVisible({ timeout: 12_000 });
  return workspace;
}

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
  const value = await locator.boundingBox();
  if (!value) throw new Error("element has no layout box");
  return value;
}

/** Top of the module's card: everything above it in the workspace is chrome. */
async function cardTop(workspace: Locator) {
  return (await box(workspace.locator("section.dashboard-surface").first())).y;
}

async function expectZeroScroll(page: Page, label: string) {
  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const workspace = document.querySelector("[data-dashboard-module-workspace]");
    const scrollers: string[] = [];
    if (workspace) {
      for (const element of workspace.querySelectorAll<HTMLElement>("*")) {
        const style = getComputedStyle(element);
        const scrollsY = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
        const scrollsX = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
        if (scrollsY || scrollsX) scrollers.push(element.tagName + "." + element.className);
      }
    }
    return {
      docY: root.scrollHeight - root.clientHeight,
      docX: root.scrollWidth - root.clientWidth,
      scrollers,
    };
  });
  expect(state.docY, `${label}: no document vertical scroll`).toBeLessThanOrEqual(0);
  expect(state.docX, `${label}: no document horizontal scroll`).toBeLessThanOrEqual(0);
  expect(state.scrollers, `${label}: no unauthorized internal scroll`).toEqual([]);
}

/** Every painted descendant of `container` lies inside it (no clipping). */
async function expectNotClipped(container: Locator, selector: string, label: string) {
  const clipped = await container.evaluate((root, childSelector) => {
    const outer = root.getBoundingClientRect();
    return Array.from(root.querySelectorAll<HTMLElement>(childSelector))
      .filter((element) => element.getClientRects().length > 0)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > outer.bottom + 1 || rect.right > outer.right + 1;
      })
      .map((element) => element.textContent?.trim().slice(0, 40) ?? element.tagName);
  }, selector);
  expect(clipped, `${label}: no control clipped by its card`).toEqual([]);
}

async function expectChromeRetired(page: Page, workspace: Locator, label: string) {
  await expect(workspace.locator(".dashboard-workspace-header"), `${label}: module header band`).toBeHidden();
  await expect(page.locator("[data-dashboard-b14-metrics]"), `${label}: summary run`).toHaveCount(0);
  const workspaceBox = await box(workspace);
  expect((await cardTop(workspace)) - workspaceBox.y, `${label}: card starts at the workspace top`).toBeLessThanOrEqual(TOLERANCE_PX);
}

/** Pager paints exactly Anterior + Siguiente, centered, no page text. */
async function expectPrevNextPager(pager: Locator, stateLabel: Locator, label: string) {
  await expect(stateLabel, `${label}: painted page state`).toBeHidden();
  const prev = pager.getByRole("button", { name: "Página anterior" });
  const next = pager.getByRole("button", { name: "Página siguiente" });
  await expect(prev).toHaveText("Anterior");
  await expect(next).toHaveText("Siguiente");
  const pagerBox = await box(pager);
  const prevBox = await box(prev);
  const nextBox = await box(next);
  const center = (prevBox.x + nextBox.x + nextBox.width) / 2;
  expect(Math.abs(center - (pagerBox.x + pagerBox.width / 2)), `${label}: pager centered`).toBeLessThanOrEqual(2);
  const painted = await paintedText(pager);
  expect(painted, `${label}: only Anterior / Siguiente are painted`).toBe("Anterior Siguiente");
}

/**
 * Text that actually paints: leaf elements with a real box. `innerText` would
 * also return `sr-only` announcements (1px clipped boxes), which are kept on
 * purpose and are not part of the visible surface.
 */
async function paintedText(container: Locator) {
  return container.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter((element) => element.children.length === 0)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      })
      .map((element) => element.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" "),
  );
}

/** No two painted controls of a band intersect, and none overflows the band. */
async function expectBandControlsDisjoint(band: Locator, label: string) {
  const result = await band.evaluate((root) => {
    const outer = root.getBoundingClientRect();
    const boxes = Array.from(
      root.querySelectorAll<HTMLElement>("input, select, button, [role='button']"),
    )
      .map((element) => ({ name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 1 && rect.height > 1);
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i].rect;
        const b = boxes[j].rect;
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width > 1 && height > 1) overlaps.push(`${boxes[i].name} × ${boxes[j].name}`);
      }
    }
    const outside = boxes
      .filter(({ rect }) => rect.left < outer.left - 1 || rect.right > outer.right + 1)
      .map(({ name }) => name);
    return { overlaps, outside };
  });
  expect(result.overlaps, `${label}: overlapping controls`).toEqual([]);
  expect(result.outside, `${label}: controls outside the band`).toEqual([]);
}

/** Actions sit right of the filters on their row, or wrap below them, right-aligned. */
async function expectActionsBesideOrBelow(filters: Locator, action: Locator, band: Locator, label: string) {
  const filtersBox = await box(filters);
  const actionBox = await box(action);
  const bandBox = await box(band);
  const sameRow = actionBox.y < filtersBox.y + filtersBox.height;
  if (sameRow) {
    expect(actionBox.x, `${label}: action right of the filters`).toBeGreaterThanOrEqual(filtersBox.x + filtersBox.width - TOLERANCE_PX);
  } else {
    expect(actionBox.y, `${label}: wrapped action below the filters`).toBeGreaterThanOrEqual(filtersBox.y + filtersBox.height - TOLERANCE_PX);
    expect(bandBox.x + bandBox.width - (actionBox.x + actionBox.width), `${label}: wrapped action right-aligned`).toBeLessThanOrEqual(12);
  }
  return sameRow;
}

/** A heading kept only as an accessible name paints no box. */
async function expectAccessibleOnly(locator: Locator, label: string) {
  const size = await box(locator);
  expect(size.width * size.height, `${label}: not painted`).toBeLessThanOrEqual(1);
}

for (const viewport of DT_VIEWPORTS) {
  test.describe(`CLINIC-DT-SPACE · ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page, "populated");
      await stubClientApis(page);
    });

    test("operaciones: intro and summary retired, tabs and cards at the top", async ({ page }) => {
      const workspace = await openModule(page, "operaciones");
      await expectChromeRetired(page, workspace, "operaciones");
      const center = workspace.locator('[data-clinic-command-center="true"]');
      const tabs = center.getByRole("tab");
      await expect(tabs).toHaveText(["Métricas", "Recientes", "Estado"]);
      expect((await box(tabs.first())).y - (await box(center)).y).toBeLessThanOrEqual(8);
      await expectAccessibleOnly(center.getByRole("heading", { name: "Métricas operativas" }), "operaciones heading");
      await expect(center.getByText("Vista rápida de informes, pendientes y actividad logística del día.")).toBeHidden();
      // The heading stays as the section's accessible name.
      await expect(center.getByRole("region", { name: "Métricas operativas" })).toBeAttached();
      const firstCard = center.getByText("Informes totales");
      await expect(firstCard).toBeVisible();
      expect((await box(firstCard)).y - (await box(tabs.first())).y).toBeLessThanOrEqual(60);
      await center.getByRole("tab", { name: "Recientes" }).click();
      await expect(center.getByText("Informes recientes")).toBeVisible();
      await expectZeroScroll(page, "operaciones");
    });

    test("informes: filters and CTA share the top band, pager is prev/next only", async ({ page }) => {
      const workspace = await openModule(page, "informes");
      await expectChromeRetired(page, workspace, "informes");
      const toolbar = workspace.locator('[data-clinic-reports-toolbar="true"]');
      const filters = toolbar.locator('[data-clinic-report-filter-bar="advanced"]');
      const cta = toolbar.getByRole("button", { name: "Abrir módulo completo de informes" });
      await expect(filters).toBeVisible();
      await expect(cta).toBeVisible();
      const sameRow = await expectActionsBesideOrBelow(filters, cta, toolbar, "informes");
      if (viewport.width >= 1536) expect(sameRow, "wide desktop keeps one row").toBe(true);
      await expectBandControlsDisjoint(toolbar, "informes");
      for (const label of ["Informe", "Paciente", "Estado", "Estudio", "Archivo", "Desde", "Hasta"]) {
        await expect(filters.getByText(label, { exact: true })).toBeVisible();
      }
      await expect(filters.getByRole("button", { name: "Aplicar" })).toBeVisible();
      await expect(filters.getByRole("button", { name: "Limpiar" })).toBeVisible();
      const table = workspace.locator('[data-clinic-reports-table="true"]');
      const toolbarBox = await box(toolbar);
      expect((await box(table)).y - (toolbarBox.y + toolbarBox.height)).toBeLessThanOrEqual(16);
      await expectPrevNextPager(
        workspace.locator('[data-clinic-reports-pagination-controls="true"]'),
        workspace.locator('[data-clinic-reports-pagination-status="true"]'),
        "informes",
      );
      await expectZeroScroll(page, "informes");
    });

    test("logistica: summary retired, CTA kept at the top right", async ({ page }) => {
      const workspace = await openModule(page, "logistica");
      await expectChromeRetired(page, workspace, "logistica");
      const card = workspace.locator('[data-clinic-mobile-module="logistica"]');
      const cta = card.getByRole("button", { name: "Abrir módulo completo de logística" });
      await expect(cta).toBeVisible();
      const cardBox = await box(card);
      const ctaBox = await box(cta);
      expect(ctaBox.y - cardBox.y).toBeLessThanOrEqual(10);
      expect(cardBox.x + cardBox.width - (ctaBox.x + ctaBox.width)).toBeLessThanOrEqual(10);
      await expect(card.getByText(/Visitas · .* Activas/)).toHaveCount(0);
      await expectZeroScroll(page, "logistica");
    });

    test("tokens: intro, summary and list header retired; filters left, actions right; prev/next pager", async ({ page }) => {
      const workspace = await openModule(page, "tokens");
      await expectChromeRetired(page, workspace, "tokens");
      const card = workspace.locator("#clinic-particular-tokens");
      const toolbar = card.locator('[data-clinic-access-toolbar="true"]');
      await expect(card.getByText("Tokens particulares de la clínica.")).toBeHidden();
      await expect(card.getByText("Últimos tokens de la clínica")).toHaveCount(0);
      await expect(card.getByText("Lista paginada sin scroll interno.")).toHaveCount(0);
      const filters = toolbar.locator('[data-clinic-access-filter-bar="advanced"]');
      await expect(filters).toBeVisible({ timeout: 12_000 });
      const refresh = toolbar.getByRole("button", { name: "Actualizar" });
      const generate = toolbar.getByRole("button", { name: "Generar token particular" });
      await expect(refresh).toBeVisible();
      await expect(generate).toBeVisible();
      const toolbarBox = await box(toolbar);
      expect(toolbarBox.y - (await box(card)).y).toBeLessThanOrEqual(TOLERANCE_PX + 1);
      const sameRow = await expectActionsBesideOrBelow(filters, generate, toolbar, "tokens");
      if (viewport.width >= 1536) expect(sameRow, "wide desktop keeps one row").toBe(true);
      expect((await box(generate)).x, "Generar after Actualizar").toBeGreaterThan((await box(refresh)).x);
      expect(Math.abs((await box(generate)).y - (await box(refresh)).y), "actions share one row").toBeLessThanOrEqual(TOLERANCE_PX);
      await expectBandControlsDisjoint(toolbar, "tokens");
      const table = card.locator('[data-clinic-access-table="true"]');
      expect((await box(table)).y - (toolbarBox.y + toolbarBox.height)).toBeLessThanOrEqual(24);
      await expectPrevNextPager(
        card.locator('[data-clinic-access-pagination-controls="true"]'),
        card.locator('[data-clinic-access-pagination-status="true"]'),
        "tokens",
      );
      // The painted state is phone-only, but assistive tech still gets the
      // page state from 768px up, and it follows Anterior / Siguiente.
      const announcement = card.locator('[data-clinic-access-pagination-announcement="true"]');
      await expect(announcement).toHaveAttribute("aria-live", "polite");
      await expect(announcement).toHaveText(/^Página 1 de (\d+), 1–(\d+) de (\d+)$/);
      await expectAccessibleOnly(announcement, "tokens page announcement");
      const pageCount = Number((await announcement.textContent())?.match(/de (\d+),/)?.[1]);
      expect(pageCount, "the stubbed dataset spans several pages").toBeGreaterThan(1);
      await card.getByRole("button", { name: "Página siguiente" }).click();
      await expect(announcement).toHaveText(new RegExp(`^Página 2 de ${pageCount}, `));
      await card.getByRole("button", { name: "Página anterior" }).click();
      await expect(announcement).toHaveText(new RegExp(`^Página 1 de ${pageCount}, 1–`));
      await expectZeroScroll(page, "tokens");
    });

    test("perfil: avatar on top, single-open sections in order, state kept, save last", async ({ page }) => {
      const workspace = await openModule(page, "perfil");
      await expectChromeRetired(page, workspace, "perfil");
      const editor = workspace.locator('[data-clinic-profile-editor="true"]');
      const desktopActions = editor.locator('[data-clinic-profile-desktop-actions="true"]');
      await expect(desktopActions.getByText("Visible en banco")).toBeVisible({ timeout: 12_000 });
      await expect(editor.locator('[data-clinic-profile-toolbar="true"]')).toBeHidden();
      await expect(editor.getByText(/Recomendados:/)).toBeHidden();
      await expect(editor.getByRole("tab")).toHaveCount(0);

      const avatar = editor.getByText("Avatar o logo", { exact: true });
      await expect(avatar).toBeVisible();
      expect((await box(avatar)).y - (await box(editor)).y).toBeLessThanOrEqual(24);

      const toggles = editor.locator("[data-clinic-profile-section-toggle]");
      await expect(toggles).toHaveText(["Datos", "Contacto", "Contenido", "Cambiar contraseña"]);
      const save = editor.getByRole("button", { name: "Guardar perfil público" });
      const sequence = [avatar, ...(await toggles.all()), save];
      for (let index = 1; index < sequence.length; index += 1) {
        expect((await box(sequence[index])).y, `sequence position ${index}`).toBeGreaterThan(
          (await box(sequence[index - 1])).y,
        );
      }

      const sections = {
        Datos: "#clinic-profile-display-name",
        Contacto: "#clinic-profile-email",
        Contenido: "#clinic-profile-services",
        "Cambiar contraseña": 'input[name="currentPassword"]',
      } as const;
      for (const [name, field] of Object.entries(sections)) {
        const toggle = editor.getByRole("button", { name, exact: true });
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(editor.locator(field)).toBeVisible();
        for (const [otherName, otherField] of Object.entries(sections)) {
          if (otherName === name) continue;
          await expect(editor.locator(otherField), `${name} open hides ${otherName}`).toBeHidden();
          await expect(editor.getByRole("button", { name: otherName, exact: true })).toHaveAttribute("aria-expanded", "false");
        }
        await expectZeroScroll(page, `perfil ${name}`);
        await expectNotClipped(editor, "button, input, textarea, label", `perfil ${name}`);
      }

      // Unsaved values survive section changes, password included.
      await editor.getByRole("button", { name: "Datos", exact: true }).click();
      await editor.locator("#clinic-profile-display-name").fill("Nombre sin guardar");
      await editor.getByRole("button", { name: "Cambiar contraseña", exact: true }).click();
      await editor.locator('input[name="currentPassword"]').fill("actual-sin-enviar");
      await editor.getByRole("button", { name: "Contacto", exact: true }).click();
      await editor.getByRole("button", { name: "Datos", exact: true }).click();
      await expect(editor.locator("#clinic-profile-display-name")).toHaveValue("Nombre sin guardar");
      await editor.getByRole("button", { name: "Cambiar contraseña", exact: true }).click();
      await expect(editor.locator('input[name="currentPassword"]')).toHaveValue("actual-sin-enviar");

      // The save action keeps its handler and payload.
      await editor.getByRole("button", { name: "Datos", exact: true }).click();
      const patch = page.waitForRequest(
        (request) => request.method() === "PATCH" && new URL(request.url()).pathname === "/api/clinic/profile",
      );
      await page.route("**/api/clinic/profile**", (route) => {
        if (route.request().method() !== "PATCH") return route.fallback();
        return json(route, {
          success: true,
          message: "Perfil público actualizado.",
          profile: { ...PROFILE, displayName: "Nombre sin guardar" },
        });
      });
      await editor.getByRole("button", { name: "Guardar perfil público" }).click();
      const payload = (await patch).postDataJSON() as Record<string, unknown>;
      expect(payload.displayName).toBe("Nombre sin guardar");
      expect(payload.isPublic).toBe(true);
      await expect(editor.getByText("Perfil público actualizado.")).toBeVisible();

      // Avatar feedback stays reachable with "Cambiar contraseña" open (the
      // save status above is still current, so the footer carries it there).
      await editor.getByRole("button", { name: "Cambiar contraseña", exact: true }).click();
      await expect(editor.locator('input[name="currentPassword"]')).toBeVisible();
      await expect(editor.getByRole("status").filter({ hasText: "Perfil público actualizado." })).toBeVisible();
      await expect(avatar).toBeVisible();
      await editor.locator("#clinic-profile-avatar").setInputFiles({
        name: "no-imagen.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });
      const avatarError = editor.locator('[data-clinic-profile-footer="true"] [role="alert"]');
      await expect(avatarError).toHaveText("La imagen debe ser JPG, PNG o WebP.");
      await expect(avatarError).toBeVisible();
      await expect(editor.locator('input[name="currentPassword"]'), "password stays open").toBeVisible();
      await expectZeroScroll(page, "perfil avatar feedback");

      // Rows stay at a readable width instead of spanning a wide workspace.
      const stack = editor.locator('[data-clinic-profile-stack="true"]');
      const stackWidth = (await box(stack)).width;
      expect(stackWidth).toBeLessThanOrEqual(768 + TOLERANCE_PX);
      expect(stackWidth).toBeGreaterThanOrEqual(Math.min(600, viewport.width - 140));
    });
  });
}

test.describe("CLINIC-DT-SPACE · avatar status while Cambiar contraseña is open", () => {
  test("removing the avatar announces its result from 768px up", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await setClinicSession(page, "populated");
    await stubClientApis(page);
    await page.route("**/api/clinic/profile**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/api/clinic/profile" && route.request().method() === "GET") {
        return json(route, { success: true, profile: { ...PROFILE, avatarUrl: "/icons/icon-192x192.png" } });
      }
      if (pathname === "/api/clinic/profile/avatar" && route.request().method() === "DELETE") {
        return json(route, { success: true, message: "Imagen eliminada.", profile: PROFILE });
      }
      return route.fallback();
    });
    const workspace = await openModule(page, "perfil");
    const editor = workspace.locator('[data-clinic-profile-editor="true"]');
    const remove = editor.getByRole("button", { name: "Quitar imagen" });
    await expect(remove).toBeEnabled({ timeout: 12_000 });
    await editor.getByRole("button", { name: "Cambiar contraseña", exact: true }).click();
    await editor.locator('input[name="currentPassword"]').fill("actual-sin-enviar");
    // Nothing to report yet: the section adds no feedback band.
    await expect(editor.locator('[data-clinic-profile-footer="true"]')).toHaveCount(0);
    await remove.click();
    await expect(editor.getByRole("status").filter({ hasText: "Imagen eliminada." })).toBeVisible();
    await expect(editor.locator('input[name="currentPassword"]'), "password state kept").toHaveValue("actual-sin-enviar");
  });
});

test.describe(`CLINIC-DT-SPACE · phone boundary ${PHONE.name}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
    await setClinicSession(page, "populated");
    await stubClientApis(page);
  });

  test("below 768px the previous mobile contract is intact", async ({ page }) => {
    let workspace = await openModule(page, "perfil");
    const editor = workspace.locator('[data-clinic-profile-editor="true"]');
    await expect(editor.getByRole("tab")).toHaveText(["Estado", "Datos", "Contacto", "Contenido", "Cambiar contraseña"]);
    await expect(editor.locator("[data-clinic-profile-section-toggle]").first()).toBeHidden();
    await expect(editor.locator('[data-clinic-profile-toolbar="true"]')).toBeVisible();
    await expect(editor.getByText(/Recomendados:/)).toBeVisible({ timeout: 12_000 });
    await editor.getByRole("tab", { name: "Datos" }).click();
    await expect(editor.getByText("Avatar o logo", { exact: true })).toBeHidden();
    await expect(editor.locator("#clinic-profile-display-name")).toBeVisible();

    workspace = await openModule(page, "informes");
    await expect(workspace.locator('[data-clinic-reports-pagination-status="true"]')).toHaveText(/Pág\. 1 \/ \d+/);
    await expect(workspace.locator('[data-clinic-report-filter-bar="advanced"]')).toBeHidden();

    workspace = await openModule(page, "tokens");
    await expect(workspace.locator('[data-clinic-access-pagination-announcement="true"]')).toBeHidden();
    await expect(workspace.locator('[data-clinic-access-pagination-status="true"]')).toHaveText(/Página 1 \/ \d+/, {
      timeout: 12_000,
    });
  });
});
