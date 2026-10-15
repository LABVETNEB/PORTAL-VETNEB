import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("frontend/src/features/dashboard/presentation/viewer");
const read = (name: string) => readFileSync(resolve(root, name), "utf8");

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
