import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PATH = "frontend/src/app/page.tsx";
const CLINICAS_PATH = "frontend/src/app/clinicas/page.tsx";
const SERVICIOS_PATH = "frontend/src/app/servicios/page.tsx";
const PRECIOS_CONTENT_PATH = "frontend/src/components/public/PreciosContent.tsx";
const REPORT_PREVIEW_COMPONENT_PATH =
  "frontend/src/components/public/ReportPreviewCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ─── ReportPreviewCard — eliminado en PR-15 ────────────────────────────────

test("ReportPreviewCard component file does not exist (removed in PR-15)", () => {
  const exists = existsSync(
    resolve(process.cwd(), REPORT_PREVIEW_COMPONENT_PATH),
  );
  assert.equal(
    exists,
    false,
    "ReportPreviewCard.tsx must not exist after PR-15 removal",
  );
});

// ─── Scope guards — ninguna página pública puede referenciar el componente ─

test("home page does not reference ReportPreviewCard", () => {
  const source = read(HOME_PATH);
  assert.equal(
    source.includes("ReportPreviewCard"),
    false,
    "home page must not reference ReportPreviewCard",
  );
});

test("clinicas page does not reference ReportPreviewCard", () => {
  const source = read(CLINICAS_PATH);
  assert.equal(
    source.includes("ReportPreviewCard"),
    false,
    "clinicas page must not reference ReportPreviewCard",
  );
});

test("servicios page does not reference ReportPreviewCard", () => {
  const source = read(SERVICIOS_PATH);
  assert.equal(
    source.includes("ReportPreviewCard"),
    false,
    "servicios page must not reference ReportPreviewCard",
  );
});

test("precios content does not reference ReportPreviewCard", () => {
  const source = read(PRECIOS_CONTENT_PATH);
  assert.equal(
    source.includes("ReportPreviewCard"),
    false,
    "precios content must not reference ReportPreviewCard",
  );
});

// ─── No IDs ni headings demo en páginas públicas ──────────────────────────

test("home page does not render report-preview-heading or demo disclaimer", () => {
  const source = read(HOME_PATH);
  assert.equal(source.includes('id="report-preview-heading"'), false);
  assert.equal(source.includes("Ejemplo visual sin datos reales"), false);
  assert.equal(source.includes("DEMOSTRATIVO"), false);
  assert.equal(source.includes("DEMO-000"), false);
  assert.equal(source.includes("Paciente demostrativo"), false);
});

test("clinicas page does not render clinicas-report-preview-heading or demo content", () => {
  const source = read(CLINICAS_PATH);
  assert.equal(source.includes('id="clinicas-report-preview-heading"'), false);
  assert.equal(source.includes("DEMOSTRATIVO"), false);
  assert.equal(source.includes("DEMO-000"), false);
  assert.equal(source.includes("DEMO-CLINICA"), false);
  assert.equal(source.includes("Paciente demostrativo"), false);
  assert.equal(source.includes("Clínica demostrativa"), false);
});

test("servicios page does not render demo or simulated content", () => {
  const source = read(SERVICIOS_PATH);
  assert.equal(source.includes("DEMOSTRATIVO"), false);
  assert.equal(source.includes("DEMO-000"), false);
  assert.equal(source.includes("Paciente demostrativo"), false);
  assert.equal(source.includes("Ejemplo visual sin datos reales"), false);
  assert.equal(source.includes("report-preview-card-title"), false);
});

test("precios content does not render demo or simulated content", () => {
  const source = read(PRECIOS_CONTENT_PATH);
  assert.equal(source.includes("DEMOSTRATIVO"), false);
  assert.equal(source.includes("DEMO-000"), false);
  assert.equal(source.includes("Ejemplo visual sin datos reales"), false);
});

// ─── Contenido preservado — PR-10, PR-12, PR-14 ───────────────────────────

test("home page preserves hero CTAs from PR-10", () => {
  const source = read(HOME_PATH);
  assert.ok(source.includes("Acceder al portal"));
  assert.ok(source.includes("Seguir con código"));
  assert.ok(source.includes("Dr. Nicolás E. Barbé"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("href={ROUTES.particulares}"));
});

test("home page preserves service bento from PR-12", () => {
  const source = read(HOME_PATH);
  assert.ok(source.includes("Estudio Anatomopatológico"));
  assert.ok(source.includes("Servicio principal"));
  assert.ok(source.includes('aria-labelledby="services-heading"'));
});

test("home page preserves specimen journey from PR-12", () => {
  const source = read(HOME_PATH);
  assert.ok(source.includes('aria-labelledby="specimen-journey-heading"'));
  assert.ok(source.includes("<SpecimenJourneySection"));
});

test("clinicas page has B2B operations section heading", () => {
  const source = read(CLINICAS_PATH);
  assert.ok(source.includes('id="clinicas-operations-heading"'));
  assert.ok(source.includes("Cómo opera tu clínica con VETNEB"));
});

test("clinicas page imports ClinicOperationsSection component", () => {
  const source = read(CLINICAS_PATH);
  assert.ok(
    source.includes('from "@/components/public/ClinicOperationsSection"'),
  );
  assert.ok(source.includes("ClinicOperationsSection"));
});

test("clinicas page operations steps cover derivación and trazabilidad", () => {
  const source = read(CLINICAS_PATH);
  assert.ok(source.includes("Coordinás la derivación"));
  assert.ok(source.includes("VETNEB registra la recepción"));
  assert.ok(source.includes("Tu clínica recibe el informe digital"));
  assert.ok(source.includes("trazabilidad"));
});

test("clinicas page has B2B conversion CTA band pointing to contacto", () => {
  const source = read(CLINICAS_PATH);
  assert.ok(source.includes('id="clinicas-conversion-heading"'));
  assert.ok(source.includes("Coordiná una derivación"));
  assert.ok(source.includes("Consultar alta de clínica"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
});

test("clinicas page preserves features heading and feature cards", () => {
  const source = read(CLINICAS_PATH);
  assert.ok(source.includes('aria-labelledby="clinicas-features-heading"'));
  assert.ok(source.includes("Recepción de informes"));
  assert.ok(source.includes("Acceso seguro y auditado"));
});

test("clinicas page preserves onboarding section", () => {
  const source = read(CLINICAS_PATH);
  assert.ok(source.includes('aria-labelledby="clinicas-onboarding-heading"'));
  assert.ok(source.includes("Cómo comenzar"));
});

test("clinicas page operations section is placed after features and before onboarding", () => {
  const source = read(CLINICAS_PATH);
  const featuresIndex = source.indexOf('aria-labelledby="clinicas-features-heading"');
  const opsIndex = source.indexOf('aria-labelledby="clinicas-operations-heading"');
  const onboardingIndex = source.indexOf('aria-labelledby="clinicas-onboarding-heading"');

  assert.ok(featuresIndex !== -1, "clinicas-features-heading must exist");
  assert.ok(opsIndex !== -1, "clinicas-operations-heading must exist");
  assert.ok(onboardingIndex !== -1, "clinicas-onboarding-heading must exist");
  assert.ok(featuresIndex < opsIndex, "operations section must come after features");
  assert.ok(opsIndex < onboardingIndex, "operations section must come before onboarding");
});
