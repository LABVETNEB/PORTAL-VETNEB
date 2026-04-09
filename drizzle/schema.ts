import { InferInsertModel, InferSelectModel } from "drizzle-orm";
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

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const clinicUsers = pgTable("clinic_users", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  authProId: varchar("auth_pro_id", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    fullName: varchar("full_name", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("admin_users_email_idx").on(table.email),
    isActiveIdx: index("admin_users_is_active_idx").on(table.isActive),
  }),
);

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

export const paymentLinks = pgTable(
  "payment_links",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    createdByAdminUserId: integer("created_by_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    token: varchar("token", { length: 128 }).notNull().unique(),
    patientName: varchar("patient_name", { length: 255 }),
    patientEmail: varchar("patient_email", { length: 255 }),
    description: text("description"),
    amountInCents: integer("amount_in_cents").notNull(),
    currency: varchar("currency", { length: 10 }).default("ARS").notNull(),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    paidAt: timestamp("paid_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    clinicIdIdx: index("payment_links_clinic_id_idx").on(table.clinicId),
    tokenIdx: index("payment_links_token_idx").on(table.token),
    statusIdx: index("payment_links_status_idx").on(table.status),
    expiresAtIdx: index("payment_links_expires_at_idx").on(table.expiresAt),
  }),
);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: serial("id").primaryKey(),
    paymentLinkId: integer("payment_link_id")
      .notNull()
      .references(() => paymentLinks.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).default("manual").notNull(),
    providerReference: varchar("provider_reference", { length: 255 }),
    status: varchar("status", { length: 30 }).notNull(),
    amountInCents: integer("amount_in_cents").notNull(),
    currency: varchar("currency", { length: 10 }).default("ARS").notNull(),
    rawPayload: text("raw_payload"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    paymentLinkIdIdx: index("payment_transactions_payment_link_id_idx").on(
      table.paymentLinkId,
    ),
    providerReferenceIdx: index(
      "payment_transactions_provider_reference_idx",
    ).on(table.providerReference),
    statusIdx: index("payment_transactions_status_idx").on(table.status),
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

export type PaymentLink = InferSelectModel<typeof paymentLinks>;
export type NewPaymentLink = InferInsertModel<typeof paymentLinks>;

export type PaymentTransaction = InferSelectModel<typeof paymentTransactions>;
export type NewPaymentTransaction = InferInsertModel<typeof paymentTransactions>;
