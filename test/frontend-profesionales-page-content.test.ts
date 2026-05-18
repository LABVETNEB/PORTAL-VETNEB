import assert from "node:assert/strict";
import { Suspense } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";
const PROFESIONALES_SEARCH_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const API_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("profesionales page defines metadata and delegates to search content", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { ProfesionalesSearchContent } from "@/components/public/ProfesionalesSearchContent";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Red de Profesionales Veterinarios"'));
  assert.ok(source.includes('"Banco público de profesionales vinculados a VETNEB'));
  assert.ok(source.includes('"/profesionales"'));
  assert.ok(source.includes("<Suspense fallback={null}>"));
  assert.ok(source.includes("<ProfesionalesSearchContent />"));
});

test("profesionales search content renders only the professional bank search surface", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes("<PublicLayout>"));
  assert.ok(source.includes("Red de profesionales veterinarios"));
  assert.ok(source.includes("Banco público de profesionales"));
  assert.ok(source.includes("Buscar profesionales"));
  assert.ok(source.includes("Ingrese texto libre, incluso una sola letra"));
  assert.ok(source.includes("Buscar desde una letra: nombre, especialidad, localidad o dato asociado"));
  assert.ok(source.includes('aria-label="Buscador de profesionales"'));
  assert.ok(source.includes('type="search"'));
  assert.equal(source.includes("minLength"), false);
  assert.equal(source.includes("minlength"), false);
  assert.ok(source.includes('name="q"'));
  assert.ok(source.includes("Buscar desde una letra: nombre, especialidad, localidad o dato asociado"));
  assert.equal(source.includes("Herramientas para el profesional"), false);
  assert.equal(source.includes("Especialidades atendidas"), false);
  assert.equal(source.includes("const benefits = ["), false);
  assert.equal(source.includes("const specialties = ["), false);
});

test("profesionales search content uses free text query and approximate backend search helper", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const apiSource = read(API_PATH);

  assert.ok(source.includes("useSearchParams"));
  assert.ok(source.includes("router.push(`${ROUTES.profesionales}${params.size ? `?${params}` : \"\"}`)"));
  assert.ok(source.includes("searchPublicProfessionals("));
  assert.ok(source.includes("query: currentQuery"));
  assert.ok(source.includes("limit: 20"));
  assert.ok(source.includes('{ cache: "no-store" }'));
  assert.ok(source.includes("coincidencias por nombre"));
  assert.ok(apiSource.includes("export async function searchPublicProfessionals("));
  assert.ok(apiSource.includes("q"));
  assert.ok(apiSource.includes("/api/public/professionals/search"));
});

test("profesionales search content renders professional result cards", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);

  assert.ok(source.includes("state.professionals.map((professional) =>"));
  assert.ok(source.includes("professional.displayName"));
  assert.ok(source.includes("professional.specialtyText"));
  assert.ok(source.includes("professional.servicesText"));
  assert.ok(source.includes("professional.aboutText"));
  assert.ok(source.includes("professional.locality"));
  assert.ok(source.includes("professional.country"));
  assert.ok(source.includes("professional.publicAddress"));
  assert.ok(source.includes("professional.mapLink"));
  assert.ok(source.includes("Ver ubicación en mapa"));
  assert.ok(source.includes('target="_blank"'));
  assert.ok(source.includes('rel="noopener noreferrer"'));
  assert.ok(source.includes("mailto:${professional.email}"));
  assert.ok(source.includes("https://wa.me/549"));
});

test("profesionales page remains public and avoids private route literals", () => {
  const pageSource = read(PROFESIONALES_PAGE_PATH);
  const contentSource = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const combined = [pageSource, contentSource].join("\n");

  assert.equal(combined.includes('"/dashboard"'), false);
  assert.equal(combined.includes("admin_session_id"), false);
});
