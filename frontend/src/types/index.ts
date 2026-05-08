// ============================================================
// PORTAL VETNEB - Tipos TypeScript del Frontend
// Derivados del schema Drizzle del backend (sin importar directamente)
// ============================================================

// --- Enums del backend (replicados para el frontend) ---

export const REPORT_STATUSES = [
  "uploaded",
  "processing",
  "ready",
  "delivered",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const FIELD_VISIT_STATUSES = [
  "pending",
  "scheduled",
  "in_progress",
  "done",
  "canceled",
  "no_show",
] as const;
export type FieldVisitStatus = (typeof FIELD_VISIT_STATUSES)[number];

export const ROUTE_PLAN_STATUSES = [
  "draft",
  "planned",
  "released",
  "in_progress",
  "completed",
  "canceled",
] as const;
export type RoutePlanStatus = (typeof ROUTE_PLAN_STATUSES)[number];

export const ROUTE_STOP_STATUSES = [
  "pending",
  "arrived",
  "departed",
  "skipped",
  "done",
  "no_show",
  "canceled",
] as const;
export type RouteStopStatus = (typeof ROUTE_STOP_STATUSES)[number];

export const AUDIT_EVENTS = [
  "auth.admin.login.succeeded",
  "auth.clinic.login.succeeded",
  "report.status.changed",
  "report.uploaded",
  "study_tracking.case.created",
  "study_tracking.case.updated",
  "study_tracking.notification.created",
  "report_access_token.created",
  "report_access_token.revoked",
  "report.public_accessed",
] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export const CLINIC_USER_ROLES = ["clinic_owner", "clinic_staff"] as const;
export type ClinicUserRole = (typeof CLINIC_USER_ROLES)[number];

// --- Entidades principales ---

export type Clinic = {
  id: number;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Report = {
  id: number;
  clinicId: number;
  clinicName?: string;
  patientName: string | null;
  studyType: string | null;
  status: ReportStatus;
  uploadDate: string | null;
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FieldVisit = {
  id: number;
  clinicId: number;
  clinicName?: string;
  status: FieldVisitStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoutePlan = {
  id: number;
  name: string;
  status: RoutePlanStatus;
  plannedDate: string | null;
  totalStops: number;
  completedStops: number;
  createdAt: string;
  updatedAt: string;
};

export type RouteMetrics = {
  routePlanId: number;
  totalStops: number;
  completedStops: number;
  skippedStops: number;
  noShowStops: number;
  complianceRate: number;
  averageDurationMinutes: number | null;
};

export type AuditEntry = {
  id: number;
  event: AuditEvent;
  actorType: string;
  actorId: number | null;
  targetType: string | null;
  targetId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// --- Tipos de respuesta API ---

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
};

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

// --- Tipos de autenticación ---

export type AuthUser = {
  id: number;
  username: string;
  clinicId?: number;
  clinicName?: string;
  role: ClinicUserRole | "admin";
};

export type LoginCredentials = {
  username: string;
  password: string;
};

// --- Tipos de UI ---

export type NavItem = {
  label: string;
  href: string;
  icon?: string;
  children?: NavItem[];
};

export type StatusBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export type DashboardStats = {
  totalReports: number;
  pendingReports: number;
  activeVisits: number;
  activePlans: number;
};

export type AdminSessionType = "admin" | "clinic" | "particular";
export type AdminSessionStatus = "active" | "expired";

export type AdminSessionSummary = {
  sessionType: AdminSessionType;
  sessionId: number;
  actorType: "admin_user" | "clinic_user" | "particular_token";
  actorId: number;
  createdAt: string;
  lastAccess: string | null;
  expiresAt: string | null;
  status: AdminSessionStatus;
};

export type AdminSessionsQuery = {
  sessionType?: AdminSessionType;
  status?: AdminSessionStatus;
  limit?: number;
  offset?: number;
};

export type AdminSessionsSnapshot = {
  success: true;
  sessions: AdminSessionSummary[];
  total: number;
  limit: number;
  offset: number;
  checkedBy?: {
    adminUserId: number;
    username: string;
  };
};

export type MaintenancePurgeCandidateCategory =
  | "expired_clinic_sessions"
  | "expired_admin_sessions"
  | "expired_particular_sessions"
  | "storage_orphans";

export type MaintenancePurgeCandidateGroup = {
  category: MaintenancePurgeCandidateCategory;
  label: string;
  count: number;
  supported: boolean;
  destructiveAction: string | null;
  reason?: string;
};

export type MaintenancePurgeDryRunSnapshot = {
  success: boolean;
  dryRun: true;
  generatedAt: string;
  checkedBy?: {
    adminUserId: number;
    username: string;
  };
  candidates: MaintenancePurgeCandidateGroup[];
  totals: {
    candidateRecords: number;
    supportedCandidateRecords: number;
    unsupportedGroups: number;
  };
};

export type SystemHealth = {
  success: boolean;
  status: string;
  version: string;
  checkedBy?: {
    adminUserId: number;
    username: string;
  };
  services: Record<string, unknown>;
  runtime: {
    uptimeSeconds: number;
    memory: {
      rssMb: number;
      heapTotalMb: number;
      heapUsedMb: number;
      externalMb: number;
      arrayBuffersMb: number;
    };
  };
  health?: Record<string, unknown>;
};
