// R-02 / LIMPIEZA E2E §23 — canonical, opt-in visual stress dataset.
// The shared HTTP fixture is the only response owner. The visual spec only
// selects this profile through the test-only cookie exported below.

export const VISUAL_STRESS_COOKIE_NAME = "e2e_visual_stress_dataset";
export const VISUAL_STRESS_COOKIE_VALUE = "1";

export const VISUAL_STRESS_CLINIC_NAMES = Object.freeze([
  "Clinica Veterinaria Integral de Diagnostico Avanzado y Seguimiento Multisede Norte",
  "Hospital Veterinario Regional San Martin de los Andes Area Oncologia y Anatomia Patologica",
  "Centro Medico Veterinario Especializado en Cirugia, Imagenes y Citologia Los Arrayanes",
  "Clinica de Emergencias Veterinarias Veinticuatro Horas Distrito Costanera Sur",
  "Instituto Veterinario Universitario de Referencia Diagnostica Dr. Manuel Belgrano",
  "Consultorios Integrados de Medicina Felina y Canina Barrio Parque Central",
  "Centro de Derivacion Veterinaria Patologia Compleja y Seguimiento Longitudinal",
  "Hospital Escuela Veterinario Metropolitano Unidad de Casos Externos",
  "Clinica Veterinaria Familias Multiespecie Diagnostico y Rehabilitacion",
  "Centro Integral de Salud Animal Laboratorio y Anatomia Patologica Oeste",
  "Veterinaria Comunitaria de Alta Complejidad y Control Posquirurgico Sur",
  "Unidad Veterinaria Movil de Diagnostico Rural y Coordinacion Logistica",
]);

export const VISUAL_STRESS_PATIENT_NAMES = Object.freeze([
  "Paciente Canino Senior con Nombre Compuesto Extraordinariamente Largo",
  "Mora del Valle de los Diagnosticos Prolongados",
  "Simon Maximo Rodriguez Fernandez de la Clinica Norte",
  "Lola Maria de las Nieves y del Control Evolutivo",
  "Bruno Patricio del Seguimiento Histopatologico Extendido",
  "Kira Josefina Paciente Oncologica en Control Prioritario",
  "Nina Esperanza del Protocolo de Muestras Seriadas",
  "Rocco Baltasar con Derivacion Interclinica Urgente",
  "Uma Catalina de Informe Complementario Pendiente",
  "Toby Alexander Paciente con Tutor de Apellidos Multiples",
  "Frida Milagros de Control Citologico Trimestral",
  "Ramon Federico del Circuito de Reenvio Documental",
]);

export const VISUAL_STRESS_REPORT_STATUSES = Object.freeze([
  "pending",
  "uploaded",
  "processing",
  "delivered",
  "error",
  "completed",
]);

export const VISUAL_STRESS_WORKFLOW_STAGES = Object.freeze([
  "sample_received",
  "processing",
  "evaluation",
  "report_development",
  "delivered",
]);

export const VISUAL_STRESS_REPORTS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => ({
    id: 120_000 + index,
    clinicId: 9_000 + index,
    clinicName: VISUAL_STRESS_CLINIC_NAMES[index],
    patientName: VISUAL_STRESS_PATIENT_NAMES[index],
    fileName: `informe-visual-stress-${120_000 + index}-nombre-de-archivo-largo-para-validar-truncado.pdf`,
    studyType:
      index % 2 === 0
        ? "Histopatologia dermatologica con inmunohistoquimica y margenes ampliados"
        : "Citologia aspirativa de lesion profunda con descripcion extendida",
    status: VISUAL_STRESS_REPORT_STATUSES[index % VISUAL_STRESS_REPORT_STATUSES.length],
    uploadDate: `2026-06-${String(28 - index).padStart(2, "0")}T12:30:00.000Z`,
    hasFile: index % 4 !== 0,
    createdAt: `2026-06-${String(16 - (index % 8)).padStart(2, "0")}T08:15:00.000Z`,
    updatedAt: `2026-06-${String(28 - index).padStart(2, "0")}T15:45:00.000Z`,
    workflowStage: VISUAL_STRESS_WORKFLOW_STAGES[index % VISUAL_STRESS_WORKFLOW_STAGES.length],
    specialStainRequested: index % 3 === 0,
    specialStainAt: index % 3 === 0 ? "2026-06-24T11:20:00.000Z" : null,
    workflowUpdatedAt: "2026-06-29T16:00:00.000Z",
  })),
);

export const VISUAL_STRESS_FIELD_VISITS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => ({
    id: 130_000 + index,
    clinicId: 9_000 + index,
    clinicName: VISUAL_STRESS_CLINIC_NAMES[index],
    status: ["scheduled", "in_progress", "done", "cancelled", "error"][index % 5],
    scheduledAt: `2026-07-${String(index + 1).padStart(2, "0")}T13:30:00.000Z`,
    completedAt:
      index % 5 === 2
        ? `2026-07-${String(index + 1).padStart(2, "0")}T16:10:00.000Z`
        : null,
    address:
      "Avenida de las Derivaciones Veterinarias Complejas 4850, Torre Norte, Piso 12, Consultorio 1204, Ciudad Autonoma de Buenos Aires",
    notes:
      "Retiro de muestras refrigeradas, entrega de material complementario, firma de conformidad y observaciones operativas extensas para validar wrapping y densidad.",
    createdAt: "2026-06-20T09:00:00.000Z",
    updatedAt: "2026-06-29T10:30:00.000Z",
  })),
);

export const VISUAL_STRESS_ROUTE_PLANS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => ({
    id: 140_000 + index,
    name: `Ruta stress ${index + 1} - corredor logistico con descripcion extensa`,
    status: ["pending", "in_progress", "completed", "error"][index % 4],
    scheduledDate: `2026-07-${String(index + 3).padStart(2, "0")}T09:00:00.000Z`,
    visitsCount: 18 + index,
    completedVisitsCount: index % 4 === 2 ? 18 + index : index,
    pendingVisitsCount: 18 + index - (index % 4 === 2 ? 18 + index : index),
    createdAt: "2026-06-22T09:00:00.000Z",
    updatedAt: "2026-06-29T12:00:00.000Z",
  })),
);

export function visualStressRouteMetrics(routePlanId) {
  return {
    routePlanId,
    totalVisits: 48_250,
    completedVisits: 31_975,
    pendingVisits: 16_275,
    delayedVisits: 824,
    averageCompletionMinutes: 128,
  };
}

const VISUAL_STRESS_EVENT_CODES = Object.freeze([
  "auth.admin.login.succeeded",
  "clinic_user.role.changed",
  "report.uploaded",
  "study_tracking.notification.created",
  "report.workflow_stage.changed",
  "report_access_token.created",
  "clinic.updated",
  "report.special_stain.changed",
  "auth.session.revoked",
  "clinic_user.credentials.updated",
  "study_tracking.case.updated",
  "report_access_token.revoked",
  "report.status.changed",
  "admin.pricing.updated",
  "admin.session.revoke.failed",
  "system.maintenance.dry_run.completed",
]);

export const VISUAL_STRESS_AUDIT_EVENTS = Object.freeze(
  Array.from({ length: 16 }, (_, index) => ({
    id: 150_000 - index,
    event: VISUAL_STRESS_EVENT_CODES[index % VISUAL_STRESS_EVENT_CODES.length],
    action: `Accion administrativa stress ${index + 1} con etiqueta larga para validar tablas densas`,
    entity: index % 2 === 0 ? "report" : "clinic_user",
    entityId: 200_000 + index,
    actorType: ["admin_user", "clinic_user", "system"][index % 3],
    actorAdminUserId: index % 3 === 0 ? 41 + index : null,
    actorClinicUserId: index % 3 === 1 ? 300 + index : null,
    actorReportAccessTokenId: null,
    clinicId: 9_000 + (index % VISUAL_STRESS_CLINIC_NAMES.length),
    reportId: 120_000 + (index % VISUAL_STRESS_REPORTS.length),
    targetAdminUserId: null,
    targetClinicUserId: index % 4 === 0 ? 400 + index : null,
    targetReportAccessTokenId: index % 5 === 0 ? 500 + index : null,
    requestId: `stress-request-${index + 1}-abcdef1234567890`,
    requestMethod: "GET",
    requestPath: "/api/admin/visual-stress-fixture/very/long/path/for/table-density",
    ipAddress: null,
    userAgent: null,
    metadata: {
      clinicName: VISUAL_STRESS_CLINIC_NAMES[index % VISUAL_STRESS_CLINIC_NAMES.length],
      email: `responsable.operativo.con.nombre.largo.${index + 1}.visual-stress@example.test`,
      status: ["pendiente", "enviado", "usado", "expirado", "error", "completado"][index % 6],
    },
    createdAt: new Date(Date.UTC(2026, 5, 29, 18 - index, 15)).toISOString(),
  })),
);

export const VISUAL_STRESS_PARTICULAR_TOKENS = Object.freeze(
  Array.from({ length: 14 }, (_, index) => ({
    id: 160_000 + index,
    clinicId: 9_000 + (index % VISUAL_STRESS_CLINIC_NAMES.length),
    reportId: index % 3 === 0 ? 120_000 + index : null,
    tokenLast4: String(8400 + index),
    tutorLastName: `Responsable Legal Compuesto Apellido Uno Apellido Dos ${index + 1}`,
    petName: VISUAL_STRESS_PATIENT_NAMES[index % VISUAL_STRESS_PATIENT_NAMES.length],
    petAge: `${index + 1} anios y ${index % 12} meses`,
    petBreed: "Mestizo de talla grande con descripcion racial extendida para truncado",
    petSex: index % 2 === 0 ? "female" : "male",
    petSpecies: index % 2 === 0 ? "canine" : "feline",
    sampleLocation: "Region dorsal toracica izquierda con referencia anatomica prolongada",
    sampleEvolution: "Evolucion de multiples semanas con cambios inflamatorios intermitentes",
    detailsLesion:
      "Descripcion extensa de lesion, bordes, consistencia, coloracion y observaciones clinicas para stress visual.",
    extractionDate: "2026-06-11T10:00:00.000Z",
    shippingDate: "2026-06-12T10:00:00.000Z",
    isActive: index % 5 !== 0,
    lastLoginAt: index % 2 === 0 ? "2026-06-29T16:20:00.000Z" : null,
    createdAt: "2026-06-12T09:15:00.000Z",
    updatedAt: "2026-06-29T16:20:00.000Z",
    createdByAdminId: 41,
    createdByClinicUserId: null,
    hasLinkedReport: index % 3 === 0,
  })),
);

export const VISUAL_STRESS_USERS = Object.freeze(
  Array.from({ length: 14 }, (_, index) =>
    index % 5 === 0
      ? {
          userType: "admin",
          userId: 170_000 + index,
          username: `administrador.visual.stress.con.nombre.largo.${index}`,
          role: index % 10 === 0 ? "admin" : "operator",
          clinicId: null,
          clinicName: null,
          createdAt: "2025-11-10T10:00:00.000Z",
          updatedAt: "2026-06-29T09:00:00.000Z",
        }
      : {
          userType: "clinic",
          userId: 170_000 + index,
          username: `responsable.clinica.visual.stress.${index}.nombre.extenso@example.test`,
          role: index % 2 === 0 ? "clinic_owner" : "clinic_staff",
          clinicId: 9_000 + (index % VISUAL_STRESS_CLINIC_NAMES.length),
          clinicName: VISUAL_STRESS_CLINIC_NAMES[index % VISUAL_STRESS_CLINIC_NAMES.length],
          clinicLocality: "Localidad con nombre compuesto y jurisdiccion administrativa extendida",
          createdAt: "2026-01-15T10:00:00.000Z",
          updatedAt: "2026-06-29T15:30:00.000Z",
        },
  ),
);

export const VISUAL_STRESS_SYSTEM_HEALTH = Object.freeze({
  success: true,
  status: "degraded",
  version: "2.1.0-visual-stress-fixture-build-with-long-version-label",
  checkedBy: {
    adminUserId: 41,
    username: "administrador.visual.stress.responsable.operativo",
  },
  services: {
    database: "degraded",
    storage: "configured",
    email_transport: "gmail_api",
    gmail_api: "configured",
    smtp: "not_configured",
    contact_email: "configured",
    contact_email_recipients: [
      "mesa.de.ayuda.operativa.visual.stress.largo@example.test",
      "responsable.auditoria.y.seguridad.portal@example.test",
      "coordinacion.logistica.veterinaria.region.norte@example.test",
    ],
    contact_to_configured: true,
    smtp_from_configured: true,
    cors: "configured",
    cors_origins: [
      "http://127.0.0.1:3000",
      "https://portal-visual-stress-fixture-long-origin.example.test",
      "https://subdominio-operativo-extenso.example.test",
    ],
    cors_has_local_or_lan_origins: true,
    node_env: "e2e_visual_stress_fixture_with_long_environment_label",
  },
  runtime: {
    uptimeSeconds: 9_876_543,
    memory: {
      rssMb: 12_345,
      heapTotalMb: 8_192,
      heapUsedMb: 6_144,
      externalMb: 2_048,
      arrayBuffersMb: 1_024,
    },
  },
  health: { timestamp: "2026-06-29T18:45:00.000Z" },
});
