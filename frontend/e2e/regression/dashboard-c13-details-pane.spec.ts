import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { DASHBOARD_GEOMETRY_SESSION_COOKIE, DASHBOARD_GEOMETRY_SURFACES, installSurfaceMocks, settleRenderAndData, suppressNextDevChrome, surfaceMeasurementRoots, trackDataRequests, waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

const audit = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
if (!audit) throw new Error("C13: missing audit fixture surface");
const PANEL = '[data-c13-harness="true"] .dashboard-utility-side-panel';
const LONG_TOKEN = "IDENTIFICADOR-SINTETICO-SIN-ESPACIOS-".repeat(9);
let harness = "";

test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { DetailsPane, DetailsHeader, DetailsTabs, DetailsMetadata, DetailsEmptyState } from "./src/features/dashboard/presentation/details/index.ts";
const main = document.querySelector("main.dashboard-main"), mount = document.createElement("div");
mount.setAttribute("data-c13-harness", "true"); mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2"; main.style.position = "relative"; main.append(mount);
const log = (window.__c13Log = []);
const LONG = ${JSON.stringify(LONG_TOKEN)};
function metadataFor(id, mode) {
  if (mode === "missing") return [{ id: "estado", label: "Estado", value: null }, { id: "origen", label: "Origen", value: undefined }, { id: "nota", label: "Nota", value: "" }, { id: "codigo", label: "Código", value: "C-" + id, mono: true }];
  if (mode === "long") return Array.from({ length: 28 }, (_, index) => ({ id: "campo-" + index, label: "Campo sintético " + (index + 1), value: index === 0 ? LONG : "Valor sintético extenso número " + (index + 1) + " para el registro " + id, mono: index === 0 }));
  if (mode === "none") return [];
  return [{ id: "estado", label: "Estado", value: "Pendiente" }, { id: "origen", label: "Origen", value: "Carga manual" }, { id: "codigo", label: "Código", value: "C-" + id, mono: true }, { id: "resumen", label: "Resumen", value: "Registro de prueba " + id }];
}
function Harness() {
  const [selectedId, setSelectedId] = useState(null), [tab, setTab] = useState("detalles"), [mode, setMode] = useState("complete"), [disabled, setDisabled] = useState(false), [tabCase, setTabCase] = useState("normal"), [, setTick] = useState(0);
  Object.assign(window, { __c13SetMode: setMode, __c13SetDisabled: setDisabled, __c13SetTab: setTab, __c13SetTabCase: setTabCase, __c13Rerender: () => setTick((value) => value + 1), __c13Select: setSelectedId });
  const tabs = [
    { id: "detalles", label: tabCase === "long-label" ? LONG : "Detalles", disabled: tabCase === "all-disabled", content: <DetailsMetadata items={metadataFor(selectedId, mode)} /> },
    { id: "notas", label: "Notas", disabled: tabCase === "all-disabled", content: <p data-c13-notes="true">Notas sintéticas del registro {selectedId}. <button type="button">Acción de notas</button></p> },
    { id: "relacionados", label: "Relacionados", disabled: disabled || tabCase === "all-disabled", content: <p data-c13-related="true">Sin relacionados sintéticos.</p> },
  ];
  return <WorkspaceScaffold kind="module" moduleId="c13-harness" title="Arnés C13" titleId="c13-harness-title"
    collection={<ul data-c13-collection="true" aria-label="Registros" style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, minHeight: 0 }}>
      {["1", "2", "3"].map((id) => <li key={id}><button type="button" aria-pressed={selectedId === id} data-c13-record={id} onClick={() => { log.push("select:" + id); setSelectedId(id); }}>Registro {id}</button></li>)}
    </ul>}
    details={<DetailsPane label="Detalles del registro">
      {selectedId ? <>
        <DetailsHeader title={mode === "long" ? "Registro sintético " + selectedId + " " + LONG : "Registro sintético " + selectedId} context="Registro" identifier={"#" + selectedId} status={<span data-c13-status="true">Activo</span>} />
        <DetailsTabs label="Secciones del registro" activeId={tab} onActiveIdChange={(id) => { log.push("tab:" + id); setTab(id); }} tabs={tabs} />
      </> : <DetailsEmptyState title="Ningún registro seleccionado" description="Elegí un registro de la colección para ver sus detalles." />}
    </DetailsPane>} />;
}
createRoot(mount).render(<Harness />);`, resolveDir: resolve(process.cwd()), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", alias: { "@": resolve(process.cwd(), "src") } });
  harness = result.outputFiles[0].text;
});

async function mount(page: Page, width: number, height: number, settleData = false) {
  if (!audit) throw new Error("C13: missing audit fixture surface");
  await page.setViewportSize({ width, height }); await suppressNextDevChrome(page); await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[audit.role]]); await installSurfaceMocks(page, audit); await page.goto(audit.route, { waitUntil: "domcontentloaded" });
  const flight = settleData ? trackDataRequests(page) : null;
  await expect(page.locator(audit.readinessSelector)).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector("main.dashboard-main") ?? {}).some((key) => key.startsWith("__reactFiber$"))), { timeout: 25_000 }).toBe(true);
  await waitForLayoutSettled(page); await page.addScriptTag({ content: harness }); await expect(page.locator('[data-c13-record="1"]')).toBeVisible();
  if (flight) {
    try { await settleRenderAndData(page, flight, "C13 mount", surfaceMeasurementRoots(audit)); }
    finally { flight.dispose(); }
  }
}

const logOf = (page: Page) => page.evaluate(() => [...(window as unknown as { __c13Log: string[] }).__c13Log]);
const call = (page: Page, name: string, value?: unknown) => page.evaluate(([key, next]) => (window as unknown as Record<string, (value: unknown) => void>)[key as string](next), [name, value] as const);
const toggle = (page: Page) => page.locator(`${PANEL} > button.dashboard-utility-side-panel-toggle`);

async function expand(page: Page) {
  await toggle(page).click();
  await expect(page.locator(PANEL)).toHaveAttribute("data-expanded", "true");
}

async function outerScroll(page: Page) {
  return page.evaluate(() => {
    const delta = (element: Element | null) => Math.max((element?.scrollHeight ?? 0) - (element?.clientHeight ?? 0), (element?.scrollWidth ?? 0) - (element?.clientWidth ?? 0));
    return {
      document: delta(document.documentElement), body: delta(document.body), main: delta(document.querySelector("main.dashboard-main")),
      scaffold: delta(document.querySelector('[data-c13-harness="true"] [data-workspace-scaffold="true"]')),
    };
  });
}

async function expectNoOuterScroll(page: Page, label: string) {
  const scroll = await outerScroll(page);
  for (const [owner, delta] of Object.entries(scroll)) expect(delta, `${label}: ${owner}`).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
}

async function expectAxeClean(page: Page) {
  expect((await new AxeBuilder({ page }).include(PANEL).analyze()).violations).toEqual([]);
}

test("C13 · estado vacío sin selección dentro del panel B16", async ({ page }) => {
  await mount(page, 1366, 768);
  const pane = page.locator(PANEL).getByRole("region", { name: "Detalles del registro", includeHidden: true });
  await expect(pane).toBeHidden();
  await expand(page);
  await expect(pane).toBeVisible();
  await expect(pane.locator('[data-details-empty-state="true"] [data-collection-state="empty"]')).toBeVisible();
  await expect(pane.getByRole("heading", { name: "Ningún registro seleccionado" })).toBeVisible();
  await expect(pane.getByRole("tablist")).toHaveCount(0);
  await expectAxeClean(page);
  await expectNoOuterScroll(page, "vacío");
  expect(await logOf(page)).toEqual([]);
});

test("C13 · composición con la colección, encabezado y metadatos completos", async ({ page }) => {
  await mount(page, 1366, 768); await expand(page);
  const pane = page.locator(PANEL).getByRole("region", { name: "Detalles del registro", includeHidden: true });
  await page.locator('[data-c13-record="2"]').click();
  await expect(page.locator('[data-c13-record="2"]')).toHaveAttribute("aria-pressed", "true");
  const heading = pane.getByRole("heading", { level: 2, name: "Registro sintético 2" });
  await expect(heading).toBeVisible();
  await expect(pane.locator('[data-details-header-context="true"]')).toHaveText("Registro");
  await expect(pane.locator('[data-details-header-identifier="true"]')).toHaveText("#2");
  await expect(pane.locator('[data-c13-status="true"]')).toBeVisible();
  const metadata = pane.locator('dl[data-details-metadata="true"]');
  expect(await metadata.locator("dt").allTextContents()).toEqual(["Estado", "Origen", "Código", "Resumen"]);
  expect(await metadata.locator("dd").allTextContents()).toEqual(["Pendiente", "Carga manual", "C-2", "Registro de prueba 2"]);
  await page.locator('[data-c13-record="3"]').click();
  await expect(pane.getByRole("heading", { level: 2, name: "Registro sintético 3" })).toBeVisible();
  await expect(metadata.locator("dd").nth(2)).toHaveText("C-3");
  expect(await logOf(page)).toEqual(["select:2", "select:3"]);
  await expectAxeClean(page);
  await expectNoOuterScroll(page, "contenido");
});

test("C13 · metadatos ausentes y lista vacía sin inventar datos", async ({ page }) => {
  await mount(page, 1366, 768); await expand(page);
  await page.locator('[data-c13-record="1"]').click(); await call(page, "__c13SetMode", "missing");
  const metadata = page.locator('dl[data-details-metadata="true"]');
  await expect(metadata.locator("dd")).toHaveCount(4);
  await expect(metadata.locator('dd[data-details-metadata-missing="true"]')).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    const value = metadata.locator("dd").nth(index);
    await expect(value).toHaveText("—Sin dato");
    await expect(value.locator('[aria-hidden="true"]')).toHaveText("—");
    await expect(value.locator(".sr-only")).toHaveText("Sin dato");
  }
  await expect(metadata.locator("dd").nth(3)).toHaveText("C-1");
  await expect(metadata).not.toContainText("undefined"); await expect(metadata).not.toContainText("null");
  await expectAxeClean(page);
  await call(page, "__c13SetMode", "none");
  await expect(metadata).toHaveCount(0);
  await expect(page.locator(PANEL).getByRole("tab", { name: "Detalles" })).toHaveAttribute("aria-selected", "true");
});

test("C13 · tabs WAI-ARIA, teclado, disabled, foco y callbacks estables", async ({ page }) => {
  await mount(page, 1366, 768); await expand(page);
  await page.locator('[data-c13-record="1"]').click(); await call(page, "__c13SetDisabled", true);
  const pane = page.locator(PANEL).getByRole("region", { name: "Detalles del registro", includeHidden: true });
  const tablist = pane.getByRole("tablist", { name: "Secciones del registro" });
  const tab = (name: string) => tablist.getByRole("tab", { name });
  await expect(tablist.getByRole("tab")).toHaveCount(3);
  for (const name of ["Detalles", "Notas", "Relacionados"]) {
    const controls = await tab(name).getAttribute("aria-controls");
    const panel = page.locator(`[id="${controls}"]`);
    await expect(panel).toHaveAttribute("role", "tabpanel");
    await expect(panel).toHaveAttribute("aria-labelledby", (await tab(name).getAttribute("id"))!);
  }
  await expect(tab("Detalles")).toHaveAttribute("tabindex", "0");
  await expect(tab("Notas")).toHaveAttribute("tabindex", "-1");
  await expect(tab("Relacionados")).toBeDisabled();
  await tab("Detalles").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab("Notas")).toBeFocused(); await expect(tab("Notas")).toHaveAttribute("aria-selected", "true");
  const ring = await tab("Notas").evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(ring).not.toBe("none");
  await expect(pane.getByRole("tabpanel", { name: "Notas" })).toBeVisible();
  await expect(pane.getByRole("tabpanel", { name: "Detalles", includeHidden: true })).toBeHidden();
  await page.keyboard.press("ArrowRight");
  await expect(tab("Detalles")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tab("Notas")).toBeFocused();
  await page.keyboard.press("Home"); await expect(tab("Detalles")).toBeFocused();
  await page.keyboard.press("End"); await expect(tab("Notas")).toBeFocused();
  await tab("Relacionados").click({ force: true });
  await expect(tab("Notas")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Tab");
  await expect(pane.getByRole("tabpanel", { name: "Notas" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(pane.getByRole("button", { name: "Acción de notas" })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
  await expect(tab("Notas")).toBeFocused();
  expect(await logOf(page)).toEqual(["select:1", "tab:notas", "tab:detalles", "tab:notas", "tab:detalles", "tab:notas"]);
  await call(page, "__c13Rerender"); await call(page, "__c13Rerender");
  await tab("Notas").click();
  expect(await logOf(page)).toEqual(["select:1", "tab:notas", "tab:detalles", "tab:notas", "tab:detalles", "tab:notas"]);
  await call(page, "__c13SetDisabled", false);
  await expect(tab("Relacionados")).toBeEnabled();
  await page.keyboard.press("ArrowRight");
  await expect(tab("Relacionados")).toBeFocused(); await expect(pane.getByRole("tabpanel", { name: "Relacionados" })).toBeVisible();
  await call(page, "__c13SetTab", "inexistente");
  await expect(tab("Detalles")).toHaveAttribute("aria-selected", "true"); await expect(tab("Detalles")).toHaveAttribute("tabindex", "0");
  expect((await logOf(page)).at(-1)).toBe("tab:relacionados");
  await expectAxeClean(page);
});

for (const [width, height] of [[1366, 768], [320, 568]]) {
  test(`C13 P2 · etiqueta larga sin overflow horizontal ${width}x${height}`, async ({ page }) => {
    await mount(page, width, height); await expand(page);
    if (width < 768) await call(page, "__c13Select", "1");
    else await page.locator('[data-c13-record="1"]').click();
    await call(page, "__c13SetTabCase", "long-label");
    const panel = page.locator(PANEL);
    const tab = panel.getByRole("tab", { name: LONG_TOKEN });
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const metrics = await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>('[data-c13-harness="true"] .dashboard-utility-side-panel-content')!;
      const tab = content.querySelector<HTMLElement>('[data-details-tab="detalles"]')!;
      return { horizontal: content.scrollWidth - content.clientWidth, tabHorizontal: tab.scrollWidth - tab.clientWidth, tabWidth: tab.getBoundingClientRect().width, contentWidth: content.clientWidth, tabHeight: tab.getBoundingClientRect().height };
    });
    expect(metrics.horizontal).toBeLessThanOrEqual(1);
    expect(metrics.tabHorizontal).toBeLessThanOrEqual(1);
    expect(metrics.tabWidth).toBeLessThanOrEqual(metrics.contentWidth);
    expect(metrics.tabHeight).toBeGreaterThan(44);
    await tab.focus(); await page.keyboard.press("ArrowRight");
    await expect(panel.getByRole("tab", { name: "Notas" })).toBeFocused();
    await expect(panel.getByRole("tabpanel", { name: "Notas" })).toBeVisible();
    await expectNoOuterScroll(page, `etiqueta larga ${width}x${height}`);
  });
}

test("C13 P2 · todas las pestañas deshabilitadas quedan sin selección ni panel activo", async ({ page }) => {
  await mount(page, 1366, 768); await expand(page);
  await page.locator('[data-c13-record="1"]').click(); await call(page, "__c13SetTabCase", "all-disabled");
  const panel = page.locator(PANEL);
  const tabs = panel.getByRole("tab", { includeHidden: true });
  await expect(tabs).toHaveCount(3);
  for (const tab of await tabs.all()) {
    await expect(tab).toBeDisabled();
    await expect(tab).toHaveAttribute("aria-selected", "false");
    await expect(tab).toHaveAttribute("tabindex", "-1");
  }
  for (const tabpanel of await panel.getByRole("tabpanel", { includeHidden: true }).all()) await expect(tabpanel).toBeHidden();
  expect(await logOf(page)).toEqual(["select:1"]);
  await expectAxeClean(page);
});

test("C13 · colapso y expansión B16 conservan pestaña, selección y foco", async ({ page }) => {
  await mount(page, 1366, 768); await expand(page);
  await page.locator('[data-c13-record="2"]').click();
  await page.locator(PANEL).getByRole("tab", { name: "Notas" }).click();
  await toggle(page).click();
  await expect(page.locator(PANEL)).toHaveAttribute("data-expanded", "false");
  await expect(toggle(page)).toBeFocused();
  await expect(page.locator(PANEL).getByRole("region", { name: "Detalles del registro", includeHidden: true })).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(page.locator(PANEL).getByRole("tab", { name: "Notas" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-c13-notes="true"]')).toContainText("registro 2");
  await expect(page.locator('[data-c13-record="2"]')).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(page)).toBeFocused();
  expect(await logOf(page)).toEqual(["select:2", "tab:notas"]);
});

test("C13 · valores extensos sin truncado y scroll interno del panel", async ({ page }) => {
  await mount(page, 1366, 768); await expand(page);
  await page.locator('[data-c13-record="1"]').click(); await call(page, "__c13SetMode", "long");
  await expect(page.locator('dl[data-details-metadata="true"] dd')).toHaveCount(28);
  const metrics = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('[data-c13-harness="true"] .dashboard-utility-side-panel-content')!;
    const pane = content.querySelector<HTMLElement>('[data-details-pane="true"]')!;
    const values = [...pane.querySelectorAll<HTMLElement>("dd, h2, [data-details-header-identifier]")];
    return {
      contentScroll: content.scrollHeight > content.clientHeight, contentOverflowY: getComputedStyle(content).overflowY,
      contentHorizontal: content.scrollWidth - content.clientWidth, paneOverflowY: getComputedStyle(pane).overflowY,
      clipped: values.filter((value) => value.scrollWidth > value.clientWidth + 1).length,
      firstValue: pane.querySelector("dd")?.textContent ?? "",
      scrollers: [...pane.querySelectorAll<HTMLElement>("*")].filter((node) => /auto|scroll/.test(getComputedStyle(node).overflowY)).length,
    };
  });
  expect(metrics.contentScroll).toBe(true); expect(metrics.contentOverflowY).toBe("auto");
  expect(metrics.contentHorizontal).toBeLessThanOrEqual(1); expect(metrics.paneOverflowY).toBe("visible");
  expect(metrics.clipped).toBe(0); expect(metrics.scrollers).toBe(0); expect(metrics.firstValue).toBe(LONG_TOKEN);
  await page.locator('[data-c13-harness="true"] .dashboard-utility-side-panel-content').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => page.locator('[data-c13-harness="true"] .dashboard-utility-side-panel-content').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expectNoOuterScroll(page, "contenido largo");
  await expectAxeClean(page);
});

test("C13 · sin solicitudes de red al seleccionar, navegar tabs y colapsar", async ({ page }) => {
  await mount(page, 1366, 768, true);
  const requests: string[] = [];
  page.on("request", (request) => { if (["fetch", "xhr", "document"].includes(request.resourceType())) requests.push(`${request.method()} ${request.url()}`); });
  const url = page.url();
  await expand(page); await page.locator('[data-c13-record="1"]').click();
  await page.locator(PANEL).getByRole("tab", { name: "Notas" }).click(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Home");
  await call(page, "__c13SetMode", "missing"); await toggle(page).click(); await toggle(page).click();
  await expect(page.locator(PANEL)).toHaveAttribute("data-expanded", "true");
  expect(requests).toEqual([]); expect(page.url()).toBe(url);
});

for (const [width, height] of [[1920, 1080], [1366, 768], [1280, 720], [834, 1194], [768, 1024], [390, 844], [320, 568]]) {
  test(`C13 · geometría B16 y zero-scroll ${width}x${height}`, async ({ page }) => {
    await mount(page, width, height);
    const collection = page.locator('[data-c13-harness="true"] .dashboard-workspace-primary');
    const before = await collection.boundingBox();
    await expand(page); await call(page, "__c13Select", "1"); await call(page, "__c13SetMode", "long");
    await expect(page.locator(PANEL).getByRole("heading", { level: 2, name: /Registro sintético 1/ })).toBeVisible();
    const geometry = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-c13-harness="true"]')!;
      const panel = root.querySelector<HTMLElement>(".dashboard-utility-side-panel")!.getBoundingClientRect();
      const primary = root.querySelector<HTMLElement>(".dashboard-workspace-primary")!.getBoundingClientRect();
      const workspace = root.querySelector<HTMLElement>(".dashboard-workspace-with-panel")!.getBoundingClientRect();
      const toggleBox = root.querySelector<HTMLElement>(".dashboard-utility-side-panel-toggle")!.getBoundingClientRect();
      const tabs = [...root.querySelectorAll<HTMLElement>('[role="tab"]')].map((tab) => tab.getBoundingClientRect().height);
      const content = root.querySelector<HTMLElement>(".dashboard-utility-side-panel-content")!;
      return { panel: { left: panel.left, right: panel.right, width: panel.width }, primary: { left: primary.left, right: primary.right, width: primary.width }, workspace: { width: workspace.width }, toggle: { width: toggleBox.width, height: toggleBox.height }, minTab: Math.min(...tabs), contentHorizontal: content.scrollWidth - content.clientWidth, contentScroll: content.scrollHeight > content.clientHeight };
    });
    console.log(`[C13] ${width}x${height}: ${JSON.stringify(geometry)}`);
    if (width >= 768) { expect(geometry.panel.width).toBeGreaterThanOrEqual(334); expect(geometry.panel.width).toBeLessThanOrEqual(338); }
    else { expect(Math.abs(geometry.panel.width - geometry.workspace.width)).toBeLessThanOrEqual(1); }
    if (width >= 1280) expect(geometry.primary.right).toBeLessThanOrEqual(geometry.panel.left + 1);
    else expect(geometry.primary.width).toBeGreaterThanOrEqual(before!.width - 1);
    expect(geometry.panel.right).toBeLessThanOrEqual(width + 1);
    expect(Math.min(geometry.toggle.width, geometry.toggle.height)).toBeGreaterThanOrEqual(44);
    if (width < 768) expect(geometry.minTab).toBeGreaterThanOrEqual(44);
    expect(geometry.contentHorizontal).toBeLessThanOrEqual(1); expect(geometry.contentScroll).toBe(true);
    await expectNoOuterScroll(page, `${width}x${height}`);
  });
}
