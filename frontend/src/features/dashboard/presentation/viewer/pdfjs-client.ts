import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

type PdfModule = typeof import("pdfjs-dist");

export function createPdfJsLoader(importModule: () => Promise<PdfModule> = () => import("pdfjs-dist")) {
  let modulePromise: Promise<PdfModule> | undefined;
  return function pdfjs(): Promise<PdfModule> {
    if (typeof window === "undefined") return Promise.reject(new Error("PDF viewer requires a browser"));
    if (!modulePromise) {
      const pending = Promise.resolve().then(importModule).then((pdf) => {
        pdf.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        return pdf;
      });
      const cached = pending.catch((error) => {
        if (modulePromise === cached) modulePromise = undefined;
        throw error;
      });
      modulePromise = cached;
    }
    return modulePromise;
  };
}

const pdfjs = createPdfJsLoader();
export const MAX_THUMBNAIL_RENDERS = 2;

type ThumbnailJob = {
  canvas: HTMLCanvasElement;
  pageNumber: number;
  signal: AbortSignal;
  resolve: () => void;
  reject: (error: unknown) => void;
  queuedAbort: () => void;
  preempted?: boolean;
};

function aborted(): Error {
  return new DOMException("Thumbnail cancelled", "AbortError");
}

export class PdfSession {
  private readonly loadPdfJs: () => Promise<PdfModule>;
  constructor(loadPdfJs: () => Promise<PdfModule> = pdfjs) { this.loadPdfJs = loadPdfJs; }

  private loading?: PDFDocumentLoadingTask;
  private document?: PDFDocumentProxy;
  private page?: PDFPageProxy;
  private rendering?: RenderTask;
  private renderPromise?: Promise<unknown>;
  private generation = 0;
  private disposed = false;
  private mainPending = false;
  private thumbnailQueue: ThumbnailJob[] = [];
  private thumbnailTasks = new Map<ThumbnailJob, RenderTask | null>();
  private thumbnailPromises = new Set<Promise<void>>();

  async load(url: string): Promise<number> {
    const pdf = await this.loadPdfJs();
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
    this.mainPending = true;
    this.preemptThumbnails();
    await Promise.allSettled([...this.thumbnailPromises]);
    await this.cancelRender();
    try {
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
    } finally {
      if (generation === this.generation) { this.mainPending = false; this.pumpThumbnails(); }
    }
  }

  renderThumbnail(canvas: HTMLCanvasElement, pageNumber: number, signal: AbortSignal): Promise<void> {
    if (this.disposed || !this.document || signal.aborted) return Promise.reject(aborted());
    return new Promise<void>((resolve, reject) => {
      const job: ThumbnailJob = { canvas, pageNumber, signal, resolve, reject, queuedAbort: () => {
        const index = this.thumbnailQueue.indexOf(job);
        if (index >= 0) { this.thumbnailQueue.splice(index, 1); reject(aborted()); }
      } };
      signal.addEventListener("abort", job.queuedAbort, { once: true });
      this.thumbnailQueue.push(job);
      this.pumpThumbnails();
    });
  }

  private pumpThumbnails(): void {
    if (this.disposed || this.mainPending) return;
    while (this.thumbnailTasks.size < MAX_THUMBNAIL_RENDERS && this.thumbnailQueue.length) {
      const job = this.thumbnailQueue.shift()!;
      job.signal.removeEventListener("abort", job.queuedAbort);
      if (job.signal.aborted) { job.reject(aborted()); continue; }
      this.thumbnailTasks.set(job, null);
      const pending = this.runThumbnail(job);
      this.thumbnailPromises.add(pending);
      void pending.finally(() => {
        this.thumbnailPromises.delete(pending);
        this.thumbnailTasks.delete(job);
        this.pumpThumbnails();
      });
    }
  }

  private async runThumbnail(job: ThumbnailJob): Promise<void> {
    let page: PDFPageProxy | undefined;
    let task: RenderTask | undefined;
    let completed = false;
    const cancel = () => task?.cancel();
    job.signal.addEventListener("abort", cancel, { once: true });
    try {
      if (this.disposed || job.signal.aborted) throw aborted();
      page = await this.document!.getPage(job.pageNumber);
      if (this.disposed || job.signal.aborted || this.mainPending) throw aborted();
      const unit = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(96 / unit.width, 128 / unit.height) });
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      job.canvas.width = Math.ceil(viewport.width * scale);
      job.canvas.height = Math.ceil(viewport.height * scale);
      job.canvas.style.width = `${viewport.width}px`;
      job.canvas.style.height = `${viewport.height}px`;
      const context = job.canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      task = page.render({ canvas: job.canvas, canvasContext: context, viewport, transform: scale === 1 ? undefined : [scale, 0, 0, scale, 0, 0] });
      this.thumbnailTasks.set(job, task);
      await task.promise;
      if (this.disposed || job.signal.aborted) throw aborted();
      completed = true;
      job.resolve();
    } catch (error) { job.reject(job.preempted || job.signal.aborted || this.disposed ? aborted() : error); }
    finally {
      job.signal.removeEventListener("abort", cancel);
      if (!completed) { job.canvas.width = 0; job.canvas.height = 0; }
      page?.cleanup();
    }
  }

  private preemptThumbnails(): void {
    for (const [job, task] of this.thumbnailTasks) if (task) { job.preempted = true; task.cancel(); }
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
    for (const job of this.thumbnailQueue.splice(0)) { job.signal.removeEventListener("abort", job.queuedAbort); job.reject(aborted()); }
    this.preemptThumbnails();
    await this.cancelRender();
    await Promise.allSettled([...this.thumbnailPromises]);
    await this.loading?.destroy();
    this.document = undefined;
    this.loading = undefined;
  }
}
