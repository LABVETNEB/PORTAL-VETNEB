import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

type PdfModule = typeof import("pdfjs-dist");
let modulePromise: Promise<PdfModule> | undefined;

async function pdfjs(): Promise<PdfModule> {
  if (typeof window === "undefined") throw new Error("PDF viewer requires a browser");
  modulePromise ??= import("pdfjs-dist").then((pdf) => {
    pdf.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdf;
  });
  return modulePromise;
}

export class PdfSession {
  private loading?: PDFDocumentLoadingTask;
  private document?: PDFDocumentProxy;
  private page?: PDFPageProxy;
  private rendering?: RenderTask;
  private renderPromise?: Promise<unknown>;
  private generation = 0;
  private disposed = false;

  async load(url: string): Promise<number> {
    const pdf = await pdfjs();
    if (this.disposed) throw new Error("closed");
    const loading = pdf.getDocument({ url, enableXfa: false, useWasm: false, stopAtErrors: true });
    this.loading = loading;
    const document = await loading.promise;
    if (this.disposed) throw new Error("closed");
    this.document = document;
    return document.numPages;
  }

  async render(canvas: HTMLCanvasElement, pageNumber: number, zoom: number): Promise<void> {
    const generation = ++this.generation;
    await this.cancelRender();
    if (this.disposed || !this.document || generation !== this.generation) return;
    const page = await this.document.getPage(pageNumber);
    if (this.disposed || generation !== this.generation) { page.cleanup(); return; }
    this.page = page;
    const viewport = page.getViewport({ scale: zoom });
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(viewport.width * scale);
    canvas.height = Math.ceil(viewport.height * scale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    const task = page.render({ canvas, canvasContext: context, viewport, transform: scale === 1 ? undefined : [scale, 0, 0, scale, 0, 0] });
    this.rendering = task;
    this.renderPromise = task.promise;
    try { await task.promise; }
    finally {
      if (this.rendering === task) { this.rendering = undefined; this.renderPromise = undefined; this.page = undefined; page.cleanup(); }
    }
  }

  private async cancelRender(): Promise<void> {
    this.rendering?.cancel();
    try { await this.renderPromise; } catch { /* cancellation is expected */ }
    this.page?.cleanup();
    this.page = undefined;
    this.rendering = undefined;
    this.renderPromise = undefined;
  }

  async destroy(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    await this.cancelRender();
    await this.loading?.destroy();
    this.document = undefined;
    this.loading = undefined;
  }
}
