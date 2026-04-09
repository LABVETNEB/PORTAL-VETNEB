import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

function parseCsvList(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().optional(),

  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SUPABASE_DB_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url()),
  SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1)),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1)),
  SUPABASE_STORAGE_BUCKET: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),

  COOKIE_NAME: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ADMIN_COOKIE_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  ADMIN_JWT_SECRET: z.preprocess(emptyToUndefined, z.string().min(32)),
  ADMIN_JWT_TTL_MINUTES: z.coerce.number().int().positive().max(24 * 60).optional(),
  ADMIN_JWT_ISSUER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ADMIN_JWT_AUDIENCE: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),

  CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CORS_ALLOW_CREDENTIALS: z.preprocess(
    parseBoolean,
    z.boolean().optional(),
  ),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
  OWNER_OPEN_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  LAB_UPLOAD_USERNAMES: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),

  MAX_UPLOAD_FILE_SIZE_MB: z.coerce.number().positive().optional(),
  SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().optional(),
  SESSION_TTL_HOURS: z.coerce.number().positive().optional(),
});

const rawEnv = envSchema.parse(process.env);

const nodeEnv = rawEnv.NODE_ENV ?? "development";
const port = rawEnv.PORT ?? 3000;
const databaseUrl = rawEnv.SUPABASE_DB_URL ?? rawEnv.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL o SUPABASE_DB_URL es obligatorio");
}

const corsOrigins = parseCsvList(rawEnv.CORS_ORIGIN);

export const ENV = {
  nodeEnv,
  isDevelopment: nodeEnv === "development",
  isProduction: nodeEnv === "production",

  port,
  databaseUrl,

  supabaseUrl: rawEnv.SUPABASE_URL,
  supabaseAnonKey: rawEnv.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: rawEnv.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: rawEnv.SUPABASE_STORAGE_BUCKET ?? "reports",

  cookieName: rawEnv.COOKIE_NAME ?? "app_session_id",
  adminCookieName: rawEnv.ADMIN_COOKIE_NAME ?? "admin_session_token",
  adminJwtSecret: rawEnv.ADMIN_JWT_SECRET,
  adminJwtTtlMinutes: rawEnv.ADMIN_JWT_TTL_MINUTES ?? 60,
  adminJwtIssuer: rawEnv.ADMIN_JWT_ISSUER ?? "portal-vetneb-api",
  adminJwtAudience: rawEnv.ADMIN_JWT_AUDIENCE ?? "portal-vetneb-admin",

  corsOrigins,
  corsAllowCredentials: rawEnv.CORS_ALLOW_CREDENTIALS ?? true,
  trustProxy: rawEnv.TRUST_PROXY ?? 1,
  cookieSecure: nodeEnv === "production",
  cookieSameSite: nodeEnv === "production" ? "none" : "lax",

  ownerOpenId: rawEnv.OWNER_OPEN_ID ?? "",
  labUploadUsernames: parseCsvList(rawEnv.LAB_UPLOAD_USERNAMES),
  maxUploadFileSizeMb: rawEnv.MAX_UPLOAD_FILE_SIZE_MB ?? 20,
  signedUrlExpiresInSeconds:
    rawEnv.SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS ?? 60 * 15,
  sessionTtlHours: rawEnv.SESSION_TTL_HOURS ?? 24,
} as const;
