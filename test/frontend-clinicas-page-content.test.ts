import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CLINICAS_PAGE_PATH = "frontend/src/app/clinicas/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("clinicas page defines metadata and public layout wiring", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Portal para Clínicas Veterinarias"'));
  assert.ok(source.includes('"/clinicas"'));
  assert.ok(source.includes("<PublicLayout>"));
});

test("clinicas page exposes hero content and primary CTAs", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("Portal para clínicas veterinarias"));
  assert.ok(source.includes("Gestión centralizada de informes, estudios y logística"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("Acceder al portal"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("Solicitar acceso"));
});

test("clinicas page keeps hero CTAs visible on blue hero background", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("public-cta-primary"));
  assert.ok(source.includes("public-cta-on-hero"));
  assert.ok(source.includes("w-full sm:w-auto"));
  assert.ok(source.includes('variant="outline"'));
});

test("clinicas page lists operational feature cards", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("const features = ["));
  assert.ok(source.includes("Recepción de informes"));
  assert.ok(source.includes("Búsqueda avanzada"));
  assert.ok(source.includes("Seguimiento de logística"));
  assert.ok(source.includes("Acceso seguro y auditado"));
  assert.ok(source.includes("Gestión de usuarios"));
  assert.ok(source.includes("Perfil público"));
  assert.ok(source.includes("features.map((feature) =>"));
});

test("clinicas page explains onboarding steps", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("const steps = ["));
  assert.ok(source.includes("Solicite acceso"));
  assert.ok(source.includes("Configure su cuenta"));
  assert.ok(source.includes("Acceda a sus informes"));
  assert.ok(source.includes("Gestione su operación"));
  assert.ok(source.includes("Cómo comenzar"));
  assert.ok(source.includes("steps.map((step) =>"));
});

test("clinicas page remains public and avoids direct backend/API calls", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});
test("clinicas page keeps one continuous soft canvas below hero", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes('className="public-soft-canvas"'));
  assert.ok(source.includes('className="py-16 md:py-20"'));
  assert.equal(source.includes('className="bg-white py-16 md:py-20"'), false);
  assert.equal(source.includes('className="public-soft-canvas py-16 md:py-20"'), false);
});

