import { crc32, deflateSync } from "node:zlib";
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

/** A valid, flat RGB PNG: big enough for the 160 px avatar floor, tiny on the wire. */
function syntheticPng(size: number) {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(body));
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc((size * 3 + 1) * size, 0x5a);
  for (let row = 0; row < size; row += 1) rows[row * (size * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

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

    // C25 F-T5 · HEAD 25cd6e50 truncated "Informes pendientes" to 79/95/112 px
    // of 139 at 1024/1280/1366: icon + label + "Prioridad" shared one row. The
    // pill now sits on the value row and the label never truncates; every card
    // keeps one height (106 px measured on HEAD and after).
    test("operaciones: every StatsCards label is readable in full, Prioridad kept", async ({ page }) => {
      const workspace = await openModule(page, "operaciones");
      const cards = workspace.locator(".dashboard-metric-card");
      await expect(cards).toHaveCount(4);
      for (const label of ["Informes totales", "Informes pendientes", "Visitas activas", "Planes de ruta"]) {
        const card = cards.filter({ hasText: label });
        const text = card.getByText(label, { exact: true });
        await expect(text, `${label}: visible`).toBeVisible();
        const fit = await text.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const cardRect = element.closest(".dashboard-metric-card")!.getBoundingClientRect();
          return {
            horizontal: element.scrollWidth <= element.clientWidth,
            vertical: element.scrollHeight <= element.clientHeight,
            inside: rect.right <= cardRect.right + 1 && rect.bottom <= cardRect.bottom + 1,
            ellipsis: getComputedStyle(element).textOverflow,
          };
        });
        expect(fit, `${label}: whole label painted inside its card`).toEqual({
          horizontal: true,
          vertical: true,
          inside: true,
          ellipsis: "clip",
        });
      }
      const pending = cards.filter({ hasText: "Informes pendientes" });
      const pill = pending.getByText("Prioridad", { exact: true });
      await expect(pill).toBeVisible();
      const [pillBox, cardBox] = await Promise.all([box(pill), box(pending)]);
      expect(pillBox.x + pillBox.width, "Prioridad inside its card").toBeLessThanOrEqual(cardBox.x + cardBox.width + TOLERANCE_PX);
      const heights = await cards.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
      expect(Math.max(...heights) - Math.min(...heights), "the four cards keep one height").toBeLessThanOrEqual(TOLERANCE_PX);
      await expectNotClipped(pending, "span, p", "Informes pendientes card");
      await expectZeroScroll(page, "operaciones F-T5");
    });

    test("informes: filters own the top band, CTA beside them or in the pager footer, pager is prev/next only", async ({ page }) => {
      const workspace = await openModule(page, "informes");
      await expectChromeRetired(page, workspace, "informes");
      const toolbar = workspace.locator('[data-clinic-reports-toolbar="true"]');
      const filters = toolbar.locator('[data-clinic-report-filter-bar="advanced"]');
      const ctaName = { name: "Abrir módulo completo de informes" };
      await expect(filters).toBeVisible();
      if (viewport.width >= 1536) {
        const cta = toolbar.getByRole("button", ctaName);
        await expect(cta).toBeVisible();
        expect(await expectActionsBesideOrBelow(filters, cta, toolbar, "informes"), "wide desktop keeps one row").toBe(true);
      } else {
        // C23b PR5: the CTA no longer wraps into a second band row above the
        // data; it takes the free right edge of the pager footer.
        await expect(toolbar.getByRole("button", ctaName)).toHaveCount(0);
        const footer = workspace.locator('[data-clinic-reports-pagination-footer="true"]');
        const cta = footer.getByRole("button", ctaName);
        await expect(cta).toBeVisible();
        await expectBandControlsDisjoint(footer, "informes footer");
        const ctaBox = await box(cta);
        const nextBox = await box(footer.getByRole("button", { name: "Página siguiente" }));
        const footerBox = await box(footer);
        expect(ctaBox.x, "CTA right of Siguiente").toBeGreaterThan(nextBox.x + nextBox.width);
        expect(ctaBox.y, "CTA inside the footer").toBeGreaterThanOrEqual(footerBox.y - TOLERANCE_PX);
        expect(ctaBox.y + ctaBox.height, "CTA inside the footer").toBeLessThanOrEqual(footerBox.y + footerBox.height + TOLERANCE_PX);
        // Tab order: Siguiente → CTA → back; the focus ring (2 + 2 px offset)
        // stays inside the clipping list panel.
        const next = footer.getByRole("button", { name: "Página siguiente" });
        await expect(next).toBeEnabled();
        await next.focus();
        await page.keyboard.press("Tab");
        await expect(cta).toBeFocused();
        const panelBox = await box(workspace.locator('[data-clinic-reports-list-panel="true"]'));
        expect(ctaBox.x + ctaBox.width + 4, "focus ring inside the panel").toBeLessThanOrEqual(panelBox.x + panelBox.width);
        expect(ctaBox.y + ctaBox.height + 4, "focus ring inside the panel").toBeLessThanOrEqual(panelBox.y + panelBox.height);
        await page.keyboard.press("Shift+Tab");
        await expect(next).toBeFocused();
      }
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

    test("perfil: institutional column + editing column, single-open sections in order, state kept, save last", async ({ page }) => {
      const workspace = await openModule(page, "perfil");
      await expectChromeRetired(page, workspace, "perfil");
      const editor = workspace.locator('[data-clinic-profile-editor="true"]');
      const institutional = editor.locator('[data-clinic-profile-institutional="true"]');
      const editing = editor.locator('[data-clinic-profile-editing="true"]');
      await expect(
        institutional.locator('[data-clinic-profile-publication="true"]').getByText("Visible en banco"),
      ).toBeVisible({ timeout: 12_000 });
      await expect(editor.locator('[data-clinic-profile-toolbar="true"]')).toBeHidden();
      await expect(editor.getByText(/Recomendados:/)).toBeHidden();
      await expect(editor.getByRole("tab")).toHaveCount(0);

      // Institutional column: logo, identity, publication state; the editor sits
      // beside it from 1200px and under it between 768px and 1199px.
      const avatar = institutional.locator('[data-clinic-profile-logo="true"]');
      await expect(avatar).toBeVisible();
      await expect(institutional.getByText("Clinica Espacio Desktop", { exact: true })).toBeVisible();
      const stackBox = await box(editor.locator('[data-clinic-profile-stack="true"]'));
      const institutionalBox = await box(institutional);
      const editingBox = await box(editing);
      if (viewport.width >= 1200) {
        expect(institutionalBox.x + institutionalBox.width, "columns do not overlap").toBeLessThanOrEqual(editingBox.x + TOLERANCE_PX);
        const share = institutionalBox.width / stackBox.width;
        expect(share, "institutional column ~1/3").toBeGreaterThan(0.28);
        expect(share, "institutional column ~1/3").toBeLessThan(0.4);
      } else {
        expect(institutionalBox.y + institutionalBox.height, "band above the editor").toBeLessThanOrEqual(editingBox.y + TOLERANCE_PX);
      }

      const toggles = editor.locator("[data-clinic-profile-section-toggle]");
      await expect(toggles).toHaveText(["Datos", "Contacto", "Contenido", "Cambiar contraseña"]);
      const save = editor.getByRole("button", { name: "Guardar perfil público" });
      const sequence = [...(await toggles.all()), save];
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

      // The two regions use the workspace width instead of a capped column.
      expect(stackBox.width).toBeGreaterThanOrEqual(Math.min(600, viewport.width - 140));
      expect(editingBox.width).toBeGreaterThanOrEqual(Math.min(480, viewport.width - 140));
    });

    test("perfil: isPublic lives in the institutional column and rides the payload; the password form stays independent", async ({ page }) => {
      const workspace = await openModule(page, "perfil");
      const editor = workspace.locator('[data-clinic-profile-editor="true"]');
      const publication = editor.locator('[data-clinic-profile-publication="true"]');
      await expect(publication.getByText("Visible en banco")).toBeVisible({ timeout: 12_000 });

      // Real quality numbers only; no invented counters or unsaved-change claims.
      await expect(publication.getByRole("meter", { name: "Calidad del perfil" })).toHaveAttribute("aria-valuenow", "93");
      await expect(publication.getByText(/\/ mínimo 75/)).toBeVisible();
      await expect(publication.getByText("Recomendados pendientes")).toBeVisible();
      await expect(editor.getByText(/Cambios sin guardar/)).toHaveCount(0);
      await expect(editor.getByText(/\b\d+\/\d+\b/)).toHaveCount(0);

      // One checkbox is exposed (the phone copy inside "Contenido" is hidden), it is
      // reachable whatever section is open, and it keeps its meaning in the payload.
      const isPublic = editor.getByRole("checkbox");
      await expect(isPublic).toHaveCount(1);
      await expect(isPublic).toBeChecked();
      await editor.getByRole("button", { name: "Contenido", exact: true }).click();
      await isPublic.uncheck();
      await editor.getByRole("button", { name: "Datos", exact: true }).click();
      await expect(isPublic, "value kept across sections").not.toBeChecked();
      await page.route("**/api/clinic/profile**", (route) => {
        if (route.request().method() !== "PATCH") return route.fallback();
        return json(route, { success: true, message: "Perfil público actualizado.", profile: { ...PROFILE, isPublic: false } });
      });
      const patch = page.waitForRequest(
        (request) => request.method() === "PATCH" && new URL(request.url()).pathname === "/api/clinic/profile",
      );
      await editor.getByRole("button", { name: "Guardar perfil público" }).click();
      expect(((await patch).postDataJSON() as Record<string, unknown>).isPublic).toBe(false);
      await expect(editor.getByRole("status").filter({ hasText: "Perfil público actualizado." })).toBeVisible();
      await expectZeroScroll(page, "perfil isPublic saved");

      // One profile form; the password panel owns a different one and is not nested in it.
      await expect(page.locator("form#clinic-public-profile-form")).toHaveCount(1);
      const passwordForm = await editor.locator('input[name="currentPassword"]').evaluate((input) => {
        const form = input.closest("form");
        return { id: form?.id ?? null, insideProfileForm: Boolean(input.closest("#clinic-public-profile-form")) };
      });
      expect(passwordForm.insideProfileForm).toBe(false);
      expect(passwordForm.id).not.toBe("clinic-public-profile-form");
      await editor.getByRole("button", { name: "Cambiar contraseña", exact: true }).click();
      await expect(editor.getByRole("button", { name: "Guardar perfil público" })).toHaveCount(0);
      await expect(editor.getByRole("button", { name: "Actualizar contraseña" })).toBeVisible();
    });

    test("perfil: the avatar is operable from the keyboard — pick, preview, cancel, upload, remove", async ({ page }) => {
      const workspace = await openModule(page, "perfil");
      const editor = workspace.locator('[data-clinic-profile-editor="true"]');
      await expect(editor.locator('[data-clinic-profile-publication="true"]').getByText("Visible en banco")).toBeVisible({ timeout: 12_000 });

      const input = editor.locator("#clinic-profile-avatar");
      const picker = editor.locator('[data-clinic-profile-avatar-picker="true"]');
      await expect(picker).toBeVisible();
      await expect(input, "the real input is kept, only visually hidden").toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
      await expect(editor.getByRole("button", { name: "Guardar imagen" })).toBeDisabled();
      await expect(editor.getByRole("button", { name: "Quitar imagen" })).toBeDisabled();

      // Keyboard focus lands on the real input and the visible control shows a ring.
      await input.focus();
      await expect(input).toBeFocused();
      const ring = await picker.evaluate((label) => getComputedStyle(label).boxShadow);
      expect(ring, "focus ring is painted on the visible picker").not.toBe("none");
      const named = await input.evaluate((element) => {
        const labels = Array.from((element as HTMLInputElement).labels ?? []).map((label) => label.textContent?.trim());
        return labels.join(" | ");
      });
      expect(named).toContain("Avatar o logo");
      expect(named).toContain("Elegir imagen");

      const chooser = page.waitForEvent("filechooser");
      await page.keyboard.press("Space");
      await (await chooser).setFiles({ name: "logo-sintetico.png", mimeType: "image/png", buffer: syntheticPng(200) });
      await expect(editor.locator("[data-clinic-profile-avatar-file]")).toHaveText("logo-sintetico.png");
      await expect(editor.locator('[data-clinic-profile-logo="true"] img')).toHaveAttribute("src", /^blob:/);
      await expect(editor.getByRole("button", { name: "Guardar imagen" })).toBeEnabled();

      // Cancelling the chooser (no file) clears the selection and the preview.
      await input.setInputFiles([]);
      await expect(editor.getByRole("button", { name: "Guardar imagen" })).toBeDisabled();
      await expect(editor.locator("[data-clinic-profile-avatar-file]")).toHaveText("Ninguna imagen seleccionada");

      // Upload, then remove: both keep the success status accessible.
      const AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0f5c63"/></svg>');
      await page.route("**/api/clinic/profile/avatar**", (route) => {
        if (route.request().method() === "POST") {
          return json(route, { success: true, message: "Avatar actualizado.", profile: { ...PROFILE, avatarUrl: AVATAR } });
        }
        if (route.request().method() === "DELETE") {
          return json(route, { success: true, message: "Avatar eliminado.", profile: { ...PROFILE, avatarUrl: null } });
        }
        return route.fallback();
      });
      await input.setInputFiles({ name: "logo-sintetico.png", mimeType: "image/png", buffer: syntheticPng(200) });
      await editor.getByRole("button", { name: "Guardar imagen" }).click();
      await expect(editor.getByRole("status").filter({ hasText: "Avatar actualizado." })).toBeVisible();
      await expect(editor.getByRole("button", { name: "Quitar imagen" })).toBeEnabled();
      await editor.getByRole("button", { name: "Quitar imagen" }).click();
      await expect(editor.getByRole("status").filter({ hasText: "Avatar eliminado." })).toBeVisible();
      await expect(editor.getByRole("button", { name: "Quitar imagen" })).toBeDisabled();

      // Invalid files are announced as an alert, with the editor still in view.
      await input.setInputFiles({ name: "no-imagen.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
      await expect(editor.getByRole("alert").filter({ hasText: "La imagen debe ser JPG, PNG o WebP." })).toBeVisible();
      await expectZeroScroll(page, "perfil avatar flow");
      await expectNotClipped(editor, "button, input, textarea, label", "perfil avatar flow");
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

// PR-BUG-01: the S7 bar renders on every load state, and filtering never
// hides a load failure behind a false empty list.
test.describe("CLINIC-DT-SPACE · PR-BUG-01 tokens bar on empty and failed loads", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await setClinicSession(page, "populated");
    await stubClientApis(page);
  });

  async function stubTokens(page: Page, mode: { current: "error" | "empty" | "populated" }) {
    await page.route("**/api/particular-tokens**", (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET" || url.pathname !== "/api/particular-tokens") return route.fallback();
      if (mode.current === "error") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "Error interno" }),
        });
      }
      const limit = Number(url.searchParams.get("limit")) || 12;
      const particularTokens = mode.current === "empty" ? [] : A03_CLINIC_TOKENS.slice(0, limit);
      return json(route, { success: true, count: particularTokens.length, particularTokens, pagination: { limit, offset: 0 } });
    });
  }

  test("empty dataset keeps the bar painted", async ({ page }) => {
    await stubTokens(page, { current: "empty" });
    const card = (await openModule(page, "tokens")).locator("#clinic-particular-tokens");
    await expect(card.getByText("No hay tokens particulares generados por esta clínica.")).toBeVisible({ timeout: 12_000 });
    await expect(card.locator('[data-clinic-access-filter-bar="advanced"]')).toBeVisible();
    await expectZeroScroll(page, "tokens empty");
  });

  test("failed load keeps the bar, Aplicar keeps the alert, Actualizar recovers with the draft intact", async ({ page }) => {
    const mode = { current: "error" as "error" | "empty" | "populated" };
    await stubTokens(page, mode);
    const card = (await openModule(page, "tokens")).locator("#clinic-particular-tokens");
    const alert = card.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 12_000 });
    const filters = card.locator('[data-clinic-access-filter-bar="advanced"]');
    await expect(filters).toBeVisible();
    await expectZeroScroll(page, "tokens failed load");

    const tokenField = filters.getByPlaceholder("Últimos 4");
    await tokenField.fill("zz99");
    await filters.getByRole("button", { name: "Aplicar" }).click();
    await expect(alert, "Aplicar must not hide the load failure").toBeVisible();
    await filters.getByRole("button", { name: "Limpiar" }).click();
    await expect(alert, "Limpiar must not hide the load failure").toBeVisible();

    await tokenField.fill("zz99");
    mode.current = "populated";
    await card.getByRole("button", { name: "Actualizar" }).click();
    await expect(alert).toHaveCount(0);
    await expect(tokenField, "the draft survives the recovery").toHaveValue("zz99");
    await expect(card.locator('[data-clinic-access-table="true"]')).toBeVisible();
    await expectZeroScroll(page, "tokens recovered");
  });

  test("after a failed load, Limpiar drops a create validation error and restores the load error", async ({ page }) => {
    await stubTokens(page, { current: "error" });
    const card = (await openModule(page, "tokens")).locator("#clinic-particular-tokens");
    const toolbarAlert = card.locator("p[role='alert']").first();
    await expect(toolbarAlert).toBeVisible({ timeout: 12_000 });
    const loadError = (await toolbarAlert.textContent())?.trim() ?? "";
    expect(loadError, "the load failure is announced").not.toBe("");

    await card.getByRole("button", { name: "Generar token particular" }).click();
    const dialog = page.getByRole("dialog", { name: "Generar token particular" });
    await dialog.locator("#clinic-token-particular-email").fill("tutor@example.test");
    await dialog.locator("#clinic-token-tutor-last-name").fill("Sintetico");
    await dialog.getByRole("button", { name: "Siguiente" }).click();
    await dialog.locator("#clinic-token-pet-name").fill("Paciente");
    await dialog.locator("#clinic-token-pet-age").fill("3");
    await dialog.locator("#clinic-token-pet-breed").fill("Mestizo");
    await dialog.getByRole("button", { name: "Siguiente" }).click();
    await dialog.locator("#clinic-token-sample-location").fill("Dorso");
    await dialog.locator("#clinic-token-sample-evolution").fill("Dos semanas");
    await dialog.locator("#clinic-token-extraction-date").fill("2026-10-01");
    await dialog.locator("#clinic-token-shipping-date").fill("2026-10-02");
    // Whitespace passes the native `required` check but not the app's trim.
    await dialog.getByLabel("Detalle de lesión").fill("   ");
    await dialog.getByRole("button", { name: "Generar token particular" }).click();
    const validation = "Complete el campo obligatorio: Detalle de lesión.";
    await expect(dialog.getByRole("alert")).toHaveText(validation);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(toolbarAlert, "the shared message now carries the validation error").toHaveText(validation);

    await card.locator('[data-clinic-access-filter-bar="advanced"]').getByRole("button", { name: "Limpiar" }).click();
    await expect(toolbarAlert, "the load failure is shown again, not the stale validation error").toHaveText(loadError);
  });
});

// C25 F-T7 · the mobile chrome rule clamps `.dashboard-section-description` to
// one ellipsised line: HEAD 25cd6e50 painted 331/346/361 px of the 372 px
// Operaciones sentence at 360/375/390. The Métricas panel has nothing below it
// on phones, so the sentence wraps whole inside the panel.
test.describe("C25 F-T7 · Operaciones mobile description", () => {
  for (const viewport of [
    { name: "320x640", width: 320, height: 640 },
    { name: "360x800", width: 360, height: 800 },
    { name: "375x812", width: 375, height: 812 },
    { name: "390x844", width: 390, height: 844 },
    { name: "412x915", width: 412, height: 915 },
    { name: "430x932", width: 430, height: 932 },
  ] as const) {
    test(`the section description is readable in full at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page, "populated");
      await stubClientApis(page);
      const workspace = await openModule(page, "operaciones");
      const center = workspace.locator('[data-clinic-command-center="true"]');
      const description = center.getByText("Vista rápida de informes, pendientes y actividad logística del día.", { exact: true });
      await expect(description).toBeVisible();
      const fit = await description.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const panel = element.closest('[role="tabpanel"]')!.getBoundingClientRect();
        return {
          horizontal: element.scrollWidth <= element.clientWidth,
          vertical: element.scrollHeight <= element.clientHeight,
          inside: rect.left >= panel.left - 1 && rect.right <= panel.right + 1 && rect.bottom <= panel.bottom + 1,
        };
      });
      expect(fit, `${viewport.name}: whole sentence painted inside the panel`).toEqual({ horizontal: true, vertical: true, inside: true });
      await expectZeroScroll(page, `operaciones F-T7 ${viewport.name}`);
    });
  }
});
