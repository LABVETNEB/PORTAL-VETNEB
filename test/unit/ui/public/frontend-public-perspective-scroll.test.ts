import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOOK_PATH = "frontend/src/hooks/useScrollPerspective.ts";
const COMPONENT_PATH = "frontend/src/components/public/PerspectiveScrollSection.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const PUBLIC_LAYOUT_PATH = "frontend/src/components/layout/PublicLayout.tsx";
const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const CLINICAS_PAGE_PATH = "frontend/src/app/clinicas/page.tsx";
const PRECIOS_CONTENT_PATH = "frontend/src/components/public/PreciosContent.tsx";
const CONTACTO_CONTENT_PATH = "frontend/src/components/public/ContactoContent.tsx";

const PROHIBITED_PUBLIC_STRINGS = [
  "DEMOSTRATIVO",
  "ejemplo visual",
  "sin datos reales",
  "caso demo",
  "DEMO-000",
  "DEMO-CLINICA-001",
  "paciente demostrativo",
  "clínica demostrativa",
  "preview de informe simulado",
  "panel operativo simulado",
  "dashboard ficticio",
  "informe inventado",
  "datos ficticios visibles",
];

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

// ─── PR-24: foundation — hook ────────────────────────────────────────────────

test("useScrollPerspective hook exists as a client module with intensity profiles", () => {
  const source = read(HOOK_PATH);

  assert.ok(source.startsWith('"use client";'));
  assert.ok(source.includes("SCROLL_PERSPECTIVE_PROFILES"));
  assert.ok(source.includes('"subtle" | "standard" | "featured"'));
  assert.ok(source.includes('"none" | "minimal"'));
  assert.ok(source.includes("disableOnMobile"));
});

test("hook drives depth via rAF with passive listeners and full cleanup", () => {
  const source = read(HOOK_PATH);

  assert.ok(source.includes("requestAnimationFrame"));
  assert.ok(source.includes("cancelAnimationFrame"));
  assert.ok(source.includes('window.addEventListener("scroll", scheduleSectionsUpdate, { passive: true })'));
  assert.ok(source.includes('window.addEventListener("resize", scheduleSectionsUpdate, { passive: true })'));
  assert.ok(source.includes('window.removeEventListener("scroll", scheduleSectionsUpdate)'));
  assert.ok(source.includes('window.removeEventListener("resize", scheduleSectionsUpdate)'));
});

test("hook respects prefers-reduced-motion without registering listeners", () => {
  const source = read(HOOK_PATH);

  assert.ok(source.includes("(prefers-reduced-motion: reduce)"));
  assert.ok(source.includes('data-perspective-disabled", "reduced-motion"'));
});

test("hook never hijacks scrolling: no wheel/touch interception, no preventDefault", () => {
  const source = read(HOOK_PATH);

  assert.equal(source.includes("preventDefault"), false);
  assert.equal(source.includes('"wheel"'), false);
  assert.equal(source.includes('"touchmove"'), false);
  assert.equal(source.includes("scrollTo"), false);
  assert.equal(source.includes("scroll-behavior"), false);
});

test("hook animates only transform/opacity CSS variables", () => {
  const source = read(HOOK_PATH);

  assert.ok(source.includes("--scroll-depth-scale"));
  assert.ok(source.includes("--scroll-depth-rotate-x"));
  assert.ok(source.includes("--scroll-depth-y"));
  assert.ok(source.includes("--scroll-depth-z"));
  assert.ok(source.includes("--scroll-depth-opacity"));
  assert.equal(source.includes("style.width"), false);
  assert.equal(source.includes("style.height"), false);
  assert.equal(source.includes("style.margin"), false);
  assert.equal(source.includes('setProperty("width"'), false);
  assert.equal(source.includes('setProperty("height"'), false);
});

test("hook uses a perceptible smoothstep curve with real desktop depth", () => {
  const source = read(HOOK_PATH);

  assert.ok(source.includes("function smoothstep("));
  assert.ok(source.includes("smoothstep(0.1, 0.8, Math.abs(signedProgress))"));
  assert.ok(source.includes("Math.sign(signedProgress) * depthMagnitude"));
  assert.equal(source.includes("signedProgress * Math.abs(signedProgress)"), false);

  assert.ok(source.includes("maxRotateXDeg: 3"));
  assert.ok(source.includes("maxRotateXDeg: 4.5"));
  assert.ok(source.includes("maxRotateXDeg: 6.5"));
  assert.ok(source.includes("maxTranslateZPx: -28"));
  assert.ok(source.includes("maxTranslateZPx: -40"));
  assert.ok(source.includes("maxTranslateZPx: -60"));
  assert.ok(source.includes("maxTranslateZPx: 0"));
  assert.ok(source.includes("Math.max(\n      0.5,"));
});

// ─── PR-24: foundation — component ───────────────────────────────────────────

test("PerspectiveScrollSection is a client wrapper using the hook with data attributes", () => {
  const source = read(COMPONENT_PATH);

  assert.ok(source.startsWith('"use client";'));
  assert.ok(source.includes("useScrollPerspective"));
  assert.ok(source.includes('data-public-perspective-section="true"'));
  assert.ok(source.includes("data-perspective-intensity={intensity}"));
  assert.ok(source.includes("public-perspective-section-inner"));
});

// ─── PR-24: foundation — CSS ─────────────────────────────────────────────────

test("globals.css defines the public perspective foundation with neutral defaults", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes(".public-perspective-stage"));
  assert.ok(source.includes(".public-perspective-section"));
  assert.ok(source.includes(".public-perspective-section-inner"));
  assert.ok(source.includes("--scroll-depth-scale: 1;"));
  assert.ok(source.includes("--scroll-depth-rotate-x: 0deg;"));
  assert.ok(source.includes("--scroll-depth-y: 0px;"));
  assert.ok(source.includes("--scroll-depth-z: 0px;"));
  assert.ok(source.includes("--scroll-depth-opacity: 1;"));
  assert.ok(source.includes("perspective: var(--public-perspective-depth, 1100px);"));
  assert.ok(source.includes("var(--scroll-depth-z)"));
  assert.ok(source.includes("translate3d("));
});

test("globals.css neutralizes perspective transforms under prefers-reduced-motion", () => {
  const source = read(GLOBALS_CSS_PATH);
  const perspectiveBlock = source.slice(
    source.indexOf("/* public-perspective-scroll:start */"),
    source.indexOf("/* public-perspective-scroll:end */"),
  );

  assert.ok(perspectiveBlock.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(perspectiveBlock.includes("transform: none !important;"));
  assert.ok(perspectiveBlock.includes("opacity: 1 !important;"));
});

test("public layout main is the perspective stage; navbar/footer stay outside it", () => {
  const source = read(PUBLIC_LAYOUT_PATH);

  assert.ok(source.includes("public-perspective-stage"));

  const mainIndex = source.indexOf("<main");
  const navbarIndex = source.indexOf("<Navbar");
  const footerIndex = source.indexOf("<Footer />");

  assert.ok(navbarIndex < mainIndex, "Navbar must render before main stage");
  assert.ok(source.indexOf("</main>") < footerIndex, "Footer must render after main stage");
});

// ─── PR-24: per-route coverage ───────────────────────────────────────────────

test("home applies perspective to several sections and excludes hero h1", () => {
  const source = read(HOME_PAGE_PATH);
  const wrapperCount = countOccurrences(source, "<PerspectiveScrollSection");

  assert.ok(
    wrapperCount >= 4,
    `home must animate several sections (expected >= 4, got ${wrapperCount})`,
  );

  const heroBlock = source.slice(source.indexOf("hero-heading"), source.indexOf("public-soft-canvas"));
  assert.equal(heroBlock.includes("PerspectiveScrollSection"), false);
});

test("servicios applies perspective to bento, coordination band, journey and closing band", () => {
  const source = read(SERVICIOS_PAGE_PATH);
  const wrapperCount = countOccurrences(source, "<PerspectiveScrollSection");

  assert.equal(wrapperCount, 4);
  assert.ok(source.includes('<PerspectiveScrollSection intensity="featured">'));
  assert.ok(source.includes('<PerspectiveScrollSection intensity="standard">'));
  assert.ok(source.includes('<PerspectiveScrollSection intensity="subtle">'));
});

test("clinicas applies perspective to modules, operations timeline, onboarding and CTA", () => {
  const source = read(CLINICAS_PAGE_PATH);
  const wrapperCount = countOccurrences(source, "<PerspectiveScrollSection");

  assert.equal(wrapperCount, 4);
  assert.ok(source.includes('<PerspectiveScrollSection intensity="featured">'));
});

test("precios applies a single subtle perspective wrapper to the catalog container", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.equal(countOccurrences(source, "<PerspectiveScrollSection"), 1);
  assert.ok(source.includes('<PerspectiveScrollSection intensity="subtle">'));
});

test("precios never applies perspective to individual price rows, values or badges", () => {
  const source = read(PRECIOS_CONTENT_PATH);
  const rowsBlock = source.slice(
    source.indexOf("{category.items.map((item, index) => ("),
    source.indexOf("Consultar este estudio"),
  );

  assert.ok(rowsBlock.includes("clinical-hover-row"));
  assert.ok(rowsBlock.includes("clinical-pill"));
  assert.equal(rowsBlock.includes("PerspectiveScrollSection"), false);
  assert.equal(rowsBlock.includes("data-public-perspective-section"), false);
});

test("contacto applies perspective to intent router and info column only", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.equal(countOccurrences(source, "<PerspectiveScrollSection"), 2);
  assert.equal(countOccurrences(source, '<PerspectiveScrollSection intensity="subtle">'), 2);
});

test("contacto form, fields and submit stay outside the perspective effect", () => {
  const source = read(CONTACTO_CONTENT_PATH);
  const formBlock = source.slice(source.indexOf("<form"), source.indexOf("</form>"));

  assert.ok(formBlock.includes("Formulario de contacto"));
  assert.equal(formBlock.includes("PerspectiveScrollSection"), false);
  assert.equal(formBlock.includes("data-public-perspective-section"), false);

  const formSectionBlock = source.slice(
    source.indexOf('id="contact-form"'),
    source.indexOf("</form>"),
  );
  assert.equal(formSectionBlock.includes("PerspectiveScrollSection"), false);
});

// ─── PR-24: exclusions and invariants ────────────────────────────────────────

test("navbar and footer carry no perspective wrappers or section data attributes", () => {
  const navbarSource = read(NAVBAR_PATH);
  const footerSource = read(FOOTER_PATH);

  for (const source of [navbarSource, footerSource]) {
    assert.equal(source.includes("PerspectiveScrollSection"), false);
    assert.equal(source.includes("data-public-perspective-section"), false);
    assert.equal(source.includes("useScrollPerspective"), false);
  }
});

test("perspective foundation introduces no prohibited public demo copy", () => {
  for (const path of [HOOK_PATH, COMPONENT_PATH, GLOBALS_CSS_PATH]) {
    const source = read(path);

    for (const prohibited of PROHIBITED_PUBLIC_STRINGS) {
      assert.equal(
        source.includes(prohibited),
        false,
        `${path} must not contain "${prohibited}"`,
      );
    }
  }
});

test("precios pricing logic and contacto submit handler remain untouched by PR-24", () => {
  const preciosSource = read(PRECIOS_CONTENT_PATH);
  const contactoSource = read(CONTACTO_CONTENT_PATH);

  assert.ok(preciosSource.includes("getPublicPricing("));
  assert.ok(preciosSource.includes("sortPricingCategories(pricingSnapshot.categories)"));
  assert.ok(preciosSource.includes('normalizePriceLabel(item.priceLabel)'));
  assert.ok(contactoSource.includes("submitContactMessage({"));
  assert.ok(contactoSource.includes("event.preventDefault();"));
  assert.ok(contactoSource.includes('aria-busy={isSubmitting}'));
});
