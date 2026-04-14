import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const CLINIC_USER_ROLES = ["clinic_owner", "clinic_staff"] as const;
export type ClinicUserRole = (typeof CLINIC_USER_ROLES)[number];

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

export type ActiveSession = InferSelectModel<typeof activeSessions>;
export type NewActiveSession = InferInsertModel<typeof activeSessions>;

export type AdminSession = InferSelectModel<typeof adminSessions>;
export type NewAdminSession = InferInsertModel<typeof adminSessions>;

export type ParticularToken = InferSelectModel<typeof particularTokens>;
export type NewParticularToken = InferInsertModel<typeof particularTokens>;

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
