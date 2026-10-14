import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { DASHBOARD_GEOMETRY_SESSION_COOKIE, DASHBOARD_GEOMETRY_SURFACES, installSurfaceMocks, suppressNextDevChrome, waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

const audit = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
if (!audit) throw new Error("C12: missing audit fixture surface");
let harness = "";

test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { AdvancedFilterSheet, SuperSearchField, ActiveFilterChips } from "./src/features/dashboard/presentation/filters/index.ts";
const main = document.querySelector("main.dashboard-main"), mount = document.createElement("div");
mount.setAttribute("data-c12-harness", "true"); mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2"; main.style.position = "relative"; main.append(mount);
const log = (window.__c12Log = []);
function Harness() {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(""), [applied, setApplied] = useState(""), [disabled, setDisabled] = useState(false), [showTrigger, setShowTrigger] = useState(true), [showActions, setShowActions] = useState(true), [showControl, setShowControl] = useState(true), [focusMode, setFocusMode] = useState("default"), [query, setQuery] = useState("");
  const trigger = useRef(null), fallback = useRef(null), first = useRef(null);
  Object.assign(window, { __c12SetOpen: setOpen, __c12SetDraft: setDraft, __c12SetApplied: setApplied, __c12SetDisabled: setDisabled, __c12ShowTrigger: setShowTrigger, __c12ShowActions: setShowActions, __c12ShowControl: setShowControl, __c12SetFocusMode: setFocusMode });
  const region = <div style={{ height: 56, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid #ddd", minWidth: 0 }}>
    <button ref={fallback} type="button" data-c12-fallback="true">Volver a filtros</button>
    {showTrigger && <button ref={trigger} type="button" disabled={disabled} onClick={() => setOpen(true)}>Filtros avanzados</button>}
    <SuperSearchField label="Buscar registros" value={query} onValueChange={setQuery} />
    <ActiveFilterChips filters={applied ? applied.split("|").map((value, index) => ({ id: "f" + index, label: "Estado", value, onRemove: () => setApplied((current) => current.split("|").filter((_, at) => at !== index).join("|")) })) : []} />
  </div>;
  return <WorkspaceScaffold kind="surface" ariaLabel="Arnés C12" filters={region} collection={<div data-c12-collection="true" style={{ flex: 1, minHeight: 0 }}>Colección intacta</div>} footer={<AdvancedFilterSheet open={open} onOpenChange={(next) => { log.push("open:" + next); setOpen(next); }} title="Filtros avanzados" description="Elegí filtros para la colección" initialFocusRef={focusMode === "default" || focusMode === "valid-ref" || focusMode === "invalid-ref" ? first : undefined} returnFocusRef={trigger} fallbackFocusRef={fallback} actions={showActions ? { apply: { label: "Aplicar", disabled, onApply: () => { log.push("apply:" + draft); setApplied(draft); setOpen(false); } }, clear: { label: "Limpiar", disabled, onClear: () => { log.push("clear"); setDraft(""); setApplied(""); } }, cancel: { label: "Cancelar", disabled, onCancel: () => { log.push("cancel"); setDraft(applied); setOpen(false); } } } : undefined}>
    {focusMode === "default" && showControl && <><label htmlFor="c12-state">Estado</label><input ref={first} id="c12-state" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} /></>}
    {focusMode === "hidden-input" && <><input type="hidden" name="module" value="audit-log" /><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /></>}
    {focusMode === "hidden-select" && <><input type="hidden" name="module" value="audit-log" /><label htmlFor="c12-select">Módulo</label><select id="c12-select"><option>Auditoría</option></select></>}
    {focusMode === "disabled" && <><input aria-label="Deshabilitado" disabled /><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /></>}
    {focusMode === "css-hidden" && <><input aria-label="Oculto" style={{ display: "none" }} /><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /></>}
    {focusMode === "hidden-parent" && <><div hidden><input aria-label="Oculto" /></div><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /></>}
    {focusMode === "aria-hidden-parent" && <><div aria-hidden="true"><input aria-label="Oculto" /></div><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /></>}
    {focusMode === "inert-parent" && <><div inert><input aria-label="Oculto" /></div><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /></>}
    {focusMode === "tab-order" && <><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /><label htmlFor="c12-preferred">Preferido</label><input id="c12-preferred" tabIndex={1} /></>}
    {focusMode === "valid-ref" && <><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /><label htmlFor="c12-preferred">Preferido</label><input ref={first} id="c12-preferred" /></>}
    {focusMode === "invalid-ref" && <><input ref={first} type="hidden" name="module" value="audit-log" /><label htmlFor="c12-visible">Visible</label><input id="c12-visible" /></>}
    <div data-c12-long="true" style={{ minHeight: "110vh" }}>Contenido largo sintético</div>
  </AdvancedFilterSheet>} />;
}
createRoot(mount).render(<Harness />);`, resolveDir: resolve(process.cwd()), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", alias: { "@": resolve(process.cwd(), "src") } });
  harness = result.outputFiles[0].text;
});

async function mount(page: Page, width: number, height: number) {
  if (!audit) throw new Error("C12: missing audit fixture surface");
  await page.setViewportSize({ width, height }); await suppressNextDevChrome(page); await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[audit.role]]); await installSurfaceMocks(page, audit); await page.goto(audit.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(audit.readinessSelector)).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector("main.dashboard-main") ?? {}).some((key) => key.startsWith("__reactFiber$"))), { timeout: 25_000 }).toBe(true);
  await waitForLayoutSettled(page); await page.addScriptTag({ content: harness }); await expect(page.getByRole("button", { name: "Filtros avanzados" })).toBeVisible();
}

const logOf = (page: Page) => page.evaluate(() => [...(window as unknown as { __c12Log: string[] }).__c12Log]);
const set = (page: Page, name: string, value: string | boolean) => page.evaluate(([key, next]) => (window as unknown as Record<string, (value: unknown) => void>)[key as string](next), [name, value] as const);

test("C12 P2 · autofocus omite controles ocultos y conserva foco modal", async ({ page }) => {
  await mount(page, 390, 844);
  const trigger = page.getByRole("button", { name: "Filtros avanzados" });
  const dialog = page.getByRole("dialog", { name: "Filtros avanzados" });
  for (const [mode, target] of [
    ["hidden-input", "Visible"], ["hidden-select", "Módulo"],
    ["disabled", "Visible"], ["css-hidden", "Visible"],
    ["hidden-parent", "Visible"], ["aria-hidden-parent", "Visible"],
    ["inert-parent", "Visible"], ["tab-order", "Preferido"], ["valid-ref", "Preferido"],
    ["invalid-ref", "Visible"], ["none", "Cerrar filtros avanzados"],
  ] as const) {
    await set(page, "__c12SetFocusMode", mode);
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole(target === "Cerrar filtros avanzados" ? "button" : mode === "hidden-select" ? "combobox" : "textbox", { name: target })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test("C12 · apertura, foco modal, Escape, cierre explícito y restauración", async ({ page }) => {
  await mount(page, 390, 844);
  const trigger = page.getByRole("button", { name: "Filtros avanzados" });
  await trigger.click(); const dialog = page.getByRole("dialog", { name: "Filtros avanzados" });
  await expect(dialog).toBeVisible(); await expect(dialog.getByLabel("Estado")).toBeFocused();
  expect((await new AxeBuilder({ page }).include('[data-advanced-filter-sheet="true"]').analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); expect(await logOf(page)).toEqual(["open:false"]);
  await trigger.click(); await dialog.getByRole("button", { name: "Cerrar filtros avanzados" }).click(); await expect(trigger).toBeFocused(); expect(await logOf(page)).toEqual(["open:false", "open:false"]);
  await set(page, "__c12SetDisabled", true); await expect(trigger).toBeDisabled(); await set(page, "__c12SetDisabled", false);
  await trigger.click(); await set(page, "__c12ShowTrigger", false); await page.keyboard.press("Escape"); await expect(page.locator('[data-c12-fallback="true"]')).toBeFocused();
});

test("C12 · aplicar, limpiar y cancelar sólo invocan callbacks del consumidor", async ({ page }) => {
  await mount(page, 390, 844);
  const trigger = page.getByRole("button", { name: "Filtros avanzados" });
  await trigger.click(); await page.getByRole("dialog", { name: "Filtros avanzados" }).getByRole("textbox", { name: "Estado" }).fill("Pendiente");
  await page.getByRole("button", { name: "Cancelar" }).click(); await expect(trigger).toBeFocused();
  expect(await logOf(page)).toEqual(["cancel"]);
  await trigger.click(); await expect(page.getByRole("dialog").getByRole("textbox", { name: "Estado" })).toHaveValue("");
  await page.getByRole("dialog").getByRole("textbox", { name: "Estado" }).fill("Listo"); await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByRole("group", { name: "Filtros activos" })).toContainText("Listo");
  expect(await logOf(page)).toEqual(["cancel", "apply:Listo"]);
  await trigger.click(); await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page.getByRole("dialog").getByRole("textbox", { name: "Estado" })).toHaveValue(""); await expect(page.getByRole("group", { name: "Filtros activos" })).toHaveCount(0);
  expect(await logOf(page)).toEqual(["cancel", "apply:Listo", "clear"]);
  await set(page, "__c12SetDisabled", true); await expect(page.getByRole("dialog").getByRole("textbox", { name: "Estado" })).toBeDisabled();
  for (const name of ["Aplicar", "Limpiar", "Cancelar"]) await expect(page.getByRole("dialog").getByRole("button", { name })).toBeDisabled();
  await set(page, "__c12ShowActions", false); await expect(page.getByRole("button", { name: "Aplicar" })).toHaveCount(0);
});

test("C12 · sin controles, con uno o varios filtros y sin acciones implícitas", async ({ page }) => {
  await mount(page, 390, 844);
  await set(page, "__c12ShowControl", false); await set(page, "__c12ShowActions", false);
  await page.getByRole("button", { name: "Filtros avanzados" }).click();
  await expect(page.getByRole("dialog", { name: "Filtros avanzados" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar filtros avanzados" })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Estado" })).toHaveCount(0);
  await page.keyboard.press("Escape"); expect(await logOf(page)).toEqual(["open:false"]);
  await set(page, "__c12SetApplied", "Uno"); await expect(page.getByRole("group", { name: "Filtros activos" })).toContainText("Uno");
  await page.setViewportSize({ width: 1920, height: 1080 }); await set(page, "__c12SetApplied", "Uno|Dos"); await expect(page.locator('[data-active-filter-chips] > ul [data-filter-chip]')).toHaveCount(2);
  await page.getByRole("button", { name: "Filtros avanzados" }).click();
  await expect(page.getByRole("button", { name: "Aplicar" })).toHaveCount(0);
  await page.keyboard.press("Escape"); expect(await logOf(page)).toEqual(["open:false", "open:false"]);
});

test("C12 · scroll interno, fondo bloqueado y controles táctiles", async ({ page }) => {
  await mount(page, 320, 568); await page.getByRole("button", { name: "Filtros avanzados" }).click();
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-advanced-filter-sheet="true"]')!;
    const body = panel.querySelector<HTMLElement>('[data-advanced-filter-body="true"]')!;
    const close = panel.querySelector<HTMLButtonElement>('[aria-label="Cerrar filtros avanzados"]')!;
    const footer = panel.querySelector<HTMLElement>('[data-advanced-filter-actions="true"]')!;
    const p = panel.getBoundingClientRect(), b = body.getBoundingClientRect(), f = footer.getBoundingClientRect();
    return {
      panel: { top: p.top, bottom: p.bottom, left: p.left, right: p.right },
      bodyScroll: body.scrollHeight > body.clientHeight,
      bodyOverflow: getComputedStyle(body).overflowY,
      footerVisible: f.bottom <= innerHeight + 1,
      closeSize: Math.min(close.getBoundingClientRect().width, close.getBoundingClientRect().height),
      documentX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      documentY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      backgroundLocked: getComputedStyle(document.body).overflow === "hidden",
      bodyBottom: b.bottom,
    };
  });
  expect(metrics.panel.left).toBeGreaterThanOrEqual(-1); expect(metrics.panel.right).toBeLessThanOrEqual(321);
  expect(metrics.panel.top).toBeGreaterThanOrEqual(-1); expect(metrics.panel.bottom).toBeLessThanOrEqual(569);
  expect(metrics.bodyScroll).toBe(true);
  expect(metrics.bodyOverflow).toBe("auto");
  expect(metrics.footerVisible).toBe(true);
  expect(metrics.closeSize).toBeGreaterThanOrEqual(44);
  expect(Math.max(metrics.documentX, metrics.documentY)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX); expect(metrics.backgroundLocked).toBe(true);
  await page.getByRole("dialog").getByRole("textbox", { name: "Estado" }).focus(); await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Limpiar" })).toBeFocused();
});

for (const [width, height] of [[1920, 1080], [1366, 768], [1280, 720], [834, 1194], [768, 1024], [390, 844], [320, 568]]) {
  test(`C12 · responsive ${width}x${height}`, async ({ page }) => {
    await mount(page, width, height); const before = await page.locator('[data-c12-collection="true"]').boundingBox();
    await page.getByRole("button", { name: "Filtros avanzados" }).click();
    const panel = page.locator('[data-advanced-filter-sheet="true"]'), box = await panel.boundingBox();
    expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(-1); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(-1); expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    await page.setViewportSize({ width: width === 390 ? 834 : 390, height: 844 }); await expect(panel).toBeVisible();
    await page.keyboard.press("Escape"); await page.setViewportSize({ width, height }); await waitForLayoutSettled(page);
    await expect.poll(async () => page.locator('[data-c12-collection="true"]').boundingBox()).toEqual(before);
    await expect(page.locator('[data-c12-collection="true"]')).toHaveText("Colección intacta");
  });
}

test("C12 · frontera 767/768/769 conserva foco y evita desborde", async ({ page }) => {
  await mount(page, 767, 844); const trigger = page.getByRole("button", { name: "Filtros avanzados" });
  await trigger.click(); const panel = page.locator('[data-advanced-filter-sheet="true"]');
  for (const width of [767, 768, 769, 767]) {
    await page.setViewportSize({ width, height: 844 }); await waitForLayoutSettled(page); await expect(panel).toBeVisible();
    const { left, right, overflow } = await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>('[data-advanced-filter-sheet="true"]')!.getBoundingClientRect();
      return { left: r.left, right: r.right, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(left).toBeGreaterThanOrEqual(-1);
    expect(right).toBeLessThanOrEqual(width + 1);
    expect(overflow).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  }
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
});

test("C12 · puntero táctil abre y cierra el sheet", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(); await mount(page, 390, 844);
    await page.getByRole("button", { name: "Filtros avanzados" }).tap();
    await expect(page.getByRole("dialog", { name: "Filtros avanzados" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cerrar filtros avanzados" }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Filtros avanzados" })).toBeFocused();
  } finally {
    await context.close();
  }
});
