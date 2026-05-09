import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("profesionales page defines metadata and public layout wiring", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Red de Profesionales Veterinarios"'));
  assert.ok(source.includes('"/profesionales"'));
  assert.ok(source.includes("<PublicLayout>"));
});

test("profesionales page exposes hero content", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes("Red de profesionales veterinarios"));
  assert.ok(source.includes("Herramientas digitales diseñadas para el profesional veterinario"));
  assert.ok(source.includes("portal."));
});

test("profesionales page lists professional benefits", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes("const benefits = ["));
  assert.ok(source.includes("Acceso seguro"));
  assert.ok(source.includes("Multiplataforma"));
  assert.ok(source.includes("Seguimiento de casos"));
  assert.ok(source.includes("Integración con clínicas"));
  assert.ok(source.includes("benefits.map((benefit) =>"));
});

test("profesionales page lists veterinary specialties", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes("const specialties = ["));
  assert.ok(source.includes("Clínica general"));
  assert.ok(source.includes("Cirugía"));
  assert.ok(source.includes("Diagnóstico por imagen"));
  assert.ok(source.includes("Laboratorio clínico"));
  assert.ok(source.includes("Medicina interna"));
  assert.ok(source.includes("specialties.map((specialty) =>"));
});

test("profesionales page exposes conversion CTAs and SEO copy", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes("¿Querés integrar tu práctica a Portal VETNEB?"));
  assert.ok(source.includes('href={ROUTES.contacto}'));
  assert.ok(source.includes("Contactar a VETNEB"));
  assert.ok(source.includes('href={ROUTES.clinicas}'));
  assert.ok(source.includes("Ver portal para clínicas"));
  assert.ok(source.includes("Portal veterinario para profesionales en Argentina"));
});

test("profesionales page remains public and avoids direct backend/API calls", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});
