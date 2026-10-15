import assert from "node:assert/strict";
import test from "node:test";
import { createPdfJsLoader } from "../../frontend/src/features/dashboard/presentation/viewer/pdfjs-client.ts";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const read = (name: string) => readSourceFile(`frontend/src/features/dashboard/presentation/viewer/${name}`);

test("C15: publishes a controlled, domain-free document viewer and toolbar", () => {
  const barrel = read("index.ts");
  const viewer = read("DocumentViewer.tsx");
  const toolbar = read("ViewerToolbar.tsx");
  const source = read("document-source.ts");
  assert.match(barrel, /DocumentViewer/);
  assert.match(barrel, /ViewerToolbar/);
  assert.match(viewer, /<Dialog\.Root open=\{open\} onOpenChange=\{onOpenChange\}/);
  assert.match(viewer, /Dialog\.Title/);
  assert.match(viewer, /onCloseAutoFocus/);
  assert.match(viewer, /overflow-y-auto/);
  assert.match(toolbar, /onDownload/);
  assert.match(viewer, /requestFullscreen/);
  assert.match(source, /https:/);
  assert.match(source, /trustedOrigins/);
  for (const text of [viewer, toolbar, source]) {
    assert.doesNotMatch(text, /@\/lib\/api|@\/app\/|ReportFileActions|useRouter|router\.push|<iframe\b|<object\b|<embed\b/);
  }
});

test("C15: PDF.js stays client-side with a local worker and cancellable tasks", () => {
  const adapter = read("pdfjs-client.ts");
  assert.match(adapter, /import\("pdfjs-dist"\)/);
  assert.match(adapter, /pdfjs-dist\/build\/pdf\.worker\.min\.mjs/);
  assert.match(adapter, /new URL\(/);
  assert.match(adapter, /\.cancel\(\)/);
  assert.match(adapter, /\.destroy\(\)/);
  assert.doesNotMatch(adapter, /https?:\/\/|cdn|pdf\.sandbox|quickjs/);
});

test("C15: a failed PDF.js import is retried once and successful imports stay cached", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    let imports = 0;
    const module = { GlobalWorkerOptions: { workerSrc: "" } } as typeof import("pdfjs-dist");
    const load = createPdfJsLoader(async () => {
      imports += 1;
      if (imports === 1) throw new Error("transient import failure");
      return module;
    });
    const first = load();
    const concurrent = load();
    assert.strictEqual(first, concurrent);
    await assert.rejects(first, /transient import failure/);
    await assert.rejects(concurrent, /transient import failure/);
    assert.equal(imports, 1);
    const recovered = load();
    assert.strictEqual(recovered, load());
    assert.strictEqual(await recovered, module);
    assert.strictEqual(await load(), module);
    assert.equal(imports, 2);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
