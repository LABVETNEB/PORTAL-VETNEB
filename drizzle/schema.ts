import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  datetime,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const clinics = mysqlTable("clinics", {
  id: int("id").autoincrement().primaryKey(),
  clinicId: varchar("clinic_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  driveFolderId: varchar("drive_folder_id", { length: 255 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const clinicUsers = mysqlTable("clinic_users", {
  id: int("id").autoincrement().primaryKey(),
  clinicId: int("clinic_id").notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  authProId: varchar("auth_pro_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  clinicId: int("clinic_id").notNull(),
  uploadDate: datetime("upload_date"),
  studyType: varchar("study_type", { length: 100 }),
  patientName: varchar("patient_name", { length: 255 }),
  fileName: varchar("file_name", { length: 255 }),
  driveFileId: varchar("drive_file_id", { length: 255 }).unique(),
  previewUrl: text("preview_url"),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const activeSessions = mysqlTable("active_sessions", {
  id: int("id").autoincrement().primaryKey(),
  clinicUserId: int("clinic_user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  lastAccess: datetime("last_access"),
  expiresAt: datetime("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});