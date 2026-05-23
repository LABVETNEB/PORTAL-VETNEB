import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_SIDEBAR_PATH =
  "frontend/src/components/dashboard/AdminDashboardSidebar.tsx";
const API_PATH = "frontend/src/lib/api.ts";
const CLINIC_CARD_PATH =
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const EXPECTED_SPECIES_OPTIONS = [
  "Caninos",
  "Felinos",
  "Exóticos",
  "Bovinos",
  "Equinos",
  "Porcinos",
  "Ovinos",
  "Caprinos",
  "Aves",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin particular token generator uses admin helpers without technical copy", () => {
  const card = read(ADMIN_CARD_PATH);
  const api = read(API_PATH);
  const removedScopedCopy = "Alta admin-" + "scoped";
  const removedAdminEndpoint = "POST " + "/api/admin/particular-tokens";

  assert.ok(card.includes('"use client";'));
  assert.ok(card.includes("createAdminParticularToken"));
  assert.ok(card.includes("getAdminParticularTokens"));
  assert.ok(card.includes("revokeAdminParticularToken"));
  assert.ok(card.includes("type AdminParticularTokenCreatePayload"));
  assert.ok(card.includes("type AdminParticularTokenSummary"));
  assert.equal(card.includes(removedScopedCopy), false);
  assert.equal(card.includes(removedAdminEndpoint), false);
  assert.ok(api.includes("export async function createAdminParticularToken("));
  assert.ok(api.includes('"/api/admin/particular-tokens"'));
  assert.ok(api.includes("export async function revokeAdminParticularToken("));
  assert.ok(
    api.includes("`/api/admin/particular-tokens/${tokenId}/revoke`,"),
  );
});

test("admin particular token generator requires clinic id and programmed fields", () => {
  const source = read(ADMIN_CARD_PATH);

  assert.ok(source.includes("clinicId: string;"));
  assert.ok(source.includes('{ key: "clinicId", label: "ID de clínica" }'));
  assert.ok(source.includes('id="admin-token-clinic-id"'));
  assert.ok(source.includes("clinicId: parsePositiveInteger(formState.clinicId"));
  assert.ok(source.includes("Complete el campo obligatorio"));
  assert.ok(source.includes("tutorLastName"));
  assert.ok(source.includes("petName"));
  assert.ok(source.includes("petAge"));
  assert.ok(source.includes("petBreed"));
  assert.ok(source.includes("petSex"));
  assert.ok(source.includes("petSpecies"));
  assert.ok(source.includes("sampleLocation"));
  assert.ok(source.includes("sampleEvolution"));
  assert.ok(source.includes("detailsLesion"));
  assert.ok(source.includes("extractionDate"));
  assert.ok(source.includes("shippingDate"));
});

test("admin dashboard mounts token generator and exposes admin navigation anchor", () => {
  const page = read(ADMIN_PAGE_PATH);
  const sidebar = read(ADMIN_SIDEBAR_PATH);

  assert.ok(page.includes('import { AdminParticularTokensCard } from "./AdminParticularTokensCard";'));
  assert.ok(page.includes('id="admin-particular-tokens"'));
  assert.ok(page.includes("<AdminParticularTokensCard />"));
  assert.ok(sidebar.includes('label: "Tokens particulares"'));
  assert.ok(sidebar.includes('`${ROUTES.dashboardAdmin}#admin-particular-tokens`'));
});

test("clinic token generator remains clinic-scoped and separate from admin generator", () => {
  const clinic = read(CLINIC_CARD_PATH);
  const admin = read(ADMIN_CARD_PATH);
  const removedClinicEndpoint = "POST " + "/api/particular-tokens";

  assert.ok(clinic.includes("createClinicParticularToken"));
  assert.ok(clinic.includes("getClinicParticularTokens"));
  assert.equal(clinic.includes("createAdminParticularToken"), false);
  assert.equal(clinic.includes(removedClinicEndpoint), false);

  assert.ok(admin.includes("createAdminParticularToken"));
  assert.ok(admin.includes("getAdminParticularTokens"));
  assert.equal(admin.includes("createClinicParticularToken"), false);
});

test("admin and clinic token forms keep normalized sex and species options", () => {
  const admin = read(ADMIN_CARD_PATH);
  const clinic = read(CLINIC_CARD_PATH);

  for (const [context, source] of [
    ["admin", admin],
    ["clinic", clinic],
  ] as const) {
    assert.equal(
      source.includes('value: "", label: "Seleccionar sexo"'),
      false,
      `${context} form must not include selectable sex placeholder`,
    );
    assert.equal(
      source.includes('value: "No informado", label: "No informado"'),
      false,
      `${context} form must not include "No informado" sex option`,
    );
    assert.equal(
      source.includes('value: "", label: "Seleccionar especie"'),
      false,
      `${context} form must not include selectable species placeholder`,
    );
    assert.equal(source.includes('value: "Canina", label: "Canina"'), false);
    assert.equal(source.includes('value: "Felina", label: "Felina"'), false);
    assert.equal(source.includes('value: "Equina", label: "Equina"'), false);
    assert.equal(source.includes('value: "Otra", label: "Otra"'), false);

    assert.ok(source.includes('value: "Macho", label: "Macho"'));
    assert.ok(source.includes('value: "Hembra", label: "Hembra"'));
    assert.ok(source.includes('petSex: "Macho"'));
    assert.ok(source.includes('petSpecies: "Caninos"'));

    let previousIndex = -1;
    for (const species of EXPECTED_SPECIES_OPTIONS) {
      const marker = `value: "${species}", label: "${species}"`;
      const index = source.indexOf(marker);
      assert.ok(index !== -1, `${context} form must include ${species}`);
      assert.ok(
        index > previousIndex,
        `${context} form must keep species order for ${species}`,
      );
      previousIndex = index;
    }
  }
});
