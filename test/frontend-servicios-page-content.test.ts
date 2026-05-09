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
  assert.ok(source.includes('"Servicios de Laboratorio Veterinario"'));
  assert.ok(source.includes('"/servicios"'));
  assert.ok(source.includes("const jsonLd = getServicesJsonLd();"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(source.includes("<PublicLayout>"));
});

test("servicios page exposes hero content", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("Servicios del laboratorio"));
  assert.ok(source.includes("Soluciones digitales completas para la gestión de diagnóstico"));
  assert.ok(source.includes("veterinario. Desde el estudio hasta la entrega del informe."));
});

test("servicios page lists laboratory service categories", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("const serviceCategories = ["));
  assert.ok(source.includes("Informes Médicos Veterinarios"));
  assert.ok(source.includes("Estudios Veterinarios"));
  assert.ok(source.includes("Gestión Digital de Clínicas"));
  assert.ok(source.includes("Logística Operativa"));
  assert.ok(source.includes("serviceCategories.map((service) =>"));
});

test("servicios page keeps detailed service feature bullets", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("Carga y procesamiento de estudios"));
  assert.ok(source.includes("Hemograma completo y diferencial"));
  assert.ok(source.includes("Dashboard privado por clínica"));
  assert.ok(source.includes("Planificación de rutas de entrega"));
  assert.ok(source.includes("Métricas de cumplimiento y SLA"));
});

test("servicios page exposes conversion CTAs and SEO copy", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("¿Necesitás digitalizar la gestión de estudios?"));
  assert.ok(source.includes('href={ROUTES.contacto}'));
  assert.ok(source.includes("Solicitar información"));
  assert.ok(source.includes('href={ROUTES.clinicas}'));
  assert.ok(source.includes("Ver solución para clínicas"));
  assert.ok(source.includes("Laboratorio veterinario digital en Argentina"));
});

test("servicios page remains public and avoids direct backend/API calls", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});
