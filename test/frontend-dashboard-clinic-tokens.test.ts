import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_TOKENS_CARD_PATH =
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const API_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("clinic dashboard exists as a clinic-only dashboard and keeps admin out", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('title: "Dashboard Clínica — Portal VETNEB"'));
  assert.ok(source.includes('title="Dashboard Clínica"'));
  assert.ok(source.includes("superficie no usa sesión de administración."));
  assert.ok(source.includes('import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";'));
  assert.ok(source.includes("<ClinicParticularTokensCard />"));
  assert.ok(source.includes('href: "#clinic-particular-tokens"'));
  assert.equal(source.includes('label: "Admin"'), false);
  assert.equal(source.includes("ROUTES.dashboardAdmin"), false);
});

test("clinic particular tokens card exists and uses clinic-scoped endpoints", () => {
  assert.equal(
    existsSync(resolve(process.cwd(), CLINIC_TOKENS_CARD_PATH)),
    true,
    "clinic particular tokens card must exist",
  );

  const source = read(CLINIC_TOKENS_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("createClinicParticularToken"));
  assert.ok(source.includes("getClinicParticularTokens"));
  assert.ok(source.includes('id="clinic-particular-tokens"'));
  assert.ok(source.includes("POST /api/particular-tokens"));
  assert.ok(source.includes("Todos"));
  assert.ok(source.includes("los datos programados son obligatorios"));
  assert.ok(source.includes("generatedToken"));
  assert.ok(source.includes("El token completo solo se muestra una vez."));
  assert.equal(source.includes("/api/admin/particular-tokens"), false);
});

test("clinic token generation requires all programmed data fields", () => {
  const source = read(CLINIC_TOKENS_CARD_PATH);

  [
    "tutorLastName",
    "petName",
    "petAge",
    "petBreed",
    "petSex",
    "petSpecies",
    "sampleLocation",
    "sampleEvolution",
    "detailsLesion",
    "extractionDate",
    "shippingDate",
  ].forEach((field) => {
    assert.ok(source.includes(field), `${field} must be present`);
  });

  assert.ok(source.includes("validateFormState"));
  assert.ok(source.includes("Complete el campo obligatorio"));
  assert.ok(source.includes("required"));
  assert.ok(source.includes("reportId: parseOptionalReportId(formState.reportId)"));
});

test("frontend api exposes clinic-scoped particular token helpers", () => {
  const source = read(API_PATH);

  assert.ok(source.includes("export type ClinicParticularTokenSummary"));
  assert.ok(source.includes("export type ClinicParticularTokenCreatePayload"));
  assert.ok(source.includes("export async function getClinicParticularTokens("));
  assert.ok(source.includes("export async function createClinicParticularToken("));
  assert.ok(source.includes("export async function linkClinicParticularTokenReport("));
  assert.ok(source.includes('"/api/particular-tokens"'));
  assert.ok(source.includes("`/api/particular-tokens${qs ? `?${qs}` : \"\"}`"));
  assert.ok(source.includes("`/api/particular-tokens/${tokenId}/report`"));
});

