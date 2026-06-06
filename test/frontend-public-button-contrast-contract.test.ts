import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const CLINICAS_PAGE_PATH = "frontend/src/app/clinicas/page.tsx";
const PROFESIONALES_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";
const CONTACTO_CONTENT_PATH = "frontend/src/components/public/ContactoContent.tsx";
const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const PUBLIC_ROUTE_CONTROL_PATH =
  "frontend/src/components/public/PublicRouteControl.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("globals css defines public CTA contract classes", () => {
  const source = read(GLOBALS_CSS_PATH);
  const ctaContractStart = source.indexOf(
    ".public-cta-primary,\n  .public-cta-secondary,\n  .public-cta-outline,\n  .public-cta-on-hero {\n    letter-spacing: 0.01em;",
  );
  const ctaContractEnd = source.indexOf("/* public-secondary-hero-surface:start */");
  const hasValidCtaContractRange =
    ctaContractStart !== -1 &&
    ctaContractEnd !== -1 &&
    ctaContractEnd > ctaContractStart;

  assert.ok(source.includes(".public-cta-primary"));
  assert.ok(source.includes(".public-cta-secondary"));
  assert.ok(source.includes(".public-cta-outline"));
  assert.ok(source.includes(".public-cta-on-hero"));
  assert.ok(hasValidCtaContractRange, "public CTA contract block must exist");

  const ctaContract = source.slice(ctaContractStart, ctaContractEnd);

  assert.ok(ctaContract.includes("inset 0 1px 0"));
  assert.ok(ctaContract.includes("inset 0 -1px 0"));
  assert.ok(
    ctaContract.includes(
      "transition-property: background-image, background-color, border-color, box-shadow, color, transform;",
    ),
  );
  assert.ok(source.includes("transition-duration: 300ms"));
  assert.ok(source.includes("cubic-bezier(0.2, 0.8, 0.2, 1)"));
  assert.ok(ctaContract.includes("transform: translateY(-1px)"));
  assert.ok(ctaContract.includes("transform: translateY(0)"));
  assert.ok(ctaContract.includes(":focus-visible"));
  assert.ok(source.includes("background-image: linear-gradient(135deg, #071F35 0%, #123E63 52%, #185A7C 100%)"));
  assert.ok(source.includes("background-image: linear-gradient(135deg, #092942 0%, #164D78 52%, #1F6F94 100%)"));
  assert.ok(ctaContract.includes("box-shadow"));

  for (const forbiddenMarker of [
    "backdrop-filter",
    "-webkit-backdrop-filter",
    "hard-shadow",
    "text-shadow",
    "@keyframes",
    "animation:",
    "Lenis",
    "gsap",
    "ScrollTrigger",
  ]) {
    assert.equal(
      ctaContract.includes(forbiddenMarker),
      false,
      `public CTA contract must not contain ${forbiddenMarker}`,
    );
  }

  assert.equal(source.includes(".public-cta-primary::before"), false);
  assert.equal(source.includes(".public-cta-primary::after"), false);
  assert.equal(source.includes(".public-cta-on-hero::before"), false);
  assert.equal(source.includes(".public-cta-on-hero::after"), false);
  assert.equal(source.includes('[data-auth-login-submit="true"]'), false);
});

test("public pages use CTA contract classes and avoid low-contrast transparent hero CTA pattern", () => {
  const home = read(HOME_PAGE_PATH);
  const servicios = read(SERVICIOS_PAGE_PATH);
  const clinicas = read(CLINICAS_PAGE_PATH);
  const profesionales = read(PROFESIONALES_CONTENT_PATH);
  const particulares = read(PARTICULARES_CONTENT_PATH);
  const contacto = read(CONTACTO_CONTENT_PATH);
  const login = read(LOGIN_CONTENT_PATH);
  const navbar = read(NAVBAR_PATH);

  const sources = [
    home,
    servicios,
    clinicas,
    profesionales,
    particulares,
    contacto,
    login,
    navbar,
  ];

  for (const source of sources) {
    assert.ok(
      source.includes("import { Button } from \"@/components/ui/button\";") ||
        source.includes("PublicRouteControl"),
    );
    assert.ok(source.includes("public-cta-"));
  }

  assert.ok(home.includes("public-cta-on-hero"));
  assert.ok(
    home.includes(
      'className="public-cta-on-hero w-full text-vetneb-navy hover:text-vetneb-navy active:text-vetneb-navy focus-visible:text-vetneb-navy sm:w-auto"',
    ),
  );
  assert.ok(clinicas.includes("public-cta-on-hero"));
  assert.equal(home.includes("bg-white/10 text-white"), false);
  assert.equal(clinicas.includes("bg-white/10 font-semibold text-white"), false);
});

test("secondaryOutline CTA variant keeps explicit readable text in all interaction states", () => {
  const source = read(PUBLIC_ROUTE_CONTROL_PATH);

  assert.ok(source.includes('text-vetneb-navy'));
  assert.ok(source.includes("hover:text-vetneb-navy"));
  assert.ok(source.includes("active:text-vetneb-navy"));
  assert.ok(source.includes("focus-visible:text-vetneb-navy"));
});

test("login and particulares submit CTAs keep loading semantics and contract class", () => {
  const login = read(LOGIN_CONTENT_PATH);
  const particulares = read(PARTICULARES_CONTENT_PATH);
  const contacto = read(CONTACTO_CONTENT_PATH);

  assert.ok(login.includes("public-cta-primary w-full"));
  assert.ok(login.includes("aria-busy={isSubmitting}"));
  assert.ok(login.includes("aria-pressed={isPasswordVisible}"));
  assert.equal(login.includes("Clínicas"), false);
  assert.equal(login.includes("Particulares"), false);
  assert.equal(login.includes('data-auth-particular-access-link="true"'), false);
  assert.equal(login.includes('data-auth-clinic-access-tab="true"'), false);
  assert.equal(login.includes("router.push(ROUTES.particulares);"), false);

  assert.ok(particulares.includes("public-cta-primary w-full"));
  assert.ok(particulares.includes("aria-busy={isSubmitting}"));
  assert.ok(contacto.includes("public-cta-primary w-full"));
  assert.ok(contacto.includes("aria-busy={isSubmitting}"));
});
