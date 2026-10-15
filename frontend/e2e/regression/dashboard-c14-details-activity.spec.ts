import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { DASHBOARD_GEOMETRY_SESSION_COOKIE, DASHBOARD_GEOMETRY_SURFACES, installSurfaceMocks, suppressNextDevChrome, waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

const audit = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
if (!audit) throw new Error("C14: missing audit fixture surface");
const PANEL = '[data-c14-harness="true"] .dashboard-utility-side-panel';
let harness = "";

test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { DetailsPane, DetailsTabs, DetailsActivity, DetailsActionDock } from "./src/features/dashboard/presentation/details/index.ts";
const main = document.querySelector("main.dashboard-main"), mount = document.createElement("div");
mount.setAttribute("data-c14-harness", "true"); mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2"; main.style.position = "relative"; main.append(mount);
const log = (window.__c14Log = []);
const steps = [
  { id: "received", label: "Recibido", date: "01/10/2026", status: "completed", description: "Ingreso" },
  { id: "review", label: "Revisión", date: "02/10/2026", status: "current" },
  { id: "queued", label: "En espera", status: "pending" },
  { id: "attention", label: "Atención", status: "warning" },
  { id: "failure", label: "Error", status: "error" },
];
function Harness() {
  const [selected, setSelected] = useState(false), [active, setActive] = useState("activity"), [disabled, setDisabled] = useState(false), [pending, setPending] = useState(false);
  Object.assign(window, { __c14SetSelected: setSelected, __c14SetDisabled: setDisabled, __c14SetPending: setPending });
  return <WorkspaceScaffold kind="module" moduleId="c14-harness" title="Arnés C14" titleId="c14-title"
    collection={<ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, minHeight: 0 }}><li><button type="button" data-c14-select="true" onClick={() => setSelected(true)}>Seleccionar</button></li></ul>}
    details={<DetailsPane label="Detalle sintético">
      <DetailsTabs label="Secciones" activeId={active} onActiveIdChange={setActive} tabs={[{ id: "activity", label: "Actividad", content: <DetailsActivity steps={selected ? steps : []} ariaLabel="Actividad del registro" className="c14-activity-probe" emptyTitle="Sin actividad" /> }]} />
      <DetailsActionDock label="Acciones del registro" description="Acciones disponibles" pending={pending} actions={selected ? [
        { id: "open", label: "Abrir", onClick: () => log.push("open") },
        { id: "download", label: "Descargar", onClick: () => log.push("download"), disabledReason: disabled ? "Archivo no disponible" : undefined },
      ] : []} />
    </DetailsPane>} />;
}
createRoot(mount).render(<Harness />);`, resolveDir: resolve(process.cwd()), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", alias: { "@": resolve(process.cwd(), "src") } });
  harness = result.outputFiles[0].text;
});

async function mount(page: Page, width: number, height: number) {
  if (!audit) throw new Error("C14: missing audit fixture surface");
  await page.setViewportSize({ width, height });
  await suppressNextDevChrome(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[audit.role]]);
  await installSurfaceMocks(page, audit);
  await page.goto(audit.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(audit.readinessSelector)).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector("main.dashboard-main") ?? {}).some((key) => key.startsWith("__reactFiber$"))), { timeout: 25_000 }).toBe(true);
  await waitForLayoutSettled(page);
  await page.addScriptTag({ content: harness });
  await expect(page.locator('[data-c14-select="true"]')).toBeVisible();
  await page.locator(`${PANEL} > button.dashboard-utility-side-panel-toggle`).click();
  await expect(page.locator(PANEL)).toHaveAttribute("data-expanded", "true");
}

const call = (page: Page, name: string, value: boolean) => page.evaluate(([key, next]) => (window as unknown as Record<string, (value: boolean) => void>)[key](next), [name, value] as const);
const logOf = (page: Page) => page.evaluate(() => [...(window as unknown as { __c14Log: string[] }).__c14Log]);

test("C14 · actividad ordenada y estado vacío accesible", async ({ page }) => {
  await mount(page, 1366, 768);
  const panel = page.locator(PANEL);
  await expect(panel.getByText("Sin actividad")).toBeVisible(); await expect(panel.getByRole("group", { name: "Actividad del registro" })).toHaveClass(/c14-activity-probe/);
  await expect(panel.locator('[data-details-action-dock="true"]')).toHaveCount(0);
  await page.locator('[data-c14-select="true"]').click();
  const list = panel.getByRole("list", { name: "Actividad del registro" });
  await expect(list.locator("li")).toHaveCount(5);
  await expect(list.locator("li").first()).toContainText("Recibido");
  await expect(list.locator("li").nth(1)).toHaveAttribute("aria-current", "step");
  await expect(list.locator("li").last()).toContainText("Error");
  await expect(panel.getByText("Ingreso")).toBeVisible();
  await expect(panel.getByText("Pendiente").first()).toBeVisible();
  expect((await new AxeBuilder({ page }).include(PANEL).analyze()).violations).toEqual([]);
});

test("C14 · dock controlado, teclado y una activación", async ({ page }) => {
  await mount(page, 1366, 768);
  const url = page.url(), requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/")) requests.push(request.url()); });
  await page.locator('[data-c14-select="true"]').click();
  const dock = page.locator(`${PANEL} [data-details-action-dock="true"]`);
  const open = dock.getByRole("button", { name: "Abrir" });
  const download = dock.getByRole("button", { name: "Descargar" });
  await call(page, "__c14SetDisabled", true);
  await expect(download).toBeDisabled();
  await expect(dock.getByText("Archivo no disponible")).toBeVisible();
  await open.focus();
  await expect(open).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await logOf(page)).toEqual(["open"]);
  await call(page, "__c14SetPending", true);
  await expect(open).toBeDisabled();
  await expect(download).toBeDisabled();
  expect(await logOf(page)).toEqual(["open"]);
  expect(page.url()).toBe(url);
  expect(requests).toEqual([]);
});

for (const [width, height] of [[1366, 768], [390, 844], [320, 568]] as const) {
  test(`C14 · un scroll owner y dock visible a ${width}×${height}`, async ({ page }) => {
    await mount(page, width, height);
    await call(page, "__c14SetSelected", true);
    const panel = page.locator(PANEL);
    await expect(panel.getByRole("button", { name: "Abrir" })).toBeVisible();
    await waitForLayoutSettled(page);
    const measures = await page.evaluate(() => {
      const panel = document.querySelector('[data-c14-harness="true"] .dashboard-utility-side-panel')!;
      const content = panel.querySelector(".dashboard-utility-side-panel-content")!;
      const delta = (element: Element | null) => Math.max((element?.scrollHeight ?? 0) - (element?.clientHeight ?? 0), (element?.scrollWidth ?? 0) - (element?.clientWidth ?? 0));
      const main = document.querySelector("main.dashboard-main")!;
      const button = panel.querySelector('[data-details-action-dock="true"] button')!;
      return { panelWidth: panel.getBoundingClientRect().width, outer: [delta(document.documentElement), delta(document.body)], mainOverflow: getComputedStyle(main).overflowY, mainScrollTop: main.scrollTop, contentOverflow: getComputedStyle(content).overflowY, innerScrollers: [...content.querySelectorAll("*")].filter((element) => ["auto", "scroll"].includes(getComputedStyle(element).overflowY)).length, targetHeight: button.getBoundingClientRect().height, buttonBottom: button.getBoundingClientRect().bottom, contentBottom: content.getBoundingClientRect().bottom };
    });
    expect(measures.panelWidth).toBeCloseTo(width >= 768 ? 336 : width, 0);
    for (const delta of measures.outer) expect(delta).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
    expect(measures.mainOverflow).toBe("hidden");
    expect(measures.mainScrollTop).toBe(0);
    expect(measures.contentOverflow).toBe("auto");
    expect(measures.innerScrollers).toBe(0);
    expect(measures.buttonBottom).toBeLessThanOrEqual(measures.contentBottom + 1);
    if (width < 768) expect(measures.targetHeight).toBeGreaterThanOrEqual(44);
  });
}
