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
