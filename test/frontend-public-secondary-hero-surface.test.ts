import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";

const SECONDARY_HERO_FILES = [
  "frontend/src/app/servicios/page.tsx",
  "frontend/src/components/public/ProfesionalesSearchContent.tsx",
  "frontend/src/app/clinicas/page.tsx",
  "frontend/src/components/public/ContactoContent.tsx",
  "frontend/src/components/public/ParticularesContent.tsx",
];

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function getSecondaryHeroSurfaceBlock(source: string): string {
  const startMarker = "/* public-secondary-hero-surface:start */";
  const endMarker = "/* public-secondary-hero-surface:end */";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.ok(end > start);

  return source.slice(start, end + endMarker.length);
}

test("public secondary hero surface defines the shared visual surface", () => {
  const source = read(GLOBALS_CSS_PATH);
  const block = getSecondaryHeroSurfaceBlock(source);

  assert.ok(block.includes(".public-secondary-hero-surface"));
  assert.ok(block.includes(".public-secondary-hero-surface::before"));
  assert.ok(block.includes(".public-secondary-hero-surface::after"));
  assert.ok(block.includes("radial-gradient"));
  assert.ok(block.includes("linear-gradient(135deg"));
  assert.ok(!block.includes("!important"));
});

test("secondary public heroes use public-secondary-hero-surface", () => {
  for (const filePath of SECONDARY_HERO_FILES) {
    assert.ok(
      read(filePath).includes("public-secondary-hero-surface"),
      `${filePath} should use public-secondary-hero-surface`,
    );
  }
});

test("services hero no longer uses the legacy hero-depth attribute", () => {
  const source = read("frontend/src/app/servicios/page.tsx");

  assert.ok(!source.includes('data-public-hero-depth="true"'));
  assert.ok(
    !source.includes('className="clinical-primary-gradient py-16 text-white md:py-20"'),
  );
});

test("home and pricing do not use the secondary hero surface", () => {
  assert.ok(!read("frontend/src/app/page.tsx").includes("public-secondary-hero-surface"));
  assert.ok(!read("frontend/src/app/precios/page.tsx").includes("public-secondary-hero-surface"));
});