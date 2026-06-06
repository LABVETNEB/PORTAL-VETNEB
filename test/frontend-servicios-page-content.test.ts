import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("servicios page defines metadata JSON-LD and public layout wiring", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { createPageMetadata, getServicesJsonLd } from "@/lib/seo";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Servicio Patológico Veterinario: Histopatología, Citología y Hematología"'));
  assert.ok(source.includes('"/servicios"'));
  assert.ok(source.includes("const jsonLd = getServicesJsonLd();"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(source.includes("<PublicLayout>"));
});

test("servicios page exposes hero content", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("Servicio patológico veterinario"));
  assert.ok(source.includes("La anatomía patológica veterinaria integra evaluación microscópica"));
  assert.ok(source.includes("trazabilidad de muestras e informes clínicos"));
});

test("servicios page lists laboratory service categories", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("const serviceCategories = ["));
  assert.ok(source.includes("Estudio anatomopatológico de tejidos"));
  assert.ok(source.includes("Estudio citológico de muestras"));
  assert.ok(source.includes("Tinciones especiales aplicadas"));
  assert.ok(source.includes("Diagnóstico integral interdisciplinario"));
  assert.ok(source.includes("Informes y seguimiento"));
  assert.ok(source.includes("serviceCategories.map((service) =>"));
});

test("servicios page keeps detailed service feature bullets", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("Recepción y procesamiento de muestras de tejidos"));
  assert.ok(source.includes("Estudio citológico de líquidos y punciones"));
  assert.ok(source.includes("Complemento de histopatología y citopatología"));
  assert.ok(source.includes("Interconsulta profesional cuando el caso lo requiere"));
  assert.ok(source.includes("Consulta de resultados de informes las 24 hs"));
  assert.ok(source.includes("Priorización según complejidad diagnóstica"));
});

test("servicios page exposes conversion CTAs and SEO copy", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("Coordinación diagnóstica para clínicas y profesionales"));
  assert.ok(source.includes('href={ROUTES.contacto}'));
  assert.ok(source.includes("Solicitar coordinación diagnóstica"));
  assert.ok(source.includes('href={ROUTES.clinicas}'));
  assert.ok(source.includes("Conocer solución para clínicas"));
  assert.ok(source.includes("Diagnóstico integral para medicina veterinaria"));
  assert.ok(source.includes("Para tener en cuenta"));
  assert.ok(source.includes("Valores que guían el servicio"));
  assert.ok(source.includes("veterinaria confiable"));
});

test("servicios page remains public and avoids direct backend/API calls", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});

test("servicios page keeps one continuous soft canvas through middle sections", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('className="public-soft-canvas"'));
  assert.ok(source.includes('className="py-16 md:py-20"'));
  assert.ok(source.includes('className="py-16"'));
  assert.equal(source.includes('className="bg-white py-16"'), false);
  assert.equal(source.includes('className="bg-blue-50 py-16"'), false);
  assert.equal(source.includes('className="bg-gray-50 py-16"'), false);
  assert.equal(source.includes('data-public-soft-canvas="true"'), false);
});

test("servicios page hides service link typography while keeping link semantics", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('href: "/laboratorio-patologico-veterinario"'));
  assert.ok(source.includes('href: "/histopatologia-veterinaria"'));
  assert.ok(source.includes('href: "/citologia-veterinaria"'));
  assert.ok(source.includes('href: "/informes-veterinarios"'));
  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("<span"));
  assert.ok(source.includes("{service.linkLabel}"));
  assert.ok(source.includes("hover:[&_.premium-card]:bg-vetneb-surface-muted/40"));
  assert.ok(source.includes("hover:[&_.premium-card]:border-vetneb-teal/48"));
  assert.ok(source.includes("hover:[&_.premium-card]:shadow-[0_22px_66px_rgba(15,45,62,0.145)]"));
  assert.equal(source.includes("group-hover:text-vetneb-teal"), false);
});

test("servicios page shows unified card CTA while preserving hidden SEO labels", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("<span aria-hidden=\"true\">Ver más</span>"));
  assert.ok(source.includes("{service.linkLabel}"));
  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("hover:[&_.premium-card]:bg-vetneb-surface-muted/40"));
  assert.ok(source.includes("hover:[&_.premium-card]:border-vetneb-teal/48"));
  assert.ok(source.includes("hover:[&_.premium-card]:shadow-[0_22px_66px_rgba(15,45,62,0.145)]"));
  assert.equal(source.includes("Ver laboratorio patológico veterinario</div>"), false);
  assert.equal(source.includes("Ver histopatología veterinaria</div>"), false);
  assert.equal(source.includes("Ver citología veterinaria</div>"), false);
  assert.equal(source.includes("Ver informes veterinarios</div>"), false);
});

test("servicios page card links are constrained to explicit CTAs not full card wrappers", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  // No Link wrapping the full card surface
  assert.equal(source.includes("group block h-full"), false);
  assert.equal(source.includes('"group block'), false);
  // No absolute overlay link trick
  assert.equal(source.includes("absolute inset-0"), false);
  // Explicit constrained CTA exists inside card
  assert.ok(source.includes("inline-flex w-fit"));
  assert.ok(source.includes("href={service.href}"));
});
