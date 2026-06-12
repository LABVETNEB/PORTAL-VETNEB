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
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { createPageMetadata, getClinicasPageJsonLd } from "@/lib/seo";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Portal para Clínicas Veterinarias"'));
  assert.ok(source.includes('"/clinicas"'));
  assert.ok(source.includes("<PublicLayout>"));
});

test("clinicas page exposes hero content and primary CTAs", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("Portal para clínicas veterinarias"));
  assert.ok(source.includes("trazabilidad de muestras"));
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
  assert.ok(source.includes('variant="secondaryOutline"'));
});

test("clinicas page groups six capabilities into three product modules", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("const featureModules = ["));
  assert.ok(source.includes('id: "informes"'));
  assert.ok(source.includes('id: "operacion"'));
  assert.ok(source.includes('id: "gestion"'));
  assert.ok(source.includes("Recepción de informes"));
  assert.ok(source.includes("Búsqueda avanzada"));
  assert.ok(source.includes("Seguimiento de logística"));
  assert.ok(source.includes("Acceso seguro y auditado"));
  assert.ok(source.includes("Gestión de usuarios"));
  assert.ok(source.includes("Perfil público"));
  assert.ok(source.includes("featureModules.map((module, moduleIndex) =>"));
  assert.ok(source.includes("module.features.map((feature) =>"));
  assert.ok(source.includes("data-clinic-module={module.id}"));
});

test("clinicas page renders a connected five-step operational timeline", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("const operationSteps = ["));
  assert.ok(source.includes("operationSteps.map((step, index) =>"));
  assert.ok(source.includes("data-clinic-op-step={step.step}"));
  assert.ok(source.includes('aria-label="Pasos operativos de derivación con VETNEB"'));
  assert.ok(source.includes("lg:grid-cols-5"));
  assert.ok(source.includes("Coordinás la derivación"));
  assert.ok(source.includes("Tu clínica recibe el informe digital"));
});

test("clinicas page renders onboarding as a connected four-step list", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes("const onboardingSteps = ["));
  assert.ok(source.includes("Solicitar acceso"));
  assert.ok(source.includes("Configurar la cuenta"));
  assert.ok(source.includes("Acceder a los informes"));
  assert.ok(source.includes("Gestionar la operación"));
  assert.ok(source.includes("Cómo comenzar"));
  assert.ok(source.includes("onboardingSteps.map((step, index) =>"));
  assert.ok(source.includes("data-clinic-onboarding-step={step.number}"));
  assert.ok(source.includes('aria-label="Pasos para comenzar con Portal VETNEB"'));
});

test("clinicas page remains public and avoids direct backend/API calls", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});
test("clinicas page does not contain demo or simulated content (PR-15 guard)", () => {
  const source = read(CLINICAS_PAGE_PATH);
  const demoTerms = [
    "MUESTRA",
    "DEMOSTRATIVO",
    "ejemplo visual",
    "sin datos reales",
    "caso demo",
    "DEMO-000",
    "DEMO-CLINICA-001",
    "Paciente demostrativo",
    "Clínica demostrativa",
    "preview de informe simulado",
    "panel operativo simulado",
    "dashboard ficticio",
    "informe inventado",
    "datos ficticios visibles",
    "mocks públicos falsos",
    "report-preview-card-title",
    "ReportPreviewCard",
  ];

  for (const term of demoTerms) {
    assert.equal(
      source.includes(term),
      false,
      `clinicas page must not contain "${term}"`,
    );
  }
});

test("clinicas page keeps one continuous soft canvas below hero", () => {
  const source = read(CLINICAS_PAGE_PATH);

  assert.ok(source.includes('className="public-soft-canvas"'));
  assert.ok(source.includes('className="py-16 md:py-20"'));
  assert.equal(source.includes('className="bg-white py-16 md:py-20"'), false);
  assert.equal(source.includes('className="public-soft-canvas py-16 md:py-20"'), false);
});
