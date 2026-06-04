import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";
const PROFESIONALES_SEARCH_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const PROFESIONAL_DETAIL_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalDetailContent.tsx";
const PROFESIONALES_DETAIL_PAGE_PATH =
  "frontend/src/app/profesionales/[clinicId]/page.tsx";
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
  assert.ok(source.includes('import { createPageMetadata, getProfessionalsPageJsonLd } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Clínicas y Profesionales Verificados VETNEB"'));
  assert.ok(source.includes('"Clínicas y profesionales verificados que trabajan con VETNEB'));
  assert.ok(source.includes('"/profesionales"'));
  assert.ok(source.includes("<Suspense fallback={null}>"));
  assert.ok(source.includes("<ProfesionalesSearchContent />"));
});

test("profesionales search content renders verified network framing", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes("<PublicLayout>"));
  assert.ok(source.includes("Clínicas y profesionales verificados que trabajan con VETNEB."));
  assert.ok(source.includes("Cada ficha forma parte de una red vinculada al laboratorio"));
  assert.ok(source.includes("criterios operativos verificables"));
  assert.ok(source.includes("no por ranking"));
  assert.ok(source.includes("Consultar la red verificada"));
  assert.ok(source.includes("Ingrese texto libre, incluso una sola letra"));
  assert.ok(source.includes("para ubicar perfiles"));
  assert.ok(source.includes("institucionales dentro de la red VETNEB"));
  assert.ok(source.includes("Nombre, especialidad, localidad o dato operativo de la red"));
  assert.ok(source.includes('aria-label="Consulta de la red profesional"'));
  assert.ok(source.includes('type="search"'));
  assert.equal(source.includes("minLength"), false);
  assert.equal(source.includes("minlength"), false);
  assert.ok(source.includes('name="q"'));
  assert.equal(source.includes("Herramientas para el profesional"), false);
  assert.equal(source.includes("Especialidades atendidas"), false);
  assert.equal(source.includes("const benefits = ["), false);
  assert.equal(source.includes("const specialties = ["), false);
});

test("profesionales public copy avoids marketplace and commercial directory language", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const forbiddenVisibleCopy = [
    "marketplace",
    "directorio",
    "reviews",
    "reseñas",
    "estrellas",
    "telemedicina",
    "reservas online",
    "mejores veterinarios",
    "buscá veterinario",
    "busca veterinario",
    "anuncios",
    "publicidad paga",
    "destacados",
  ];

  for (const forbidden of forbiddenVisibleCopy) {
    assert.equal(
      source.toLowerCase().includes(forbidden),
      false,
      `copy visible de /profesionales no debe incluir ${forbidden}`,
    );
  }
});

test("profesionales search content uses free text query and approximate backend search helper", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const apiSource = read(API_PATH);

  assert.ok(source.includes("useSearchParams"));
  assert.ok(source.includes("router.push(`${ROUTES.profesionales}${params.size ? `?${params}` : \"\"}`)"));
  assert.ok(source.includes("searchPublicProfessionals("));
  assert.ok(source.includes("query: currentQuery"));
  assert.ok(source.includes("limit: PUBLIC_PROFESSIONALS_PAGE_SIZE"));
  assert.ok(source.includes('{ cache: "no-store" }'));
  assert.ok(source.includes("coincidencias por nombre"));
  assert.ok(source.includes("router.push(`${ROUTES.profesionales}${params.size ? `?${params}` : \"\"}`)"));
  assert.ok(apiSource.includes("export async function searchPublicProfessionals("));
  assert.ok(apiSource.includes("export async function getPublicProfessional("));
  assert.ok(apiSource.includes("q"));
  assert.ok(apiSource.includes("/api/public/professionals/search"));
  assert.ok(apiSource.includes("/api/public/professionals/${clinicId}"));
});

test("profesionales search content renders compact professional result cards", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);

  assert.ok(source.includes("state.professionals.map((professional) =>"));
  assert.ok(source.includes("professional.displayName"));
  assert.ok(source.includes("professional.avatarUrl"));
  assert.ok(source.includes("professional-avatar-fallback"));
  assert.ok(source.includes("getPublicProfessionalLocation(professional)"));
  assert.ok(source.includes("summarizePublicProfessional(professional)"));
  assert.ok(source.includes("isVerifiedPublicProfessional(professional)"));
  assert.ok(source.includes("buildProfessionalDetailHref("));
  assert.ok(source.includes("professional.clinicId"));
  assert.ok(source.includes("Abrir detalle del perfil"));
  assert.equal(/<a\b/.test(source), false);
  assert.equal(source.includes("professional.aboutText"), false);
  assert.equal(source.includes("professional.email"), false);
  assert.equal(source.includes("professional.phone"), false);
  assert.equal(source.includes("professional.publicAddress"), false);
  assert.equal(source.includes("professional.mapLink"), false);
  assert.equal(source.includes("email"), false);
  assert.equal(source.includes("teléfono"), false);
  assert.equal(source.includes("Dirección"), false);
  assert.equal(source.includes("<PublicExternalControl"), false);
  assert.equal(source.includes("mailto:${professional.email}"), false);
  assert.equal(source.includes("https://wa.me/549"), false);
});

test("profesionales detail route renders selected professional data", () => {
  const pageSource = read(PROFESIONALES_DETAIL_PAGE_PATH);
  const detailSource = read(PROFESIONAL_DETAIL_CONTENT_PATH);

  assert.ok(pageSource.includes("ProfesionalDetailContent"));
  assert.ok(pageSource.includes("<ProfesionalDetailContent clinicId={clinicId} />"));
  assert.ok(pageSource.includes("/profesionales/${encodeURIComponent(clinicId)}"));
  assert.ok(detailSource.includes("parsePublicProfessionalClinicId(clinicId)"));
  assert.ok(detailSource.includes("getPublicProfessional(parsedClinicId"));
  assert.ok(detailSource.includes("professional.displayName"));
  assert.ok(detailSource.includes("professional.aboutText"));
  assert.ok(detailSource.includes("professional.specialtyText"));
  assert.ok(detailSource.includes("professional.servicesText"));
  assert.ok(detailSource.includes("professional.publicAddress"));
  assert.ok(detailSource.includes("professional.mapLink"));
  assert.ok(detailSource.includes("mailto:${professional.email}"));
  assert.ok(detailSource.includes("buildWhatsAppHref(professional.phone)"));
  assert.ok(detailSource.includes("Ver ubicación en mapa"));
  assert.equal(/<a\b/.test(detailSource), false);
});

test("profesionales page remains public and avoids private route literals", () => {
  const pageSource = read(PROFESIONALES_PAGE_PATH);
  const contentSource = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const detailSource = read(PROFESIONAL_DETAIL_CONTENT_PATH);
  const combined = [pageSource, contentSource, detailSource].join("\n");
  const forbiddenPublicUiMarkers = [
    "storagePath",
    "signedUrl",
    "token",
    "cookie",
    "session",
    "service_role",
  ];

  assert.equal(combined.includes('"/dashboard"'), false);
  assert.equal(combined.includes("admin_session_id"), false);

  for (const marker of forbiddenPublicUiMarkers) {
    assert.equal(
      combined.includes(marker),
      false,
      `UI pública de profesionales no debe exponer ${marker}`,
    );
  }
});
