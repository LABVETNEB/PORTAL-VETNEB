import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const VISUAL_ACCENTS_PATH = "frontend/src/components/public/VisualAccents.tsx";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public visual accents no longer render decorative eyebrow pills", () => {
  const source = read(VISUAL_ACCENTS_PATH);

  assert.ok(source.includes("export function Eyebrow(_props: EyebrowProps)"));
  assert.ok(source.includes("return null;"));
  assert.equal(source.includes("tracking-[0.22em]"), false);
  assert.equal(source.includes("rounded-full border border-white/50"), false);
  assert.equal(source.includes("uppercase"), false);
});

test("home page no longer renders the hero eyebrow pill", () => {
  const source = read(HOME_PAGE_PATH);

  assert.equal(source.includes("Servicio patológico veterinario"), false);
  assert.equal(
    source.includes("rounded-full border border-white/30 bg-black/35"),
    false,
  );
});
