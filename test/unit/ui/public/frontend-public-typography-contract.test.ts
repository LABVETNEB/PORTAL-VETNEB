import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const LAYOUT_PATH = "frontend/src/app/layout.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const FONTS_MODULE_PATH = "frontend/src/lib/fonts.ts";
const SERVICE_WORKER_PATH = "frontend/public/sw.js";
const FONT_DIRECTORY = "frontend/public/fonts";

function contentVersion(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

function fontFiles(): string[] {
  return readdirSync(resolve(process.cwd(), FONT_DIRECTORY)).sort();
}

function fontBytes(fileName: string): Buffer {
  return readFileSync(resolve(process.cwd(), FONT_DIRECTORY, fileName));
}

// The font URL carries the hash of its own bytes, so it can be cached for good
// and new bytes can never be served under a URL a client already holds.
function expectedFontUrl(): string {
  const files = fontFiles();

  assert.equal(files.length, 1, `exactly one font file is published, found ${files.join(", ")}`);

  return `/fonts/InterVariable.${contentVersion(fontBytes(files[0]!))}.woff2`;
}

test("global font is a local variable woff2 asset without remote font imports", () => {
  const layout = read(LAYOUT_PATH);
  const globals = read(GLOBALS_CSS_PATH);

  assert.equal(layout.includes("next/font/google"), false);
  for (const remoteMarker of ["fonts.googleapis.com", "fonts.gstatic.com"]) {
    assert.equal(`${layout}\n${globals}`.includes(remoteMarker), false);
  }
  assert.match(
    layout,
    /<link\s+rel="preload"\s+href=\{INTER_FONT_PATH\}\s+as="font"\s+type="font\/woff2"\s+crossOrigin="anonymous"\s*\/>/,
  );
  assert.match(layout, /import \{ INTER_FONT_PATH \} from "@\/lib\/fonts";/);
});

test("the published font file is named after the hash of its own bytes", () => {
  const [fileName] = fontFiles();

  assert.equal(`/fonts/${fileName}`, expectedFontUrl());
  assert.equal(
    fontFiles().includes("InterVariable.woff2"),
    false,
    "no unversioned copy of the font may be published next to the versioned one",
  );
});

test("the preload and the font-face reference the one content-versioned URL", () => {
  const url = expectedFontUrl();
  const version = url.split(".")[1]!;
  const fonts = read(FONTS_MODULE_PATH);
  const globals = read(GLOBALS_CSS_PATH);

  assert.match(fonts, new RegExp(`export const INTER_FONT_VERSION = "${version}";`));
  assert.ok(
    fonts.includes("export const INTER_FONT_PATH = `/fonts/InterVariable.${INTER_FONT_VERSION}.woff2`;"),
    "INTER_FONT_PATH must be derived from INTER_FONT_VERSION",
  );

  const fontUrls = [...globals.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((match) => match[1]);

  assert.deepEqual(fontUrls, [url], "globals.css must load the font from the same URL the document preloads");
});

test("a change in the font bytes yields a different URL", () => {
  const [fileName] = fontFiles();
  const bytes = fontBytes(fileName!);
  const changed = Buffer.from(bytes);

  changed[changed.length - 1] = changed[changed.length - 1]! ^ 0xff;

  assert.notEqual(contentVersion(changed), contentVersion(bytes));
  assert.match(contentVersion(bytes), /^[0-9a-f]{16}$/);
});

test("the service worker never pins the font under a fixed name", () => {
  const worker = read(SERVICE_WORKER_PATH);

  assert.equal(
    worker.includes("/fonts/"),
    false,
    "sw.js caches the font by request URL only; naming a font URL there would pin stale bytes across font changes",
  );
});

test("globals css defines the variable font-face and typography tokens applied to body headings and ui controls", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.match(
    source,
    /@font-face\s*\{[\s\S]*?font-family:\s*"Inter";[\s\S]*?font-style:\s*normal;[\s\S]*?font-weight:\s*100 900;[\s\S]*?font-display:\s*swap;[\s\S]*?src:\s*url\("\/fonts\/InterVariable\.[0-9a-f]{16}\.woff2"\)\s*format\("woff2"\);[\s\S]*?\}/,
  );

  assert.ok(source.includes('--font-heading: "Inter";'));
  assert.ok(source.includes('--font-body: "Inter";'));
  assert.ok(source.includes('--font-ui: "Inter";'));

  assert.match(
    source,
    /html\s*\{[\s\S]*?font-family:\s*var\(--font-body\),\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/,
  );

  assert.match(
    source,
    /body\s*\{[\s\S]*font-family:\s*var\(--font-body\),\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/,
  );
  assert.match(
    source,
    /h1,[\s\S]*h6,[\s\S]*\.font-heading,[\s\S]*\.public-heading\s*\{[\s\S]*font-family:\s*var\(--font-heading\),\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/,
  );
  assert.match(
    source,
    /button,[\s\S]*textarea,[\s\S]*\.public-cta-on-hero\s*\{[\s\S]*font-family:\s*var\(--font-ui\),\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/,
  );

  assert.ok(source.includes("-webkit-font-smoothing: antialiased;"));
  assert.ok(source.includes("-moz-osx-font-smoothing: grayscale;"));
});

test("typography foundation does not introduce motion or serif policy regressions", () => {
  const layout = read(LAYOUT_PATH);
  const globals = read(GLOBALS_CSS_PATH);
  const combined = `${layout}\n${globals}`;

  for (const forbiddenMotionMarker of [
    "gsap",
    "ScrollTrigger",
    "PublicScrollReveal",
    "staggerChildren",
    "data-scroll-reveal-item",
    "Lenis",
    "pinSpacing",
    "scrub",
    "parallax",
  ]) {
    assert.equal(
      combined.includes(forbiddenMotionMarker),
      false,
      `typography foundation must not include ${forbiddenMotionMarker}`,
    );
  }

  for (const forbiddenSerifMarker of [
    "Source Serif",
    "Merriweather",
    "Georgia",
    "\"Times New Roman\"",
  ]) {
    assert.equal(
      combined.includes(forbiddenSerifMarker),
      false,
      `typography foundation must not include ${forbiddenSerifMarker}`,
    );
  }
});
