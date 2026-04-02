import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clínicas veterinarias
 */
export const clinics = mysqlTable("clinics", {
  id: int("id").autoincrement().primaryKey(),
  clinicId: varchar("clinic_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  driveFolderId: varchar("drive_folder_id", { length: 255 }),
  status: mysqlEnum("status", ["active", "inactive"])
    .default("active")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Clinic = typeof clinics.$inferSelect;
export type InsertClinic = typeof clinics.$inferInsert;

/**
 * Usuarios de clínicas
 */
export const clinicUsers = mysqlTable("clinic_users", {
  id: int("id").autoincrement().primaryKey(),
  clinicId: int("clinic_id").notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  authProId: varchar("auth_pro_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ClinicUser = typeof clinicUsers.$inferSelect;
export type InsertClinicUser = typeof clinicUsers.$inferInsert;

/**
 * Informes médicos
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  clinicId: int("clinic_id").notNull(),
  uploadDate: timestamp("upload_date"),
  studyType: varchar("study_type", { length: 100 }),
  patientName: varchar("patient_name", { length: 255 }),
  fileName: varchar("file_name", { length: 255 }),
  driveFileId: varchar("drive_file_id", { length: 255 }).unique(),
  previewUrl: text("preview_url"),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Sesiones activas
 */
export const activeSessions = mysqlTable("active_sessions", {
  id: int("id").autoincrement().primaryKey(),
  clinicUserId: int("clinic_user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  lastAccess: timestamp("last_access"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActiveSession = typeof activeSessions.$inferSelect;
export type InsertActiveSession = typeof activeSessions.$inferInsert;
