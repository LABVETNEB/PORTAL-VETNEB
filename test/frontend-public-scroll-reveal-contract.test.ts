import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const COMPONENT_PATH = "frontend/src/components/public/PublicScrollReveal.tsx";
const FRONTEND_PACKAGE_PATH = "frontend/package.json";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const SERVICES_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const CLINICAS_PAGE_PATH = "frontend/src/app/clinicas/page.tsx";
const SCROLL_REVEAL_FORBIDDEN_TERMS = [
  "lenis",
  "pinspacing",
  "pin:",
  "scrub",
  "parallax",
];

const PUBLIC_FILES_WITHOUT_USAGE = [
  "frontend/src/app/profesionales/page.tsx",
  "frontend/src/app/particulares/page.tsx",
  "frontend/src/app/contacto/page.tsx",
  "frontend/src/app/precios/page.tsx",
  "frontend/src/app/login/page.tsx",
  "frontend/src/components/public/ContactoContent.tsx",
  "frontend/src/components/public/ParticularesContent.tsx",
  "frontend/src/components/public/ProfesionalesSearchContent.tsx",
];

const PUBLIC_FILES_WITHOUT_GSAP_IMPORT = [
  "frontend/src/app/page.tsx",
  "frontend/src/app/servicios/page.tsx",
  "frontend/src/app/clinicas/page.tsx",
  "frontend/src/app/profesionales/page.tsx",
  "frontend/src/app/particulares/page.tsx",
  "frontend/src/app/contacto/page.tsx",
  "frontend/src/app/precios/page.tsx",
  "frontend/src/app/login/page.tsx",
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
  assert.ok(source.includes("registerPlugin(ScrollTrigger)"));
  assert.ok(source.includes("gsap.context"));
  assert.ok(source.includes("prefers-reduced-motion"));
  assert.ok(source.includes("matchMedia"));
  assert.ok(source.includes("revert()"));
  assert.ok(source.includes("PublicScrollRevealVariant"));
  assert.ok(source.includes('"section" | "cards" | "minimal"'));
  assert.ok(source.includes("variant?: PublicScrollRevealVariant"));
  assert.ok(source.includes("PUBLIC_MOTION_POLICY_PRESETS"));
  assert.ok(source.includes("section: {"));
  assert.ok(source.includes("cards: {"));
  assert.ok(source.includes("minimal: {"));
  assert.ok(source.includes("fromOpacity: 0.98"));
  assert.ok(source.includes("fromOpacity: 0.96"));
  assert.ok(source.includes("fromY: 14"));
  assert.ok(source.includes("fromY: 16"));
  assert.ok(source.includes("fromY: 8"));
  assert.ok(source.includes("duration: 0.75"));
  assert.ok(source.includes("duration: 0.72"));
  assert.ok(source.includes("duration: 0.55"));
  assert.ok(source.includes('start: "top 86%"'));
  assert.ok(source.includes('start: "top 84%"'));
  assert.ok(source.includes('start: "top 88%"'));
  assert.ok(source.includes("staggerChildren?: boolean"));
  assert.ok(source.includes("childSelector?: string"));
  assert.ok(source.includes('[data-scroll-reveal-item]'));
  assert.ok(source.includes("stagger: 0.07"));
  assert.ok(source.includes("opacity: 1"));
  assert.ok(source.includes("y: 0"));
  assert.ok(source.includes("once: true"));
});

test("home page imports and uses PublicScrollReveal with card stagger rollout", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";',
    ),
  );
  assert.ok(source.includes("<PublicScrollReveal>"));
  assert.ok(source.includes("<PublicScrollReveal staggerChildren>"));
  assert.ok(source.includes("data-scroll-reveal-item"));
  assert.ok(source.includes("staggerChildren"));
});

test("services page imports and uses PublicScrollReveal for controlled rollout", () => {
  const source = read(SERVICES_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";',
    ),
  );
  assert.ok(source.includes("<PublicScrollReveal"));
  assert.ok(source.includes('variant="section"'));
  assert.ok(source.includes('variant="cards"'));
  assert.ok(source.includes('variant="minimal"'));
  assert.ok(source.includes("staggerChildren"));
  assert.ok(source.includes("data-scroll-reveal-item"));
});

test("clinicas page imports and uses PublicScrollReveal for controlled rollout", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";',
    ),
  );
  assert.ok(source.includes("<PublicScrollReveal"));
  assert.ok(source.includes('variant="section"'));
  assert.ok(source.includes('variant="cards"'));
  assert.ok(source.includes('variant="minimal"'));
  assert.ok(source.includes("staggerChildren"));
  assert.ok(source.includes("data-scroll-reveal-item"));
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

test("services page does not import gsap or ScrollTrigger directly", () => {
  const source = read(SERVICES_PAGE_PATH);

  assert.equal(
    source.includes('from "gsap"') || source.includes("from 'gsap'"),
    false,
  );
  assert.equal(source.includes('from "gsap/ScrollTrigger"'), false);
  assert.equal(source.includes("from 'gsap/ScrollTrigger'"), false);
});

test("clinicas page does not import gsap or ScrollTrigger directly", () => {
  const source = read(CLINICAS_PAGE_PATH);

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

test("home, services, clinicas and reveal infrastructure do not include advanced scroll effects", () => {
  const combinedSource =
    `${read(COMPONENT_PATH)}\n${read(HOME_PAGE_PATH)}\n${read(SERVICES_PAGE_PATH)}\n${read(CLINICAS_PAGE_PATH)}`.toLowerCase();

  for (const forbiddenTerm of SCROLL_REVEAL_FORBIDDEN_TERMS) {
    assert.equal(
      combinedSource.includes(forbiddenTerm),
      false,
      `scroll reveal rollout should not include ${forbiddenTerm}`,
    );
  }
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

test("staggerChildren is only used in home, services and clinicas rollout", () => {
  for (const path of PUBLIC_FILES_WITHOUT_USAGE) {
    const source = read(path);

    assert.equal(
      source.includes("staggerChildren"),
      false,
      `${path} should not reference staggerChildren`,
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
