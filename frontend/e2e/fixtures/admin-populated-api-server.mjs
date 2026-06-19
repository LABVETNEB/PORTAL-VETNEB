import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 3107;
const POPULATED_ADMIN_SESSION = "e2e_populated_admin_session";
const POPULATED_CLINIC_SESSION = "e2e_populated_clinic_session";

const CLINIC_REPORTS = [
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

const AUDIT_EVENTS = [
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
].map((entry, index) => ({
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
  ...entry,
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

const USERS = Array.from({ length: 9 }, (_, index) =>
  index === 0
    ? {
        userType: "admin",
        userId: 41,
        username: "admin_operaciones",
        role: "admin",
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
        clinicId: 11 + index,
        clinicName: `Clínica E2E ${String(index).padStart(2, "0")}`,
        clinicLocality: index % 2 === 0 ? "CABA" : "Buenos Aires",
        createdAt: "2026-01-15T10:00:00.000Z",
        updatedAt: "2026-06-17T15:30:00.000Z",
      },
);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
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
      : 47;

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
    const limit = Number(url.searchParams.get("limit") ?? 9);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const userType = url.searchParams.get("userType");
    const role = url.searchParams.get("role");
    const filteredUsers = USERS.filter(
      (user) => (!userType || user.userType === userType) && (!role || user.role === role),
    );

    sendJson(response, 200, {
      success: true,
      users: filteredUsers.slice(offset, offset + limit),
      total: filteredUsers.length,
      limit,
      offset,
      totals: { adminUsers: 3, clinicUsers: 26 },
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
    sendJson(response, 200, { reports: CLINIC_REPORTS });
    return;
  }

  if (
    hasPopulatedClinicSession(request) &&
    url.pathname === "/api/logistics/field-visits"
  ) {
    sendJson(response, 200, { visits: CLINIC_FIELD_VISITS });
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
