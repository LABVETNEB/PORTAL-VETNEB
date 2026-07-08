import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LAYOUT_PATH = "frontend/src/app/layout.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const FONT_ASSET_PATH = "frontend/public/fonts/InterVariable.woff2";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("global font is a local variable woff2 asset without remote font imports", () => {
  const layout = read(LAYOUT_PATH);
  const globals = read(GLOBALS_CSS_PATH);

  assert.ok(existsSync(resolve(process.cwd(), FONT_ASSET_PATH)));
  assert.equal(layout.includes("next/font/google"), false);
  for (const remoteMarker of ["fonts.googleapis.com", "fonts.gstatic.com"]) {
    assert.equal(`${layout}\n${globals}`.includes(remoteMarker), false);
  }
  assert.match(
    layout,
    /<link\s+rel="preload"\s+href="\/fonts\/InterVariable\.woff2"\s+as="font"\s+type="font\/woff2"\s+crossOrigin="anonymous"\s*\/>/,
  );
});

test("globals css defines the variable font-face and typography tokens applied to body headings and ui controls", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.match(
    source,
    /@font-face\s*\{[\s\S]*?font-family:\s*"Inter";[\s\S]*?font-style:\s*normal;[\s\S]*?font-weight:\s*100 900;[\s\S]*?font-display:\s*swap;[\s\S]*?src:\s*url\("\/fonts\/InterVariable\.woff2"\)\s*format\("woff2"\);[\s\S]*?\}/,
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
