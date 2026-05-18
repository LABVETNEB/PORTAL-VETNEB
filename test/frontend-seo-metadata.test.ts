import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ROOT_LAYOUT_PATH = "frontend/src/app/layout.tsx";
const SEO_PATH = "frontend/src/lib/seo.ts";
const ROBOTS_PATH = "frontend/src/app/robots.ts";
const SITEMAP_PATH = "frontend/src/app/sitemap.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend root layout wires base metadata and organization JSON-LD", () => {
  const source = read(ROOT_LAYOUT_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(
    source.includes(
      'import { baseMetadata, getOrganizationJsonLd } from "@/lib/seo";',
    ),
  );
  assert.ok(source.includes("export const metadata: Metadata = baseMetadata;"));
  assert.ok(source.includes("const orgJsonLd = getOrganizationJsonLd();"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(
    source.includes(
      "dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}",
    ),
  );
  assert.ok(source.includes('<html lang="es"'));
});

test("frontend SEO base metadata defines canonical brand and indexable robots", () => {
  const source = read(SEO_PATH);

  assert.ok(source.includes('export const SITE_NAME = "Portal VETNEB";'));
  assert.ok(
    source.includes('process.env.NEXT_PUBLIC_SITE_URL ?? "https://portal.vetneb.com"'),
  );
  assert.ok(source.includes(").replace(/\\/+$/, \"\");"));
  assert.ok(source.includes('export const SITE_LOCALE = "es_AR";'));
  assert.ok(source.includes("export const baseMetadata: Metadata = {"));
  assert.ok(source.includes("metadataBase: new URL(SITE_URL),"));
  assert.ok(source.includes("applicationName: SITE_NAME,"));
  assert.ok(source.includes("template: `%s | ${SITE_NAME}`,"));
  assert.ok(source.includes("index: true,"));
  assert.ok(source.includes("follow: true,"));
  assert.ok(source.includes('"max-image-preview": "large",'));
});

test("frontend SEO metadata exposes Open Graph and Twitter cards", () => {
  const source = read(SEO_PATH);

  assert.ok(source.includes("export const SITE_OG_IMAGE_PATH ="));
  assert.ok(source.includes("export const SITE_OG_IMAGE_URL ="));
  assert.ok(source.includes("openGraph: {"));
  assert.ok(source.includes('type: "website",'));
  assert.ok(source.includes("locale: SITE_LOCALE,"));
  assert.ok(source.includes("siteName: SITE_NAME,"));
  assert.ok(source.includes("url: SITE_OG_IMAGE_URL,"));
  assert.ok(source.includes("twitter: {"));
  assert.ok(source.includes('card: "summary_large_image",'));
  assert.ok(source.includes("images: [SITE_OG_IMAGE_URL],"));
  assert.ok(source.includes("alternates: {"));
  assert.ok(source.includes("canonical: SITE_URL,"));
});

test("frontend SEO helpers create page metadata and organization JSON-LD graph", () => {
  const source = read(SEO_PATH);

  assert.ok(source.includes("export function buildCanonicalUrl(path: string): string {"));
  assert.ok(source.includes("const canonicalUrl = buildCanonicalUrl(path);"));
  assert.ok(source.includes("canonical: canonicalUrl,"));
  assert.ok(source.includes("export function getOrganizationJsonLd()"));
  assert.ok(source.includes('"@context": "https://schema.org"'));
  assert.ok(source.includes('"@graph": ['));
  assert.ok(source.includes('"@type": "Organization"'));
  assert.ok(source.includes('"@type": "WebSite"'));
  assert.ok(source.includes("knowsAbout: ["));
  assert.ok(source.includes('"@type": "Service"'));
  assert.ok(source.includes("hasOfferCatalog: {"));
  assert.equal(source.includes("AggregateRating"), false);
  assert.equal(source.includes('"@type": "Review"'), false);
});

test("frontend robots allows public institutional pages and blocks private/API surfaces", () => {
  const source = read(ROBOTS_PATH);

  assert.ok(source.includes('import { SITE_URL } from "@/lib/seo";'));
  assert.ok(source.includes('userAgent: "*"'));
  assert.ok(source.includes('"/servicios"'));
  assert.ok(source.includes('"/clinicas"'));
  assert.ok(source.includes('"/profesionales"'));
  assert.ok(source.includes('"/contacto"'));
  assert.ok(source.includes('"/precios"'));
  assert.ok(source.includes('disallow: ["/dashboard", "/api"]'));
  assert.ok(source.includes("sitemap: `${SITE_URL}/sitemap.xml`,"));
});

test("frontend sitemap lists public indexable pages only", () => {
  const source = read(SITEMAP_PATH);

  assert.ok(source.includes('import { SITE_URL } from "@/lib/seo";'));
  assert.ok(source.includes("const now = new Date();"));
  assert.ok(source.includes("url: SITE_URL,"));
  assert.ok(source.includes("url: `${SITE_URL}/servicios`,"));
  assert.ok(source.includes("url: `${SITE_URL}/clinicas`,"));
  assert.ok(source.includes("url: `${SITE_URL}/profesionales`,"));
  assert.ok(source.includes("url: `${SITE_URL}/contacto`,"));
  assert.ok(source.includes("url: `${SITE_URL}/precios`,"));
  assert.equal(source.includes("/dashboard"), false);
  assert.equal(source.includes("/api"), false);
  assert.equal(source.includes("/login"), false);
  assert.equal(source.includes("/particulares"), false);
});
