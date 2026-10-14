import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { DASHBOARD_GEOMETRY_SESSION_COOKIE, DASHBOARD_GEOMETRY_SURFACES, installSurfaceMocks, suppressNextDevChrome, waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";
const audit = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
if (!audit) throw new Error("C10: missing audit fixture surface"); let harness = "";
test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { SuperSearchField } from "./src/features/dashboard/presentation/filters/index.ts";
const main = document.querySelector("main.dashboard-main"), mount = document.createElement("div");
mount.setAttribute("data-c10-harness", "true"); mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2"; main.style.position = "relative"; main.append(mount);
const log = (window.__c10Log = []), refLog = (window.__c10RefLog = []);
const callbackA = (node) => { refLog.push(node ? "a:attach" : "a:null"); return () => refLog.push("a:cleanup"); };
const callbackB = (node) => { refLog.push(node ? "b:attach" : "b:null"); return () => refLog.push("b:cleanup"); };
const legacy = (node) => { refLog.push(node ? "legacy:attach" : "legacy:null"); };
function Harness() {
  const [value, setValue] = useState(""), [disabled, setDisabled] = useState(false), [busy, setBusy] = useState(false);
  const [refMode, setRefMode] = useState("object"), [elementKey, setElementKey] = useState(0), [visible, setVisible] = useState(true);
  const inputRef = useRef(null);
  Object.assign(window, { __c10SetValue: setValue, __c10SetDisabled: setDisabled, __c10SetBusy: setBusy, __c10SetRefMode: setRefMode, __c10SetElementKey: setElementKey, __c10SetVisible: setVisible, __c10ObjectRef: inputRef, __c10Focus: () => inputRef.current?.focus() });
  return <WorkspaceScaffold kind="surface" ariaLabel="Arnés C10" filters={<div data-c10-filter-region="true" style={{ height: 56, flex: "none", padding: "8px 16px", borderBottom: "1px solid #ddd", minWidth: 0 }}><form role="search" onSubmit={(event) => { event.preventDefault(); log.push("submit:" + value); }}>{visible && <SuperSearchField key={elementKey} ref={refMode === "object" ? inputRef : refMode === "a" ? callbackA : refMode === "b" ? callbackB : legacy} label="Buscar registros" placeholder="Buscar" value={value} onValueChange={(next) => { log.push("change:" + next); setValue(next); }} disabled={disabled} busy={busy} />}</form></div>} collection={<div data-c10-collection="true" style={{ flex: 1, minHeight: 0 }}>Colección intacta</div>} />;
}
createRoot(mount).render(<Harness />);`, resolveDir: resolve(process.cwd()), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", alias: { "@": resolve(process.cwd(), "src") } });
  harness = result.outputFiles[0].text; });
async function mount(page: Page, width: number, height: number) {
  if (!audit) throw new Error("C10: missing audit fixture surface");
  await page.setViewportSize({ width, height }); await suppressNextDevChrome(page); await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[audit.role]]); await installSurfaceMocks(page, audit); await page.goto(audit.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(audit.readinessSelector)).toBeVisible({ timeout: 25_000 }); await waitForLayoutSettled(page);
  await page.addScriptTag({ content: harness }); await expect(page.getByRole("searchbox", { name: "Buscar registros" })).toBeVisible(); await waitForLayoutSettled(page);
}
const history = (page: Page) => page.evaluate(() => [...(window as unknown as { __c10Log: string[] }).__c10Log]); const refs = (page: Page) => page.evaluate(() => [...(window as unknown as { __c10RefLog: string[] }).__c10RefLog]);
const set = (page: Page, name: string, value: string | number | boolean) => page.evaluate(([key, next]) => (window as unknown as Record<string, (value: unknown) => void>)[key](next), [name, value] as const); test("C10 · callback refs conservan cleanup y estabilidad", async ({ page }) => {
  await mount(page, 1366, 768); expect(await page.evaluate(() => (window as unknown as { __c10ObjectRef: { current: Element | null } }).__c10ObjectRef.current?.tagName)).toBe("INPUT");
  await set(page, "__c10SetRefMode", "a"); await expect.poll(() => refs(page)).toEqual(["a:attach"]); expect(await page.evaluate(() => (window as unknown as { __c10ObjectRef: { current: Element | null } }).__c10ObjectRef.current)).toBeNull(); await set(page, "__c10SetValue", "nuevo"); await expect(page.getByRole("searchbox", { name: "Buscar registros" })).toHaveValue("nuevo"); expect(await refs(page)).toEqual(["a:attach"]);
  await set(page, "__c10SetRefMode", "b"); await expect.poll(() => refs(page)).toEqual(["a:attach", "a:cleanup", "b:attach"]);
  await set(page, "__c10SetElementKey", 1); await expect.poll(() => refs(page)).toEqual(["a:attach", "a:cleanup", "b:attach", "b:cleanup", "b:attach"]);
  await set(page, "__c10SetRefMode", "legacy"); await expect.poll(() => refs(page)).toEqual(["a:attach", "a:cleanup", "b:attach", "b:cleanup", "b:attach", "b:cleanup", "legacy:attach"]);
  await set(page, "__c10SetVisible", false); await expect.poll(() => refs(page)).toEqual(["a:attach", "a:cleanup", "b:attach", "b:cleanup", "b:attach", "b:cleanup", "legacy:attach", "legacy:null"]);
  await set(page, "__c10SetRefMode", "object"); await set(page, "__c10SetVisible", true); await expect(page.getByRole("searchbox", { name: "Buscar registros" })).toBeVisible(); expect(await page.evaluate(() => (window as unknown as { __c10ObjectRef: { current: Element | null } }).__c10ObjectRef.current?.tagName)).toBe("INPUT"); await set(page, "__c10SetVisible", false); await expect(page.getByRole("searchbox", { name: "Buscar registros" })).toHaveCount(0); expect(await page.evaluate(() => (window as unknown as { __c10ObjectRef: { current: Element | null } }).__c10ObjectRef.current)).toBeNull();
});
test("C10 · valor controlado, limpieza, foco, Enter, IME y estados", async ({ page }) => { await mount(page, 1366, 768); const input = page.getByRole("searchbox", { name: "Buscar registros" }), initialHistory = await page.evaluate(() => window.history.length);
  await input.fill("gato"); expect(await history(page)).toEqual(["change:gato"]); await input.press("Tab"); await expect(page.getByRole("button", { name: "Limpiar búsqueda" })).toBeFocused(); await page.keyboard.press("Shift+Tab"); await expect(input).toBeFocused();
  const focus = await input.evaluate((element) => { const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }; }); expect(focus.style).not.toBe("none"); expect(focus.width).toBeGreaterThanOrEqual(2);
  await input.press("Enter"); expect(await history(page)).toEqual(["change:gato", "submit:gato"]); await input.press("Escape"); await expect(input).toHaveValue("gato"); await page.getByRole("button", { name: "Limpiar búsqueda" }).click(); await expect(input).toHaveValue(""); await expect(input).toBeFocused(); expect(await history(page)).toEqual(["change:gato", "submit:gato", "change:"]);
  await set(page, "__c10SetValue", "externo"); await expect(input).toHaveValue("externo"); await input.dispatchEvent("compositionstart"); await input.fill("texto pegado largo ".repeat(20)); await input.dispatchEvent("compositionend"); await expect(input).toHaveValue("texto pegado largo ".repeat(20));
  await set(page, "__c10SetBusy", true); await expect(input).toBeDisabled(); await expect(input).toHaveAttribute("aria-busy", "true"); await expect(page.getByRole("button", { name: "Limpiar búsqueda" })).toHaveCount(0);
  await set(page, "__c10SetBusy", false); await set(page, "__c10SetDisabled", true); await expect(input).toBeDisabled(); await set(page, "__c10SetDisabled", false); await expect(input).toBeEnabled(); await page.evaluate(() => (window as unknown as { __c10Focus: () => void }).__c10Focus()); await expect(input).toBeFocused();
  expect(await page.evaluate(() => window.history.length)).toBe(initialHistory); await expect(page.locator('[data-c10-collection="true"]')).toHaveText("Colección intacta"); expect((await new AxeBuilder({ page }).include('[data-c10-harness="true"]').analyze()).violations).toEqual([]);
});
for (const [width, height] of [[1920, 1080], [1366, 768], [1280, 720], [834, 1194], [768, 1024], [390, 844], [320, 568]]) test(`C10 · geometría y responsive ${width}x${height}`, async ({ page }) => {
  await mount(page, width, height); const metrics = await page.evaluate(() => { const field = document.querySelector<HTMLElement>('[data-super-search-field="true"]')!, input = field.querySelector("input")!, region = document.querySelector<HTMLElement>('[data-c10-filter-region="true"]')!, rect = input.getBoundingClientRect(), style = getComputedStyle(input);
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return { height: rect.height, radius: parseFloat(style.borderTopLeftRadius), width: rect.width, regionHeight: region.getBoundingClientRect().height, overflow, inside: rect.left >= 0 && rect.right <= window.innerWidth }; });
  expect(metrics.height).toBe(40); expect(metrics.radius).toBe(20); expect(metrics.regionHeight).toBe(56); expect(metrics.width).toBeGreaterThan(0); expect(metrics.overflow).toBe(0); expect(metrics.inside).toBe(true);
  if (width < 768) { await set(page, "__c10SetValue", "valor"); const clear = await page.getByRole("button", { name: "Limpiar búsqueda" }).boundingBox(); expect(clear?.width).toBeGreaterThanOrEqual(44); expect(clear?.height).toBeGreaterThanOrEqual(44); }
});
