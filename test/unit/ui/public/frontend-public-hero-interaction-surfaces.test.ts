import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public hero interaction surfaces define action tile primitives", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes(".public-hero-action-grid"));
  assert.ok(source.includes(".public-hero-action-tile"));
  assert.ok(source.includes(".public-hero-action-tile-label"));
  assert.ok(source.includes(".public-hero-action-tile-title"));
  assert.ok(source.includes(".public-hero-action-tile-copy"));
  assert.ok(source.includes(".public-hero-action-tile-arrow"));
  assert.ok(source.includes("grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2"));
  assert.ok(source.includes(".public-hero-action-tile:hover .public-hero-action-tile-arrow"));
});

test("public hero interaction surfaces define search dock primitives", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes(".public-hero-search-dock"));
  assert.ok(source.includes(".public-hero-search-inner"));
  assert.ok(source.includes("max-w-3xl rounded-2xl"));
  assert.ok(source.includes("backdrop-blur"));
  assert.ok(source.includes("rounded-xl bg-card/95"));
});

test("public hero interaction surfaces define editorial scope primitives", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes(".public-hero-scope-list"));
  assert.ok(source.includes(".public-hero-scope-item"));
  assert.ok(source.includes("flex max-w-3xl flex-wrap gap-2"));
  assert.ok(source.includes("tracking-[0.08em] text-primary-foreground/86"));
});

test("public hero interaction surfaces define contact method primitives", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes(".public-contact-method-grid"));
  assert.ok(source.includes(".public-contact-method"));
  assert.ok(source.includes(".public-contact-method-title"));
  assert.ok(source.includes(".public-contact-method-value"));
  assert.ok(source.includes("grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3"));
  assert.ok(source.includes("hover:border-white/50 hover:bg-white/[0.14]"));
});

