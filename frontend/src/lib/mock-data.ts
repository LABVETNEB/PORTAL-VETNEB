/**
 * MOCK DATA — Portal VETNEB Frontend
 *
 * Este archivo contiene datos de prueba para desarrollo y demostración.
 * Todos los datos aquí son FICTICIOS y no representan entidades reales.
 * Reemplazar por llamadas reales a la API cuando los endpoints estén disponibles.
 *
 * @mock
 */

import type {
  Report,
  FieldVisit,
  RoutePlan,
  RouteMetrics,
  AuditEntry,
  DashboardStats,
  Clinic,
} from "@/types";

// ─── Clínicas ────────────────────────────────────────────────────────────────

export const MOCK_CLINICS: Clinic[] = [
  {
    id: 1,
    name: "Clínica Veterinaria San Martín",
    contactEmail: "info@clinicasanmartin.com",
    contactPhone: "+54 11 4567-8901",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-06-01T08:30:00Z",
  },
  {
    id: 2,
    name: "Hospital Veterinario del Norte",
    contactEmail: "contacto@vetdelnorte.com",
    contactPhone: "+54 11 5678-9012",
    createdAt: "2024-02-20T09:00:00Z",
    updatedAt: "2024-06-15T11:00:00Z",
  },
  {
    id: 3,
    name: "Centro Veterinario Palermo",
    contactEmail: "palermo@vetcentro.com",
    contactPhone: "+54 11 6789-0123",
    createdAt: "2024-03-10T14:00:00Z",
    updatedAt: "2024-07-01T09:00:00Z",
  },
];

// ─── Informes ─────────────────────────────────────────────────────────────────

export const MOCK_REPORTS: Report[] = [
  {
    id: 1,
    clinicId: 1,
    clinicName: "Clínica Veterinaria San Martín",
    patientName: "Max (Labrador)",
    studyType: "Hemograma completo",
    status: "ready",
    uploadDate: "2025-04-28T10:30:00Z",
    storagePath: null,
    createdAt: "2025-04-28T10:30:00Z",
    updatedAt: "2025-04-28T14:00:00Z",
  },
  {
    id: 2,
    clinicId: 2,
    clinicName: "Hospital Veterinario del Norte",
    patientName: "Luna (Gato Persa)",
    studyType: "Bioquímica sérica",
    status: "processing",
    uploadDate: "2025-04-29T09:15:00Z",
    storagePath: null,
    createdAt: "2025-04-29T09:15:00Z",
    updatedAt: "2025-04-29T09:15:00Z",
  },
  {
    id: 3,
    clinicId: 1,
    clinicName: "Clínica Veterinaria San Martín",
    patientName: "Rocky (Bulldog Francés)",
    studyType: "Radiografía torácica",
    status: "delivered",
    uploadDate: "2025-04-25T16:00:00Z",
    storagePath: "clinics/1/2025-04/rocky-rx-torax.pdf",
    createdAt: "2025-04-25T16:00:00Z",
    updatedAt: "2025-04-26T10:00:00Z",
  },
  {
    id: 4,
    clinicId: 3,
    clinicName: "Centro Veterinario Palermo",
    patientName: "Bella (Golden Retriever)",
    studyType: "Ecografía abdominal",
    status: "uploaded",
    uploadDate: "2025-04-30T11:00:00Z",
    storagePath: null,
    createdAt: "2025-04-30T11:00:00Z",
    updatedAt: "2025-04-30T11:00:00Z",
  },
  {
    id: 5,
    clinicId: 2,
    clinicName: "Hospital Veterinario del Norte",
    patientName: "Simba (Gato Siamés)",
    studyType: "Uroanálisis",
    status: "ready",
    uploadDate: "2025-05-01T08:45:00Z",
    storagePath: null,
    createdAt: "2025-05-01T08:45:00Z",
    updatedAt: "2025-05-01T12:00:00Z",
  },
];

// ─── Visitas de campo ─────────────────────────────────────────────────────────

export const MOCK_FIELD_VISITS: FieldVisit[] = [
  {
    id: 1,
    clinicId: 1,
    clinicName: "Clínica Veterinaria San Martín",
    status: "scheduled",
    scheduledAt: "2025-05-05T09:00:00Z",
    completedAt: null,
    address: "Av. San Martín 1234, CABA",
    notes: "Entrega de resultados hemograma",
    createdAt: "2025-05-01T10:00:00Z",
    updatedAt: "2025-05-01T10:00:00Z",
  },
  {
    id: 2,
    clinicId: 2,
    clinicName: "Hospital Veterinario del Norte",
    status: "in_progress",
    scheduledAt: "2025-05-04T14:00:00Z",
    completedAt: null,
    address: "Calle Corrientes 5678, CABA",
    notes: "Recogida de muestras urgentes",
    createdAt: "2025-05-02T08:00:00Z",
    updatedAt: "2025-05-04T14:05:00Z",
  },
  {
    id: 3,
    clinicId: 3,
    clinicName: "Centro Veterinario Palermo",
    status: "done",
    scheduledAt: "2025-05-02T11:00:00Z",
    completedAt: "2025-05-02T11:45:00Z",
    address: "Thames 890, Palermo, CABA",
    notes: "Entrega informe ecografía",
    createdAt: "2025-04-30T09:00:00Z",
    updatedAt: "2025-05-02T11:45:00Z",
  },
  {
    id: 4,
    clinicId: 1,
    clinicName: "Clínica Veterinaria San Martín",
    status: "pending",
    scheduledAt: "2025-05-06T10:00:00Z",
    completedAt: null,
    address: "Av. San Martín 1234, CABA",
    notes: null,
    createdAt: "2025-05-03T15:00:00Z",
    updatedAt: "2025-05-03T15:00:00Z",
  },
];

// ─── Planes de ruta ───────────────────────────────────────────────────────────

export const MOCK_ROUTE_PLANS: RoutePlan[] = [
  {
    id: 1,
    name: "Ruta Norte — 5 Mayo 2025",
    status: "released",
    plannedDate: "2025-05-05T08:00:00Z",
    totalStops: 6,
    completedStops: 0,
    createdAt: "2025-05-03T10:00:00Z",
    updatedAt: "2025-05-03T16:00:00Z",
  },
  {
    id: 2,
    name: "Ruta Sur — 4 Mayo 2025",
    status: "in_progress",
    plannedDate: "2025-05-04T08:00:00Z",
    totalStops: 4,
    completedStops: 2,
    createdAt: "2025-05-02T11:00:00Z",
    updatedAt: "2025-05-04T13:30:00Z",
  },
  {
    id: 3,
    name: "Ruta Centro — 2 Mayo 2025",
    status: "completed",
    plannedDate: "2025-05-02T08:00:00Z",
    totalStops: 5,
    completedStops: 5,
    createdAt: "2025-04-30T09:00:00Z",
    updatedAt: "2025-05-02T17:00:00Z",
  },
  {
    id: 4,
    name: "Ruta Oeste — 6 Mayo 2025",
    status: "draft",
    plannedDate: "2025-05-06T08:00:00Z",
    totalStops: 3,
    completedStops: 0,
    createdAt: "2025-05-04T09:00:00Z",
    updatedAt: "2025-05-04T09:00:00Z",
  },
];

// ─── Métricas de ruta ─────────────────────────────────────────────────────────

export const MOCK_ROUTE_METRICS: RouteMetrics[] = [
  {
    routePlanId: 3,
    totalStops: 5,
    completedStops: 5,
    skippedStops: 0,
    noShowStops: 0,
    complianceRate: 100,
    averageDurationMinutes: 22,
  },
  {
    routePlanId: 2,
    totalStops: 4,
    completedStops: 2,
    skippedStops: 0,
    noShowStops: 0,
    complianceRate: 50,
    averageDurationMinutes: 18,
  },
];

// ─── Auditoría ────────────────────────────────────────────────────────────────

export const MOCK_AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: 1,
    event: "auth.clinic.login.succeeded",
    actorType: "clinic_user",
    actorId: 1,
    targetType: null,
    targetId: null,
    metadata: { username: "clinica_sanmartin", ip: "192.168.1.10" },
    createdAt: "2025-05-04T08:01:00Z",
  },
  {
    id: 2,
    event: "report.uploaded",
    actorType: "clinic_user",
    actorId: 1,
    targetType: "report",
    targetId: 4,
    metadata: { studyType: "Ecografía abdominal", clinicId: 3 },
    createdAt: "2025-04-30T11:00:00Z",
  },
  {
    id: 3,
    event: "report.status.changed",
    actorType: "admin_user",
    actorId: 1,
    targetType: "report",
    targetId: 1,
    metadata: { from: "processing", to: "ready" },
    createdAt: "2025-04-28T14:00:00Z",
  },
  {
    id: 4,
    event: "auth.admin.login.succeeded",
    actorType: "admin_user",
    actorId: 1,
    targetType: null,
    targetId: null,
    metadata: { username: "admin", ip: "10.0.0.1" },
    createdAt: "2025-04-28T13:55:00Z",
  },
  {
    id: 5,
    event: "report_access_token.created",
    actorType: "admin_user",
    actorId: 1,
    targetType: "report",
    targetId: 3,
    metadata: { expiresIn: "7d" },
    createdAt: "2025-04-26T10:00:00Z",
  },
];

// ─── Estadísticas del dashboard ───────────────────────────────────────────────

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalReports: 5,
  pendingReports: 2,
  activeVisits: 2,
  activePlans: 2,
};
