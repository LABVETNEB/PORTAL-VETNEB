import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PATH = "frontend/src/app/servicios/page.tsx";
const SPECIMEN_JOURNEY_COMPONENT_PATH =
  "frontend/src/components/public/SpecimenJourneySection.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ─── SpecimenJourneySection component ────────────────────────────────────────

test("SpecimenJourneySection component exports a named SpecimenJourneySection function", () => {
  const source = read(SPECIMEN_JOURNEY_COMPONENT_PATH);

  assert.ok(source.includes("export function SpecimenJourneySection("));
  assert.ok(source.includes("export interface SpecimenStage {"));
  assert.ok(source.includes("stages: SpecimenStage[]"));
  assert.ok(source.includes("data-specimen-stage={stage.step}"));
});

test("SpecimenJourneySection renders ordered list with accessible label", () => {
  const source = read(SPECIMEN_JOURNEY_COMPONENT_PATH);

  assert.ok(source.includes("<ol"));
  assert.ok(source.includes('aria-label="Etapas del recorrido de la muestra"'));
  assert.ok(source.includes("<li"));
});

test("SpecimenJourneySection uses protocol-badge slot for optional protocol text", () => {
  const source = read(SPECIMEN_JOURNEY_COMPONENT_PATH);

  assert.ok(source.includes("stage.protocol &&"));
  assert.ok(source.includes("{stage.protocol}"));
});

test("SpecimenJourneySection supports timeline variant with grid default (PR-17)", () => {
  const source = read(SPECIMEN_JOURNEY_COMPONENT_PATH);

  assert.ok(source.includes('variant?: "grid" | "timeline"'));
  assert.ok(source.includes('variant = "grid"'));
  assert.ok(source.includes('if (variant === "timeline")'));
});

test("SpecimenJourneySection does not import gsap or add animations", () => {
  const source = read(SPECIMEN_JOURNEY_COMPONENT_PATH);

  assert.equal(source.includes("gsap"), false);
  assert.equal(source.includes("animation"), false);
  assert.equal(source.includes("transition"), false);
});

// ─── Home page — service bento ───────────────────────────────────────────────

test("home page service grid uses bento layout with featured anatomopatológico", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes("grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"));
  assert.ok(source.includes('isFeatured && "lg:col-span-2"'));
  assert.ok(source.includes('isWide && "lg:col-span-2"'));
  assert.ok(source.includes("Servicio principal"));
  assert.ok(source.includes('service.title === "Estudio Anatomopatológico"'));
});

test("home page bento preserves all four service titles", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes("Estudio Anatomopatológico"));
  assert.ok(source.includes("Estudio Citológico"));
  assert.ok(source.includes("Tinciones Especiales"));
  assert.ok(source.includes("Diagnóstico Integral"));
});

test("home page bento preserves services-heading contract", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes('aria-labelledby="services-heading"'));
  assert.ok(source.includes('id="services-heading"'));
  assert.ok(source.includes("Servicios del laboratorio patológico veterinario"));
  assert.ok(source.includes("Ver todos los servicios"));
  assert.ok(source.includes('href={ROUTES.servicios}'));
});

// ─── Home page — specimen journey section ────────────────────────────────────

test("home page has unified journey section with correct heading contract (PR-17)", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes('aria-labelledby="specimen-journey-heading"'));
  assert.ok(source.includes('id="specimen-journey-heading"'));
  assert.ok(source.includes("Recorrido de la muestra"));
  assert.ok(source.includes("Cómo funciona"));
  assert.ok(source.includes("asegurar la trazabilidad del diagnóstico."));
});

test("home page Specimen Journey uses SpecimenJourneySection timeline variant", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes('from "@/components/public/SpecimenJourneySection"'));
  assert.ok(source.includes("<SpecimenJourneySection"));
  assert.ok(source.includes("stages={specimenJourneyStages}"));
  assert.ok(source.includes('variant="timeline"'));
});

test("home page specimen journey stages contain all 5 required stages", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes('"Toma y fijación"'));
  assert.ok(source.includes('"Envío coordinado"'));
  assert.ok(source.includes('"Recepción y procesamiento"'));
  assert.ok(source.includes('"Evaluación diagnóstica"'));
  assert.ok(source.includes('"Informe digital y acceso"'));
});

test("home page specimen journey contains verified protocol data from FAQ", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes("formol al 10%"));
  assert.ok(source.includes("48–72 h"));
  assert.ok(source.includes("bolsa tipo ziploc"));
  assert.ok(source.includes("15 días hábiles"));
});

test("home page specimen journey section is placed before benefits section in source", () => {
  const source = read(HOME_PATH);

  const journeyIndex = source.indexOf('aria-labelledby="specimen-journey-heading"');
  const benefitsIndex = source.indexOf('aria-labelledby="benefits-heading"');

  assert.ok(journeyIndex !== -1, "specimen-journey-heading must exist");
  assert.ok(benefitsIndex !== -1, "benefits-heading must exist");
  assert.ok(journeyIndex < benefitsIndex, "journey must come before benefits");
});

test("home page preserves hero CTAs from PR-10", () => {
  const source = read(HOME_PATH);

  assert.ok(source.includes("Acceder al portal"));
  assert.ok(source.includes("Seguir con código"));
  assert.ok(source.includes("Dr. Nicolás E. Barbé"));
  assert.ok(source.includes('href={ROUTES.login}'));
  assert.ok(source.includes('href={ROUTES.particulares}'));
});

test("home page specimen journey does not contain forbidden marketing terms", () => {
  const source = read(HOME_PATH);
  const journeyStart = source.indexOf('"Toma y fijación"');
  const journeyEnd = source.indexOf('"Informe digital y acceso"');
  const journeySlice = source.slice(journeyStart, journeyEnd + 50).toLowerCase();

  const forbidden = ["marketplace", "ranking", "reviews", "estrellas", "telemedicina"];
  for (const word of forbidden) {
    assert.equal(journeySlice.includes(word), false, `journey must not contain "${word}"`);
  }
});

// ─── Servicios page — specimen journey section ───────────────────────────────

test("servicios page has Specimen Journey section with correct heading contract", () => {
  const source = read(SERVICIOS_PATH);

  assert.ok(source.includes('aria-labelledby="services-specimen-journey-heading"'));
  assert.ok(source.includes('id="services-specimen-journey-heading"'));
  assert.ok(source.includes("Recorrido de la muestra"));
});

test("servicios page specimen journey uses SpecimenJourneySection component", () => {
  const source = read(SERVICIOS_PATH);

  assert.ok(source.includes('from "@/components/public/SpecimenJourneySection"'));
  assert.ok(source.includes("<SpecimenJourneySection"));
  assert.ok(source.includes("stages={specimenJourneyStages}"));
});

test("servicios page specimen journey contains verified protocol data", () => {
  const source = read(SERVICIOS_PATH);

  assert.ok(source.includes("formol al 10%"));
  assert.ok(source.includes("48–72 h"));
  assert.ok(source.includes("bolsa tipo ziploc"));
  assert.ok(source.includes("15 días hábiles"));
});

test("servicios page bento gives each diagnostic layer explicit hierarchy", () => {
  const source = read(SERVICIOS_PATH);

  assert.ok(source.includes('data-services-diagnostic-bento="true"'));
  assert.ok(source.includes('layout: "dominant" as const'));
  assert.equal((source.match(/layout: "medium" as const/g) ?? []).length, 2);
  assert.equal((source.match(/layout: "connector" as const/g) ?? []).length, 2);
  assert.ok(source.includes('isDominant && "lg:col-span-12"'));
  assert.ok(source.includes('isMedium && "lg:col-span-6"'));
  assert.ok(source.includes('"lg:col-span-7"'));
  assert.ok(source.includes('"lg:col-span-5"'));
  assert.ok(source.includes("Servicio principal"));
});

test("servicios page preserves conversion CTAs and service content", () => {
  const source = read(SERVICIOS_PATH);

  assert.ok(source.includes("Coordinación diagnóstica para clínicas y profesionales"));
  assert.ok(source.includes("Solicitar coordinación diagnóstica"));
  assert.ok(source.includes("Conocer solución para clínicas"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("href={ROUTES.clinicas}"));
});

// ─── No private API surface exposed ──────────────────────────────────────────

test("home page does not reference private API routes", () => {
  const source = read(HOME_PATH);

  assert.equal(source.includes('"/api/admin'), false);
  assert.equal(source.includes('"/api/auth'), false);
  assert.equal(source.includes('"/api/particular'), false);
  assert.equal(source.includes('"/dashboard"'), false);
});

test("servicios page does not reference private API routes", () => {
  const source = read(SERVICIOS_PATH);

  assert.equal(source.includes('"/api/admin'), false);
  assert.equal(source.includes('"/api/auth'), false);
  assert.equal(source.includes('"/api/particular'), false);
  assert.equal(source.includes('"/dashboard"'), false);
});
