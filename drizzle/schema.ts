import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

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

export type Clinic = InferSelectModel<typeof clinics>;
export type NewClinic = InferInsertModel<typeof clinics>;

export type ClinicUser = InferSelectModel<typeof clinicUsers>;
export type NewClinicUser = InferInsertModel<typeof clinicUsers>;

export type Report = InferSelectModel<typeof reports>;
export type NewReport = InferInsertModel<typeof reports>;

export type ActiveSession = InferSelectModel<typeof activeSessions>;
export type NewActiveSession = InferInsertModel<typeof activeSessions>;
