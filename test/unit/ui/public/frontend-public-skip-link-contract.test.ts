import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PUBLIC_LAYOUT_PATH = "frontend/src/components/layout/PublicLayout.tsx";
const SKIP_TO_CONTENT_PATH = "frontend/src/components/public/SkipToContent.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public layout renders the skip link as the first focusable element before the navbar", () => {
  const source = read(PUBLIC_LAYOUT_PATH);

  assert.ok(
    source.includes(
      'import { SkipToContent } from "@/components/public/SkipToContent";',
    ),
    "PublicLayout must import the SkipToContent control",
  );
  assert.ok(
    source.includes("<SkipToContent />"),
    "PublicLayout must render the SkipToContent control",
  );
  assert.equal(
    source.match(/<SkipToContent \/>/g)?.length,
    1,
    "PublicLayout must render exactly one skip control",
  );

  const skipIndex = source.indexOf("<SkipToContent />");
  const navbarIndex = source.indexOf("<Navbar />");
  const mainIndex = source.indexOf("<main");
  assert.ok(skipIndex >= 0 && navbarIndex >= 0 && mainIndex >= 0);
  assert.ok(
    skipIndex < navbarIndex,
    "skip link must precede the navbar so it is the first focusable element",
  );
  assert.ok(
    skipIndex < mainIndex,
    "skip control must render before the main content",
  );
});

test("public main landmark keeps its id without a permanent tab stop", () => {
  const source = read(PUBLIC_LAYOUT_PATH);

  assert.ok(source.includes('id="main-content"'));
  assert.equal(
    source.includes("tabIndex={-1}"),
    false,
    "main#main-content must not keep a permanent tabIndex",
  );
  assert.equal(/<a\b/.test(source), false);
  assert.equal(source.includes("next/link"), false);
});

test("skip-to-content control is a contract-safe button that focuses the main landmark", () => {
  const source = read(SKIP_TO_CONTENT_PATH);

  assert.ok(source.includes('"use client"'), "control must be a client component");
  assert.ok(source.includes("<button"), "skip link must render a <button>");
  assert.equal(
    /<a\b/.test(source),
    false,
    "skip link must not use a raw anchor (public surface hardening)",
  );
  assert.ok(source.includes('type="button"'));
  assert.ok(source.includes('className="skip-to-content-link"'));
  assert.ok(source.includes("aria-controls={MAIN_CONTENT_ID}"));
  assert.ok(source.includes("Saltar al contenido principal"));
  assert.equal(source.includes("next/link"), false);
  assert.ok(
    source.includes('MAIN_CONTENT_ID = "main-content"'),
    "control must reference the main landmark id",
  );
  assert.ok(
    source.includes("getElementById(MAIN_CONTENT_ID)"),
    "control must target the main landmark by id",
  );
  assert.ok(
    source.includes(".focus("),
    "control must move focus to the main landmark",
  );
  assert.ok(
    source.includes('hasAttribute("tabindex")') &&
      source.includes('setAttribute("tabindex", "-1")') &&
      source.includes('addEventListener("blur"') &&
      source.includes('removeAttribute("tabindex")'),
    "control must add tabIndex only while the main landmark has focus",
  );
});

test("globals.css defines the skip-to-content link with theme-aware tokens", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(
    source.includes("/* skip-to-content:start */"),
    "globals.css must delimit the skip-to-content section start",
  );
  assert.ok(
    source.includes("/* skip-to-content:end */"),
    "globals.css must delimit the skip-to-content section end",
  );
  assert.ok(
    source.includes(".skip-to-content-link {"),
    "globals.css must define .skip-to-content-link",
  );
  assert.ok(
    source.includes("background-color: hsl(var(--primary));"),
    "skip link must use the --primary token so it adapts to dark-gray mode",
  );
  assert.ok(
    source.includes("color: hsl(var(--primary-foreground));"),
    "skip link must use the --primary-foreground token for contrast",
  );
});

test("skip-to-content link stays hidden until focus and reveals on focus", () => {
  const source = read(GLOBALS_CSS_PATH);

  const start = source.indexOf("/* skip-to-content:start */");
  const end = source.indexOf("/* skip-to-content:end */");
  assert.ok(start >= 0 && end > start);
  const section = source.slice(start, end);

  assert.ok(
    section.includes("position: fixed;"),
    "skip link must be fixed-positioned so it cannot shift layout",
  );
  assert.ok(
    section.includes("transform: translateY(calc(-100% - 1.5rem));"),
    "skip link must be translated offscreen by default",
  );
  assert.ok(
    /\.skip-to-content-link:focus[\s\S]*transform: translateY\(0\);/.test(
      section,
    ),
    "skip link must move into view when focused",
  );
  assert.ok(
    section.includes("outline: 2px solid hsl(var(--ring));"),
    "focused skip link must expose a visible focus ring",
  );
  assert.equal(
    /transition(?:-property)?:/.test(section),
    false,
    "skip link must not require motion to reveal itself",
  );
});
