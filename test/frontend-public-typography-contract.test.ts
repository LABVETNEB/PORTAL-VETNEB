import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LAYOUT_PATH = "frontend/src/app/layout.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("root layout loads Inter and Source Sans 3 via next/font and exposes both css variables", () => {
  const source = read(LAYOUT_PATH);

  assert.match(
    source,
    /import\s+\{\s*Inter\s*,\s*Source_Sans_3\s*\}\s+from\s+"next\/font\/google";/,
  );
  assert.ok(source.includes('variable: "--font-inter"'));
  assert.ok(source.includes('variable: "--font-source-sans-3"'));
  assert.ok(source.includes('weight: ["400", "500", "600", "700"]'));
  assert.match(
    source,
    /<html[^>]*className=\{`\$\{inter\.variable\}\s+\$\{sourceSans\.variable\}`\}/,
  );
});

test("globals css defines typography tokens and applies them to body headings and ui controls", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes("--font-heading: var(--font-inter);"));
  assert.ok(source.includes("--font-body: var(--font-source-sans-3);"));
  assert.ok(source.includes("--font-ui: var(--font-inter);"));

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
