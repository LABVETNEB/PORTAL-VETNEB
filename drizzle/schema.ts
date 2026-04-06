import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// =========================
// ENUMS
// =========================

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const clinicStatusEnum = pgEnum("clinic_status", ["active", "inactive"]);

// =========================
// TABLES
// =========================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in", { mode: "date" })
    .defaultNow()
    .notNull(),
});

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  clinicId: varchar("clinic_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  driveFolderId: varchar("drive_folder_id", { length: 255 }),
  status: clinicStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const clinicUsers = pgTable("clinic_users", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  authProId: varchar("auth_pro_id", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull(),
  uploadDate: timestamp("upload_date", { mode: "date" }),
  studyType: varchar("study_type", { length: 100 }),
  patientName: varchar("patient_name", { length: 255 }),
  fileName: varchar("file_name", { length: 255 }),
  driveFileId: varchar("drive_file_id", { length: 255 }).unique(),
  previewUrl: text("preview_url"),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const activeSessions = pgTable("active_sessions", {
  id: serial("id").primaryKey(),
  clinicUserId: integer("clinic_user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  lastAccess: timestamp("last_access", { mode: "date" }),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// =========================
// TYPES
// =========================

export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

export type Clinic = InferSelectModel<typeof clinics>;
export type InsertClinic = InferInsertModel<typeof clinics>;

export type ClinicUser = InferSelectModel<typeof clinicUsers>;
export type InsertClinicUser = InferInsertModel<typeof clinicUsers>;

export type Report = InferSelectModel<typeof reports>;
export type InsertReport = InferInsertModel<typeof reports>;

export type ActiveSession = InferSelectModel<typeof activeSessions>;
export type InsertActiveSession = InferInsertModel<typeof activeSessions>;