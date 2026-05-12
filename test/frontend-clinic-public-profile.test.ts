import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PROFILE_CARD_PATH =
  "frontend/src/components/dashboard/ClinicPublicProfileCard.tsx";
const API_PATH = "frontend/src/lib/api.ts";
const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("clinic public profile card exists and is clinic scoped", () => {
  assert.equal(existsSync(resolve(process.cwd(), PROFILE_CARD_PATH)), true);

  const source = read(PROFILE_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("getClinicPublicProfile"));
  assert.ok(source.includes("updateClinicPublicProfile"));
  assert.ok(source.includes('id="clinic-public-profile"'));
  assert.ok(source.includes("Perfil para banco de especialidades"));
  assert.ok(source.includes("especialidades"));
  assert.equal(source.includes("/api/admin"), false);
});

test("clinic public profile card exposes required publication fields", () => {
  const source = read(PROFILE_CARD_PATH);

  [
    "displayName",
    "specialtyText",
    "locality",
    "country",
    "servicesText",
    "aboutText",
    "email",
    "phone",
    "isPublic",
  ].forEach((field) => {
    assert.ok(source.includes(field), `${field} must be present`);
  });

  assert.ok(source.includes("missingRequiredFields"));
  assert.ok(source.includes("missingRecommendedFields"));
  assert.ok(source.includes("publicationErrors"));
  assert.ok(source.includes("qualityScore"));
  assert.ok(source.includes("minimumQualityScore"));
  assert.ok(source.includes("isSearchEligible"));
});

test("frontend api exposes clinic public profile helpers", () => {
  const source = read(API_PATH);

  assert.ok(source.includes("export type ClinicPublicProfilePublication"));
  assert.ok(source.includes("export type ClinicPublicProfile"));
  assert.ok(source.includes("export type ClinicPublicProfileUpdatePayload"));
  assert.ok(source.includes("export async function getClinicPublicProfile("));
  assert.ok(source.includes("export async function updateClinicPublicProfile("));
  assert.ok(source.includes('"/api/clinic/profile"'));
});

test("clinic dashboard renders public profile before token generation", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("ClinicPublicProfileCard"));
  assert.ok(source.includes("<ClinicPublicProfileCard />"));
  assert.ok(source.includes("<ClinicParticularTokensCard />"));
  assert.ok(
    source.indexOf("<ClinicPublicProfileCard />") <
      source.indexOf("<ClinicParticularTokensCard />"),
  );
  assert.ok(
    source.includes('href: `${ROUTES.dashboard}#clinic-public-profile`'),
  );
  assert.ok(source.includes('label: "Perfil"'));
});
