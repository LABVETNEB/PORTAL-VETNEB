import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const COMPONENT_PATH = "frontend/src/components/public/PublicScrollReveal.tsx";
const FRONTEND_PACKAGE_PATH = "frontend/package.json";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";

const PUBLIC_FILES_WITHOUT_USAGE = [
  "frontend/src/app/servicios/page.tsx",
  "frontend/src/app/clinicas/page.tsx",
  "frontend/src/app/precios/page.tsx",
  "frontend/src/components/public/ContactoContent.tsx",
  "frontend/src/components/public/ParticularesContent.tsx",
  "frontend/src/components/public/ProfesionalesSearchContent.tsx",
];

const PUBLIC_FILES_WITHOUT_GSAP_IMPORT = [
  "frontend/src/app/page.tsx",
  "frontend/src/app/servicios/page.tsx",
  "frontend/src/app/clinicas/page.tsx",
  "frontend/src/app/precios/page.tsx",
  "frontend/src/components/public/ContactoContent.tsx",
  "frontend/src/components/public/ParticularesContent.tsx",
  "frontend/src/components/public/ProfesionalesSearchContent.tsx",
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
  assert.ok(source.includes("opacity: 0.96"));
  assert.ok(source.includes("opacity: 1"));
  assert.ok(source.includes("y: 14"));
  assert.ok(source.includes("y: 0"));
  assert.ok(source.includes("once: true"));
});

test("home page imports and uses PublicScrollReveal for the first rollout", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";',
    ),
  );
  assert.ok(source.includes("<PublicScrollReveal>"));
});

test("home page does not import gsap or ScrollTrigger directly", () => {
  const source = read(HOME_PAGE_PATH);

  assert.equal(
    source.includes('from "gsap"') || source.includes("from 'gsap'"),
    false,
  );
  assert.equal(source.includes('from "gsap/ScrollTrigger"'), false);
  assert.equal(source.includes("from 'gsap/ScrollTrigger'"), false);
});

test("home keeps hero and hero image untouched by PublicScrollReveal", () => {
  const source = read(HOME_PAGE_PATH);
  const heroMatch = source.match(
    /<section\s+className="relative isolate overflow-hidden text-white"[\s\S]*?<\/section>/,
  );

  assert.ok(source.includes('src="/images/hero-microscope-vetneb.webp"'));
  assert.ok(heroMatch);
  assert.equal(heroMatch[0].includes("<PublicScrollReveal"), false);
  assert.equal(
    /<PublicScrollReveal[\s\S]*?<section\s+className="relative isolate overflow-hidden text-white"/.test(
      source,
    ),
    false,
  );
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

test("public pages and content do not import gsap directly", () => {
  for (const path of PUBLIC_FILES_WITHOUT_GSAP_IMPORT) {
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
