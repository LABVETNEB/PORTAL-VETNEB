import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PATH = "frontend/src/app/page.tsx";
const CLINICAS_PATH = "frontend/src/app/clinicas/page.tsx";
const REPORT_PREVIEW_COMPONENT_PATH =
  "frontend/src/components/public/ReportPreviewCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ─── ReportPreviewCard component (file kept, not rendered publicly) ───────────

test("ReportPreviewCard component exports a named ReportPreviewCard function", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes("export function ReportPreviewCard("));
});

test("ReportPreviewCard renders banner with DEMOSTRATIVO label", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes("Demostrativo"));
  assert.ok(source.includes("Muestra"));
  assert.ok(source.includes("Ejemplo visual sin datos reales"));
});

test("ReportPreviewCard uses role=note for the demo banner", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes('role="note"'));
  assert.ok(
    source.includes("Este es un informe de muestra demostrativo, no es un informe real"),
  );
});

test("ReportPreviewCard uses fictitious data — DEMO-000 code", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes("DEMO-000"));
  assert.ok(source.includes("Paciente demostrativo"));
  assert.ok(source.includes("Canino demostrativo"));
  assert.ok(source.includes("Tejido remitido para evaluación"));
});

test("ReportPreviewCard does not contain real personal data patterns", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.equal(/@[\w.-]+\.[a-z]{2,}/i.test(source), false, "must not contain email patterns");
  assert.equal(/\b\d{7,8}\b/.test(source), false, "must not contain DNI-like numbers");
  assert.equal(/\+54\s?\d/.test(source), false, "must not contain phone numbers");
});

test("ReportPreviewCard contains all required diagnostic sections", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes("Macroscopía"));
  assert.ok(source.includes("Microscopía"));
  assert.ok(source.includes("Diagnóstico"));
  assert.ok(source.includes("Comentario"));
  assert.ok(source.includes("Acceso digital"));
  assert.ok(source.includes("Trazabilidad"));
});

test("ReportPreviewCard has accessible heading via report-preview-card-title id", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes('id="report-preview-card-title"'));
  assert.ok(source.includes('aria-labelledby="report-preview-card-title"'));
  assert.ok(source.includes("Informe Anatomopatológico"));
});

test("ReportPreviewCard uses clinical-card-header class for report header", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes("clinical-card-header"));
});

test("ReportPreviewCard does not import gsap or add animations", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.equal(source.includes("gsap"), false);
  assert.equal(source.includes("framer-motion"), false);
});

test("ReportPreviewCard does not open private routes", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("/dashboard"), false);
  assert.equal(source.includes("signed"), false);
});

test("ReportPreviewCard renders digital access chips — portal and tutor", () => {
  const source = read(REPORT_PREVIEW_COMPONENT_PATH);

  assert.ok(source.includes("Disponible en portal clínica"));
  assert.ok(source.includes("Acceso tutor por código privado"));
});

// ─── Home page — no public demo content (PR-14 correction) ───────────────────

test("home page does not import ReportPreviewCard (PR-14 correction)", () => {
  const source = read(HOME_PATH);

  assert.equal(
    source.includes('from "@/components/public/ReportPreviewCard"'),
    false,
    "home page must not import ReportPreviewCard after PR-14",
  );
});

test("home page does not render report-preview-heading (PR-14 correction)", () => {
  const source = read(HOME_PATH);

  assert.equal(
    source.includes('id="report-preview-heading"'),
    false,
    "home page must not have report-preview-heading after PR-14",
  );
  assert.equal(
    source.includes("Ejemplo visual sin datos reales"),
    false,
    "home page must not display fictitious data disclaimer after PR-14",
  );
});

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

// ─── Clínicas page — B2B operations landing (PR-14) ──────────────────────────

test("clinicas page does not import ReportPreviewCard (PR-14 correction)", () => {
  const source = read(CLINICAS_PATH);

  assert.equal(
    source.includes('from "@/components/public/ReportPreviewCard"'),
    false,
    "clinicas page must not import ReportPreviewCard after PR-14",
  );
});

test("clinicas page does not render clinicas-report-preview-heading (PR-14 correction)", () => {
  const source = read(CLINICAS_PATH);

  assert.equal(
    source.includes('id="clinicas-report-preview-heading"'),
    false,
    "clinicas page must not have clinicas-report-preview-heading after PR-14",
  );
});

test("clinicas page has B2B operations section heading", () => {
  const source = read(CLINICAS_PATH);

  assert.ok(source.includes('id="clinicas-operations-heading"'));
  assert.ok(source.includes("Cómo opera tu clínica con VETNEB"));
});

test("clinicas page imports ClinicOperationsSection component", () => {
  const source = read(CLINICAS_PATH);

  assert.ok(source.includes('from "@/components/public/ClinicOperationsSection"'));
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
  assert.ok(
    featuresIndex < opsIndex,
    "operations section must come after features",
  );
  assert.ok(
    opsIndex < onboardingIndex,
    "operations section must come before onboarding",
  );
});
