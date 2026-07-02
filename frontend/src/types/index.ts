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
  "auth.session.revoked",
  "clinic.created",
  "clinic.updated",
  "clinic.deleted",
  "clinic_user.created",
  "clinic_user.credentials.updated",
  "clinic_user.role.changed",
  "admin.pricing.update",
  "report.status.changed",
  "report.uploaded",
  "study_tracking.case.created",
  "study_tracking.case.updated",
  "study_tracking.notification.created",
  "report_access_token.created",
  "report_access_token.revoked",
  "report.public_accessed",
  "logistics.route_plan.lifecycle_changed",
  "logistics.route_event.created",
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
  currentStatus?: ReportStatus;
  uploadDate: string | null;
  fileName?: string | null;
  hasFile: boolean;
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

export type UnifiedLoginCredentials = {
  identifier: string;
  password: string;
};

export type UnifiedLoginRole = "admin" | "clinic" | "particular";

export type UnifiedLoginResponse = {
  success: true;
  role: UnifiedLoginRole;
  redirectTo: string;
};

export type ParticularLoginCredentials = {
  token: string;
};

export type ParticularReportSummary = {
  id: number;
  clinicId: number;
  uploadDate: string | null;
  studyType: string | null;
  patientName: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParticularSession = {
  id: number;
  clinicId: number;
  reportId: number | null;
  tokenLast4: string | null;
  tutorLastName: string;
  petName: string;
  petAge: string;
  petBreed: string;
  petSex: string;
  petSpecies: string;
  sampleLocation: string;
  sampleEvolution: string;
  detailsLesion: string | null;
  extractionDate: string;
  shippingDate: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByAdminId: number | null;
  createdByClinicUserId: number | null;
  hasLinkedReport: boolean;
  report: ParticularReportSummary | null;
};

export type ParticularAuthResponse = {
  success: true;
  particular: ParticularSession;
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

export type AdminRoleUserType = "admin" | "clinic";
export type AdminRoleUserRole = "admin" | ClinicUserRole;

export type AdminRoleUserSummary =
  | {
      userType: "admin";
      userId: number;
      username: string;
      role: "admin";
      clinicId: null;
      clinicName: null;
      createdAt: string;
      updatedAt: string;
    }
  | {
      userType: "clinic";
      userId: number;
      username: string;
      role: ClinicUserRole;
      clinicId: number;
      clinicName: string | null;
      clinicLocality?: string | null;
      createdAt: string;
      updatedAt: string;
    };

export type AdminUsersRolesQuery = {
  userType?: AdminRoleUserType;
  role?: AdminRoleUserRole;
  search?: string;
  limit?: number;
  offset?: number;
};

export type AdminClinicUserRoleChangeResponse = {
  success: true;
  user: Extract<AdminRoleUserSummary, { userType: "clinic" }>;
  changedBy: {
    adminUserId: number;
    username: string;
  };
};

export type AdminClinicSummary = {
  clinicId: number;
  clinicName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminClinicManagementSummary = AdminClinicSummary & {
  users: Extract<AdminRoleUserSummary, { userType: "clinic" }>[];
};

export type AdminClinicsSnapshot = {
  success: true;
  clinics: AdminClinicManagementSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminClinicCreatePayload = {
  clinicName: string;
  contactEmail: string;
  contactPhone?: string | null;
  username: string;
  password: string;
  role?: ClinicUserRole;
};

export type AdminClinicCreateResponse = {
  success: true;
  clinic: AdminClinicSummary;
  user: Extract<AdminRoleUserSummary, { userType: "clinic" }>;
  createdBy: {
    adminUserId: number;
    username: string;
  };
};

export type AdminClinicUpdatePayload = {
  clinicName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type AdminClinicUpdateResponse = {
  success: true;
  clinic: AdminClinicSummary;
  changedBy: {
    adminUserId: number;
    username: string;
  };
};

export type AdminClinicUserCredentialsUpdatePayload = {
  username?: string;
  password?: string;
};

export type AdminClinicUserCredentialsUpdateResponse = {
  success: true;
  user: Extract<AdminRoleUserSummary, { userType: "clinic" }>;
  changedBy: {
    adminUserId: number;
    username: string;
  };
};

export type AdminUsersRolesSnapshot = {
  success: true;
  users: AdminRoleUserSummary[];
  total: number;
  limit: number;
  offset: number;
  totals: {
    adminUsers: number;
    clinicUsers: number;
  };
  checkedBy?: {
    adminUserId: number;
    username: string;
  };
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
  currentAdminSessionId?: number;
  checkedBy?: {
    adminUserId: number;
    username: string;
  };
};

export type AdminSessionRevocationResult = AdminSessionSummary & {
  revokedAt: string;
};

export type AdminSessionRevocationResponse = {
  success: true;
  revokedSession: AdminSessionRevocationResult;
  revokedBy: {
    adminUserId: number;
    username: string;
  };
};

export type AdminFailedLoginAlertSurface = "admin" | "clinic" | "particular";
export type AdminFailedLoginAlertReason =
  | "missing_credentials"
  | "invalid_credentials"
  | "rate_limited";

export type AdminFailedLoginAlertSummary = {
  id: number;
  surface: AdminFailedLoginAlertSurface;
  username: string | null;
  reason: AdminFailedLoginAlertReason;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminFailedLoginAlertsQuery = {
  surface?: AdminFailedLoginAlertSurface;
  reason?: AdminFailedLoginAlertReason;
  limit?: number;
  offset?: number;
};

export type AdminFailedLoginAlertsSnapshot = {
  success: true;
  failedLoginAlerts: AdminFailedLoginAlertSummary[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  filters: {
    surface: AdminFailedLoginAlertSurface | null;
    reason: AdminFailedLoginAlertReason | null;
  };
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

export type AdminSchemaHealthStatus = "ok" | "degraded";

export type AdminSchemaHealthCheckedBy = {
  adminUserId: string | number;
  username: string;
};

export type AdminSchemaHealthSummary = {
  requiredTables: number;
  requiredColumns: number;
  presentColumns: number;
  missingColumns: number;
};

export type AdminSchemaHealthColumn = {
  name: string;
  present: boolean;
};

export type AdminSchemaHealthTable = {
  schema: string;
  table: string;
  status: AdminSchemaHealthStatus;
  requiredColumns: number;
  presentColumns: number;
  missingColumns: number;
  columns: AdminSchemaHealthColumn[];
  missingColumnNames: string[];
};

export type AdminSchemaHealthMissingColumn = {
  schema: string;
  table: string;
  column: string;
};

export type AdminSchemaHealthSnapshot = {
  success: boolean;
  checkedBy?: AdminSchemaHealthCheckedBy;
  status: AdminSchemaHealthStatus;
  generatedAt: string;
  summary: AdminSchemaHealthSummary;
  tables: AdminSchemaHealthTable[];
  missing: AdminSchemaHealthMissingColumn[];
};
