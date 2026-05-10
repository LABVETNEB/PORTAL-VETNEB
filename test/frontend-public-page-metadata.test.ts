import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";
const CLINICAS_PAGE_PATH = "frontend/src/app/clinicas/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("servicios public page defines SEO metadata and services JSON-LD", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { createPageMetadata, getServicesJsonLd } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Servicio Patológico Veterinario: Histopatología, Citología y Hematología"'));
  assert.ok(source.includes('"/servicios"'));
  assert.ok(source.includes("const jsonLd = getServicesJsonLd();"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(source.includes("dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}"));
});

test("profesionales public page defines SEO metadata", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Red de Profesionales Veterinarios"'));
  assert.ok(source.includes('"Directorio y red de profesionales veterinarios en Portal VETNEB.'));
  assert.ok(source.includes('"/profesionales"'));
});

test("clinicas public page defines SEO metadata", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Portal para Clínicas Veterinarias"'));
  assert.ok(source.includes('"Acceso al portal de gestión para clínicas veterinarias.'));
  assert.ok(source.includes('"/clinicas"'));
});

test("public page metadata remains scoped to public routes", () => {
  const servicios = read(SERVICIOS_PAGE_PATH);
  const profesionales = read(PROFESIONALES_PAGE_PATH);
  const clinicas = read(CLINICAS_PAGE_PATH);

  const combined = [servicios, profesionales, clinicas].join("\n");

  assert.equal(combined.includes('"/dashboard"'), false);
  assert.equal(combined.includes('"/api"'), false);
  assert.equal(combined.includes('"/login"'), false);
});
