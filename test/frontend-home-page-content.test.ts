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
  assert.ok(source.includes("Diagnóstico patológico de"));
  assert.ok(source.includes("laboratorio veterinario"));
  assert.ok(source.includes("Portal centralizado para clínicas y profesionales veterinarios."));
  assert.ok(source.includes("histopatología"));
  assert.ok(source.includes("citología"));
  assert.ok(source.includes("citopatología"));
  assert.ok(source.includes("hematología"));
  assert.ok(source.includes("diagnóstico hematológico"));
  assert.ok(source.includes("hemoparásitos"));
  assert.ok(source.includes('href={ROUTES.login}'));
  assert.ok(source.includes("Acceder al portal"));
  assert.ok(source.includes('href={ROUTES.contacto}'));
  assert.ok(source.includes("Solicitar acceso"));
});

test("home page lists core laboratory services and services route CTA", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="services-heading"'));
  assert.ok(source.includes('id="services-heading"'));
  assert.ok(source.includes("Servicios del laboratorio patológico veterinario"));
  assert.ok(source.includes("Informes Médicos"));
  assert.ok(source.includes("Estudios Veterinarios"));
  assert.ok(source.includes("Gestión Digital"));
  assert.ok(source.includes("Logística Operativa"));
  assert.ok(source.includes('href={ROUTES.servicios}'));
  assert.ok(source.includes("Ver todos los servicios"));
});

test("home page lists benefits for clinics and professionals", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="benefits-heading"'));
  assert.ok(source.includes('id="benefits-heading"'));
  assert.ok(source.includes("Diseñado para el sector veterinario"));
  assert.ok(source.includes("Para clínicas veterinarias"));
  assert.ok(source.includes("Para profesionales"));
  assert.ok(source.includes("Acceso inmediato a resultados de estudios"));
  assert.ok(source.includes("Seguimiento de casos clínicos"));
});

test("home page exposes final conversion CTA without private route metadata", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="cta-heading"'));
  assert.ok(source.includes('id="cta-heading"'));
  assert.ok(source.includes("¿Listo para digitalizar su laboratorio?"));
  assert.ok(source.includes("Iniciar sesión"));
  assert.ok(source.includes("Contactar"));
  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
});
