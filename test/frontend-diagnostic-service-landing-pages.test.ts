import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HISTOPATHOLOGY_PAGE_PATH =
  "frontend/src/app/histopatologia-veterinaria/page.tsx";
const CYTOLOGY_PAGE_PATH =
  "frontend/src/app/citologia-veterinaria/page.tsx";
const SERVICES_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const SEO_PATH = "frontend/src/lib/seo.ts";
const SITEMAP_PATH = "frontend/src/app/sitemap.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("diagnostic service landing pages exist", () => {
  assert.equal(existsSync(resolve(process.cwd(), HISTOPATHOLOGY_PAGE_PATH)), true);
  assert.equal(existsSync(resolve(process.cwd(), CYTOLOGY_PAGE_PATH)), true);
});

test("histopathology landing page targets transactional veterinary service intent", () => {
  const source = read(HISTOPATHOLOGY_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Histopatología Veterinaria | Servicio Histopatológico Veterinario"'));
  assert.ok(source.includes('"/histopatologia-veterinaria"'));
  assert.ok(source.includes("Histopatología veterinaria"));
  assert.ok(source.includes("Servicio histopatológico veterinario"));
  assert.ok(source.includes("estudio anatomopatológico"));
  assert.ok(source.includes("biopsias"));
  assert.ok(source.includes("criterio clínico-patológico"));
  assert.ok(source.includes("const jsonLd = getDiagnosticServiceJsonLd({"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(source.includes('href="/servicios"'));
  assert.ok(source.includes("VER MAS SERVICIOS"));
  assert.ok(source.includes('href="/contacto"'));
});

test("cytology landing page targets transactional veterinary service intent", () => {
  const source = read(CYTOLOGY_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Citología Veterinaria | Servicio Citológico y Citopatológico Veterinario"'));
  assert.ok(source.includes('"/citologia-veterinaria"'));
  assert.ok(source.includes("Citología veterinaria"));
  assert.ok(source.includes("Servicio citológico veterinario"));
  assert.ok(source.includes("citopatología veterinaria"));
  assert.ok(source.includes("diagnóstico citológico veterinario"));
  assert.ok(source.includes("criterio clínico-patológico"));
  assert.ok(source.includes("const jsonLd = getDiagnosticServiceJsonLd({"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(source.includes('href="/servicios"'));
  assert.ok(source.includes("VER MAS SERVICIOS"));
  assert.ok(source.includes('href="/contacto"'));
});

test("diagnostic service structured data is centralized and verifiable", () => {
  const source = read(SEO_PATH);

  assert.ok(source.includes("export type DiagnosticServiceJsonLdInput = {"));
  assert.ok(source.includes("export function getDiagnosticServiceJsonLd({"));
  assert.ok(source.includes('"@type": "BreadcrumbList"'));
  assert.ok(source.includes('"@type": "Service"'));
  assert.ok(source.includes("serviceType"));
  assert.ok(source.includes("areaServed"));
  assert.ok(source.includes('"@type": "Country"'));
  assert.ok(source.includes('name: "Argentina"'));
  assert.ok(source.includes('"@id": organizationId'));
  assert.ok(source.includes('"@id": websiteId'));
  assert.ok(source.includes('"@id": breadcrumbId'));
});

test("diagnostic service landing pages are included in sitemap", () => {
  const source = read(SITEMAP_PATH);

  assert.ok(source.includes("url: `${SITE_URL}/histopatologia-veterinaria`,"));
  assert.ok(source.includes("url: `${SITE_URL}/citologia-veterinaria`,"));
  assert.ok(source.includes("priority: 0.88,"));
});

test("services page links to transactional diagnostic landing pages", () => {
  const source = read(SERVICES_PAGE_PATH);

  assert.ok(source.includes('href="/histopatologia-veterinaria"'));
  assert.ok(source.includes("Ver histopatología veterinaria"));
  assert.ok(source.includes('href="/citologia-veterinaria"'));
  assert.ok(source.includes("Ver citología veterinaria"));
});

test("diagnostic service pages remain public and avoid backend calls", () => {
  const combined = `${read(HISTOPATHOLOGY_PAGE_PATH)}\n${read(CYTOLOGY_PAGE_PATH)}`;

  assert.equal(combined.includes('"/dashboard"'), false);
  assert.equal(combined.includes('"/api"'), false);
  assert.equal(combined.includes("fetch("), false);
  assert.equal(combined.includes("AggregateRating"), false);
  assert.equal(combined.includes('"@type": "Review"'), false);
  assert.equal(combined.includes("openingHours"), false);
  assert.equal(combined.includes("GeoCoordinates"), false);
  assert.equal(combined.includes("PostalAddress"), false);
});
