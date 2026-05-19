import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SEO_PATH = "frontend/src/lib/seo.ts";
const LAYOUT_PATH = "frontend/src/app/layout.tsx";
const ROBOTS_PATH = "frontend/src/app/robots.ts";
const SITEMAP_PATH = "frontend/src/app/sitemap.ts";
const HOME_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PATH = "frontend/src/app/servicios/page.tsx";
const CLINICAS_PATH = "frontend/src/app/clinicas/page.tsx";
const PROFESIONALES_PATH = "frontend/src/app/profesionales/page.tsx";
const PROFESIONALES_DYNAMIC_PROFILE_PATH =
  "frontend/src/app/profesionales/[clinicId]/page.tsx";
const CONTACTO_PATH = "frontend/src/app/contacto/page.tsx";
const PRECIOS_PATH = "frontend/src/app/precios/page.tsx";
const PARTICULARES_PATH = "frontend/src/app/particulares/page.tsx";
const LOGIN_PATH = "frontend/src/app/login/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public SEO base keeps controlled site URL and canonical metadata helpers", () => {
  const source = read(SEO_PATH);

  assert.ok(source.includes("export const SITE_URL = ("));
  assert.ok(
    source.includes('process.env.NEXT_PUBLIC_SITE_URL ?? "https://portal.vetneb.com"'),
  );
  assert.ok(source.includes("metadataBase: new URL(SITE_URL),"));
  assert.ok(source.includes("alternates: {"));
  assert.ok(source.includes("canonical: SITE_URL,"));
  assert.ok(source.includes("export function buildCanonicalUrl(path: string): string {"));
  assert.ok(source.includes("const canonicalUrl = buildCanonicalUrl(path);"));
  assert.ok(source.includes("canonical: canonicalUrl,"));
  assert.equal(source.includes("localhost"), false);
});

test("root layout embeds institutional JSON-LD script", () => {
  const source = read(LAYOUT_PATH);

  assert.ok(source.includes("const orgJsonLd = getOrganizationJsonLd();"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(
    source.includes(
      "dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}",
    ),
  );
});

test("robots policy blocks dashboard and api while exposing sitemap", () => {
  const source = read(ROBOTS_PATH);

  assert.ok(source.includes('disallow: ["/dashboard", "/api"]'));
  assert.ok(source.includes("sitemap: `${SITE_URL}/sitemap.xml`,"));
});

test("sitemap includes only public indexable institutional routes", () => {
  const source = read(SITEMAP_PATH);

  assert.ok(source.includes("url: SITE_URL,"));
  assert.ok(source.includes("url: `${SITE_URL}/servicios`,"));
  assert.ok(source.includes("url: `${SITE_URL}/clinicas`,"));
  assert.ok(source.includes("url: `${SITE_URL}/profesionales`,"));
  assert.ok(source.includes("url: `${SITE_URL}/contacto`,"));
  assert.ok(source.includes("url: `${SITE_URL}/precios`,"));
  assert.ok(source.includes("priority: 1,"));
  assert.ok(source.includes("priority: 0.9,"));
  assert.ok(source.includes("priority: 0.85,"));
  assert.ok(source.includes("priority: 0.8,"));
  assert.ok(source.includes("priority: 0.7,"));
  assert.ok(source.includes("priority: 0.65,"));
  assert.equal(source.includes("/dashboard"), false);
  assert.equal(source.includes("/api"), false);
  assert.equal(source.includes("/login"), false);
  assert.equal(source.includes("/particulares"), false);
});

test("public pages use metadata helper with stable canonical routes", () => {
  const homeSource = read(HOME_PATH);
  const serviciosSource = read(SERVICIOS_PATH);
  const clinicasSource = read(CLINICAS_PATH);
  const profesionalesSource = read(PROFESIONALES_PATH);
  const contactoSource = read(CONTACTO_PATH);
  const preciosSource = read(PRECIOS_PATH);
  const particularesSource = read(PARTICULARES_PATH);
  const loginSource = read(LOGIN_PATH);

  assert.ok(homeSource.includes('"/",'));
  assert.ok(serviciosSource.includes('"/servicios"'));
  assert.ok(clinicasSource.includes('"/clinicas"'));
  assert.ok(profesionalesSource.includes('"/profesionales"'));
  assert.ok(contactoSource.includes('"/contacto"'));
  assert.ok(preciosSource.includes('"/precios"'));
  assert.ok(particularesSource.includes('"/particulares"'));
  assert.ok(loginSource.includes('"/login"'));
  assert.ok(particularesSource.includes("robots: {"));
  assert.ok(particularesSource.includes("index: false,"));
  assert.ok(particularesSource.includes("follow: false,"));
  assert.ok(loginSource.includes("robots: { index: false, follow: false },"));
});

test("professionals public page exposes verifiable structured data", () => {
  const seoSource = read(SEO_PATH);
  const profesionalesSource = read(PROFESIONALES_PATH);

  assert.ok(seoSource.includes("export function getProfessionalsPageJsonLd()"));
  assert.ok(seoSource.includes('"@type": "BreadcrumbList"'));
  assert.ok(seoSource.includes('"@type": ["WebPage", "SearchResultsPage"]'));
  assert.ok(seoSource.includes('const pageUrl = buildCanonicalUrl("/profesionales");'));
  assert.ok(seoSource.includes("const breadcrumbId = `${pageUrl}#breadcrumb`;"));
  assert.ok(seoSource.includes("const searchPageId = `${pageUrl}#search-results-page`;"));
  assert.ok(seoSource.includes("const searchActionTarget = `${pageUrl}?q={search_term_string}`;"));
  assert.ok(seoSource.includes('name: "Inicio"'));
  assert.ok(seoSource.includes('name: "Profesionales"'));
  assert.ok(seoSource.includes("item: SITE_URL"));
  assert.ok(seoSource.includes("item: pageUrl"));
  assert.ok(seoSource.includes('"@id": websiteId'));
  assert.ok(seoSource.includes('"@id": organizationId'));
  assert.ok(seoSource.includes('"@id": breadcrumbId'));
  assert.ok(seoSource.includes('"@type": "SearchAction"'));
  assert.ok(seoSource.includes('"@type": "EntryPoint"'));
  assert.ok(seoSource.includes("urlTemplate: searchActionTarget"));
  assert.ok(seoSource.includes('"query-input": "required name=search_term_string"'));

  assert.ok(
    profesionalesSource.includes(
      'import { getProfessionalsPageJsonLd } from "@/lib/seo";',
    ),
  );
  assert.ok(
    profesionalesSource.includes(
      "const professionalsPageJsonLd = getProfessionalsPageJsonLd();",
    ),
  );
  assert.ok(profesionalesSource.includes('type="application/ld+json"'));
  assert.ok(
    profesionalesSource.includes(
      "__html: JSON.stringify(professionalsPageJsonLd),",
    ),
  );
});

test("professionals structured data avoids unverifiable result entities", () => {
  const seoSource = read(SEO_PATH);
  const profesionalesSource = read(PROFESIONALES_PATH);
  const combined = `${seoSource}\n${profesionalesSource}`;

  assert.equal(combined.includes('"@type": "ItemList"'), false);
  assert.equal(combined.includes("AggregateRating"), false);
  assert.equal(combined.includes('"@type": "Review"'), false);
  assert.equal(combined.includes('"@type": "LocalBusiness"'), false);
  assert.equal(combined.includes('"@type": "MedicalBusiness"'), false);
  assert.equal(combined.includes('"@type": "VeterinaryCare"'), false);
  assert.equal(combined.includes("openingHours"), false);
  assert.equal(combined.includes("GeoCoordinates"), false);
  assert.equal(combined.includes("PostalAddress"), false);
  assert.equal(combined.includes("priceRange"), false);
});

test("professionals structured data stays page-level without public profile route", () => {
  const seoSource = read(SEO_PATH);
  const profesionalesSource = read(PROFESIONALES_PATH);
  const combined = `${seoSource}\n${profesionalesSource}`;

  assert.equal(
    existsSync(resolve(process.cwd(), PROFESIONALES_DYNAMIC_PROFILE_PATH)),
    false,
  );
  assert.equal(combined.includes("getPublicProfessional"), false);
  assert.equal(combined.includes("/api/public/professionals/"), false);
  assert.ok(combined.includes('"@type": ["WebPage", "SearchResultsPage"]'));
  assert.ok(combined.includes('"@type": "SearchAction"'));
});

test("professionals SEO remains static at page-level without server fetch wiring", () => {
  const seoSource = read(SEO_PATH);
  const profesionalesSource = read(PROFESIONALES_PATH);
  const combined = `${seoSource}\n${profesionalesSource}`;

  assert.equal(combined.includes("fetch("), false);
  assert.equal(combined.includes("searchPublicProfessionals("), false);
  assert.ok(
    profesionalesSource.includes(
      "const professionalsPageJsonLd = getProfessionalsPageJsonLd();",
    ),
  );
});

test("institutional JSON-LD avoids fake rating/review schema", () => {
  const source = read(SEO_PATH);

  assert.equal(source.includes("AggregateRating"), false);
  assert.equal(source.includes('"@type": "Review"'), false);
  assert.ok(source.includes('"@type": "Organization"'));
  assert.ok(source.includes('"@type": "WebSite"'));
});

test("server SEO files avoid client-only window/document usage", () => {
  const combined = [
    read(SEO_PATH),
    read(LAYOUT_PATH),
    read(ROBOTS_PATH),
    read(SITEMAP_PATH),
  ].join("\n");

  assert.equal(combined.includes("window."), false);
  assert.equal(combined.includes("document."), false);
});
