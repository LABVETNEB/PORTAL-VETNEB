import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PAGE_PATH = "frontend/src/app/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("home page defines public metadata and organization JSON-LD", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { createPageMetadata, getOrganizationJsonLd, SITE_URL } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Portal VETNEB — Laboratorio Patológico Veterinario"'));
  assert.ok(source.includes('"/"'));
  assert.ok(source.includes("const jsonLd = getOrganizationJsonLd();"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(source.includes("dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}"));
});

test("home page exposes accessible hero and primary CTAs", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="hero-heading"'));
  assert.ok(source.includes('id="hero-heading"'));
  assert.ok(source.includes('src="/images/hero-microscope-vetneb.webp"'));
  assert.ok(source.includes('import Image from "next/image";'));
  assert.ok(source.includes("SERVICIO PATOLÓGICO VETNEB"));
  assert.ok(source.includes("VETNEB"));
  assert.ok(source.includes("Diagnóstico patológico veterinario con criterio clínico y"));
  assert.ok(source.includes("trazabilidad integral"));
  assert.ok(source.includes("Dr. BARBÉ, NICOLÁS E."));
  assert.ok(source.includes("Acceder a informes y trazabilidad"));
  assert.ok(source.includes("Consultá los resultados de sus informes las 24 hs."));
  assert.ok(source.includes("clinical-muted-band mt-7 w-fit max-w-full"));
  assert.equal(source.includes("inline-flex w-fit flex-col rounded-md border border-white/30"), false);
  assert.equal(source.includes("text-[0.62rem]"), false);
  assert.equal(source.includes("border-t border-white/35"), false);
  assert.equal(source.includes("premium-card p-6"), false);
  assert.ok(source.includes("Horario de atención Lunes a viernes de 8 a 17hs"));
  assert.ok(source.includes("Whatsapp: 3534138946"));
  assert.ok(source.includes('href="https://wa.me/5493534138946"'));
  assert.ok(source.includes('target="_blank"'));
  assert.ok(source.includes('rel="noopener noreferrer"'));
  assert.ok(source.includes('href={ROUTES.login}'));
});

test("home page lists core laboratory services and services route CTA", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('className="public-soft-canvas"'));
  assert.ok(source.includes('aria-labelledby="services-heading"'));
  assert.ok(source.includes('id="services-heading"'));
  assert.ok(source.includes('className="py-16 md:py-20"'));
  assert.ok(source.includes("Servicios del laboratorio patológico veterinario"));
  assert.ok(source.includes("Estudio Anatomopatológico"));
  assert.ok(source.includes("Estudio Citológico"));
  assert.ok(source.includes("Tinciones Especiales"));
  assert.ok(source.includes("Diagnóstico Integral"));
  assert.ok(source.includes('href={ROUTES.servicios}'));
  assert.ok(source.includes("Ver todos los servicios"));
});

test("home page lists benefits for clinics and professionals", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="benefits-heading"'));
  assert.ok(source.includes('id="benefits-heading"'));
  assert.ok(source.includes("Trabajo interdisciplinario y criterio diagnóstico"));
  assert.ok(source.includes("Diagnóstico integral"));
  assert.ok(source.includes("Para tener en cuenta"));
  assert.ok(source.includes("Articulamos el análisis con equipos de diagnóstico por imágenes"));
  assert.ok(source.includes("El análisis no es automatizado: requiere evaluación microscópica especializada"));
});

test("home page exposes final conversion CTA without private route metadata", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="cta-heading"'));
  assert.ok(source.includes('id="cta-heading"'));
  assert.ok(source.includes("Seguimos trabajando en mejorar"));
  assert.ok(source.includes("Ingresar al portal de informes"));
  assert.ok(source.includes("Coordinar muestras y consultas"));
  assert.ok(source.includes("clinical-primary-gradient clinical-primary-gradient-hover"));
  assert.ok(source.includes('variant="outline"'));
  assert.ok(source.includes("border-vetneb-line/90 bg-card/95"));
  assert.ok(source.includes("font-semibold text-vetneb-navy shadow-sm"));
  assert.ok(source.includes("hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised hover:text-vetneb-navy"));
  assert.equal(source.includes("bg-primary py-16 text-white md:py-20"), false);
  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
});
