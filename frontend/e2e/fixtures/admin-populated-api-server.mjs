import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 3107;
const POPULATED_ADMIN_SESSION = "e2e_populated_admin_session";
const POPULATED_CLINIC_SESSION = "e2e_populated_clinic_session";

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

// R-13: only served when the request carries an explicit limit/offset
// querystring (the adaptive rutas/page.tsx contract always sends both), so
// the pre-existing unconditional-2-arg call sites (getDashboardStats,
// dashboard/logistica hub, metricas) keep hitting the unhandled path below
// and preserve the "no route-plans fixture" invariant already asserted by
// dashboard-clinic-module-state-parity.spec.ts.
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

  if (hasPopulatedClinicSession(request) && url.pathname === "/api/reports") {
    const reports =
      url.searchParams.has("query") ||
      url.searchParams.has("status") ||
      url.searchParams.has("studyType")
        ? filterClinicReports(url)
        : CLINIC_REPORTS;
    sendJson(response, 200, paginateClinicReports(reports, url));
    return;
  }

  if (
    hasPopulatedClinicSession(request) &&
    url.pathname === "/api/reports/search"
  ) {
    sendJson(
      response,
      200,
      paginateClinicReports(filterClinicReports(url), url),
    );
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
    url.pathname === "/api/logistics/route-plans" &&
    (url.searchParams.has("limit") && url.searchParams.has("offset"))
  ) {
    sendJson(response, 200, { routePlans: CLINIC_ROUTE_PLANS });
    return;
  }

  if (!hasPopulatedAdminSession(request)) {
    sendJson(response, 404, { error: "E2E populated session required" });
    return;
  }

  handlePopulatedRequest(request, response, url);
});

server.listen(PORT, HOST);

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
