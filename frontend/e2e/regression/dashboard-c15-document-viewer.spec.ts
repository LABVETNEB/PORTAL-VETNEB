import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";
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
const workerPath = resolve(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
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

function coloredPdf(count: number): Buffer {
  const colors = ["1 0 0", "0 1 0", "0 0 1"];
  const kids = Array.from({ length: count }, (_, index) => `${index + 3} 0 R`).join(" ");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${kids}] /Count ${count} >>`];
  for (let index = 0; index < count; index += 1) objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents ${count + 3 + index} 0 R >>`);
  for (let index = 0; index < count; index += 1) {
    const stream = `${colors[index % colors.length]} rg 0 0 300 400 re f\n`;
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  return Buffer.from(`${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { DocumentViewer } from "./src/features/dashboard/presentation/viewer/index.ts";
import { PdfSession } from "./src/features/dashboard/presentation/viewer/pdfjs-client.ts";
const main = document.querySelector("main.dashboard-main"), mount = document.createElement("div");
mount.setAttribute("data-c15-harness", "true"); mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2"; main.style.position = "relative"; main.append(mount);
const log = (window.__c15Log = []);
window.__c15PdfSession = PdfSession;
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
  await page.route("**/pdfjs-dist/build/pdf.worker.min.mjs", (route) => { workerRequests += 1; return route.fulfill({ status: 200, contentType: "text/javascript", path: workerPath }); });
  await page.route(/^https:\/\/documents\.c15\.test\//, (route) => {
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
  expect(await dialog.locator('[data-c15-scroll="true"] canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width > canvas.height)).toBe(true);
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
    const body = Buffer.from(data.split(",")[1], "base64");
    if (extension === "jpg") await page.route("**/synthetic.jpg", (route) => route.fulfill({ status: 200, contentType: mimeType, headers: { "access-control-allow-origin": "*" }, body }));
    else await page.route("**/synthetic.webp", (route) => route.fulfill({ status: 200, contentType: mimeType, headers: { "access-control-allow-origin": "*" }, body }));
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

test("C15 · ambos extremos de una imagen ampliada quedan alcanzables", async ({ page }) => {
  for (const width of [390, 1366]) {
    await mount(page, width, 844);
    const image = await page.evaluate((imageWidth) => {
      const canvas = document.createElement("canvas");
      canvas.width = imageWidth;
      canvas.height = 300;
      canvas.getContext("2d")!.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    }, width - 32);
    await page.route("**/synthetic.png", (route) => route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: Buffer.from(image.split(",")[1], "base64") }));
    await set(page, "__c15Source", { kind: "image", mimeType: "image/png", url: IMAGE });
    await page.getByRole("button", { name: "Abrir documento" }).click();
    const dialog = page.getByRole("dialog", { name: "Documento sintético" });
    await expect(dialog.getByRole("img", { name: "Documento sintético" })).toBeVisible();
    for (const target of [125, 150, 200]) {
      while (Number((await dialog.getByText(/^[0-9]+%$/).textContent())?.replace("%", "")) < target) {
        await dialog.getByRole("button", { name: "Ampliar zoom" }).click();
      }
      await expect.poll(() => dialog.getByRole("img", { name: "Documento sintético" }).evaluate((image) => image.getBoundingClientRect().width)).toBeGreaterThan(width - 32);
      const scroll = dialog.locator('[data-c15-scroll="true"]');
      const start = await scroll.evaluate((element) => {
        element.scrollLeft = 0;
        const image = element.querySelector("img")!;
        return { left: image.getBoundingClientRect().left - element.getBoundingClientRect().left, max: element.scrollWidth - element.clientWidth };
      });
      expect(start.left, `${width}px at ${target}%: left edge`).toBeGreaterThanOrEqual(-1);
      expect(start.max, `${width}px at ${target}%: horizontal range`).toBeGreaterThan(0);
      const end = await scroll.evaluate((element) => {
        element.scrollLeft = element.scrollWidth - element.clientWidth;
        const image = element.querySelector("img")!;
        return { right: image.getBoundingClientRect().right - element.getBoundingClientRect().right, left: element.scrollLeft };
      });
      expect(end.right, `${width}px at ${target}%: right edge`).toBeLessThanOrEqual(1);
      expect(end.left).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBe(0);
    }
    await dialog.getByRole("button", { name: "Cerrar visor" }).last().click();
  }
});

test("C15 · cierre durante carga, fullscreen y scroll sólo en modal", async ({ page }) => {
  await mount(page, 390, 844);
  let pendingPdf: Route | undefined;
  await page.route("**/synthetic.pdf", (route) => { pendingPdf = route; });
  await set(page, "__c15Source", pdf()); await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  await expect(dialog.getByText("Cargando documento…")).toBeVisible();
  await expect.poll(() => pendingPdf !== undefined).toBe(true);
  await dialog.getByRole("button", { name: "Pantalla completa" }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await dialog.getByRole("button", { name: "Cerrar visor" }).last().click();
  await expect(dialog).toHaveCount(0);
  if (pendingPdf) await pendingPdf.abort();
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

test("C16 · PDF de una página evita banda y PDF largo carga miniaturas reales por demanda", async ({ page }) => {
  const browserMessages: string[] = [];
  page.on("console", (message) => browserMessages.push(message.text()));
  page.on("pageerror", (error) => browserMessages.push(error.message));
  await mount(page);
  let loads = 0;
  await page.route(/^https:\/\/documents\.c15\.test\/colored-(one|many)\.pdf/, (route) => {
    loads += 1;
    const count = route.request().url().includes("colored-one") ? 1 : 24;
    return route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: coloredPdf(count) });
  });
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-one.pdf`));
  await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  await expect(dialog.getByRole("img", { name: "Página 1 de 1" })).toBeVisible();
  await expect(dialog.getByRole("navigation", { name: "Miniaturas del documento" })).toHaveCount(0);
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-many.pdf?proof=${marker}`));
  const strip = dialog.getByRole("navigation", { name: "Miniaturas del documento" });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("button", { name: "Ir a página 24 de 24" })).toBeAttached();
  await expect(strip.locator('[data-c16-page="1"] canvas')).toBeVisible();
  const firstColor = await strip.locator('[data-c16-page="1"] canvas').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext("2d")!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data));
  expect(firstColor[0]).toBeGreaterThan(200);
  expect(firstColor[1]).toBeLessThan(50);
  expect(await strip.locator("canvas").evaluateAll((canvases: HTMLCanvasElement[]) => canvases.filter((canvas) => canvas.width > 0).length)).toBeLessThanOrEqual(8);
  await strip.getByRole("button", { name: "Ir a página 2 de 24" }).click();
  await expect(dialog.getByRole("img", { name: "Página 2 de 24" })).toBeVisible();
  await expect(strip.getByRole("button", { name: "Ir a página 2 de 24" })).toHaveAttribute("aria-current", "page");
  await dialog.getByRole("button", { name: "Página siguiente" }).click();
  await expect(strip.getByRole("button", { name: "Ir a página 3 de 24" })).toHaveAttribute("aria-current", "page");
  await dialog.getByRole("button", { name: "Ampliar zoom" }).click();
  await expect(dialog.getByText("125%")).toBeVisible();
  await expect(strip.getByRole("button", { name: "Ir a página 3 de 24" })).toHaveAttribute("aria-current", "page");
  await strip.getByRole("button", { name: "Ir a página 24 de 24" }).click();
  await expect(dialog.getByRole("img", { name: "Página 24 de 24" })).toBeVisible();
  expect(await strip.locator("canvas").evaluateAll((canvases: HTMLCanvasElement[]) => canvases.filter((canvas) => canvas.width > 0).length)).toBeLessThanOrEqual(8);
  await expect(strip.locator('[data-c16-page="1"] canvas')).toHaveJSProperty("width", 0);
  const evicted = strip.locator('[data-c16-page="1"]');
  const evictedStatus = evicted.locator(":scope > span[id]");
  await expect(evictedStatus).toHaveText("Miniatura en espera");
  await expect(evicted.getByRole("button", { name: "Ir a página 1 de 24" })).toHaveAttribute("aria-describedby", await evictedStatus.getAttribute("id") ?? "");
  await expect(evicted.getByRole("button", { name: "Ir a página 1 de 24" }).getByText("Miniatura en espera")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[data-c15-viewer="true"]').analyze()).violations).toEqual([]);
  await strip.getByRole("button", { name: "Ir a página 1 de 24" }).click();
  await expect(dialog.getByRole("img", { name: "Página 1 de 24" })).toBeVisible();
  await expect(strip.locator('[data-c16-page="1"] canvas')).toBeVisible();
  expect(loads).toBe(2);
  expect(browserMessages.join(" ")).not.toContain(marker);
  expect(await page.evaluate(() => document.body.scrollHeight - document.body.clientHeight)).toBe(0);
  expect((await new AxeBuilder({ page }).include('[data-c15-viewer="true"]').analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir documento" })).toBeFocused();
});

test("C16 · error individual, reintento y cambio rápido de documento", async ({ page }) => {
  await mount(page);
  await page.route(/^https:\/\/documents\.c15\.test\/colored-/, (route) => route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: coloredPdf(route.request().url().includes("one") ? 1 : 3) }));
  await page.evaluate(() => {
    const klass = (window as unknown as { __c15PdfSession: typeof import("../../src/features/dashboard/presentation/viewer/pdfjs-client").PdfSession }).__c15PdfSession;
    const original = klass.prototype.renderThumbnail;
    let failed = false;
    klass.prototype.renderThumbnail = function (canvas, number, signal) {
      if (number === 2 && !failed) { failed = true; return Promise.reject(new Error("synthetic thumbnail failure")); }
      return original.call(this, canvas, number, signal);
    };
  });
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-many.pdf?proof=${marker}`));
  await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  const strip = dialog.getByRole("navigation", { name: "Miniaturas del documento" });
  await expect(strip.getByRole("button", { name: "Reintentar miniatura de página 2" })).toBeVisible();
  const errorTile = strip.locator('[data-c16-page="2"]');
  const errorStatus = errorTile.locator(":scope > span[id]");
  await expect(errorStatus).toHaveText("Miniatura no disponible");
  await expect(errorTile.getByRole("button", { name: "Ir a página 2 de 3" })).toHaveAttribute("aria-describedby", await errorStatus.getAttribute("id") ?? "");
  expect((await new AxeBuilder({ page }).include('[data-c15-viewer="true"]').analyze()).violations).toEqual([]);
  await expect(strip.locator('[data-c16-page="1"] canvas')).toBeVisible();
  await strip.getByRole("button", { name: "Reintentar miniatura de página 2" }).click();
  await expect(strip.locator('[data-c16-page="2"] canvas')).toBeVisible();
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-one.pdf`));
  await expect(strip).toHaveCount(0);
  await expect(dialog.getByRole("img", { name: "Página 1 de 1" })).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollHeight - document.body.clientHeight)).toBe(0);
});

test("C16 · render principal que interrumpe una miniatura en pintura la recupera", async ({ page }) => {
  await mount(page);
  await page.route("**/colored-many.pdf", (route) => route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: coloredPdf(24) }));
  await page.evaluate(() => {
    type Session = { render: (canvas: HTMLCanvasElement, page: number, zoom: number) => Promise<void>; thumbnailTasks: Map<{ pageNumber: number }, unknown> };
    const target = window as unknown as { __c15PdfSession: { prototype: { renderThumbnail: (this: Session, canvas: HTMLCanvasElement, page: number, signal: AbortSignal) => Promise<void> } }; __c16Preempted: string[] };
    const preempted: string[] = target.__c16Preempted = [];
    const original = target.__c15PdfSession.prototype.renderThumbnail;
    target.__c15PdfSession.prototype.renderThumbnail = function (canvas, number, signal) {
      const tasks = this.thumbnailTasks;
      if (!Object.hasOwn(tasks, "set")) {
        tasks.set = (job, task) => {
          Map.prototype.set.call(tasks, job, task);
          if (task && job.pageNumber === 2 && !preempted.length) {
            preempted.push(String(job.pageNumber));
            const main = document.querySelector<HTMLCanvasElement>('[data-c15-scroll="true"] canvas');
            if (main) void this.render(main, 1, 1);
          }
          return tasks;
        };
      }
      return original.call(this, canvas, number, signal);
    };
  });
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-many.pdf`));
  await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  const strip = dialog.getByRole("navigation", { name: "Miniaturas del documento" });
  await expect(dialog.getByRole("img", { name: "Página 1 de 24" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __c16Preempted: string[] }).__c16Preempted)).toEqual(["2"]);
  await expect(strip.locator('[data-c16-page="2"] canvas')).toBeVisible();
  await expect(strip.getByText("Miniatura no disponible")).toHaveCount(0);
  await expect(strip.getByRole("button", { name: "Reintentar miniatura de página 2" })).toHaveCount(0);
  await expect(dialog.getByRole("img", { name: "Página 1 de 24" })).toBeVisible();
});

test("C16 · banda móvil conserva scroll propio y fondo inmóvil", async ({ page }) => {
  await mount(page, 390, 844);
  await page.route("**/colored-many.pdf", (route) => route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: coloredPdf(24) }));
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-many.pdf`));
  await page.getByRole("button", { name: "Abrir documento" }).click();
  const dialog = page.getByRole("dialog", { name: "Documento sintético" });
  const strip = dialog.getByRole("navigation", { name: "Miniaturas del documento" });
  await expect(strip).toBeVisible();
  await strip.getByRole("button", { name: "Ir a página 20 de 24" }).click();
  await expect(dialog.getByRole("img", { name: "Página 20 de 24" })).toBeVisible();
  const geometry = await page.evaluate(() => {
    const strip = document.querySelector('[data-c16-thumbnails="true"]')!;
    const main = document.querySelector("main.dashboard-main")!;
    return { stripScroll: strip.scrollLeft, stripOverflow: strip.scrollWidth > strip.clientWidth,
      bodyVertical: document.body.scrollHeight - document.body.clientHeight,
      bodyHorizontal: document.body.scrollWidth - document.body.clientWidth,
      mainVertical: main.scrollHeight - main.clientHeight };
  });
  expect(geometry.stripOverflow).toBe(true);
  expect(geometry.stripScroll).toBeGreaterThan(0);
  expect(geometry.bodyVertical).toBe(0);
  expect(geometry.bodyHorizontal).toBe(0);
  expect(geometry.mainVertical).toBe(0);
});

test("C16 review P1 · ocho miniaturas observadas no reinician renders ni expulsiones", async ({ page }) => {
  await mount(page, 1366, 1800);
  await page.route("**/colored-many.pdf", (route) => route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: coloredPdf(40) }));
  await page.evaluate(() => {
    const target = window as unknown as { __c15PdfSession: typeof import("../../src/features/dashboard/presentation/viewer/pdfjs-client").PdfSession; __c16Probe: { renders: number; completed: number; cancelled: number; restarted: number; peak: number; evictions: number }; __c16Session: { thumbnailTasks: Map<unknown, unknown> } };
    const probe = target.__c16Probe = { renders: 0, completed: 0, cancelled: 0, restarted: 0, peak: 0, evictions: 0 };
    const attempts = new Map<number, number>();
    const original = target.__c15PdfSession.prototype.renderThumbnail;
    target.__c15PdfSession.prototype.renderThumbnail = function (canvas, number, signal) {
      probe.renders += 1;
      const previous = attempts.get(number) ?? 0;
      if (previous > 0) probe.restarted += 1;
      attempts.set(number, previous + 1);
      const pending = original.call(this, canvas, number, signal);
      target.__c16Session = this as unknown as { thumbnailTasks: Map<unknown, unknown> };
      probe.peak = Math.max(probe.peak, target.__c16Session.thumbnailTasks.size);
      return pending.then(() => { probe.completed += 1; }, (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") probe.cancelled += 1;
        throw error;
      });
    };
    new MutationObserver((records) => {
      for (const record of records) if (record.target instanceof HTMLCanvasElement && record.oldValue && record.oldValue !== "0" && record.target.width === 0) probe.evictions += 1;
    }).observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["width"] });
  });
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-many.pdf`));
  await page.getByRole("button", { name: "Abrir documento" }).click();
  const strip = page.getByRole("navigation", { name: "Miniaturas del documento" });
  await expect(strip).toBeVisible();
  const observed = await strip.evaluate((root) => {
    const box = root.getBoundingClientRect();
    return [...root.querySelectorAll<HTMLElement>("[data-c16-page]")].filter((tile) => {
      const rect = tile.getBoundingClientRect();
      return rect.bottom > box.top - 120 && rect.top < box.bottom + 120;
    }).length;
  });
  expect(observed).toBeGreaterThanOrEqual(8);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __c16Probe: { renders: number } }).__c16Probe.renders)).toBeGreaterThanOrEqual(8);
  await expect(strip.getByText("Cargando miniatura…")).toHaveCount(0);
  const before = await page.evaluate(() => ({ ...(window as unknown as { __c16Probe: object }).__c16Probe }));
  await page.evaluate(() => new Promise<void>((resolve) => {
    let frames = 0;
    const advance = () => { if (++frames === 120) resolve(); else requestAnimationFrame(advance); };
    requestAnimationFrame(advance);
  }));
  const after = await page.evaluate(() => {
    const target = window as unknown as { __c16Probe: { renders: number; completed: number; cancelled: number; restarted: number; peak: number; evictions: number }; __c16Session: { thumbnailTasks: Map<unknown, unknown> } };
    return { ...target.__c16Probe, active: target.__c16Session.thumbnailTasks.size };
  });
  const bitmapCount = await strip.locator("canvas").evaluateAll((canvases: HTMLCanvasElement[]) => canvases.filter((canvas) => canvas.width > 0).length);
  console.log("C16 thumbnail stability", JSON.stringify({ observed, before, after, bitmapCount }));
  expect(after.renders - (before as { renders: number }).renders).toBeLessThanOrEqual(2);
  expect(after.evictions - (before as { evictions: number }).evictions).toBeLessThanOrEqual(2);
  expect(after.cancelled - (before as { cancelled: number }).cancelled).toBe(0);
  expect(after.restarted - (before as { restarted: number }).restarted).toBeLessThanOrEqual(2);
  expect(after.peak).toBeLessThanOrEqual(2);
  expect(after.active).toBe(0);
  expect(after.completed).toBeGreaterThanOrEqual(6);
  expect(bitmapCount).toBeLessThanOrEqual(8);
});

test("C16 review P2 · páginas diferidas no anuncian cargas inexistentes", async ({ page }) => {
  await mount(page, 1366, 768);
  await page.route("**/colored-many.pdf", (route) => route.fulfill({ status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: coloredPdf(40) }));
  await page.evaluate(() => {
    const target = window as unknown as { __c15PdfSession: typeof import("../../src/features/dashboard/presentation/viewer/pdfjs-client").PdfSession; __c16ReleaseThumbnail: () => void };
    const original = target.__c15PdfSession.prototype.renderThumbnail;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    target.__c16ReleaseThumbnail = release;
    target.__c15PdfSession.prototype.renderThumbnail = function (canvas, number, signal) {
      return number === 1 ? gate.then(() => original.call(this, canvas, number, signal)) : original.call(this, canvas, number, signal);
    };
  });
  await set(page, "__c15Source", pdf(`${ORIGIN}/colored-many.pdf`));
  await page.getByRole("button", { name: "Abrir documento" }).click();
  const strip = page.getByRole("navigation", { name: "Miniaturas del documento" });
  await expect(strip).toBeVisible();
  await expect(strip.locator('[data-c16-page="40"]')).toContainText("Página 40");
  await expect(strip.locator('[data-c16-page="40"]')).not.toContainText("Cargando miniatura");
  const selected = strip.getByRole("button", { name: "Ir a página 1 de 40" });
  await expect(selected).toHaveAttribute("aria-current", "page");
  const loadingStatus = strip.locator('[data-c16-page="1"] > span[id]');
  await expect(loadingStatus).toHaveText("Cargando miniatura…");
  await expect(selected).toHaveAttribute("aria-describedby", await loadingStatus.getAttribute("id") ?? "");
  await expect(selected.getByText("Cargando miniatura…")).toHaveCount(0);
  await expect(strip.getByRole("status")).toHaveCount(1);
  expect((await new AxeBuilder({ page }).include('[data-c15-viewer="true"]').analyze()).violations).toEqual([]);
  await page.evaluate(() => (window as unknown as { __c16ReleaseThumbnail: () => void }).__c16ReleaseThumbnail());
  await expect(strip.locator('[data-c16-page="1"] canvas')).toBeVisible();
  await expect(strip.getByRole("status")).toHaveCount(0);
  await expect(selected).not.toHaveAttribute("aria-describedby", /.+/);
});
