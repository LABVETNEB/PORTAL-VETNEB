import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";
import { MAX_THUMBNAIL_RENDERS, PdfSession } from "../../frontend/src/features/dashboard/presentation/viewer/pdfjs-client.ts";

const read = (name: string) => readSourceFile(`frontend/src/features/dashboard/presentation/viewer/${name}`);

test("C16: viewer publishes thumbnails only for multipage PDF", () => {
  const viewer = read("DocumentViewer.tsx");
  const barrel = read("index.ts");
  assert.match(barrel, /ViewerThumbnails/);
  assert.match(viewer, /kind === "pdf" && numPages > 1/);
  assert.match(viewer, /<ViewerThumbnails/);
});

test("C16: thumbnails share the PDF session with bounded work and cleanup", () => {
  const adapter = read("pdfjs-client.ts");
  assert.match(adapter, /renderThumbnail/);
  assert.match(adapter, /MAX_THUMBNAIL_RENDERS/);
  assert.match(adapter, /AbortSignal/);
  assert.match(adapter, /\.cancel\(\)/);
  assert.match(adapter, /\.cleanup\(\)/);
  assert.doesNotMatch(adapter, /localStorage|sessionStorage|indexedDB|toDataURL|createObjectURL/);
});

test("C16: actual session limits thumbnail tasks and gives the main canvas priority", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { devicePixelRatio: 1 } });
  const tasks: { main: boolean; finish: () => void; cancel: () => void }[] = [];
  let active = 0;
  let peak = 0;
  let loads = 0;
  let cleanups = 0;
  const document = {
    numPages: 12,
    getPage: async (pageNumber: number) => {
      if (pageNumber === 11) throw new Error("synthetic page failure");
      return ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 300 * scale, height: 400 * scale }),
      cleanup: () => { cleanups += 1; },
      render: ({ canvas }: { canvas: { main?: boolean } }) => {
        active += 1;
        peak = Math.max(peak, active);
        let resolve!: () => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
        let done = false;
        const complete = (cancelled: boolean) => {
          if (done) return;
          done = true;
          active -= 1;
          if (cancelled) reject(new DOMException("cancelled", "AbortError"));
          else resolve();
        };
        tasks.push({ main: !!canvas.main, finish: () => complete(false), cancel: () => complete(true) });
        return { promise, cancel: () => complete(true) };
      },
      });
    },
  };
  const session = new PdfSession(async () => ({
    getDocument: () => { loads += 1; return { promise: Promise.resolve(document), destroy: async () => {} }; },
  }) as unknown as typeof import("pdfjs-dist"));
  const canvas = (main = false) => ({ main, style: {}, getContext: () => ({}) }) as unknown as HTMLCanvasElement;
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  try {
    assert.equal(await session.load("https://synthetic.test/file.pdf"), 12);
    const jobs = Array.from({ length: 10 }, (_, index) => session.renderThumbnail(canvas(), index + 1, new AbortController().signal));
    const settledJobs = Promise.allSettled(jobs);
    await tick();
    assert.equal(tasks.length, MAX_THUMBNAIL_RENDERS);
    assert.equal(peak, MAX_THUMBNAIL_RENDERS);
    const main = session.render(canvas(true), 3, 1);
    await tick();
    assert.equal(tasks.filter((task) => task.main).length, 1);
    assert.equal(active, 1);
    tasks.find((task) => task.main)?.finish();
    await main;
    for (let index = 0; index < 20; index += 1) {
      tasks.filter((task) => !task.main).forEach((task) => task.finish());
      await tick();
      if (Number(active) === 0 && tasks.length >= 11) break;
    }
    const results = await settledJobs;
    assert.equal(results.length, 10);
    assert.equal(loads, 1);
    assert.ok(peak <= MAX_THUMBNAIL_RENDERS);
    assert.ok(cleanups >= 11);
    const failed = session.renderThumbnail(canvas(), 11, new AbortController().signal);
    const recovered = session.renderThumbnail(canvas(), 12, new AbortController().signal);
    const individual = Promise.allSettled([failed, recovered]);
    await tick();
    tasks.at(-1)?.finish();
    const individualResults = await individual;
    assert.equal(individualResults[0].status, "rejected");
    assert.equal(individualResults[1].status, "fulfilled");
    const closing = session.renderThumbnail(canvas(), 4, new AbortController().signal);
    const closingResult = Promise.allSettled([closing]);
    await tick();
    await session.destroy();
    assert.equal((await closingResult)[0].status, "rejected");
    assert.equal(Number(active), 0);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("C16: a main render that preempts a painting thumbnail rejects it as a retryable AbortError", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { devicePixelRatio: 1 } });
  class RenderingCancelledException extends Error {
    constructor(message: string) { super(message); this.name = "RenderingCancelledException"; }
  }
  const painting = new Map<number, { finish: () => void; fail: (error: Error) => void }>();
  const document = {
    numPages: 3,
    getPage: async (pageNumber: number) => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 300 * scale, height: 400 * scale }),
      cleanup: () => {},
      render: ({ canvas }: { canvas: { main?: boolean } }) => {
        const key = canvas.main ? 0 : pageNumber;
        let settled = false;
        let resolve!: () => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
        const settle = (error?: Error) => { if (settled) return; settled = true; painting.delete(key); if (error) reject(error); else resolve(); };
        painting.set(key, { finish: () => settle(), fail: (error) => settle(error) });
        return { promise, cancel: () => settle(new RenderingCancelledException(`Rendering cancelled, page ${pageNumber}`)) };
      },
    }),
  };
  const session = new PdfSession(async () => ({
    getDocument: () => ({ promise: Promise.resolve(document), destroy: async () => {} }),
  }) as unknown as typeof import("pdfjs-dist"));
  const canvas = (main = false) => ({ main, width: 0, height: 0, style: {}, getContext: () => ({}) }) as unknown as HTMLCanvasElement;
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const outcome = (pending: Promise<void>) => pending.then(() => "fulfilled", (error: unknown) => error);
  try {
    await session.load("https://synthetic.test/file.pdf");
    const preemptedCanvas = canvas();
    const preempted = outcome(session.renderThumbnail(preemptedCanvas, 1, new AbortController().signal));
    await tick();
    assert.ok(painting.has(1), "thumbnail 1 must be painting before the main render starts");
    const main = session.render(canvas(true), 2, 1);
    const preemptedError = await preempted;
    assert.ok(preemptedError instanceof DOMException, `preemption must not surface ${String(preemptedError)}`);
    assert.equal(preemptedError.name, "AbortError");
    assert.equal(preemptedCanvas.width, 0);
    for (let index = 0; index < 10 && !painting.has(0); index += 1) await tick();
    painting.get(0)?.finish();
    await main;
    const retried = outcome(session.renderThumbnail(canvas(), 1, new AbortController().signal));
    await tick();
    painting.get(1)?.finish();
    assert.equal(await retried, "fulfilled");
    const genuine = outcome(session.renderThumbnail(canvas(), 2, new AbortController().signal));
    await tick();
    painting.get(2)?.fail(new Error("synthetic paint failure"));
    const genuineError = await genuine;
    assert.ok(genuineError instanceof Error && !(genuineError instanceof DOMException));
    assert.equal(genuineError.message, "synthetic paint failure");
    const controller = new AbortController();
    const withdrawn = outcome(session.renderThumbnail(canvas(), 3, controller.signal));
    await tick();
    controller.abort();
    const withdrawnError = await withdrawn;
    assert.ok(withdrawnError instanceof DOMException && withdrawnError.name === "AbortError");
    await session.destroy();
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
