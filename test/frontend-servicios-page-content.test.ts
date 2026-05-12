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
  assert.ok(source.includes('import Link from "next/link";'));
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
  assert.ok(source.includes("La anatomía patológica veterinaria estudia los motivos"));
  assert.ok(source.includes("desarrollo y las consecuencias de distintas enfermedades"));
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

  assert.ok(source.includes("Seguimos trabajando en mejorar"));
  assert.ok(source.includes('href={ROUTES.contacto}'));
  assert.ok(source.includes("Solicitar información"));
  assert.ok(source.includes('href={ROUTES.clinicas}'));
  assert.ok(source.includes("Ver solución para clínicas"));
  assert.ok(source.includes("Diagnóstico integral para medicina veterinaria"));
  assert.ok(source.includes("Para tener en cuenta"));
  assert.ok(source.includes("Valores que guían el servicio"));
  assert.ok(source.includes("veterinario confiable"));
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

