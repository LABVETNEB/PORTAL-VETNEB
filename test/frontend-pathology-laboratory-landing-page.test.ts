import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PATHOLOGY_LAB_PAGE_PATH =
  "frontend/src/app/laboratorio-patologico-veterinario/page.tsx";
const SERVICES_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const SITEMAP_PATH = "frontend/src/app/sitemap.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("veterinary pathology laboratory landing page exists", () => {
  assert.equal(existsSync(resolve(process.cwd(), PATHOLOGY_LAB_PAGE_PATH)), true);
});

test("veterinary pathology laboratory landing page targets laboratory service intent", () => {
  const source = read(PATHOLOGY_LAB_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Laboratorio Patológico Veterinario | Anatomía Patológica Veterinaria"'));
  assert.ok(source.includes('"/laboratorio-patologico-veterinario"'));
  assert.ok(source.includes("Laboratorio patológico veterinario"));
  assert.ok(source.includes("Anatomía patológica veterinaria"));
  assert.ok(source.includes("histopatología"));
  assert.ok(source.includes("citología"));
  assert.ok(source.includes("tinciones especiales"));
  assert.ok(source.includes("hematología"));
  assert.ok(source.includes("hemoparásitos"));
  assert.ok(source.includes("criterio clínico-patológico"));
});

test("veterinary pathology laboratory landing page uses centralized diagnostic service JSON-LD", () => {
  const source = read(PATHOLOGY_LAB_PAGE_PATH);

  assert.ok(source.includes("getDiagnosticServiceJsonLd"));
  assert.ok(source.includes("const jsonLd = getDiagnosticServiceJsonLd({"));
  assert.ok(source.includes('path: "/laboratorio-patologico-veterinario"'));
  assert.ok(source.includes('name: "Laboratorio patológico veterinario"'));
  assert.ok(source.includes('serviceType: "Laboratorio de anatomía patológica veterinaria"'));
  assert.ok(source.includes("knowsAbout: ["));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(
    source.includes(
      "dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}",
    ),
  );
});

test("veterinary pathology laboratory landing page keeps public diagnostic navigation", () => {
  const source = read(PATHOLOGY_LAB_PAGE_PATH);

  assert.ok(source.includes('href="/contacto"'));
  assert.ok(source.includes("Solicitar coordinación diagnóstica"));
  assert.ok(source.includes('href="/servicios"'));
  assert.ok(source.includes("VER MAS SERVICIOS"));
  assert.ok(source.includes('href="/servicios"'));
});

test("veterinary pathology laboratory landing page is included in sitemap", () => {
  const source = read(SITEMAP_PATH);

  assert.ok(
    source.includes(
      "url: `${SITE_URL}/laboratorio-patologico-veterinario`,",
    ),
  );
  assert.ok(source.includes("priority: 0.89,"));
  assert.equal(source.includes("/dashboard"), false);
  assert.equal(source.includes("/api"), false);
});

test("services page links to veterinary pathology laboratory landing page", () => {
  const source = read(SERVICES_PAGE_PATH);

  assert.ok(source.includes('href="/laboratorio-patologico-veterinario"'));
  assert.ok(source.includes("Ver laboratorio patológico veterinario"));
});

test("veterinary pathology laboratory landing page remains public and verifiable", () => {
  const source = read(PATHOLOGY_LAB_PAGE_PATH);

  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("AggregateRating"), false);
  assert.equal(source.includes('"@type": "Review"'), false);
  assert.equal(source.includes("openingHours"), false);
  assert.equal(source.includes("GeoCoordinates"), false);
  assert.equal(source.includes("PostalAddress"), false);
  assert.equal(source.includes("from \"gsap\""), false);
  assert.equal(source.includes("from 'gsap'"), false);
});

test("veterinary pathology laboratory related services card links to public services", () => {
  const source = read(PATHOLOGY_LAB_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="pathology-lab-related-heading"'));
  assert.ok(source.includes('href="/servicios"'));
  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("Ver citología veterinaria"));
  assert.ok(source.includes("Ver servicio patológico veterinario"));
  assert.ok(source.includes('<span aria-hidden="true">Ver más</span>'));
  assert.ok(source.includes("group-hover:bg-sky-50"));
  assert.ok(source.includes("group-hover:border-sky-300"));
  assert.ok(source.includes("group-hover:shadow-xl"));
  assert.equal(
    source.includes("text-sm font-semibold text-primary underline underline-offset-4 hover:text-vetneb-teal"),
    false,
  );
});
