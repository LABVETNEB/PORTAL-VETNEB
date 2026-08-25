import { createServer } from "node:http";

// PR-TRUNC · Deliberately long text dataset (additive, opt-in, test-only).
// The truncation audit must observe what a LONG clinical value does to the
// clinic report surfaces, and those two (/dashboard and /dashboard/informes)
// are rendered by SERVER components: their payload never leaves the Next
// process, so Playwright's `page.route` cannot substitute it. The gate is
// `hasLongTextDataset` below, strictly conjunctive like the A03 one.
import {
  LONG_TEXT_CLINIC_REPORT,
  LONG_TEXT_COOKIE_NAME,
  LONG_TEXT_COOKIE_VALUE,
} from "../helpers/long-text-dataset.mjs";

const HOST = "127.0.0.1";
const PORT = 3107;
const POPULATED_ADMIN_SESSION = "e2e_populated_admin_session";
const POPULATED_CLINIC_SESSION = "e2e_populated_clinic_session";

// ─────────────────────────────────────────────────────────────────────────────
// A03 · Adaptive pagination dataset (additive, opt-in, test-only).
//
// The historical logistics fixtures answer with exactly three records and
// ignore limit/offset, so no logistics consumer can ever reach a COMPLETE
// second page — the observation point the A03 baseline requires (audit §20.3
// and §20.4). Those routes are rendered by SERVER components, so Playwright's
// `page.route` cannot substitute their payload: the fetch leaves the Next
// process, never the browser.
//
// This opt-in branch is the only way to make that observation point reachable
// without touching `frontend/src/**`. It requires BOTH a populated clinic
// session AND the auxiliary cookie below, so every existing consumer — A01,
// A02 and the whole current suite — keeps receiving byte-identical historical
// payloads. Presence of the auxiliary cookie alone never activates it.
// ─────────────────────────────────────────────────────────────────────────────
const A03_ADAPTIVE_COOKIE_NAME = "e2e_a03_adaptive_pagination";
const A03_ADAPTIVE_COOKIE_VALUE = "1";
const A03_DATASET_SIZE = 256;

const CLINIC_REPORT_STATUSES = [
  "uploaded",
  "processing",
  "ready",
  "delivered",
];
const CLINIC_REPORT_STUDY_TYPES = [
  "Histopatología",
  "Citología",
  "Inmunohistoquímica",
  "Biopsia de piel",
  "Necropsia",
];

const LEGACY_CLINIC_REPORTS = [
  {
    id: 8401,
    clinicId: 77,
    clinicName: "Clínica E2E Informes Mobile",
    patientName: "Mora",
    studyType:
      "Histopatología dermatológica con evaluación de márgenes quirúrgicos ampliados",
    status: "uploaded",
    uploadDate: "2026-06-18T12:00:00.000Z",
    hasFile: true,
    createdAt: "2026-06-18T12:00:00.000Z",
    updatedAt: "2026-06-18T14:30:00.000Z",
  },
  {
    id: 8402,
    clinicId: 77,
    clinicName: "Clínica E2E Informes Mobile",
    patientName:
      "Paciente con nombre clínico extraordinariamente extenso para validar el detalle mobile",
    studyType: "Citología",
    status: "processing",
    uploadDate: "2026-06-17T11:30:00.000Z",
    hasFile: false,
    createdAt: "2026-06-17T11:30:00.000Z",
    updatedAt: "2026-06-18T13:15:00.000Z",
  },
  {
    id: 8403,
    clinicId: 77,
    clinicName: "Clínica E2E Informes Mobile",
    patientName: "Simón",
    studyType: "Inmunohistoquímica",
    status: "delivered",
    uploadDate: "2026-06-16T09:45:00.000Z",
    hasFile: true,
    createdAt: "2026-06-16T09:45:00.000Z",
    updatedAt: "2026-06-18T10:00:00.000Z",
  },
];

function isoDaysBefore(baseDate, daysBefore, hour) {
  const date = new Date(baseDate);
  date.setUTCDate(date.getUTCDate() - daysBefore);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function createSyntheticClinicReport(index) {
  const id = 8400 + index;
  const status =
    CLINIC_REPORT_STATUSES[(index - 1) % CLINIC_REPORT_STATUSES.length];
  const studyType =
    CLINIC_REPORT_STUDY_TYPES[
      (index - 1) % CLINIC_REPORT_STUDY_TYPES.length
    ];
  const uploadDate = isoDaysBefore("2026-06-18T12:00:00.000Z", index - 1, 12);

  return {
    id,
    clinicId: 77,
    clinicName: "Clínica E2E Informes Mobile",
    patientName: `Paciente E2E ${String(index).padStart(4, "0")}`,
    studyType,
    status,
    currentStatus: status,
    uploadDate,
    fileName:
      status === "uploaded" || status === "delivered"
        ? `informe-${id}.pdf`
        : null,
    hasFile: status === "uploaded" || status === "delivered",
    createdAt: uploadDate,
    updatedAt: isoDaysBefore("2026-06-18T14:30:00.000Z", index - 1, 14),
  };
}

const CLINIC_REPORTS = [
  ...LEGACY_CLINIC_REPORTS,
  ...Array.from({ length: 997 }, (_, index) =>
    createSyntheticClinicReport(index + LEGACY_CLINIC_REPORTS.length + 1),
  ),
];

const CLINIC_FIELD_VISITS = [
  {
    id: 8501,
    clinicId: 77,
    clinicName: "Clínica Veterinaria Palermo Norte",
    status: "scheduled",
    scheduledAt: "2026-06-20T13:30:00.000Z",
    completedAt: null,
    address: "Avenida Santa Fe 3250, Palermo, Ciudad Autónoma de Buenos Aires",
    notes: "Retiro programado de muestras para anatomía patológica.",
    createdAt: "2026-06-18T10:00:00.000Z",
    updatedAt: "2026-06-19T09:15:00.000Z",
  },
  {
    id: 8502,
    clinicId: 78,
    clinicName:
      "Centro Veterinario Integral de Diagnóstico y Seguimiento Los Arrayanes",
    status: "in_progress",
    scheduledAt: "2026-06-19T15:45:00.000Z",
    completedAt: null,
    address:
      "Avenida de los Diagnósticos Veterinarios Integrales 4850, Torre Norte, Piso 12, Consultorio 1204, Ciudad Autónoma de Buenos Aires",
    notes:
      "Entrega de resultados y retiro de material refrigerado con trazabilidad prioritaria.",
    createdAt: "2026-06-17T11:20:00.000Z",
    updatedAt: "2026-06-19T15:50:00.000Z",
  },
  {
    id: 8503,
    clinicId: 79,
    clinicName: "Hospital Veterinario del Parque",
    status: "done",
    scheduledAt: "2026-06-18T12:00:00.000Z",
    completedAt: "2026-06-18T13:10:00.000Z",
    address: "Calle 14 865, La Plata, Provincia de Buenos Aires",
    notes: "Visita completada con recepción conforme.",
    createdAt: "2026-06-16T08:30:00.000Z",
    updatedAt: "2026-06-18T13:10:00.000Z",
  },
];

// R-13 (updated for the premium hub redesign): served for every populated
// clinic session request, with or without limit/offset. The unconditional
// call sites (getDashboardStats, dashboard/logistica hub) now resolve, so the
// clinic hub/command center exercise their HEALTHY state under this fixture;
// dashboard-clinic-module-state-parity.spec.ts asserts that healthy path and
// the default (non-populated) session keeps covering the degraded states.
const CLINIC_ROUTE_PLANS = [
  {
    id: 8601,
    name: "Ruta Zona Norte",
    status: "released",
    plannedDate: "2026-06-21T09:00:00.000Z",
    totalStops: 8,
    completedStops: 3,
    createdAt: "2026-06-17T10:00:00.000Z",
    updatedAt: "2026-06-19T11:00:00.000Z",
  },
  {
    id: 8602,
    name: "Ruta Zona Sur",
    status: "in_progress",
    plannedDate: "2026-06-20T08:30:00.000Z",
    totalStops: 5,
    completedStops: 2,
    createdAt: "2026-06-16T09:00:00.000Z",
    updatedAt: "2026-06-19T14:20:00.000Z",
  },
  {
    id: 8603,
    name: "Ruta Zona Oeste",
    status: "completed",
    plannedDate: "2026-06-18T07:45:00.000Z",
    totalStops: 10,
    completedStops: 10,
    createdAt: "2026-06-15T08:00:00.000Z",
    updatedAt: "2026-06-18T13:30:00.000Z",
  },
];

// R-14 exception: additive-only, keyed by CLINIC_ROUTE_PLANS id. Serves
// GET /api/logistics/route-plans/:id/metrics so metricas/page.tsx (which now
// requests limit/offset and therefore matches the route-plans handler above)
// can resolve its per-page-visible-plan metrics fan-out end to end. Does not
// touch the route-plans or field-visits handlers or their gating.
const CLINIC_ROUTE_METRICS_BY_PLAN_ID = {
  8601: {
    routePlanId: 8601,
    totalStops: 8,
    completedStops: 3,
    skippedStops: 1,
    noShowStops: 0,
    complianceRate: 90,
    averageDurationMinutes: 42,
  },
  8602: {
    routePlanId: 8602,
    totalStops: 5,
    completedStops: 2,
    skippedStops: 1,
    noShowStops: 1,
    complianceRate: 65,
    averageDurationMinutes: 55,
  },
  8603: {
    routePlanId: 8603,
    totalStops: 10,
    completedStops: 10,
    skippedStops: 0,
    noShowStops: 0,
    complianceRate: 100,
    averageDurationMinutes: null,
  },
};

// ── A03 datasets ─────────────────────────────────────────────────────────────
// Deterministic by construction: fixed ISO timestamps, index-derived values,
// no Date.now(), no randomness, no execution-order dependency. The three
// historical records stay at indexes 0..2 so the A03 dataset is a strict
// superset of the historical one and the first page keeps rendering the same
// leading rows; synthetic records extend it to A03_DATASET_SIZE.

const A03_FIXED_SCHEDULED_AT = "2026-06-22T09:00:00.000Z";
const A03_FIXED_COMPLETED_AT = "2026-06-22T10:30:00.000Z";
const A03_FIXED_CREATED_AT = "2026-06-15T08:00:00.000Z";
const A03_FIXED_UPDATED_AT = "2026-06-20T12:00:00.000Z";
const A03_FIXED_PLANNED_DATE = "2026-06-23T07:30:00.000Z";
const A03_VISIT_STATUSES = ["pending", "scheduled", "in_progress", "done"];
const A03_ROUTE_PLAN_STATUSES = [
  "draft",
  "released",
  "in_progress",
  "completed",
];

const pad3 = (value) => String(value).padStart(3, "0");

function createA03FieldVisit(index) {
  const ordinal = pad3(index + 1);

  return {
    id: 20000 + index,
    clinicId: 900 + (index % 24),
    clinicName: `Clinica Adaptativa E2E ${ordinal}`,
    status: A03_VISIT_STATUSES[index % A03_VISIT_STATUSES.length],
    scheduledAt: A03_FIXED_SCHEDULED_AT,
    completedAt:
      A03_VISIT_STATUSES[index % A03_VISIT_STATUSES.length] === "done"
        ? A03_FIXED_COMPLETED_AT
        : null,
    address: `Avenida Sintetica ${1000 + index}, Buenos Aires`,
    notes: `Visita sintetica determinista ${ordinal}.`,
    createdAt: A03_FIXED_CREATED_AT,
    updatedAt: A03_FIXED_UPDATED_AT,
  };
}

function createA03RoutePlan(index) {
  const ordinal = pad3(index + 1);
  const totalStops = 4 + (index % 9);

  return {
    id: 30000 + index,
    name: `Ruta Adaptativa E2E ${ordinal}`,
    status: A03_ROUTE_PLAN_STATUSES[index % A03_ROUTE_PLAN_STATUSES.length],
    plannedDate: A03_FIXED_PLANNED_DATE,
    totalStops,
    completedStops: index % (totalStops + 1),
    createdAt: A03_FIXED_CREATED_AT,
    updatedAt: A03_FIXED_UPDATED_AT,
  };
}

const A03_FIELD_VISITS = [
  ...CLINIC_FIELD_VISITS,
  ...Array.from({ length: A03_DATASET_SIZE - CLINIC_FIELD_VISITS.length }, (_, index) =>
    createA03FieldVisit(index),
  ),
];

const A03_ROUTE_PLANS = [
  ...CLINIC_ROUTE_PLANS,
  ...Array.from({ length: A03_DATASET_SIZE - CLINIC_ROUTE_PLANS.length }, (_, index) =>
    createA03RoutePlan(index),
  ),
];

/**
 * Metrics for every A03 plan, historical ids included. The historical map is
 * never mutated: its three entries are copied in first and win, so a request
 * without the A03 cookie keeps resolving through `CLINIC_ROUTE_METRICS_BY_PLAN_ID`
 * exactly as before.
 */
const A03_ROUTE_METRICS_BY_PLAN_ID = Object.fromEntries(
  A03_ROUTE_PLANS.map((plan) => {
    const historical = CLINIC_ROUTE_METRICS_BY_PLAN_ID[plan.id];
    if (historical) {
      return [plan.id, historical];
    }

    const completedStops = plan.completedStops;
    const skippedStops = plan.totalStops - completedStops > 0 ? 1 : 0;

    return [
      plan.id,
      {
        routePlanId: plan.id,
        totalStops: plan.totalStops,
        completedStops,
        skippedStops,
        noShowStops: 0,
        complianceRate: Math.round((completedStops / plan.totalStops) * 100),
        averageDurationMinutes: 30 + (plan.id % 30),
      },
    ];
  }),
);

// PR-R06: audit is RF debounced (high-volume, no over-fetch superset), so the
// mobile adaptive list can request a limit up to ADMIN_AUDIT_LIMIT_CAP (32).
// The base 11 hand-authored entries are cycled to reach the fixture's
// declared unfiltered total (47) so any adaptive offset/limit within that
// range slices real rows instead of running off the end of the array.
const AUDIT_EVENTS_TOTAL = 47;

const AUDIT_EVENTS_BASE = [
  {
    event: "auth.admin.login.succeeded",
    action: "Inicio de sesión administrativo",
    entity: "admin_user",
    entityId: 41,
    actorType: "admin_user",
    actorAdminUserId: 41,
    metadata: { surface: "admin_dashboard", result: "success" },
  },
  {
    event: "clinic_user.role.changed",
    action: "Rol de clínica actualizado",
    entity: "clinic_user",
    entityId: 202,
    actorType: "admin_user",
    actorAdminUserId: 41,
    targetClinicUserId: 202,
    clinicId: 12,
    metadata: {
      username: "owner_palermo",
      clinicName: "Clínica Palermo Norte",
      previousRole: "clinic_staff",
      newRole: "clinic_owner",
    },
  },
  {
    event: "report.uploaded",
    action: "Informe cargado",
    entity: "report",
    entityId: 7302,
    actorType: "admin_user",
    actorAdminUserId: 41,
    clinicId: 12,
    reportId: 7302,
    metadata: { studyType: "Histopatología", patient: "Mora" },
  },
  {
    event: "study_tracking.notification.created",
    action: "Notificación de seguimiento creada",
    entity: "study_tracking_case",
    entityId: 8804,
    actorType: "system",
    metadata: { channel: "portal", stage: "evaluation" },
  },
  {
    event: "report.workflow_stage.changed",
    action: "Etapa de informe actualizada",
    entity: "report",
    entityId: 7305,
    actorType: "admin_user",
    actorAdminUserId: 42,
    clinicId: 15,
    reportId: 7305,
    metadata: { previousStage: "processing", newStage: "evaluation" },
  },
  {
    event: "report_access_token.created",
    action: "Token particular creado",
    entity: "report_access_token",
    entityId: 9106,
    actorType: "admin_user",
    actorAdminUserId: 41,
    clinicId: 16,
    targetReportAccessTokenId: 9106,
    metadata: { petName: "Simón", linkedReport: true },
  },
  {
    event: "clinic.updated",
    action: "Datos de clínica actualizados",
    entity: "clinic",
    entityId: 17,
    actorType: "admin_user",
    actorAdminUserId: 42,
    clinicId: 17,
    metadata: { field: "contactPhone", result: "updated" },
  },
  {
    event: "report.special_stain.changed",
    action: "Tinción especial solicitada",
    entity: "report",
    entityId: 7308,
    actorType: "clinic_user",
    actorClinicUserId: 308,
    clinicId: 18,
    reportId: 7308,
    metadata: { requested: true, stainType: "PAS" },
  },
  {
    event: "auth.session.revoked",
    action: "Sesión revocada",
    entity: "admin_session",
    entityId: 5209,
    actorType: "admin_user",
    actorAdminUserId: 41,
    metadata: { reason: "operator_request" },
  },
  {
    event: "clinic_user.credentials.updated",
    action: "Credenciales de clínica actualizadas",
    entity: "clinic_user",
    entityId: 309,
    actorType: "clinic_user",
    actorClinicUserId: 309,
    clinicId: 18,
    metadata: { field: "password", result: "updated" },
  },
  {
    event: "study_tracking.case.updated",
    action: "Caso de seguimiento actualizado",
    entity: "study_tracking_case",
    entityId: 8805,
    actorType: "admin_user",
    actorAdminUserId: 42,
    clinicId: 15,
    metadata: { stage: "report_development" },
  },
  {
    event: "report_access_token.revoked",
    action: "Token particular revocado",
    entity: "report_access_token",
    entityId: 9107,
    actorType: "admin_user",
    actorAdminUserId: 41,
    clinicId: 16,
    targetReportAccessTokenId: 9107,
    metadata: { reason: "operator_request" },
  },
  {
    event: "report.status.changed",
    action: "Estado de informe actualizado",
    entity: "report",
    entityId: 7309,
    actorType: "clinic_user",
    actorClinicUserId: 310,
    clinicId: 12,
    reportId: 7309,
    metadata: { previousStatus: "pending", newStatus: "delivered" },
  },
];

const AUDIT_EVENTS = Array.from({ length: AUDIT_EVENTS_TOTAL }, (_, index) => ({
  id: 9900 - index,
  action: null,
  entity: null,
  entityId: null,
  actorType: null,
  actorAdminUserId: null,
  actorClinicUserId: null,
  actorReportAccessTokenId: null,
  clinicId: null,
  reportId: null,
  targetAdminUserId: null,
  targetClinicUserId: null,
  targetReportAccessTokenId: null,
  requestId: null,
  requestMethod: "GET",
  requestPath: "/api/admin/e2e-fixture",
  ipAddress: null,
  userAgent: null,
  metadata: null,
  createdAt: new Date(Date.UTC(2026, 5, 18, 14 - index, 30)).toISOString(),
  ...AUDIT_EVENTS_BASE[index % AUDIT_EVENTS_BASE.length],
}));

const TOKENS = Array.from({ length: 9 }, (_, index) => ({
  id: 9101 + index,
  clinicId: 12 + index,
  reportId: index % 3 === 0 ? 7301 + index : null,
  tokenLast4: String(4201 + index),
  tutorLastName: ["Gómez", "Pérez", "Luna"][index % 3],
  petName: ["Mora", "Simón", "Lola", "Bruno", "Kira", "Toby", "Nina", "Rocco", "Uma"][index],
  petAge: `${2 + index} años`,
  petBreed: index % 2 === 0 ? "Mestizo" : "Labrador",
  petSex: index % 2 === 0 ? "female" : "male",
  petSpecies: index % 2 === 0 ? "canine" : "feline",
  sampleLocation: "Piel",
  sampleEvolution: `${3 + index} semanas`,
  detailsLesion: "Lesión nodular para evaluación anatomopatológica.",
  extractionDate: "2026-06-10T10:00:00.000Z",
  shippingDate: "2026-06-11T10:00:00.000Z",
  isActive: index !== 7,
  lastLoginAt: index % 2 === 0 ? "2026-06-17T16:20:00.000Z" : null,
  createdAt: "2026-06-12T09:15:00.000Z",
  updatedAt: "2026-06-17T16:20:00.000Z",
  createdByAdminId: 41,
  createdByClinicUserId: null,
  hasLinkedReport: index % 3 === 0,
}));

const REPORT_STAGES = [
  "sample_received",
  "processing",
  "evaluation",
  "report_development",
  "delivered",
];

const REPORTS = Array.from({ length: 9 }, (_, index) => ({
  id: 7301 + index,
  clinicId: 12 + index,
  clinicName: `Clínica E2E ${String(index + 1).padStart(2, "0")}`,
  patientName: ["Mora", "Simón", "Lola", "Bruno", "Kira", "Toby", "Nina", "Rocco", "Uma"][index],
  fileName: `informe-e2e-${7301 + index}.pdf`,
  studyType: index % 2 === 0 ? "histopatologia" : "citologia",
  uploadDate: `2026-06-${String(17 - index).padStart(2, "0")}T12:00:00.000Z`,
  createdAt: "2026-06-08T09:00:00.000Z",
  workflowStage: REPORT_STAGES[index % REPORT_STAGES.length],
  specialStainRequested: index === 2 || index === 6,
  specialStainAt: index === 2 || index === 6 ? "2026-06-17T10:00:00.000Z" : null,
  workflowUpdatedAt: "2026-06-18T11:00:00.000Z",
}));

const ADMIN_USERS_TARGET_TOTAL = 5000;
const ADMIN_USER_STATUSES = ["active", "inactive", "locked"];
const ADMIN_USER_LOCALITIES = [
  "CABA",
  "Buenos Aires",
  "Córdoba",
  "Rosario",
  "Mendoza",
];

const LEGACY_USERS = Array.from({ length: 9 }, (_, index) =>
  index === 0
    ? {
        userType: "admin",
        userId: 41,
        username: "admin_operaciones",
        role: "admin",
        status: "active",
        clinicId: null,
        clinicName: null,
        createdAt: "2025-11-10T10:00:00.000Z",
        updatedAt: "2026-06-18T09:00:00.000Z",
      }
    : {
        userType: "clinic",
        userId: 200 + index,
        username: `usuario_clinica_${String(index).padStart(2, "0")}`,
        role: index % 2 === 0 ? "clinic_owner" : "clinic_staff",
        status: ADMIN_USER_STATUSES[(index - 1) % ADMIN_USER_STATUSES.length],
        clinicId: 11 + index,
        clinicName: `Clínica E2E ${String(index).padStart(2, "0")}`,
        clinicLocality: index % 2 === 0 ? "CABA" : "Buenos Aires",
        createdAt: "2026-01-15T10:00:00.000Z",
        updatedAt: "2026-06-17T15:30:00.000Z",
      },
);

function createSyntheticAdminUser(index) {
  const createdAt = isoDaysBefore("2026-06-18T10:00:00.000Z", index % 365, 10);
  const updatedAt = isoDaysBefore("2026-06-18T15:30:00.000Z", index % 90, 15);

  return {
    userType: "admin",
    userId: 10_000 + index,
    username: `admin_fixture_${String(index).padStart(4, "0")}`,
    role: "admin",
    status: ADMIN_USER_STATUSES[index % ADMIN_USER_STATUSES.length],
    clinicId: null,
    clinicName: null,
    createdAt,
    updatedAt,
  };
}

function createSyntheticClinicUser(index) {
  const clinicId = 20_000 + index;
  const createdAt = isoDaysBefore("2026-06-18T10:00:00.000Z", index % 365, 10);
  const updatedAt = isoDaysBefore("2026-06-18T15:30:00.000Z", index % 90, 15);

  return {
    userType: "clinic",
    userId: 30_000 + index,
    username: `usuario_clinica_fixture_${String(index).padStart(4, "0")}`,
    role: index % 2 === 0 ? "clinic_owner" : "clinic_staff",
    status: ADMIN_USER_STATUSES[index % ADMIN_USER_STATUSES.length],
    clinicId,
    clinicName: `Clínica Fixture ${String(index).padStart(4, "0")}`,
    clinicLocality: ADMIN_USER_LOCALITIES[index % ADMIN_USER_LOCALITIES.length],
    createdAt,
    updatedAt,
  };
}

const SYNTHETIC_ADMIN_USERS = Array.from({ length: 249 }, (_, index) =>
  createSyntheticAdminUser(index + 1),
);

const SYNTHETIC_CLINIC_USERS = Array.from(
  {
    length:
      ADMIN_USERS_TARGET_TOTAL -
      LEGACY_USERS.length -
      SYNTHETIC_ADMIN_USERS.length,
  },
  (_, index) => createSyntheticClinicUser(index + 1),
);

const USERS = [
  ...LEGACY_USERS,
  ...SYNTHETIC_ADMIN_USERS,
  ...SYNTHETIC_CLINIC_USERS,
];

function readAdminUsersPagination(url, total) {
  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));
  const hasLimit = url.searchParams.has("limit");
  const limit =
    hasLimit && Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 100)
      : Math.min(total, 9);
  const offset =
    Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  return { limit, offset };
}

function includesAdminUserText(value, query) {
  return String(value ?? "").toLowerCase().includes(query);
}

// CAP-A1 (5000-user dataset) is opt-in via ?dataset=high-volume. Requests
// without it — i.e. the real AdminUsersRolesReadOnlyCard component, whose
// adaptive server-page-size can exceed 9 on tall viewports — keep resolving
// against the 9-user LEGACY_USERS pool, preserving the pre-CAP-A1 no-scroll
// contract (`expectNinePopulatedRows`) that relies on the dataset itself
// capping the response at 9 rows regardless of the requested limit.
function isHighVolumeAdminUsersRequest(url) {
  return url.searchParams.get("dataset") === "high-volume";
}

function filterAdminUsers(url) {
  const query = (
    url.searchParams.get("query") ??
    url.searchParams.get("search") ??
    ""
  )
    .trim()
    .toLowerCase();
  const userType = url.searchParams.get("userType")?.trim() ?? "";
  const role = url.searchParams.get("role")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const pool = isHighVolumeAdminUsersRequest(url) ? USERS : LEGACY_USERS;

  return pool.filter((user) => {
    const matchesQuery =
      !query ||
      includesAdminUserText(user.userId, query) ||
      includesAdminUserText(user.username, query) ||
      includesAdminUserText(user.role, query) ||
      includesAdminUserText(user.status, query) ||
      includesAdminUserText(user.clinicId, query) ||
      includesAdminUserText(user.clinicName, query) ||
      includesAdminUserText(user.clinicLocality, query);
    const matchesUserType = !userType || user.userType === userType;
    const matchesRole = !role || user.role === role;
    const matchesStatus = !status || user.status === status;

    return matchesQuery && matchesUserType && matchesRole && matchesStatus;
  });
}

function countAdminUsersByType(users) {
  return users.reduce(
    (totals, user) => {
      if (user.userType === "admin") {
        totals.adminUsers += 1;
      } else {
        totals.clinicUsers += 1;
      }

      return totals;
    },
    { adminUsers: 0, clinicUsers: 0 },
  );
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function readClinicReportsPagination(url, total) {
  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));
  const hasLimit = url.searchParams.has("limit");
  const limit =
    hasLimit && Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 100)
      : total;
  const offset =
    Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  return { limit, offset };
}

function paginateClinicReports(reports, url) {
  const total = reports.length;
  const { limit, offset } = readClinicReportsPagination(url, total);
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    reports: reports.slice(offset, offset + limit),
    total,
    totalPages,
    limit,
    offset,
  };
}

function includesClinicReportText(value, query) {
  return String(value ?? "").toLowerCase().includes(query);
}

function filterClinicReports(url) {
  const query = url.searchParams.get("query")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const studyType =
    url.searchParams.get("studyType")?.trim().toLowerCase() ?? "";

  return CLINIC_REPORTS.filter((report) => {
    const matchesQuery =
      !query ||
      includesClinicReportText(report.id, query) ||
      includesClinicReportText(report.patientName, query) ||
      includesClinicReportText(report.studyType, query) ||
      includesClinicReportText(report.status, query) ||
      includesClinicReportText(report.clinicName, query);
    const matchesStatus = !status || report.status === status;
    const matchesStudyType =
      !studyType || includesClinicReportText(report.studyType, studyType);

    return matchesQuery && matchesStatus && matchesStudyType;
  });
}

function hasPopulatedAdminSession(request) {
  return (request.headers.cookie ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .includes(`admin_session_id=${POPULATED_ADMIN_SESSION}`);
}

function hasPopulatedClinicSession(request) {
  return (request.headers.cookie ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .includes(`app_session_id=${POPULATED_CLINIC_SESSION}`);
}

/**
 * A03 opt-in gate. Deliberately conjunctive: the auxiliary cookie ALONE never
 * activates the dataset, so an unauthenticated or non-populated caller can
 * never reach it, and the historical path stays byte-identical for every
 * request that does not carry the exact cookie value.
 */
function hasA03AdaptiveDataset(request) {
  if (!hasPopulatedClinicSession(request)) {
    return false;
  }

  return (request.headers.cookie ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .includes(`${A03_ADAPTIVE_COOKIE_NAME}=${A03_ADAPTIVE_COOKIE_VALUE}`);
}

/**
 * PR-TRUNC opt-in gate. Conjunctive exactly like {@link hasA03AdaptiveDataset}:
 * the auxiliary cookie ALONE never activates the long-text dataset.
 */
function hasLongTextDataset(request) {
  if (!hasPopulatedClinicSession(request)) {
    return false;
  }

  return (request.headers.cookie ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .includes(`${LONG_TEXT_COOKIE_NAME}=${LONG_TEXT_COOKIE_VALUE}`);
}

/**
 * Rewrites the FIRST report of a page with the long synthetic values. Only the
 * first item changes, so row count, pagination totals and every adaptive
 * capacity the A03 baseline measures stay exactly as they are: this dataset
 * makes text long, never longer lists.
 */
function withLongClinicReportText(page) {
  if (!Array.isArray(page.reports) || page.reports.length === 0) {
    return page;
  }

  const [first, ...rest] = page.reports;

  return {
    ...page,
    reports: [
      {
        ...first,
        patientName: LONG_TEXT_CLINIC_REPORT.patientName,
        studyType: LONG_TEXT_CLINIC_REPORT.studyType,
        clinicName: LONG_TEXT_CLINIC_REPORT.clinicName,
        fileName: LONG_TEXT_CLINIC_REPORT.fileName,
        hasFile: true,
      },
      ...rest,
    ],
  };
}

/**
 * Pagination semantics of the A03 datasets, mirroring what the real logistics
 * endpoints do (`server/routes/logistics-field-visits.fastify.ts`:
 * `parsePositiveInt(request.query.limit, 50, 100)`):
 *
 * - no `limit` and no `offset` → the FULL dataset, so `client-slice` consumers
 *   page over a set wide enough to hold a complete second page;
 * - `limit` present → positive integer, capped at `maxLimit` (never above 100);
 *   a non-integer or non-positive value falls back to `defaultLimit`, it is not
 *   silently coerced into whatever the caller sent;
 * - `offset` present → non-negative integer; anything else normalizes to 0;
 * - the slice is exactly `slice(offset, offset + limit)`, and the response
 *   shape is unchanged (no `total`, which the runtime endpoints do not expose).
 */
function sliceA03Dataset(url, items, defaultLimit, maxLimit) {
  const hasLimit = url.searchParams.has("limit");
  const hasOffset = url.searchParams.has("offset");

  if (!hasLimit && !hasOffset) {
    return items;
  }

  const rawLimit = Number(url.searchParams.get("limit"));
  const limit =
    hasLimit && Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

  const rawOffset = Number(url.searchParams.get("offset"));
  const offset =
    hasOffset && Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return items.slice(offset, offset + limit);
}

function auditSnapshot(url) {
  const event = url.searchParams.get("event");
  const limit = Number(url.searchParams.get("limit") ?? 9);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const filteredItems = event
    ? AUDIT_EVENTS.filter((entry) => entry.event === event)
    : AUDIT_EVENTS;
  const total = event === "clinic_user.role.changed"
    ? 6
    : event === "study_tracking.notification.created"
      ? 4
      : AUDIT_EVENTS_TOTAL;

  return {
    success: true,
    count: Math.min(filteredItems.length, limit),
    items: filteredItems.slice(offset, offset + limit),
    pagination: { limit, offset, total },
    filters: event ? { event } : {},
  };
}

function handlePopulatedRequest(request, response, url) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed in E2E fixture" });
    return;
  }

  if (url.pathname === "/api/admin/audit-log") {
    sendJson(response, 200, auditSnapshot(url));
    return;
  }

  if (url.pathname === "/api/admin/study-tracking/notifications") {
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    sendJson(response, 200, {
      success: true,
      count: 0,
      notifications: [],
      pagination: { limit, offset },
    });
    return;
  }

  if (url.pathname === "/api/admin/system/health") {
    sendJson(response, 200, {
      success: true,
      status: "ok",
      version: "2.1.0-e2e",
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
      services: {
        database: "up",
        storage: "configured",
        email_transport: "gmail_api",
        gmail_api: "configured",
        smtp: "not_configured",
        contact_email: "configured",
        contact_email_recipients: ["qa-fixture@example.test"],
        contact_to_configured: true,
        smtp_from_configured: true,
        cors: "configured",
        cors_origins: ["http://127.0.0.1:3000"],
        cors_has_local_or_lan_origins: true,
        node_env: "e2e",
      },
      runtime: {
        uptimeSeconds: 172800,
        memory: {
          rssMb: 128,
          heapTotalMb: 96,
          heapUsedMb: 64,
          externalMb: 8,
          arrayBuffersMb: 2,
        },
      },
      health: { timestamp: "2026-06-18T14:30:00.000Z" },
    });
    return;
  }

  if (url.pathname === "/api/admin/particular-tokens") {
    const limit = Number(url.searchParams.get("limit") ?? 9);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const clinicIdValue = url.searchParams.get("clinicId");
    const clinicId = clinicIdValue ? Number(clinicIdValue) : null;
    const filteredTokens = clinicId
      ? TOKENS.filter((token) => token.clinicId === clinicId)
      : TOKENS;
    const particularTokens = filteredTokens.slice(offset, offset + limit);

    sendJson(response, 200, {
      success: true,
      count: particularTokens.length,
      particularTokens,
      pagination: { limit, offset },
      filters: { clinicId },
    });
    return;
  }

  if (url.pathname === "/api/admin/report-workflow") {
    const limit = Number(url.searchParams.get("limit") ?? 9);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    sendJson(response, 200, {
      success: true,
      reports: REPORTS.slice(offset, offset + limit),
      pagination: { limit, offset, hasMore: offset + limit < REPORTS.length },
    });
    return;
  }

  if (url.pathname === "/api/admin/users-roles") {
    const filteredUsers = filterAdminUsers(url);
    const total = filteredUsers.length;
    const { limit, offset } = readAdminUsersPagination(url, total);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    sendJson(response, 200, {
      success: true,
      users: filteredUsers.slice(offset, offset + limit),
      total,
      totalPages,
      limit,
      offset,
      totals: countAdminUsersByType(filteredUsers),
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
    });
    return;
  }

  sendJson(response, 404, { error: "E2E fixture route not found" });
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);

  if (url.pathname === "/__e2e/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  // Public, unauthenticated — mirrors server/routes/app-version.fastify.ts so
  // AppVersionGate's production-only check (frontend/src/components/app-version/AppVersionGate.tsx)
  // resolves instead of 404ing under `next start`. forceUpdate stays false so
  // E2E never sees the update-required overlay.
  if (url.pathname === "/api/app-version") {
    response.writeHead(200, {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        success: true,
        appVersion: "e2e-app-version",
        clientMinVersion: "e2e-app-version",
        forceUpdate: false,
        displayVersion: "Portal VETNEB v2.1.0",
      }),
    );
    return;
  }

  if (hasPopulatedClinicSession(request) && url.pathname === "/api/reports") {
    const reports =
      url.searchParams.has("query") ||
      url.searchParams.has("status") ||
      url.searchParams.has("studyType")
        ? filterClinicReports(url)
        : CLINIC_REPORTS;
    const page = paginateClinicReports(reports, url);
    sendJson(
      response,
      200,
      hasLongTextDataset(request) ? withLongClinicReportText(page) : page,
    );
    return;
  }

  if (
    hasPopulatedClinicSession(request) &&
    url.pathname === "/api/reports/search"
  ) {
    const searchPage = paginateClinicReports(filterClinicReports(url), url);
    sendJson(
      response,
      200,
      hasLongTextDataset(request)
        ? withLongClinicReportText(searchPage)
        : searchPage,
    );
    return;
  }

  // A03 branches are evaluated first and are strictly narrower than the
  // historical ones (they additionally require the auxiliary cookie), so a
  // request without it falls through to the untouched historical payload.
  if (
    hasA03AdaptiveDataset(request) &&
    url.pathname === "/api/logistics/field-visits"
  ) {
    sendJson(response, 200, {
      visits: sliceA03Dataset(url, A03_FIELD_VISITS, 50, 100),
    });
    return;
  }

  if (
    hasA03AdaptiveDataset(request) &&
    url.pathname === "/api/logistics/route-plans"
  ) {
    sendJson(response, 200, {
      routePlans: sliceA03Dataset(url, A03_ROUTE_PLANS, 50, 100),
    });
    return;
  }

  if (
    hasPopulatedClinicSession(request) &&
    url.pathname === "/api/logistics/field-visits"
  ) {
    sendJson(response, 200, { visits: CLINIC_FIELD_VISITS });
    return;
  }

  if (
    hasPopulatedClinicSession(request) &&
    url.pathname === "/api/logistics/route-plans"
  ) {
    sendJson(response, 200, { routePlans: CLINIC_ROUTE_PLANS });
    return;
  }

  const routePlanMetricsMatch = url.pathname.match(
    /^\/api\/logistics\/route-plans\/(\d+)\/metrics$/,
  );
  if (hasPopulatedClinicSession(request) && routePlanMetricsMatch) {
    const planId = Number(routePlanMetricsMatch[1]);
    const metrics = hasA03AdaptiveDataset(request)
      ? A03_ROUTE_METRICS_BY_PLAN_ID[planId]
      : CLINIC_ROUTE_METRICS_BY_PLAN_ID[planId];
    if (metrics) {
      sendJson(response, 200, { metrics });
    } else {
      sendJson(response, 404, { error: "route plan metrics not found" });
    }
    return;
  }

  if (!hasPopulatedAdminSession(request)) {
    sendJson(response, 404, { error: "E2E populated session required" });
    return;
  }

  handlePopulatedRequest(request, response, url);
});

server.listen(PORT, HOST);

// Teardown contract: the process must always exit and free port 3107, even
// with keep-alive sockets still open. `closeAllConnections` prevents
// `server.close` from waiting on idle agents, and the unref'd failsafe timer
// guarantees exit if anything else keeps the event loop alive.
let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  server.close(() => process.exit(0));
  server.closeAllConnections();

  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
