import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SEO_PATH = "frontend/src/lib/seo.ts";
const ROBOTS_PATH = "frontend/src/app/robots.ts";
const SITEMAP_PATH = "frontend/src/app/sitemap.ts";
const HOME_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PATH = "frontend/src/app/servicios/page.tsx";
const CITOLOGIA_PATH = "frontend/src/app/citologia-veterinaria/page.tsx";
const HISTOPAT_PATH = "frontend/src/app/histopatologia-veterinaria/page.tsx";
const INFORMES_PATH = "frontend/src/app/informes-veterinarios/page.tsx";
const LABORATORIO_PATH = "frontend/src/app/laboratorio-patologico-veterinario/page.tsx";
const CLINICAS_PATH = "frontend/src/app/clinicas/page.tsx";
const PRECIOS_PATH = "frontend/src/app/precios/page.tsx";
const CONTACTO_PATH = "frontend/src/app/contacto/page.tsx";
const PROFESIONALES_PATH = "frontend/src/app/profesionales/page.tsx";
const OFFLINE_PATH = "frontend/src/app/offline/page.tsx";
const LOGIN_PATH = "frontend/src/app/login/page.tsx";
const PARTICULARES_PATH = "frontend/src/app/particulares/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ─── robots.ts contracts ──────────────────────────────────────────────────────

test("robots.ts disallows dashboard, api, offline and particulares", () => {
  const source = read(ROBOTS_PATH);

  assert.ok(source.includes('"/dashboard"'), "robots must disallow /dashboard");
  assert.ok(source.includes('"/api"'), "robots must disallow /api");
  assert.ok(source.includes('"/offline"'), "robots must disallow /offline");
  assert.ok(source.includes('"/particulares"'), "robots must disallow /particulares");
});

test("robots.ts does not allow dashboard or api routes explicitly", () => {
  const source = read(ROBOTS_PATH);

  const allowSection = source.slice(source.indexOf("allow:"), source.indexOf("disallow:"));

  assert.equal(
    allowSection.includes("/dashboard"),
    false,
    "allow list must not include /dashboard",
  );
  assert.equal(
    allowSection.includes("/api"),
    false,
    "allow list must not include /api",
  );
});

// ─── Offline page noindex contract ───────────────────────────────────────────

test("offline page declares robots noindex", () => {
  const source = read(OFFLINE_PATH);

  assert.ok(
    source.includes("robots: { index: false, follow: false }"),
    "offline page must have robots noindex/nofollow",
  );
});

// ─── Login y particulares noindex contract ────────────────────────────────────

test("login and particulares pages declare robots noindex", () => {
  const loginSource = read(LOGIN_PATH);
  const particularesSource = read(PARTICULARES_PATH);

  assert.ok(
    loginSource.includes("robots: { index: false, follow: false }"),
    "login page must have robots noindex",
  );
  assert.ok(
    particularesSource.includes("index: false,"),
    "particulares page must have robots index: false",
  );
  assert.ok(
    particularesSource.includes("follow: false,"),
    "particulares page must have robots follow: false",
  );
});

// ─── Titles sin doble marca (home y contacto) ────────────────────────────────

test("contacto page title does not contain brand name to avoid template duplication", () => {
  const source = read(CONTACTO_PATH);

  assert.equal(
    source.includes('"Contacto — Portal VETNEB"'),
    false,
    "contacto title must not contain 'Portal VETNEB' — the template appends '| Portal VETNEB', causing 'Contacto — Portal VETNEB | Portal VETNEB'",
  );
  assert.ok(
    source.includes('"Contacto — Laboratorio Patológico Veterinario"'),
    "contacto title must be 'Contacto — Laboratorio Patológico Veterinario' for keyword value without brand duplication",
  );
});

test("home page title does not start with brand name to avoid template duplication", () => {
  const source = read(HOME_PATH);

  assert.equal(
    source.includes('"Portal VETNEB — Laboratorio Patológico Veterinario"'),
    false,
    "home title must not start with 'Portal VETNEB' since the template appends '| Portal VETNEB' — this would duplicate the brand",
  );
  assert.ok(
    source.includes("createPageMetadata("),
    "home page must use createPageMetadata helper",
  );
  assert.ok(
    source.includes('"/",'),
    "home page must pass canonical root path",
  );
});

// ─── Sitemap incluye todas las páginas públicas indexables ───────────────────

test("sitemap includes all public indexable service pages", () => {
  const source = read(SITEMAP_PATH);

  const requiredUrls = [
    "${SITE_URL}/servicios",
    "${SITE_URL}/citologia-veterinaria",
    "${SITE_URL}/histopatologia-veterinaria",
    "${SITE_URL}/informes-veterinarios",
    "${SITE_URL}/laboratorio-patologico-veterinario",
    "${SITE_URL}/clinicas",
    "${SITE_URL}/profesionales",
    "${SITE_URL}/contacto",
    "${SITE_URL}/precios",
  ];

  for (const url of requiredUrls) {
    assert.ok(
      source.includes(url),
      `sitemap must include URL: ${url}`,
    );
  }
});

test("sitemap excludes private, noindex and tokenized routes", () => {
  const source = read(SITEMAP_PATH);

  const forbiddenPaths = [
    "/dashboard",
    "/api",
    "/offline",
    "/particulares",
    "/login",
  ];

  for (const path of forbiddenPaths) {
    assert.equal(
      source.includes(path),
      false,
      `sitemap must not include path: ${path}`,
    );
  }
});

// ─── JSON-LD en páginas de servicios ─────────────────────────────────────────

test("service pages emit getDiagnosticServiceJsonLd structured data", () => {
  const pages = [
    { path: SERVICIOS_PATH, name: "servicios" },
    { path: CITOLOGIA_PATH, name: "citologia-veterinaria" },
    { path: HISTOPAT_PATH, name: "histopatologia-veterinaria" },
    { path: INFORMES_PATH, name: "informes-veterinarios" },
    { path: LABORATORIO_PATH, name: "laboratorio-patologico-veterinario" },
  ];

  for (const page of pages) {
    const source = read(page.path);

    assert.ok(
      source.includes('type="application/ld+json"'),
      `${page.name} must emit application/ld+json script`,
    );
    assert.ok(
      source.includes("JSON.stringify("),
      `${page.name} JSON-LD must use JSON.stringify`,
    );
    assert.ok(
      source.includes("dangerouslySetInnerHTML="),
      `${page.name} JSON-LD must use dangerouslySetInnerHTML`,
    );
  }
});

test("contacto page emits ContactPage JSON-LD", () => {
  const pageSource = read(CONTACTO_PATH);
  const seoSource = read(SEO_PATH);

  assert.ok(
    seoSource.includes("export function getContactPageJsonLd()"),
    "seo.ts must export getContactPageJsonLd",
  );
  assert.ok(
    seoSource.includes('"@type": "ContactPage"'),
    "getContactPageJsonLd must emit ContactPage type",
  );
  assert.ok(
    pageSource.includes("getContactPageJsonLd"),
    "contacto page must use getContactPageJsonLd",
  );
  assert.ok(
    pageSource.includes('type="application/ld+json"'),
    "contacto page must emit application/ld+json",
  );
  assert.ok(
    pageSource.includes("JSON.stringify("),
    "contacto page JSON-LD must use JSON.stringify",
  );
});

test("clinicas page emits WebPage JSON-LD with breadcrumb", () => {
  const pageSource = read(CLINICAS_PATH);
  const seoSource = read(SEO_PATH);

  assert.ok(
    seoSource.includes("export function getClinicasPageJsonLd()"),
    "seo.ts must export getClinicasPageJsonLd",
  );
  assert.ok(
    pageSource.includes("getClinicasPageJsonLd"),
    "clinicas page must use getClinicasPageJsonLd",
  );
  assert.ok(
    pageSource.includes('type="application/ld+json"'),
    "clinicas page must emit application/ld+json",
  );
});

test("precios page emits WebPage JSON-LD with breadcrumb", () => {
  const pageSource = read(PRECIOS_PATH);
  const seoSource = read(SEO_PATH);

  assert.ok(
    seoSource.includes("export function getPreciosPageJsonLd()"),
    "seo.ts must export getPreciosPageJsonLd",
  );
  assert.ok(
    pageSource.includes("getPreciosPageJsonLd"),
    "precios page must use getPreciosPageJsonLd",
  );
  assert.ok(
    pageSource.includes('type="application/ld+json"'),
    "precios page must emit application/ld+json",
  );
});

test("profesionales page emits SearchResultsPage JSON-LD", () => {
  const source = read(PROFESIONALES_PATH);

  assert.ok(
    source.includes("getProfessionalsPageJsonLd"),
    "profesionales page must use getProfessionalsPageJsonLd",
  );
  assert.ok(
    source.includes('type="application/ld+json"'),
    "profesionales page must emit application/ld+json",
  );
});

// ─── JSON-LD no contiene datos prohibidos ni tipos riesgosos ─────────────────

test("seo.ts JSON-LD helpers do not include unverifiable schema types", () => {
  const source = read(SEO_PATH);

  assert.equal(source.includes("AggregateRating"), false, "seo.ts must not contain AggregateRating");
  assert.equal(source.includes('"@type": "Review"'), false, "seo.ts must not contain Review type");
  assert.equal(source.includes('"@type": "FAQPage"'), false, "seo.ts must not contain FAQPage type");
  assert.equal(source.includes("openingHours"), false, "seo.ts must not contain openingHours (not verified)");
  assert.equal(source.includes("GeoCoordinates"), false, "seo.ts must not contain GeoCoordinates (no verified address)");
  assert.equal(source.includes("PostalAddress"), false, "seo.ts must not contain PostalAddress (no verified street address)");
  assert.equal(source.includes("priceRange"), false, "seo.ts must not contain priceRange (not verified)");
  assert.equal(source.includes("MedicalClaim"), false, "seo.ts must not contain MedicalClaim");
});

test("JSON-LD across all public pages uses JSON.stringify and not manual interpolation", () => {
  const pagePaths = [
    SERVICIOS_PATH,
    CITOLOGIA_PATH,
    HISTOPAT_PATH,
    INFORMES_PATH,
    LABORATORIO_PATH,
    CLINICAS_PATH,
    PRECIOS_PATH,
    CONTACTO_PATH,
    PROFESIONALES_PATH,
  ];

  for (const pagePath of pagePaths) {
    const source = read(pagePath);

    if (!source.includes('type="application/ld+json"')) {
      continue;
    }

    assert.ok(
      source.includes("JSON.stringify("),
      `${pagePath}: JSON-LD script must use JSON.stringify for safe serialization`,
    );
    assert.equal(
      source.includes("__html: `{"),
      false,
      `${pagePath}: JSON-LD must not use template literal string interpolation`,
    );
  }
});

// ─── Sin datos inventados ni placeholders en seo.ts ──────────────────────────

test("seo.ts does not contain placeholder, localhost or internal domain references", () => {
  const source = read(SEO_PATH);

  const forbidden = [
    "localhost",
    "example.com",
    "TODO",
    "FIXME",
    "placeholder",
    "your-domain",
    "yoursite",
  ];

  for (const term of forbidden) {
    assert.equal(
      source.toLowerCase().includes(term.toLowerCase()),
      false,
      `seo.ts must not contain: ${term}`,
    );
  }
});

test("seo.ts canonical URL defaults to production domain, not localhost", () => {
  const source = read(SEO_PATH);

  assert.ok(
    source.includes('"https://portal.vetneb.com"'),
    "seo.ts must default to production canonical URL",
  );
  assert.equal(
    source.includes("localhost"),
    false,
    "seo.ts must not contain localhost as canonical URL",
  );
});

// ─── BreadcrumbList en helpers de servicios y nuevas páginas ─────────────────

test("seo.ts JSON-LD helpers emit BreadcrumbList for service and informational pages", () => {
  const source = read(SEO_PATH);

  const helpersWithBreadcrumb = [
    "getDiagnosticServiceJsonLd",
    "getProfessionalsPageJsonLd",
    "getContactPageJsonLd",
    "getClinicasPageJsonLd",
    "getPreciosPageJsonLd",
  ];

  for (const helper of helpersWithBreadcrumb) {
    const helperStart = source.indexOf(`export function ${helper}`);
    const helperEnd = source.indexOf("\nexport function", helperStart + 1);
    const helperBody = helperEnd > -1
      ? source.slice(helperStart, helperEnd)
      : source.slice(helperStart);

    assert.ok(
      helperBody.includes('"@type": "BreadcrumbList"'),
      `${helper} must emit BreadcrumbList`,
    );
  }
});

// ─── Canonical URL en todas las páginas públicas indexables ──────────────────

test("all public indexable pages declare canonical via createPageMetadata or generateMetadata", () => {
  const indexablePages = [
    { path: HOME_PATH, name: "home" },
    { path: SERVICIOS_PATH, name: "servicios" },
    { path: CITOLOGIA_PATH, name: "citologia" },
    { path: HISTOPAT_PATH, name: "histopatologia" },
    { path: INFORMES_PATH, name: "informes" },
    { path: LABORATORIO_PATH, name: "laboratorio" },
    { path: CLINICAS_PATH, name: "clinicas" },
    { path: PRECIOS_PATH, name: "precios" },
    { path: CONTACTO_PATH, name: "contacto" },
    { path: PROFESIONALES_PATH, name: "profesionales" },
  ];

  for (const page of indexablePages) {
    const source = read(page.path);

    const hasMetadataHelper =
      source.includes("createPageMetadata(") ||
      source.includes("generateMetadata(");

    assert.ok(
      hasMetadataHelper,
      `${page.name} page must use createPageMetadata or generateMetadata for canonical URL`,
    );
  }
});

// ─── Páginas privadas no aparecen en sitemap ──────────────────────────────────

test("dashboard routes are never referenced in sitemap", () => {
  const source = read(SITEMAP_PATH);

  const dashboardPaths = [
    "/dashboard",
    "/dashboard/informes",
    "/dashboard/logistica",
    "/dashboard/admin",
  ];

  for (const path of dashboardPaths) {
    assert.equal(
      source.includes(path),
      false,
      `sitemap must not include dashboard path: ${path}`,
    );
  }
});

// ─── Descripción de precios mejorada ─────────────────────────────────────────

test("precios page title is descriptive and keyword-rich", () => {
  const source = read(PRECIOS_PATH);

  assert.equal(
    source.includes('"Lista de precios"'),
    false,
    "precios title must not be the generic 'Lista de precios' — use a descriptive keyword-rich title",
  );
  assert.ok(
    source.includes("Veterinario") || source.includes("Veterinaria") || source.includes("Patológico"),
    "precios title must include veterinary/pathology keyword",
  );
});
