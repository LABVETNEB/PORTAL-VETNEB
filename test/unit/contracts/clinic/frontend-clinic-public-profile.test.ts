import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const PROFILE_CARD_PATH =
  "frontend/src/components/dashboard/ClinicPublicProfileCard.tsx";
const API_PATH = "frontend/src/lib/api.ts";
const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";

test("clinic public profile card exists and is clinic scoped", () => {
  assert.equal(existsSync(resolve(process.cwd(), PROFILE_CARD_PATH)), true);

  const source = read(PROFILE_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("getClinicPublicProfile"));
  assert.ok(source.includes("updateClinicPublicProfile"));
  assert.ok(source.includes('id: "clinic-public-profile"'));
  // FASE 2B: the card no longer duplicates the module title/subtitle that
  // DashboardModuleWorkspace already renders once above it — it keeps the
  // aria-label instead.
  assert.ok(source.includes('ariaLabel="Perfil público de la clínica"'));
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
  assert.ok(source.includes("isSearchEligible"));
  // Clinic desktop/tablet space pass: the "Completitud" summary run (the only
  // reader of qualityScore/minimumQualityScore) is retired with the rest of
  // the red-marked summary; the publication badge and the phone completion
  // line keep reading the publication snapshot.
  assert.equal(source.includes("ModuleMetricRun"), false);
  assert.ok(source.includes("getPublicationLabel(profile)"));
});

test("clinic public profile editor keeps mobile fields operable", () => {
  const source = read(PROFILE_CARD_PATH);

  assert.ok(source.includes('"data-clinic-profile-editor": "true"'));
  assert.ok(source.includes('data-clinic-profile-fields="true"'));
  assert.ok(source.includes('data-clinic-profile-toolbar="true"'));
  assert.ok(source.includes('data-clinic-profile-footer="true"'));
  assert.ok(source.includes("ModuleCardSections"));
  assert.ok(source.includes('label: "Contacto"'));
  assert.ok(source.includes("h-12 w-12 sm:h-16 sm:w-16"));
  assert.ok(source.includes("min-h-0 flex-1 overflow-hidden"));
  assert.equal(source.includes("overflow-y-auto"), false);
});

test("clinic public profile editor is single-open from 768px up without losing state", () => {
  const source = read(PROFILE_CARD_PATH);

  // One section source of truth for chips (<768px) and disclosure rows (>=768px).
  assert.ok(source.includes("activeId={activeTabId}"));
  assert.ok(source.includes("onActiveIdChange={setActiveTabId}"));
  assert.ok(source.includes("aria-expanded={isOpen}"));
  assert.ok(source.includes("aria-controls={`${sectionBaseId}-section-${sectionId}`}"));
  assert.ok(source.includes('"hidden h-11 w-full'), "rows paint from md only");
  // Order: institutional identity, Datos, Contacto, Contenido, Cambiar contraseña, then save.
  const order = [
    "{statusTab}",
    'renderSectionToggle("datos")',
    'renderSectionToggle("contacto")',
    'renderSectionToggle("contenido")',
    "renderSectionToggle(PASSWORD_TAB_ID)",
    'data-clinic-profile-desktop-actions="true"',
  ].map((needle) => source.indexOf(needle));
  assert.ok(order.every((index) => index > 0), "every stack element exists");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "stack order");
  // Values live in formState; the password panel and the avatar stay mounted.
  assert.ok(source.includes("{isOpen || keepMounted ? content : null}"));
  // C25 F-T6: the panel shares its section with the painted section name.
  assert.match(source, /<PasswordChangePanel variant="clinic" density="compact" embeddedFromMd \/>\s+<\/>,\s+true,\s+\)/, "the password panel is kept mounted");
  assert.equal(source.includes("renderProfileForm"), false, "one profile form, not one per section");
  assert.equal((source.match(/id=\{PROFILE_FORM_ID\}/g) ?? []).length, 1);
  // Save keeps its handler and stays a form submit; width is capped on desktop.
  assert.ok(source.includes('onSubmit={handleSubmit}'));
  assert.ok(source.includes("form={PROFILE_FORM_ID}"));
  // Two regions from 768px up (the capped 768 px column is retired).
  assert.equal(source.includes("md:max-w-3xl"), false);
  assert.ok(source.includes('data-clinic-profile-institutional="true"'));
  assert.ok(source.includes('data-clinic-profile-editing="true"'));
});

test("clinic public profile institutional column keeps the publication contract and invents nothing", () => {
  const source = read(PROFILE_CARD_PATH);

  // Real publication snapshot only: the badge, the pending requirements and the
  // quality meter (only when the response carries both numbers).
  assert.ok(source.includes('data-clinic-profile-publication="true"'));
  assert.ok(source.includes("typeof qualityScore === \"number\""));
  assert.ok(source.includes("typeof minimumQualityScore === \"number\""));
  assert.ok(source.includes('role="meter"'));
  assert.ok(source.includes('aria-label="Calidad del perfil"'));
  assert.ok(source.includes('"Obligatorios pendientes"'));
  assert.ok(source.includes('"Recomendados pendientes"'));
  // No counters or unsaved-change claims without a functional source.
  assert.equal(source.includes("Cambios sin guardar"), false);
  assert.equal(/\b\d+\/\d+\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/https?:\/\/\S+/g, "").replace(/[a-z]+\/[a-z]+/gi, "")), false, "no n/m counters");

  // `isPublic`: one control bound to formState and the same setter, rendered
  // for phones (inside Contenido) and for the institutional column.
  const checkedBinding = "checked={formState.isPublic}";
  const checkedSetter = 'updateField("isPublic", event.target.checked)';
  assert.ok(source.includes(checkedBinding));
  assert.equal(source.indexOf(checkedBinding), source.lastIndexOf(checkedBinding), "one checkbox renderer");
  assert.ok(source.includes(checkedSetter));
  assert.equal(source.indexOf(checkedSetter), source.lastIndexOf(checkedSetter), "one setter");
  assert.ok(source.includes('renderPublishCheckbox("md:hidden")'));
  assert.ok(source.includes('renderPublishCheckbox("max-md:hidden")'));
  assert.ok(source.includes("isPublic: formState.isPublic,"), "payload keeps isPublic");
});

test("clinic public profile avatar keeps the real input, its handlers and an accessible picker", () => {
  const source = read(PROFILE_CARD_PATH);

  assert.ok(source.includes('id="clinic-profile-avatar"'));
  assert.ok(source.includes("onChange={handleAvatarInputChange}"));
  assert.ok(source.includes('accept="image/jpeg,image/png,image/webp"'));
  const labelFor = 'htmlFor="clinic-profile-avatar"';
  assert.notEqual(source.indexOf(labelFor), source.lastIndexOf(labelFor), "phone label + desktop picker");
  assert.ok(source.includes('className="peer md:sr-only"'), "the input stays in the DOM, visually hidden from md");
  assert.ok(source.includes("peer-focus-visible:ring-2"), "the visible picker shows the input's focus");
  assert.ok(source.includes("URL.revokeObjectURL"), "preview resources are still released");
  assert.ok(source.includes("MAX_AVATAR_FILE_SIZE_BYTES = 512 * 1024"));
  assert.ok(source.includes("MIN_AVATAR_DIMENSION = 160"));
  assert.ok(source.includes("MAX_AVATAR_DIMENSION = 1024"));
});

test("clinic public profile keeps one profile form with the password panel outside of it", () => {
  const source = read(PROFILE_CARD_PATH);
  const stack = source.slice(source.indexOf("const profileStack = ("), source.indexOf("const hasProfileLoadState"));

  assert.equal(source.indexOf("id={PROFILE_FORM_ID}"), source.lastIndexOf("id={PROFILE_FORM_ID}"));
  const formEnd = stack.indexOf("</form>");
  assert.ok(formEnd > 0);
  assert.ok(stack.indexOf("<PasswordChangePanel") > formEnd, "the password form is never nested in the profile form");
  assert.ok(stack.indexOf("{statusTab}") < stack.indexOf("<form"), "avatar controls sit outside the profile form");
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

test("clinic dashboard renders public profile before token generation", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("ClinicPublicProfileCard"));
  assert.ok(source.includes("<ClinicPublicProfileCard />"));
  assert.ok(source.includes("<ClinicParticularTokensCard />"));
  assert.ok(
    source.indexOf("<ClinicPublicProfileCard />") <
      source.indexOf("<ClinicParticularTokensCard />"),
  );
});
