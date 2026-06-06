import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PATH = "frontend/src/app/servicios/page.tsx";
const CLINICAS_PATH = "frontend/src/app/clinicas/page.tsx";
const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";
const PROFESIONALES_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const PROFESIONAL_DETAIL_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalDetailContent.tsx";
const CONTACTO_PAGE_PATH = "frontend/src/app/contacto/page.tsx";
const CONTACTO_CONTENT_PATH = "frontend/src/components/public/ContactoContent.tsx";
const PRECIOS_PATH = "frontend/src/app/precios/page.tsx";
const PRECIOS_CONTENT_PATH = "frontend/src/components/public/PreciosContent.tsx";
const LOGIN_PATH = "frontend/src/app/login/page.tsx";
const PARTICULARES_PATH = "frontend/src/app/particulares/page.tsx";
const SITEMAP_PATH = "frontend/src/app/sitemap.ts";
const SEO_PATH = "frontend/src/lib/seo.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function count(source: string, pattern: string): number {
  return source.split(pattern).length - 1;
}

test("indexable public pages keep metadata helper wiring", () => {
  const homeSource = read(HOME_PATH);
  const serviciosSource = read(SERVICIOS_PATH);
  const clinicasSource = read(CLINICAS_PATH);
  const profesionalesPageSource = read(PROFESIONALES_PAGE_PATH);
  const contactoPageSource = read(CONTACTO_PAGE_PATH);
  const preciosSource = read(PRECIOS_PATH);

  assert.ok(homeSource.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(serviciosSource.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(clinicasSource.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(profesionalesPageSource.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(contactoPageSource.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(preciosSource.includes("export const metadata: Metadata = createPageMetadata("));
});

test("home page keeps one clear h1 and institutional section hierarchy", () => {
  const source = read(HOME_PATH);

  assert.equal(count(source, "<h1"), 1);
  assert.ok(source.includes('aria-labelledby="hero-heading"'));
  assert.ok(source.includes('aria-labelledby="services-heading"'));
  assert.ok(source.includes('aria-labelledby="benefits-heading"'));
  assert.ok(source.includes('aria-labelledby="cta-heading"'));
  assert.ok(source.includes("<h2"));
  assert.ok(source.includes("CardTitle"));
  assert.ok(source.includes("<section"));
});

test("servicios page keeps semantic headings, sections and reveal policy", () => {
  const source = read(SERVICIOS_PATH);

  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("<h2"));
  assert.ok(source.includes("<section"));
  assert.ok(source.includes("<article"));
  assert.ok(source.includes("PublicScrollReveal"));
  assert.equal(
    source.includes('from "gsap"') || source.includes("from 'gsap'"),
    false,
  );
});

test("clinicas page keeps semantic headings, sections and reveal policy", () => {
  const source = read(CLINICAS_PATH);

  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("<h2"));
  assert.ok(source.includes("<h3"));
  assert.ok(source.includes("<section"));
  assert.ok(source.includes("<article"));
  assert.ok(source.includes("PublicScrollReveal"));
  assert.equal(
    source.includes('from "gsap"') || source.includes("from 'gsap'"),
    false,
  );
});

test("profesionales content keeps semantic search/result structure and map safety", () => {
  const source = read(PROFESIONALES_CONTENT_PATH);
  const detailSource = read(PROFESIONAL_DETAIL_CONTENT_PATH);

  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("<h2"));
  assert.ok(source.includes("Clínicas y profesionales verificados que trabajan con VETNEB."));
  assert.ok(source.includes("Cada ficha fue revisada y confirmada por el laboratorio."));
  assert.ok(source.includes("<section"));
  assert.ok(source.includes("state.professionals.map((professional) =>"));
  assert.ok(source.includes("<article"));
  assert.ok(source.includes("searchPublicProfessionals("));
  assert.ok(source.includes("router.push(`${ROUTES.profesionales}${params.size ? `?${params}` : \"\"}`)"));
  assert.ok(source.includes("buildProfessionalDetailHref("));
  assert.equal(source.includes("<PublicExternalControl"), false);
  assert.ok(detailSource.includes("Ver ubicación en mapa"));
  assert.ok(detailSource.includes("<PublicExternalControl"));
  assert.ok(detailSource.includes('target="_blank"'));
  assert.equal(/<a\b/.test(source), false);
  assert.equal(/<a\b/.test(detailSource), false);
  assert.equal(source.includes('from "gsap"'), false);
  assert.equal(detailSource.includes('from "gsap"'), false);
});

test("contacto content keeps semantic headings and unchanged contact flow", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("<h2"));
  assert.ok(source.includes("<h3"));
  assert.ok(source.includes("<section"));
  assert.ok(source.includes('aria-label="Formulario de contacto"'));
  assert.ok(source.includes("Envíenos un mensaje"));
  assert.ok(source.includes("Información de contacto"));
  assert.equal(source.includes("Solicitar integración clínica"), false);
});

test("precios page keeps functional surface without reveal animation additions", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("<h2"));
  assert.ok(source.includes("CardTitle"));
  assert.ok(source.includes("<section"));
  assert.ok(source.includes("getPublicPricing("));
  assert.equal(source.includes("PublicScrollReveal"), false);
  assert.equal(
    source.includes('from "gsap"') || source.includes("from 'gsap'"),
    false,
  );
});

test("precios page sanitizes semantic ids for category headings", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(source.includes("function toSemanticId(value: string): string {"));
  assert.ok(source.includes(".normalize(\"NFD\")"));
  assert.ok(source.includes(".replace(/[\\u0300-\\u036f]/g, \"\")"));
  assert.ok(source.includes(".replace(/[^a-z0-9]+/g, \"-\")"));
  assert.ok(source.includes("const categoryHeadingId = `pricing-category-${toSemanticId(category.category)}`;"));
  assert.ok(source.includes("aria-labelledby={categoryHeadingId}"));
  assert.ok(source.includes("id={categoryHeadingId}"));
  assert.equal(
    source.includes("aria-labelledby={`pricing-category-${category.category}`}"),
    false,
  );
  assert.equal(
    source.includes("id={`pricing-category-${category.category}`}"),
    false,
  );
});

test("seo integrity keeps no fake review schema and no private sitemap routes", () => {
  const seoSource = read(SEO_PATH);
  const sitemapSource = read(SITEMAP_PATH);

  assert.equal(seoSource.includes("AggregateRating"), false);
  assert.equal(seoSource.includes('"@type": "Review"'), false);
  assert.equal(seoSource.includes("localhost"), false);
  assert.equal(sitemapSource.includes("/dashboard"), false);
  assert.equal(sitemapSource.includes("/api"), false);
});

test("functional protected pages keep noindex contract and particulares stays out of sitemap", () => {
  const loginSource = read(LOGIN_PATH);
  const particularesSource = read(PARTICULARES_PATH);
  const sitemapSource = read(SITEMAP_PATH);

  assert.ok(loginSource.includes("robots: { index: false, follow: false },"));
  assert.ok(particularesSource.includes("robots: {"));
  assert.ok(particularesSource.includes("index: false,"));
  assert.equal(sitemapSource.includes("/particulares"), false);
});
