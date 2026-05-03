import {
  boolean,
  index,
  uniqueIndex,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const CLINIC_USER_ROLES = ["clinic_owner", "clinic_staff"] as const;
export type ClinicUserRole = (typeof CLINIC_USER_ROLES)[number];

export const REPORT_STATUSES = [
  "uploaded",
  "processing",
  "ready",
  "delivered",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const FIELD_VISIT_SOURCE_TYPES = [
  "report",
  "study_tracking_case",
  "manual",
] as const;
export type FieldVisitSourceType = (typeof FIELD_VISIT_SOURCE_TYPES)[number];

export const FIELD_VISIT_STATUSES = [
  "pending",
  "scheduled",
  "in_progress",
  "done",
  "canceled",
  "no_show",
] as const;
export type FieldVisitStatus = (typeof FIELD_VISIT_STATUSES)[number];

export const VISIT_LOCATION_GEO_QUALITIES = [
  "exact",
  "approx",
  "missing",
  "ambiguous",
] as const;
export type VisitLocationGeoQuality =
  (typeof VISIT_LOCATION_GEO_QUALITIES)[number];
export const ROUTE_PLAN_STATUSES = [
  "draft",
  "planned",
  "released",
  "in_progress",
  "completed",
  "canceled",
] as const;
export type RoutePlanStatus = (typeof ROUTE_PLAN_STATUSES)[number];

export const ROUTE_PLANNING_MODES = ["manual", "heuristic"] as const;
export type RoutePlanningMode = (typeof ROUTE_PLANNING_MODES)[number];

export const ROUTE_PLAN_OBJECTIVES = ["distance", "time", "sla"] as const;
export type RoutePlanObjective = (typeof ROUTE_PLAN_OBJECTIVES)[number];

export const ROUTE_PLAN_CREATED_BY_TYPES = [
  "system",
  "admin",
  "clinic",
] as const;
export type RoutePlanCreatedByType =
  (typeof ROUTE_PLAN_CREATED_BY_TYPES)[number];

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
export const AUDIT_ACTOR_TYPES = [
  "system",
  "admin_user",
  "clinic_user",
  "public_report_access_token",
] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

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


export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const clinicUsers = pgTable(
  "clinic_users",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 100 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    authProId: varchar("auth_pro_id", { length: 100 }),
    role: varchar("role", { length: 32 })
      .$type<ClinicUserRole>()
      .notNull()
      .default("clinic_staff"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    clinicIdIdx: index("clinic_users_clinic_id_idx").on(table.clinicId),
    clinicIdRoleIdx: index("clinic_users_clinic_id_role_idx").on(
      table.clinicId,
      table.role,
    ),
  }),
);

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    uploadDate: timestamp("upload_date", { mode: "date" }),
    studyType: varchar("study_type", { length: 100 }),
    patientName: varchar("patient_name", { length: 255 }),
    fileName: varchar("file_name", { length: 255 }),
    storagePath: varchar("storage_path", { length: 255 }).notNull().unique(),
    previewUrl: text("preview_url"),
    downloadUrl: text("download_url"),
    currentStatus: varchar("current_status", { length: 32 })
      .$type<ReportStatus>()
      .notNull()
      .default("uploaded"),
    statusChangedAt: timestamp("status_changed_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    statusChangedByClinicUserId: integer("status_changed_by_clinic_user_id").references(
      () => clinicUsers.id,
      { onDelete: "set null" },
    ),
    statusChangedByAdminUserId: integer("status_changed_by_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    clinicIdIdx: index("reports_clinic_id_idx").on(table.clinicId),
    clinicUploadDateIdx: index("reports_clinic_upload_date_idx").on(
      table.clinicId,
      table.uploadDate,
    ),
    clinicStudyTypeIdx: index("reports_clinic_study_type_idx").on(
      table.clinicId,
      table.studyType,
    ),
    clinicCurrentStatusIdx: index("reports_clinic_current_status_idx").on(
      table.clinicId,
      table.currentStatus,
    ),
    statusChangedAtIdx: index("reports_status_changed_at_idx").on(
      table.statusChangedAt,
    ),
  }),
);

export const reportStatusHistory = pgTable(
  "report_status_history",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 32 }).$type<ReportStatus>(),
    toStatus: varchar("to_status", { length: 32 })
      .$type<ReportStatus>()
      .notNull(),
    changedByClinicUserId: integer("changed_by_clinic_user_id").references(
      () => clinicUsers.id,
      { onDelete: "set null" },
    ),
    changedByAdminUserId: integer("changed_by_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    reportIdCreatedAtIdx: index("report_status_history_report_id_created_at_idx").on(
      table.reportId,
      table.createdAt,
    ),
    toStatusIdx: index("report_status_history_to_status_idx").on(table.toStatus),
  }),
);

export const reportAccessTokens = pgTable(
  "report_access_tokens",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    reportId: integer("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    createdByClinicUserId: integer("created_by_clinic_user_id").references(
      () => clinicUsers.id,
      { onDelete: "set null" },
    ),
    createdByAdminUserId: integer("created_by_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    revokedByClinicUserId: integer("revoked_by_clinic_user_id").references(
      () => clinicUsers.id,
      { onDelete: "set null" },
    ),
    revokedByAdminUserId: integer("revoked_by_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    tokenLast4: varchar("token_last4", { length: 4 }).notNull(),
    accessCount: integer("access_count").default(0).notNull(),
    lastAccessAt: timestamp("last_access_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: index("report_access_tokens_token_hash_idx").on(table.tokenHash),
    clinicIdIdx: index("report_access_tokens_clinic_id_idx").on(table.clinicId),
    reportIdIdx: index("report_access_tokens_report_id_idx").on(table.reportId),
    clinicReportCreatedAtIdx: index(
      "report_access_tokens_clinic_report_created_at_idx",
    ).on(table.clinicId, table.reportId, table.createdAt),
    expiresAtIdx: index("report_access_tokens_expires_at_idx").on(table.expiresAt),
    revokedAtIdx: index("report_access_tokens_revoked_at_idx").on(table.revokedAt),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    event: varchar("event", { length: 120 }).$type<AuditEvent>().notNull(),
    actorType: varchar("actor_type", { length: 40 })
      .$type<AuditActorType>()
      .notNull()
      .default("system"),
    actorAdminUserId: integer("actor_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    actorClinicUserId: integer("actor_clinic_user_id").references(
      () => clinicUsers.id,
      { onDelete: "set null" },
    ),
    actorReportAccessTokenId: integer("actor_report_access_token_id").references(
      () => reportAccessTokens.id,
      { onDelete: "set null" },
    ),
    clinicId: integer("clinic_id").references(() => clinics.id, {
      onDelete: "set null",
    }),
    reportId: integer("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    targetAdminUserId: integer("target_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    targetClinicUserId: integer("target_clinic_user_id").references(
      () => clinicUsers.id,
      { onDelete: "set null" },
    ),
    targetReportAccessTokenId: integer("target_report_access_token_id").references(
      () => reportAccessTokens.id,
      { onDelete: "set null" },
    ),
    requestId: varchar("request_id", { length: 64 }),
    requestMethod: varchar("request_method", { length: 16 }),
    requestPath: text("request_path"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("audit_log_event_idx").on(table.event),
    createdAtIdx: index("audit_log_created_at_idx").on(table.createdAt),
    actorTypeIdx: index("audit_log_actor_type_idx").on(table.actorType),
    actorAdminUserIdIdx: index("audit_log_actor_admin_user_id_idx").on(
      table.actorAdminUserId,
    ),
    actorClinicUserIdIdx: index("audit_log_actor_clinic_user_id_idx").on(
      table.actorClinicUserId,
    ),
    actorReportAccessTokenIdIdx: index(
      "audit_log_actor_report_access_token_id_idx",
    ).on(table.actorReportAccessTokenId),
    clinicIdIdx: index("audit_log_clinic_id_idx").on(table.clinicId),
    reportIdIdx: index("audit_log_report_id_idx").on(table.reportId),
    targetReportAccessTokenIdIdx: index(
      "audit_log_target_report_access_token_id_idx",
    ).on(table.targetReportAccessTokenId),
  }),
);

export const activeSessions = pgTable(
  "active_sessions",
  {
    id: serial("id").primaryKey(),
    clinicUserId: integer("clinic_user_id")
      .notNull()
      .references(() => clinicUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    lastAccess: timestamp("last_access", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: index("active_sessions_token_hash_idx").on(table.tokenHash),
    clinicUserIdIdx: index("active_sessions_clinic_user_id_idx").on(
      table.clinicUserId,
    ),
  }),
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: serial("id").primaryKey(),
    adminUserId: integer("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    lastAccess: timestamp("last_access", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: index("admin_sessions_token_hash_idx").on(table.tokenHash),
    adminUserIdIdx: index("admin_sessions_admin_user_id_idx").on(
      table.adminUserId,
    ),
  }),
);

export const particularTokens = pgTable(
  "particular_tokens",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    reportId: integer("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    createdByAdminId: integer("created_by_admin_id").references(
      () => adminUsers.id,
      {
        onDelete: "set null",
      },
    ),
    createdByClinicUserId: integer("created_by_clinic_user_id").references(
      () => clinicUsers.id,
      {
        onDelete: "set null",
      },
    ),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    tokenLast4: varchar("token_last4", { length: 4 }).notNull(),
    tutorLastName: varchar("tutor_last_name", { length: 255 }).notNull(),
    petName: varchar("pet_name", { length: 255 }).notNull(),
    petAge: varchar("pet_age", { length: 100 }).notNull(),
    petBreed: varchar("pet_breed", { length: 255 }).notNull(),
    petSex: varchar("pet_sex", { length: 50 }).notNull(),
    petSpecies: varchar("pet_species", { length: 100 }).notNull(),
    sampleLocation: text("sample_location").notNull(),
    sampleEvolution: text("sample_evolution").notNull(),
    detailsLesion: text("details_lesion"),
    extractionDate: timestamp("extraction_date", { mode: "date" }).notNull(),
    shippingDate: timestamp("shipping_date", { mode: "date" }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: index("particular_tokens_token_hash_idx").on(table.tokenHash),
    clinicIdIdx: index("particular_tokens_clinic_id_idx").on(table.clinicId),
    reportIdIdx: index("particular_tokens_report_id_idx").on(table.reportId),
    clinicCreatedAtIdx: index("particular_tokens_clinic_created_at_idx").on(
      table.clinicId,
      table.createdAt,
    ),
  }),
);

export const clinicPublicProfiles = pgTable(
  "clinic_public_profiles",
  {
    clinicId: integer("clinic_id")
      .primaryKey()
      .references(() => clinics.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 255 }),
    avatarStoragePath: varchar("avatar_storage_path", { length: 512 }),
    aboutText: text("about_text"),
    specialtyText: text("specialty_text"),
    servicesText: text("services_text"),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    locality: varchar("locality", { length: 255 }),
    country: varchar("country", { length: 255 }),
    isPublic: boolean("is_public").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    isPublicIdx: index("clinic_public_profiles_is_public_idx").on(
      table.isPublic,
    ),
    countryIdx: index("clinic_public_profiles_country_idx").on(table.country),
    localityIdx: index("clinic_public_profiles_locality_idx").on(table.locality),
  }),
);

export const clinicPublicSearch = pgTable(
  "clinic_public_search",
  {
    clinicId: integer("clinic_id")
      .primaryKey()
      .references(() => clinics.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    avatarStoragePath: varchar("avatar_storage_path", { length: 512 }),
    aboutText: text("about_text"),
    specialtyText: text("specialty_text"),
    servicesText: text("services_text"),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    locality: varchar("locality", { length: 255 }),
    country: varchar("country", { length: 255 }),
    isPublic: boolean("is_public").default(false).notNull(),
    hasRequiredPublicFields: boolean("has_required_public_fields")
      .default(false)
      .notNull(),
    isSearchEligible: boolean("is_search_eligible").default(false).notNull(),
    profileQualityScore: integer("profile_quality_score").default(0).notNull(),
    searchText: text("search_text").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    isPublicIdx: index("clinic_public_search_is_public_idx").on(table.isPublic),
    isSearchEligibleIdx: index("clinic_public_search_is_search_eligible_idx").on(
      table.isSearchEligible,
    ),
    qualityScoreIdx: index("clinic_public_search_profile_quality_score_idx").on(
      table.profileQualityScore,
    ),
    updatedAtIdx: index("clinic_public_search_updated_at_idx").on(
      table.updatedAt,
    ),
  }),
);

export const studyTrackingCases = pgTable(
  "study_tracking_cases",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    reportId: integer("report_id")
      .unique()
      .references(() => reports.id, { onDelete: "set null" }),
    particularTokenId: integer("particular_token_id")
      .unique()
      .references(() => particularTokens.id, { onDelete: "set null" }),
    createdByAdminId: integer("created_by_admin_id").references(
      () => adminUsers.id,
      {
        onDelete: "set null",
      },
    ),
    createdByClinicUserId: integer("created_by_clinic_user_id").references(
      () => clinicUsers.id,
      {
        onDelete: "set null",
      },
    ),
    receptionAt: timestamp("reception_at", { mode: "date" }).notNull(),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", {
      mode: "date",
    }).notNull(),
    estimatedDeliveryAutoCalculatedAt: timestamp(
      "estimated_delivery_auto_calculated_at",
      { mode: "date" },
    ).notNull(),
    estimatedDeliveryWasManuallyAdjusted: boolean(
      "estimated_delivery_was_manually_adjusted",
    )
      .default(false)
      .notNull(),
    currentStage: varchar("current_stage", { length: 40 })
      .default("reception")
      .notNull(),
    processingAt: timestamp("processing_at", { mode: "date" }),
    evaluationAt: timestamp("evaluation_at", { mode: "date" }),
    reportDevelopmentAt: timestamp("report_development_at", {
      mode: "date",
    }),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    specialStainRequired: boolean("special_stain_required")
      .default(false)
      .notNull(),
    specialStainNotifiedAt: timestamp("special_stain_notified_at", {
      mode: "date",
    }),
    paymentUrl: text("payment_url"),
    adminContactEmail: varchar("admin_contact_email", { length: 255 }),
    adminContactPhone: varchar("admin_contact_phone", { length: 50 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    clinicIdIdx: index("study_tracking_cases_clinic_id_idx").on(table.clinicId),
    currentStageIdx: index("study_tracking_cases_current_stage_idx").on(
      table.currentStage,
    ),
    estimatedDeliveryIdx: index(
      "study_tracking_cases_estimated_delivery_at_idx",
    ).on(table.estimatedDeliveryAt),
    createdAtIdx: index("study_tracking_cases_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const studyTrackingNotifications = pgTable(
  "study_tracking_notifications",
  {
    id: serial("id").primaryKey(),
    studyTrackingCaseId: integer("study_tracking_case_id")
      .notNull()
      .references(() => studyTrackingCases.id, { onDelete: "cascade" }),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    reportId: integer("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    particularTokenId: integer("particular_token_id").references(
      () => particularTokens.id,
      {
        onDelete: "set null",
      },
    ),
    type: varchar("type", { length: 80 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    studyTrackingCaseIdIdx: index(
      "study_tracking_notifications_case_id_idx",
    ).on(table.studyTrackingCaseId),
    clinicIdIdx: index("study_tracking_notifications_clinic_id_idx").on(
      table.clinicId,
    ),
    particularTokenIdIdx: index(
      "study_tracking_notifications_particular_token_id_idx",
    ).on(table.particularTokenId),
    unreadIdx: index("study_tracking_notifications_unread_idx").on(
      table.isRead,
      table.createdAt,
    ),
  }),
);

export const fieldVisits = pgTable(
  "field_visits",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 40 })
      .$type<FieldVisitSourceType>()
      .notNull()
      .default("manual"),
    sourceId: integer("source_id"),
    status: varchar("status", { length: 32 })
      .$type<FieldVisitStatus>()
      .notNull()
      .default("pending"),
    priority: integer("priority").default(0).notNull(),
    criticality: varchar("criticality", { length: 32 }),
    serviceDurationMin: integer("service_duration_min").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    clinicIdIdx: index("field_visits_clinic_id_idx").on(table.clinicId),
    clinicStatusIdx: index("field_visits_clinic_status_idx").on(
      table.clinicId,
      table.status,
    ),
    clinicPriorityCreatedAtIdx: index(
      "field_visits_clinic_priority_created_at_idx",
    ).on(table.clinicId, table.priority, table.createdAt),
    clinicSourceIdx: index("field_visits_clinic_source_idx").on(
      table.clinicId,
      table.sourceType,
      table.sourceId,
    ),
    createdAtIdx: index("field_visits_created_at_idx").on(table.createdAt),
  }),
);

export const visitLocations = pgTable(
  "visit_locations",
  {
    id: serial("id").primaryKey(),
    fieldVisitId: integer("field_visit_id")
      .notNull()
      .references(() => fieldVisits.id, { onDelete: "cascade" }),
    addressRaw: text("address_raw").notNull(),
    addressNormalized: text("address_normalized"),
    locality: varchar("locality", { length: 255 }),
    country: varchar("country", { length: 255 }),
    lat: real("lat"),
    lng: real("lng"),
    geoQuality: varchar("geo_quality", { length: 32 })
      .$type<VisitLocationGeoQuality>()
      .notNull()
      .default("missing"),
    geocodeSource: varchar("geocode_source", { length: 100 }),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    fieldVisitIdIdx: index("visit_locations_field_visit_id_idx").on(
      table.fieldVisitId,
    ),
    geoQualityIdx: index("visit_locations_geo_quality_idx").on(
      table.geoQuality,
    ),
    localityCountryIdx: index("visit_locations_locality_country_idx").on(
      table.locality,
      table.country,
    ),
  }),
);
export const timeWindows = pgTable(
  "time_windows",
  {
    id: serial("id").primaryKey(),
    fieldVisitId: integer("field_visit_id")
      .notNull()
      .references(() => fieldVisits.id, { onDelete: "cascade" }),
    windowStart: timestamp("window_start", { mode: "date" }).notNull(),
    windowEnd: timestamp("window_end", { mode: "date" }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    isHard: boolean("is_hard").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    fieldVisitIdIdx: index("time_windows_field_visit_id_idx").on(
      table.fieldVisitId,
    ),
    windowStartIdx: index("time_windows_window_start_idx").on(
      table.windowStart,
    ),
    windowEndIdx: index("time_windows_window_end_idx").on(table.windowEnd),
    fieldVisitWindowStartIdx: index(
      "time_windows_field_visit_window_start_idx",
    ).on(table.fieldVisitId, table.windowStart),
  }),
);
export const routePlans = pgTable(
  "route_plans",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    serviceDate: timestamp("service_date", { mode: "date" }).notNull(),
    status: varchar("status", { length: 32 })
      .$type<RoutePlanStatus>()
      .notNull()
      .default("draft"),
    planningMode: varchar("planning_mode", { length: 32 })
      .$type<RoutePlanningMode>()
      .notNull()
      .default("manual"),
    objective: varchar("objective", { length: 32 })
      .$type<RoutePlanObjective>()
      .notNull()
      .default("distance"),
    totalPlannedKm: real("total_planned_km").default(0).notNull(),
    totalPlannedMin: integer("total_planned_min").default(0).notNull(),
    createdByType: varchar("created_by_type", { length: 32 })
      .$type<RoutePlanCreatedByType>()
      .notNull()
      .default("system"),
    createdById: integer("created_by_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    clinicIdIdx: index("route_plans_clinic_id_idx").on(table.clinicId),
    clinicServiceDateIdx: index("route_plans_clinic_service_date_idx").on(
      table.clinicId,
      table.serviceDate,
    ),
    clinicStatusIdx: index("route_plans_clinic_status_idx").on(
      table.clinicId,
      table.status,
    ),
    clinicPlanningModeIdx: index("route_plans_clinic_planning_mode_idx").on(
      table.clinicId,
      table.planningMode,
    ),
  }),
);

export const routeStops = pgTable(
  "route_stops",
  {
    id: serial("id").primaryKey(),
    routePlanId: integer("route_plan_id")
      .notNull()
      .references(() => routePlans.id, { onDelete: "cascade" }),
    fieldVisitId: integer("field_visit_id")
      .notNull()
      .references(() => fieldVisits.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    etaStart: timestamp("eta_start", { mode: "date" }),
    etaEnd: timestamp("eta_end", { mode: "date" }),
    plannedKmFromPrev: real("planned_km_from_prev").default(0).notNull(),
    plannedMinFromPrev: integer("planned_min_from_prev").default(0).notNull(),
    actualArrival: timestamp("actual_arrival", { mode: "date" }),
    actualDeparture: timestamp("actual_departure", { mode: "date" }),
    actualKmFromPrev: real("actual_km_from_prev"),
    status: varchar("status", { length: 32 })
      .$type<RouteStopStatus>()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    routePlanIdIdx: index("route_stops_route_plan_id_idx").on(
      table.routePlanId,
    ),
    routePlanSequenceIdx: uniqueIndex("route_stops_route_plan_sequence_idx").on(
      table.routePlanId,
      table.sequence,
    ),
    fieldVisitIdIdx: index("route_stops_field_visit_id_idx").on(
      table.fieldVisitId,
    ),
    routePlanStatusIdx: index("route_stops_route_plan_status_idx").on(
      table.routePlanId,
      table.status,
    ),
  }),
);
export const particularSessions = pgTable(
  "particular_sessions",
  {
    id: serial("id").primaryKey(),
    particularTokenId: integer("particular_token_id")
      .notNull()
      .references(() => particularTokens.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    lastAccess: timestamp("last_access", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: index("particular_sessions_token_hash_idx").on(
      table.tokenHash,
    ),
    particularTokenIdIdx: index("particular_sessions_particular_token_id_idx").on(
      table.particularTokenId,
    ),
  }),
);

export type Clinic = InferSelectModel<typeof clinics>;
export type NewClinic = InferInsertModel<typeof clinics>;

export type ClinicUser = InferSelectModel<typeof clinicUsers>;
export type NewClinicUser = InferInsertModel<typeof clinicUsers>;

export type AdminUser = InferSelectModel<typeof adminUsers>;
export type NewAdminUser = InferInsertModel<typeof adminUsers>;

export type Report = InferSelectModel<typeof reports>;
export type NewReport = InferInsertModel<typeof reports>;

export type ReportStatusHistory = InferSelectModel<typeof reportStatusHistory>;
export type NewReportStatusHistory = InferInsertModel<typeof reportStatusHistory>;

export type ReportAccessToken = InferSelectModel<typeof reportAccessTokens>;
export type NewReportAccessToken = InferInsertModel<typeof reportAccessTokens>;

export type AuditLog = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;

export type ActiveSession = InferSelectModel<typeof activeSessions>;
export type NewActiveSession = InferInsertModel<typeof activeSessions>;

export type AdminSession = InferSelectModel<typeof adminSessions>;
export type NewAdminSession = InferInsertModel<typeof adminSessions>;

export type ParticularToken = InferSelectModel<typeof particularTokens>;
export type NewParticularToken = InferInsertModel<typeof particularTokens>;
export type FieldVisit = InferSelectModel<typeof fieldVisits>;
export type NewFieldVisit = InferInsertModel<typeof fieldVisits>;

export type VisitLocation = InferSelectModel<typeof visitLocations>;
export type NewVisitLocation = InferInsertModel<typeof visitLocations>;
export type TimeWindow = InferSelectModel<typeof timeWindows>;
export type NewTimeWindow = InferInsertModel<typeof timeWindows>;
export type RoutePlan = InferSelectModel<typeof routePlans>;
export type NewRoutePlan = InferInsertModel<typeof routePlans>;

export type RouteStop = InferSelectModel<typeof routeStops>;
export type NewRouteStop = InferInsertModel<typeof routeStops>;

export type ClinicPublicProfile = InferSelectModel<typeof clinicPublicProfiles>;
export type NewClinicPublicProfile = InferInsertModel<typeof clinicPublicProfiles>;

export type ClinicPublicSearch = InferSelectModel<typeof clinicPublicSearch>;
export type NewClinicPublicSearch = InferInsertModel<typeof clinicPublicSearch>;

export type StudyTrackingCase = InferSelectModel<typeof studyTrackingCases>;
export type NewStudyTrackingCase = InferInsertModel<typeof studyTrackingCases>;

export type StudyTrackingNotification = InferSelectModel<
  typeof studyTrackingNotifications
>;
export type NewStudyTrackingNotification = InferInsertModel<
  typeof studyTrackingNotifications
>;

export type ParticularSession = InferSelectModel<typeof particularSessions>;
export type NewParticularSession = InferInsertModel<typeof particularSessions>;
