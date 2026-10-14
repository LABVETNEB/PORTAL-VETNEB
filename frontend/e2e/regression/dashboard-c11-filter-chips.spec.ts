import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { DASHBOARD_GEOMETRY_SESSION_COOKIE, DASHBOARD_GEOMETRY_SURFACES, installSurfaceMocks, suppressNextDevChrome, waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

// C11: no product adopter (S1–S7 have no per-filter removal to reuse); the primitives run in the real B15 scaffold.
const audit = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
if (!audit) throw new Error("C11: missing audit fixture surface");
const LONG = "Paciente: Nombre de paciente sintético extraordinariamente largo para truncar";
const EIGHT = ["Evento:Inicio de sesión", "Actor:Administrador", "Desde:2026-10-01", "Hasta:2026-10-14", "Clínica ID:42", "Informe ID:7", "Estado:Pendiente", LONG];
let harness = "";

test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React, { Component, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { ActiveFilterChips, SuperSearchField } from "./src/features/dashboard/presentation/filters/index.ts";
const main = document.querySelector("main.dashboard-main"), mount = document.createElement("div");
mount.setAttribute("data-c11-harness", "true"); mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2"; main.style.position = "relative"; main.append(mount);
const log = (window.__c11Log = []);
const toFilters = (pairs) => pairs.map(([id, text]) => { const at = text.indexOf(":"); return { id, label: text.slice(0, at), value: text.slice(at + 1).trim() }; });
class Boundary extends Component { state = { error: null }; static getDerivedStateFromError(error) { return { error }; } componentDidUpdate(previous) { if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null }); } render() { return this.state.error ? <p data-c11-error="true">{String(this.state.error.message)}</p> : this.props.children; } }
function Harness() {
  const [pairs, setPairs] = useState([]), [disabled, setDisabled] = useState(false), [clearable, setClearable] = useState(true), [locked, setLocked] = useState(""), [query, setQuery] = useState("");
  const search = useRef(null);
  Object.assign(window, { __c11Set: setPairs, __c11SetDisabled: setDisabled, __c11SetClearable: setClearable, __c11SetLocked: setLocked });
  const filters = toFilters(pairs).map((filter) => ({ ...filter, disabled: filter.id === locked, onRemove: () => { log.push("remove:" + filter.id); setPairs((current) => current.filter(([id]) => id !== filter.id)); } }));
  const region = <div data-c11-filter-region="true" style={{ height: 56, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid #ddd", minWidth: 0 }}>
    <SuperSearchField ref={search} label="Buscar registros" value={query} onValueChange={setQuery} />
    <Boundary resetKey={JSON.stringify(pairs)}><ActiveFilterChips filters={filters} disabled={disabled} returnFocusRef={search} onClearAll={clearable ? () => { log.push("clear"); setPairs([]); } : undefined} /></Boundary>
  </div>;
  return <WorkspaceScaffold kind="surface" ariaLabel="Arnés C11" filters={region} collection={<div data-c11-collection="true" style={{ flex: 1, minHeight: 0 }}>Colección intacta</div>} />;
}
createRoot(mount).render(<Harness />);`, resolveDir: resolve(process.cwd()), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", alias: { "@": resolve(process.cwd(), "src") } });
  harness = result.outputFiles[0].text;
});

async function mount(page: Page, width: number, height: number) {
  if (!audit) throw new Error("C11: missing audit fixture surface");
  await page.setViewportSize({ width, height }); await suppressNextDevChrome(page); await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[audit.role]]); await installSurfaceMocks(page, audit); await page.goto(audit.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(audit.readinessSelector)).toBeVisible({ timeout: 25_000 });
  // The readiness marker is already in the SSR HTML: a node appended before hydration is a mismatch React wipes.
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector("main.dashboard-main") ?? {}).some((key) => key.startsWith("__reactFiber$"))), { timeout: 25_000 }).toBe(true); await waitForLayoutSettled(page);
  await page.addScriptTag({ content: harness }); await expect(page.getByRole("searchbox", { name: "Buscar registros" })).toBeVisible(); await waitForLayoutSettled(page);
}
const call = (page: Page, name: string, value: unknown) => page.evaluate(([key, next]) => (window as unknown as Record<string, (value: unknown) => void>)[key as string](next), [name, value] as const);
const setFilters = (page: Page, texts: string[]) => call(page, "__c11Set", texts.map((text, index) => [`f${index}`, text]));
const logOf = (page: Page) => page.evaluate(() => [...(window as unknown as { __c11Log: string[] }).__c11Log]);
const chips = (page: Page) => page.locator("[data-active-filter-chips] > ul [data-filter-chip]");
const overflow = (page: Page) => page.locator("[data-active-filter-chips] > [data-action-menu-trigger]");
const remover = (page: Page, text: string) => page.getByRole("button", { name: `Quitar filtro ${text}`, exact: true });
async function hiddenCount(page: Page) {
  if (!(await overflow(page).count())) return 0;
  return Number((await overflow(page).getAttribute("aria-label"))?.match(/^\+(\d+) /)?.[1]);
}

test("C11 · cero, uno y varios filtros: orden, retirada individual, limpieza global, foco y callbacks únicos", async ({ page }) => {
  await mount(page, 1920, 1080); const search = page.getByRole("searchbox", { name: "Buscar registros" }), initialHistory = await page.evaluate(() => window.history.length);
  await expect(page.getByRole("group", { name: "Filtros activos" })).toHaveCount(0);
  await setFilters(page, ["Estado:Pendiente"]); await expect(chips(page)).toHaveText(["Estado: Pendiente"]); await expect(overflow(page)).toHaveCount(0); await expect(page.getByRole("button", { name: "Limpiar filtros" })).toBeVisible();
  await setFilters(page, EIGHT.slice(0, 4)); await expect(chips(page)).toHaveText(EIGHT.slice(0, 4).map((text) => text.replace(":", ": "))); await expect(overflow(page)).toHaveCount(0);
  await search.focus(); for (const text of ["Evento: Inicio de sesión", "Actor: Administrador", "Desde: 2026-10-01", "Hasta: 2026-10-14"]) { await page.keyboard.press("Tab"); await expect(remover(page, text)).toBeFocused(); }
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Limpiar filtros" })).toBeFocused();
  const ring = await page.getByRole("button", { name: "Limpiar filtros" }).evaluate((element) => getComputedStyle(element).outlineStyle); expect(ring).not.toBe("none");
  await remover(page, "Hasta: 2026-10-14").focus(); const focusRing = await remover(page, "Hasta: 2026-10-14").evaluate((element) => { const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }; }); expect(focusRing.style).not.toBe("none"); expect(focusRing.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Escape"); expect(await logOf(page)).toEqual([]);
  await remover(page, "Actor: Administrador").click(); expect(await logOf(page)).toEqual(["remove:f1"]); await expect(remover(page, "Desde: 2026-10-01")).toBeFocused();
  await page.keyboard.press("Enter"); await expect(remover(page, "Hasta: 2026-10-14")).toBeFocused(); await page.keyboard.press("Space"); await expect(remover(page, "Evento: Inicio de sesión")).toBeFocused();
  expect(await logOf(page)).toEqual(["remove:f1", "remove:f2", "remove:f3"]);
  await setFilters(page, EIGHT.slice(0, 3)); await page.getByRole("button", { name: "Limpiar filtros" }).click(); await expect(search).toBeFocused(); await expect(page.getByRole("group", { name: "Filtros activos" })).toHaveCount(0);
  expect(await logOf(page)).toEqual(["remove:f1", "remove:f2", "remove:f3", "clear"]);
  await setFilters(page, ["Estado:Pendiente"]); await call(page, "__c11SetClearable", false); await expect(page.getByRole("button", { name: "Limpiar filtros" })).toHaveCount(0);
  await remover(page, "Estado: Pendiente").click(); await expect(search).toBeFocused();
  expect(await page.evaluate(() => window.history.length)).toBe(initialHistory); await expect(page.locator('[data-c11-collection="true"]')).toHaveText("Colección intacta");
});

test("C11 · overflow por teclado y puntero, etiquetas extensas, disabled, identidades y axe", async ({ page }) => {
  await mount(page, 1366, 768); await setFilters(page, EIGHT); await expect(overflow(page)).toBeVisible();
  const hidden = await hiddenCount(page); expect(hidden).toBeGreaterThan(0); expect((await chips(page).count()) + hidden).toBe(EIGHT.length);
  expect((await new AxeBuilder({ page }).include('[data-c11-harness="true"]').analyze()).violations).toEqual([]);
  await overflow(page).focus(); await page.keyboard.press("ArrowDown"); const menu = page.getByRole("menu"); await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(hidden); await expect(menu.getByRole("menuitem").first()).toBeFocused();
  expect((await new AxeBuilder({ page }).include('[role="menu"]').analyze()).violations).toEqual([]);
  await page.keyboard.press("ArrowDown"); await expect(menu.getByRole("menuitem").nth(1)).toBeFocused(); await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0); await expect(overflow(page)).toBeFocused(); expect(await logOf(page)).toEqual([]);
  await page.keyboard.press("ArrowUp"); await expect(menu.getByRole("menuitem").last()).toBeFocused(); await expect(menu.getByRole("menuitem").last().locator("[title]")).toHaveAttribute("title", LONG);
  await page.keyboard.press("Enter"); await expect(menu).toHaveCount(0); expect(await logOf(page)).toEqual(["remove:f7"]); await expect(overflow(page)).toBeFocused(); expect(await hiddenCount(page)).toBe(hidden - 1);
  await overflow(page).click(); await page.getByRole("menuitem").first().click(); expect(await logOf(page)).toEqual(["remove:f7", `remove:f${EIGHT.length - hidden}`]);
  await setFilters(page, [LONG]); const longChip = chips(page).first(), box = (await longChip.boundingBox())!; expect(box.width).toBeLessThanOrEqual(162);
  await expect(longChip.locator("[title]")).toHaveAttribute("title", "Paciente: Nombre de paciente sintético extraordinariamente largo para truncar"); await expect(remover(page, "Paciente: Nombre de paciente sintético extraordinariamente largo para truncar")).toBeVisible();
  await setFilters(page, EIGHT); await call(page, "__c11SetLocked", "f0"); await expect(remover(page, "Evento: Inicio de sesión")).toBeDisabled(); await expect(remover(page, "Actor: Administrador")).toBeEnabled();
  await call(page, "__c11SetDisabled", true); await expect(remover(page, "Actor: Administrador")).toBeDisabled(); await expect(page.getByRole("button", { name: "Limpiar filtros" })).toBeDisabled(); await expect(overflow(page)).toBeEnabled();
  await overflow(page).click(); for (const item of await page.getByRole("menuitem").all()) await expect(item).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("menuitem").first().click({ force: true }); await page.keyboard.press("Escape"); expect(await logOf(page)).toEqual(["remove:f7", `remove:f${EIGHT.length - hidden}`]);
  await call(page, "__c11SetDisabled", false); await call(page, "__c11Set", [["dup", "A:1"], ["dup", "B:2"]]); await expect(page.locator('[data-c11-error="true"]')).toHaveText('ActiveFilterChips: duplicate filter id "dup"');
  await call(page, "__c11Set", [[" ", "A:1"]]); await expect(page.locator('[data-c11-error="true"]')).toHaveText("ActiveFilterChips: every filter needs a non-empty id");
});

for (const [width, height] of [[1920, 1080], [1366, 768], [1280, 720], [834, 1194], [768, 1024], [390, 844], [320, 568]]) test(`C11 · geometría, overflow y responsive ${width}x${height}`, async ({ page }) => {
  await mount(page, width, height); await setFilters(page, EIGHT); await waitForLayoutSettled(page);
  for (const size of [[width, height], [1366, 768], [width, height]]) {
    await page.setViewportSize({ width: size[0], height: size[1] }); await waitForLayoutSettled(page); const mobile = size[0] < 768;
    const metrics = await page.evaluate(async () => {
      const signature = () => { const row = document.querySelector("[data-active-filter-chips]"); return `${row?.querySelectorAll(":scope > ul [data-filter-chip]").length}|${row?.querySelector(":scope > [data-action-menu-trigger]")?.getAttribute("aria-label")}|${row?.getBoundingClientRect().width}`; };
      for (let same = 0, last = "", frame = 0; same < 3 && frame < 120; frame += 1) { await new Promise(requestAnimationFrame); const next = signature(); same = next === last ? same + 1 : 0; last = next; }
      const region = document.querySelector<HTMLElement>('[data-c11-filter-region="true"]')!, bounds = region.getBoundingClientRect(), row = document.querySelector<HTMLElement>("[data-active-filter-chips]")!;
      const items = [...row.querySelectorAll<HTMLElement>(":scope > ul > li, :scope > button")].map((element) => element.getBoundingClientRect()), shown = row.querySelectorAll(":scope > ul [data-filter-chip]").length, hidden = Number(row.querySelector(":scope > [data-action-menu-trigger]")?.getAttribute("aria-label")?.match(/^\+(\d+) /)?.[1] ?? 0);
      const chipBoxes = [...row.querySelectorAll<HTMLElement>(":scope > ul [data-filter-chip]")].map((element) => { const style = getComputedStyle(element); return { height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width, radius: parseFloat(style.borderTopLeftRadius), border: parseFloat(style.borderTopWidth), shadow: style.boxShadow.split(/,(?![^(]*\))/).every((layer) => /rgba\(0, 0, 0, 0\)|^\s*none\s*$|^\s*\S+ 0px 0px 0px( 0px)?\s*$/.test(layer)) }; });
      const targets = [...row.querySelectorAll<HTMLElement>(":scope > ul [data-filter-chip] button, :scope > button")].map((element) => element.getBoundingClientRect()).map((rect) => Math.min(rect.width, rect.height));
      return { regionHeight: bounds.height, vertical: items.every((rect) => rect.top >= bounds.top - 0.5 && rect.bottom <= bounds.bottom + 0.5), documentScroll: { x: document.documentElement.scrollWidth - document.documentElement.clientWidth, y: document.documentElement.scrollHeight - document.documentElement.clientHeight }, chipBoxes, targets, shown, hidden,
        inside: items.every((rect) => rect.left >= bounds.left - 0.5 && rect.right <= bounds.right + 0.5), ordered: items.every((rect, index) => index === 0 || rect.left >= items[index - 1].right - 0.5) };
    });
    const { shown, hidden } = metrics; expect(metrics.regionHeight).toBe(56); expect(Math.max(metrics.documentScroll.x, metrics.documentScroll.y)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX); expect(metrics.inside).toBe(true); expect(metrics.vertical).toBe(true); expect(metrics.ordered).toBe(true); expect(shown).toBe(EIGHT.length - hidden);
    for (const chip of metrics.chipBoxes) { expect(Math.abs(chip.height - (mobile ? 44 : 32))).toBeLessThanOrEqual(2); expect(chip.width).toBeGreaterThanOrEqual(94); expect(chip.width).toBeLessThanOrEqual(162); expect(chip.radius).toBe(8); expect(chip.border).toBe(1); expect(chip.shadow).toBe(true); }
    if (mobile) for (const target of metrics.targets) expect(target).toBeGreaterThanOrEqual(44);
    if (shown) await expect(chips(page).first()).toHaveText("Evento: Inicio de sesión");
  }
});
