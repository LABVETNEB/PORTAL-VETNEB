import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DASHBOARD_GEOMETRY_SESSION_COOKIE, DASHBOARD_GEOMETRY_SURFACES, installSurfaceMocks, suppressNextDevChrome, waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";

const audit = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
if (!audit) throw new Error("C15: missing audit fixture surface");
const ORIGIN = "https://documents.c15.test";
const PDF = `${ORIGIN}/synthetic.pdf`;
const BAD_PDF = `${ORIGIN}/broken.pdf`;
const IMAGE = `${ORIGIN}/synthetic.png`;
const marker = "SYNTHETIC_PRIVATE_MARKER";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l7sAAAAASUVORK5CYII=", "base64");
const worker = readFileSync(resolve(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"));
let harness = "";
let workerRequests = 0;

function twoPagePdf(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 5 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << >> /Contents 6 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { DocumentViewer } from "./src/features/dashboard/presentation/viewer/index.ts";
const main = document.querySelector("main.dashboard-main"), mount = document.createElement("div");
mount.setAttribute("data-c15-harness", "true"); mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2"; main.style.position = "relative"; main.append(mount);
const log = (window.__c15Log = []);
function Harness() {
  const [open, setOpen] = useState(false), [source, setSource] = useState(null), [allowed, setAllowed] = useState(true);
  const trigger = useRef(null);
  Object.assign(window, { __c15Source: setSource, __c15Open: setOpen, __c15Allowed: setAllowed });
  return <WorkspaceScaffold kind="surface" ariaLabel="Arnés C15" collection={<div style={{ flex: 1, minHeight: 0 }}><button ref={trigger} type="button" onClick={() => setOpen(true)}>Abrir documento</button></div>} footer={<DocumentViewer open={open} onOpenChange={(next) => { log.push("open:" + next); setOpen(next); }} title="Documento sintético" source={source} trustedOrigins={allowed ? [${JSON.stringify(ORIGIN)}] : []} onDownload={() => log.push("download")} returnFocusRef={trigger} />} />;
}
createRoot(mount).render(<Harness />);`, resolveDir: resolve(process.cwd()), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "esm", alias: { "@": resolve(process.cwd(), "src") } });
  harness = result.outputFiles[0].text;
});

async function mount(page: Page, width = 1366, height = 768) {
  if (!audit) throw new Error("C15: missing audit fixture surface");
  workerRequests = 0;
  await page.setViewportSize({ width, height }); await suppressNextDevChrome(page); await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.route("**/pdfjs-dist/build/pdf.worker.min.mjs", (route) => { workerRequests += 1; return route.fulfill({ status: 200, contentType: "text/javascript", body: worker }); });
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith(".png") ? png : path.endsWith("broken.pdf") ? Buffer.from("not a PDF") : twoPagePdf();
    return route.fulfill({ status: 200, contentType: path.endsWith(".png") ? "image/png" : "application/pdf", headers: { "access-control-allow-origin": "*" }, body });
  });
  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[audit.role]]); await installSurfaceMocks(page, audit); await page.goto(audit.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(audit.readinessSelector)).toBeVisible({ timeout: 25_000 });
  await expect.poll(() => page.evaluate(() => Object.keys(document.querySelector("main.dashboard-main") ?? {}).some((key) => key.startsWith("__reactFiber$"))), { timeout: 25_000 }).toBe(true);
  await waitForLayoutSettled(page);
  await page.evaluate(() => {
    const NativeWorker = window.Worker;
    (window as unknown as { __c15WorkerCount: number }).__c15WorkerCount = 0;
    (window as unknown as { __c15WorkerTerminations: number }).__c15WorkerTerminations = 0;
    Object.defineProperty(window, "Worker", { configurable: true, value: class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (String(url).includes("pdf.worker")) (window as unknown as { __c15WorkerCount: number }).__c15WorkerCount += 1;
        super(url, options);
      }
      terminate() { (window as unknown as { __c15WorkerTerminations: number }).__c15WorkerTerminations += 1; super.terminate(); }
    } });
  });
  await page.addScriptTag({ content: harness, type: "module" }); await expect(page.getByRole("button", { name: "Abrir documento" })).toBeVisible();
}

const set = (page: Page, key: string, value: unknown) => page.evaluate(([name, next]) => (window as unknown as Record<string, (value: unknown) => void>)[name as string](next), [key, value] as const);
const pdf = (url = PDF) => ({ kind: "pdf", mimeType: "application/pdf", url });

test("C15 · PDF multipágina, zoom, descarga, Escape y foco", async ({ page }) => {
  const consoleText: string[] = [];
  page.on("console", (message) => consoleText.push(message.text()));
  await mount(page); await set(page, "__c15Source", pdf(`${PDF}?proof=${marker}`));
  const trigger = page.getByRole("button", { name: "Abrir documento" }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Página 1 de 2" })).toBeVisible({ timeout: 15_000 });
  expect(workerRequests).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __c15WorkerCount: number }).__c15WorkerCount)).toBeGreaterThan(0);
  await expect(dialog.getByText("1 / 2")).toBeVisible();
  await dialog.getByRole("button", { name: "Página siguiente" }).click();
  await expect(dialog.getByRole("img", { name: "Página 2 de 2" })).toBeVisible();
  expect(await dialog.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.width > canvas.height)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Ampliar zoom" }).click(); await expect(dialog.getByText("125%")).toBeVisible();
  await dialog.getByRole("button", { name: "Descargar documento" }).click();
  expect(await page.evaluate(() => (window as unknown as { __c15Log: string[] }).__c15Log)).toContain("download");
  expect(consoleText.join(" ")).not.toContain(marker);
  expect((await new AxeBuilder({ page }).include('[data-c15-viewer="true"]').analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __c15WorkerTerminations: number }).__c15WorkerTerminations)).toBeGreaterThan(0);
});

test("C15 · estados, imágenes, política de origen y recuperación", async ({ page }) => {
  const browserMessages: string[] = [];
  page.on("console", (message) => browserMessages.push(message.text()));
  page.on("pageerror", (error) => browserMessages.push(error.message));
  await mount(page, 390, 844); await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  await expect(dialog.getByText("No hay documento para mostrar.")).toBeVisible();
  await set(page, "__c15Source", { kind: "image", mimeType: "image/png", url: IMAGE });
  await expect(dialog.getByRole("img", { name: "Documento sintético" })).toBeVisible();
  for (const [extension, mimeType] of [["jpg", "image/jpeg"], ["webp", "image/webp"]] as const) {
    const data = await page.evaluate((format) => { const canvas = document.createElement("canvas"); canvas.width = 2; canvas.height = 2; canvas.getContext("2d")!.fillRect(0, 0, 2, 2); return canvas.toDataURL(format); }, mimeType);
    await page.route(`${ORIGIN}/synthetic.${extension}`, (route) => route.fulfill({ status: 200, contentType: mimeType, headers: { "access-control-allow-origin": "*" }, body: Buffer.from(data.split(",")[1], "base64") }));
    await set(page, "__c15Source", { kind: "image", mimeType, url: `${ORIGIN}/synthetic.${extension}` });
    await expect(dialog.getByRole("img", { name: "Documento sintético" })).toBeVisible();
  }
  await set(page, "__c15Source", { kind: "image", mimeType: "image/gif", url: IMAGE });
  await expect(dialog.getByRole("alert")).toContainText("no se puede mostrar");
  await set(page, "__c15Source", pdf("http://documents.c15.test/synthetic.pdf"));
  await expect(dialog.getByRole("alert")).toContainText("no se puede mostrar");
  await set(page, "__c15Source", pdf("https://user:pass@documents.c15.test/synthetic.pdf"));
  await expect(dialog.getByRole("alert")).toContainText("no se puede mostrar");
  await set(page, "__c15Source", pdf()); await set(page, "__c15Allowed", false);
  await expect(dialog.getByRole("alert")).toContainText("no se puede mostrar");
  await set(page, "__c15Allowed", true); await set(page, "__c15Source", pdf(`${BAD_PDF}?proof=${marker}`));
  await expect(dialog.getByRole("alert")).toContainText("No se pudo mostrar", { timeout: 15_000 });
  await dialog.getByRole("button", { name: "Reintentar" }).click();
  await expect(dialog.getByRole("alert")).toContainText("No se pudo mostrar", { timeout: 15_000 });
  expect(browserMessages.join(" ")).not.toContain(marker);
});

test("C15 · cierre durante carga, fullscreen y scroll sólo en modal", async ({ page }) => {
  await mount(page, 390, 844);
  await page.route(PDF, async (route) => { await new Promise((done) => setTimeout(done, 600)); await route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: twoPagePdf() }); });
  await set(page, "__c15Source", pdf()); await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  await expect(dialog.getByText("Cargando documento…")).toBeVisible();
  await dialog.getByRole("button", { name: "Pantalla completa" }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await dialog.getByRole("button", { name: "Cerrar visor" }).last().click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => ({ body: document.body.scrollHeight - document.body.clientHeight, main: (() => { const main = document.querySelector("main.dashboard-main"); return (main?.scrollHeight ?? 0) - (main?.clientHeight ?? 0); })() }))).toEqual({ body: 0, main: 0 });
});

test("C15 · renderizados alternados, scroll interior y fallback fullscreen", async ({ page }) => {
  await mount(page, 390, 600);
  await set(page, "__c15Source", pdf()); await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  await expect(dialog.getByRole("img", { name: "Página 1 de 2" })).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "Página siguiente" }).click();
  await expect(dialog.getByRole("img", { name: "Página 2 de 2" })).toBeVisible();
  await dialog.getByRole("button", { name: "Página anterior" }).click();
  await expect(dialog.getByRole("img", { name: "Página 1 de 2" })).toBeVisible();
  for (let index = 0; index < 4; index += 1) {
    await dialog.getByRole("button", { name: "Ampliar zoom" }).click();
    await expect(dialog.getByText(`${125 + index * 25}%`)).toBeVisible();
  }
  await expect(dialog.getByRole("button", { name: "Ampliar zoom" })).toBeDisabled();
  expect(await page.evaluate(() => { const body = document.querySelector('[data-c15-scroll="true"]'); return !!body && body.scrollHeight > body.clientHeight; })).toBe(true);
  expect(await page.evaluate(() => document.body.scrollHeight - document.body.clientHeight)).toBe(0);
  await page.evaluate(() => { const dialog = document.querySelector('[data-c15-viewer="true"]') as HTMLElement; dialog.requestFullscreen = () => Promise.reject(new Error("synthetic denial")); });
  await dialog.getByRole("button", { name: "Pantalla completa" }).click();
  await expect(dialog).toBeVisible();
  await set(page, "__c15Source", { kind: "image", mimeType: "image/png", url: IMAGE });
  await expect(dialog.getByRole("img", { name: "Documento sintético" })).toBeVisible();
  await set(page, "__c15Source", pdf());
  await expect(dialog.getByRole("img", { name: "Página 1 de 2" })).toBeVisible({ timeout: 15_000 });
});
