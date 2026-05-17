import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const COMPONENT_PATH = "frontend/src/components/public/PublicScrollReveal.tsx";
const FRONTEND_PACKAGE_PATH = "frontend/package.json";

const PUBLIC_FILES_WITHOUT_USAGE = [
  "frontend/src/app/page.tsx",
  "frontend/src/app/servicios/page.tsx",
  "frontend/src/app/clinicas/page.tsx",
  "frontend/src/app/precios/page.tsx",
  "frontend/src/components/public/ContactoContent.tsx",
  "frontend/src/components/public/ParticularesContent.tsx",
  "frontend/src/components/public/ProfesionalesSearchContent.tsx",
];

const PUBLIC_SERVER_PAGES = [
  "frontend/src/app/page.tsx",
  "frontend/src/app/servicios/page.tsx",
  "frontend/src/app/clinicas/page.tsx",
  "frontend/src/app/precios/page.tsx",
];

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public scroll reveal infrastructure file exists", () => {
  assert.equal(existsSync(resolve(process.cwd(), COMPONENT_PATH)), true);
});

test("public scroll reveal infrastructure is client-only and uses safe gsap primitives", () => {
  const source = read(COMPONENT_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import("gsap")'));
  assert.ok(source.includes("ScrollTrigger"));
  assert.ok(source.includes("gsap.context"));
  assert.ok(source.includes("prefers-reduced-motion"));
  assert.ok(source.includes("matchMedia"));
  assert.ok(source.includes("revert()"));
  assert.ok(source.includes("opacity: 0"));
  assert.ok(source.includes("opacity: 1"));
  assert.ok(source.includes("y: 18"));
  assert.ok(source.includes("y: 0"));
});

test("public pages and public content do not use PublicScrollReveal yet", () => {
  for (const path of PUBLIC_FILES_WITHOUT_USAGE) {
    const source = read(path);

    assert.equal(
      source.includes("PublicScrollReveal"),
      false,
      `${path} should not reference PublicScrollReveal yet`,
    );
  }
});

test("public server pages do not import gsap directly", () => {
  for (const path of PUBLIC_SERVER_PAGES) {
    const source = read(path);

    assert.equal(
      source.includes('from "gsap"') || source.includes("from 'gsap'"),
      false,
      `${path} should not import gsap directly`,
    );
    assert.equal(
      source.includes("ScrollTrigger"),
      false,
      `${path} should not reference ScrollTrigger directly`,
    );
  }
});

test("frontend package declares gsap dependency", () => {
  const source = read(FRONTEND_PACKAGE_PATH);

  assert.match(source, /"gsap"\s*:/);
});
