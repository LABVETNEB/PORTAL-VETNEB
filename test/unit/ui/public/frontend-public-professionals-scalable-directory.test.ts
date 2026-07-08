import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildProfessionalDetailHref,
  getPublicProfessionalLocation,
  isVerifiedPublicProfessional,
  parsePublicProfessionalClinicId,
  summarizePublicProfessional,
} from "../../../../frontend/src/lib/public-professionals.ts";

const PROFESIONALES_SEARCH_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const PROFESIONAL_DETAIL_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalDetailContent.tsx";
const PUBLIC_PROFESSIONALS_HELPER_PATH =
  "frontend/src/lib/public-professionals.ts";
const PUBLIC_PROFESSIONALS_API_CLIENT_PATH = "frontend/src/lib/api.ts";
const PUBLIC_PROFESSIONALS_API_ROUTE_PATH =
  "server/routes/public-professionals.fastify.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function extractSerializeProfessional(source: string) {
  const start = source.indexOf("async function serializeProfessional(");
  assert.notEqual(start, -1, "serializeProfessional must exist");

  const end = source.indexOf("\nfunction applyCorsHeaders", start);
  assert.notEqual(end, -1, "serializeProfessional block must be bounded");

  return source.slice(start, end);
}

test("public professionals api client keeps search and detail endpoint boundary", () => {
  const source = read(PUBLIC_PROFESSIONALS_API_CLIENT_PATH);

  assert.ok(source.includes("export async function searchPublicProfessionals("));
  assert.ok(source.includes("const query = new URLSearchParams();"));
  assert.ok(source.includes('query.set("q", params.query.trim());'));
  assert.ok(source.includes('query.set("limit", String(params.limit));'));
  assert.ok(source.includes('query.set("offset", String(params.offset));'));
  assert.ok(source.includes("const qs = query.toString();"));
  assert.ok(
    source.includes('`/api/public/professionals/search${qs ? `?${qs}` : ""}`'),
  );
  assert.ok(source.includes("export async function getPublicProfessional("));
  assert.ok(source.includes("clinicId: number,"));
  assert.ok(source.includes("`/api/public/professionals/${clinicId}`"));
});

test("public professionals UI keeps generic copy for rate-limited fetch failures", () => {
  const searchSource = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const detailSource = read(PROFESIONAL_DETAIL_CONTENT_PATH);

  assert.ok(searchSource.includes(".catch(() => {"));
  assert.ok(
    searchSource.includes(
      'setState({ status: "error", professionals: [], total: 0 });',
    ),
  );
  assert.ok(
    searchSource.includes(
      "No se pudo realizar la búsqueda. Intente nuevamente.",
    ),
  );
  assert.equal(
    searchSource.includes(
      "Demasiadas consultas al directorio público. Intente más tarde.",
    ),
    false,
  );

  assert.ok(detailSource.includes(".catch(() => {"));
  assert.ok(
    detailSource.includes('setState({ status: "error", professional: null });'),
  );
  assert.ok(
    detailSource.includes("No se pudo cargar el perfil profesional solicitado."),
  );
  assert.equal(
    detailSource.includes(
      "Demasiadas consultas al perfil público. Intente más tarde.",
    ),
    false,
  );

  for (const rawErrorMarker of [
    "body.message",
    "data.message",
    "json.message",
    "error.message",
    "stack",
    "RateLimit",
  ]) {
    assert.equal(searchSource.includes(rawErrorMarker), false);
    assert.equal(detailSource.includes(rawErrorMarker), false);
  }
});
test("public professionals listing renders compact cards without contact detail payload", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);

  assert.ok(source.includes("Clínicas y profesionales verificados que trabajan con VETNEB."));
  assert.ok(source.includes("state.professionals.map((professional) =>"));
  assert.ok(source.includes("key={professional.clinicId}"));
  assert.ok(source.includes("professional.displayName"));
  assert.ok(source.includes("professional.avatarUrl"));
  assert.ok(source.includes("professional-avatar-fallback"));
  assert.ok(source.includes("summarizePublicProfessional(professional)"));
  assert.ok(source.includes("getPublicProfessionalLocation(professional)"));
  assert.ok(source.includes("isVerifiedPublicProfessional(professional)"));
  assert.equal(source.includes("professional.aboutText"), false);
  assert.equal(source.includes("professional.email"), false);
  assert.equal(source.includes("professional.phone"), false);
  assert.equal(source.includes("professional.publicAddress"), false);
  assert.equal(source.includes("professional.mapLink"), false);
  assert.equal(source.includes("email"), false);
  assert.equal(source.includes("teléfono"), false);
  assert.equal(source.includes("Dirección"), false);
});

test("public professionals listing has stable local avatar fallback", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);

  assert.ok(source.includes("professional-avatar-fallback"));
  assert.ok(source.includes('aria-hidden="true"'));
  assert.ok(source.includes("BriefcaseMedical"));
  assert.equal(source.includes("https://"), false);
});

test("public professionals card navigation opens detail resolved by clinic id", () => {
  const searchSource = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const detailSource = read(PROFESIONAL_DETAIL_CONTENT_PATH);

  assert.ok(searchSource.includes("buildProfessionalDetailHref("));
  assert.ok(searchSource.includes("professional.clinicId"));
  assert.ok(searchSource.includes("Abrir detalle del perfil"));
  assert.ok(detailSource.includes("parsePublicProfessionalClinicId(clinicId)"));
  assert.ok(detailSource.includes("getPublicProfessional(parsedClinicId"));
  assert.ok(detailSource.includes('{ cache: "no-store" }'));
  assert.ok(detailSource.includes("professional.specialtyText"));
  assert.ok(detailSource.includes("professional.servicesText"));
  assert.ok(detailSource.includes("professional.aboutText"));
  assert.ok(detailSource.includes("professional.publicAddress"));
  assert.ok(detailSource.includes("professional.mapLink"));
});

test("public professionals detail identity stays isolated for similar clinics", () => {
  const clinicA = {
    clinicId: 701,
    specialtyText: "Dermatopatologia veterinaria compartida",
    servicesText: "Biopsias cutaneas con informe exclusivo Rosario A",
    locality: "Rosario",
    country: "Argentina",
    profileQualityScore: 82,
  };
  const clinicB = {
    clinicId: 702,
    specialtyText: "Dermatopatologia veterinaria compartida",
    servicesText: "Biopsias cutaneas con informe exclusivo Rosario B",
    locality: "Rosario",
    country: "Argentina",
    profileQualityScore: 83,
  };
  const searchSource = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const detailSource = read(PROFESIONAL_DETAIL_CONTENT_PATH);

  assert.equal(buildProfessionalDetailHref(clinicA.clinicId), "/profesionales/701");
  assert.equal(buildProfessionalDetailHref(clinicB.clinicId), "/profesionales/702");
  assert.equal(parsePublicProfessionalClinicId("701"), 701);
  assert.equal(parsePublicProfessionalClinicId("702"), 702);
  assert.equal(getPublicProfessionalLocation(clinicA), "Rosario, Argentina");
  assert.equal(isVerifiedPublicProfessional(clinicA), true);
  assert.ok(summarizePublicProfessional(clinicA)?.includes("Rosario A"));
  assert.equal(summarizePublicProfessional(clinicA)?.includes("Rosario B"), false);
  assert.ok(summarizePublicProfessional(clinicB)?.includes("Rosario B"));
  assert.equal(summarizePublicProfessional(clinicB)?.includes("Rosario A"), false);
  assert.equal(searchSource.includes("key={index}"), false);
  assert.equal(searchSource.includes("selectedProfessional"), false);
  assert.ok(detailSource.includes("getPublicProfessional(parsedClinicId"));
});

test("public professionals UI and API contracts avoid private public-surface leaks", () => {
  const publicUiSource = [
    read(PROFESIONALES_SEARCH_CONTENT_PATH),
    read(PROFESIONAL_DETAIL_CONTENT_PATH),
    read(PUBLIC_PROFESSIONALS_HELPER_PATH),
  ].join("\n");
  const serializeProfessional = extractSerializeProfessional(
    read(PUBLIC_PROFESSIONALS_API_ROUTE_PATH),
  );
  const forbiddenPublicUiMarkers = [
    "avatarStoragePath",
    "storagePath",
    "storage_path",
    "downloadUrl",
    "previewUrl",
    "sessionToken",
    "tokenHash",
    "admin_session_id",
    "app_session_id",
    "particular_session_id",
    "dangerouslySetInnerHTML",
    "<script",
    "onclick=",
  ];

  for (const marker of forbiddenPublicUiMarkers) {
    assert.equal(
      publicUiSource.includes(marker),
      false,
      `public UI should not expose ${marker}`,
    );
  }

  assert.ok(serializeProfessional.includes("avatarUrl"));
  assert.equal(serializeProfessional.includes("avatarStoragePath:"), false);
  assert.equal(serializeProfessional.includes("storagePath"), false);
  assert.equal(serializeProfessional.includes("token"), false);
  assert.equal(serializeProfessional.includes("cookie"), false);
});
