import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PROFILE_CARD_PATH =
  "frontend/src/components/dashboard/ClinicPublicProfileCard.tsx";
const API_PATH = "frontend/src/lib/api.ts";
const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/ClinicDashboardSidebar.tsx";

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
    "publicAddress",
    "mapLink",
    "isPublic",
  ].forEach((field) => {
    assert.ok(source.includes(field), `${field} must be present`);
  });

  assert.ok(source.includes("Avatar o logo"));
  assert.ok(source.includes("Dirección pública"));
  assert.ok(source.includes("Enlace a mapa"));
  assert.ok(source.includes("JPG, PNG o WebP"));
  assert.ok(source.includes("512 KB"));
  assert.ok(source.includes("160 x 160 px"));
  assert.ok(source.includes("1024 x 1024 px"));
  assert.ok(source.includes('accept="image/jpeg,image/png,image/webp"'));
  assert.equal(source.includes("image/svg+xml"), false);

  assert.ok(source.includes("missingRequiredFields"));
  assert.ok(source.includes("missingRecommendedFields"));
  assert.ok(source.includes("publicationErrors"));
  assert.ok(source.includes("qualityScore"));
  assert.ok(source.includes("minimumQualityScore"));
  assert.ok(source.includes("isSearchEligible"));
});

test("clinic public profile editor keeps mobile fields operable", () => {
  const source = read(PROFILE_CARD_PATH);

  assert.ok(source.includes('data-clinic-profile-editor="true"'));
  assert.ok(source.includes('data-clinic-profile-fields="true"'));
  assert.ok(source.includes('data-clinic-profile-toolbar="true"'));
  assert.ok(source.includes('data-clinic-profile-footer="true"'));
  assert.ok(source.includes("ModuleSurface"));
  assert.ok(source.includes('label: "Contacto"'));
  assert.ok(source.includes("h-12 w-12 sm:h-16 sm:w-16"));
  assert.ok(source.includes("text-xl sm:text-2xl"));
  assert.ok(source.includes("min-h-0 flex-1 overflow-hidden"));
  assert.equal(source.includes("overflow-y-auto"), false);
});

test("frontend api exposes clinic public profile helpers", () => {
  const source = read(API_PATH);

  assert.ok(source.includes("export type ClinicPublicProfilePublication"));
  assert.ok(source.includes("export type ClinicPublicProfile"));
  assert.ok(source.includes("export type ClinicPublicProfileUpdatePayload"));
  assert.ok(source.includes("export async function getClinicPublicProfile("));
  assert.ok(source.includes("export async function updateClinicPublicProfile("));
  assert.ok(source.includes("export async function uploadClinicPublicProfileAvatar("));
  assert.ok(source.includes("export async function deleteClinicPublicProfileAvatar("));
  assert.ok(source.includes('"/api/clinic/profile"'));
  assert.ok(source.includes('"/api/clinic/profile/avatar"'));
});

test("clinic dashboard renders public profile before token generation and keeps sidebar navigation", () => {
  const source = read(DASHBOARD_PAGE_PATH);
  const sidebarSource = read(CLINIC_DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes("ClinicPublicProfileCard"));
  assert.ok(source.includes("<ClinicPublicProfileCard />"));
  assert.ok(source.includes("<ClinicParticularTokensCard />"));
  assert.ok(
    source.indexOf("<ClinicPublicProfileCard />") <
      source.indexOf("<ClinicParticularTokensCard />"),
  );
  assert.ok(sidebarSource.includes('label: "Perfil público"'));
  assert.ok(sidebarSource.includes('`${ROUTES.dashboard}?module=perfil`'));
});
