import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const parseBooleanishEnv = (value: unknown) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) return undefined;
  if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;

  return value;
};

function parseDelimitedList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}


function parseDatabaseMaxConnections(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 10);
}
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SUPABASE_DB_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  DATABASE_MAX_CONNECTIONS: z.preprocess(emptyToUndefined, z.string().optional()),
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
  PARTICULAR_COOKIE_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
  OWNER_OPEN_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  LAB_UPLOAD_USERNAMES: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  MAX_UPLOAD_FILE_SIZE_MB: z.coerce.number().positive().optional(),
  SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  SESSION_TTL_HOURS: z.coerce.number().positive().optional(),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.preprocess(parseBooleanishEnv, z.boolean().optional()),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_FROM: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GMAIL_API_CLIENT_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  GMAIL_API_CLIENT_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  GMAIL_API_REFRESH_TOKEN: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  GMAIL_API_FROM: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  CONTACT_TO: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  APP_VERSION: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  RENDER_GIT_COMMIT: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CLIENT_MIN_VERSION: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

const rawEnv = envSchema.parse(process.env);

const nodeEnv = rawEnv.NODE_ENV ?? "development";
const port = rawEnv.PORT ?? 3000;

const databaseUrl = rawEnv.SUPABASE_DB_URL ?? rawEnv.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL o SUPABASE_DB_URL es obligatorio");
}const DB_MAX_CONNECTIONS_DEFAULT = 3;
const DB_MAX_CONNECTIONS_FLOOR = 1;
const DB_MAX_CONNECTIONS_CEILING = 10;
const databaseMaxConnections = parseDatabaseMaxConnections(rawEnv.DATABASE_MAX_CONNECTIONS);

const LOCAL_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const configuredCorsOrigins = parseDelimitedList(rawEnv.CORS_ORIGIN);

if (nodeEnv === "production" && configuredCorsOrigins.length === 0) {
  throw new Error("CORS_ORIGIN es obligatorio cuando NODE_ENV=production");
}

const corsOrigins =
  nodeEnv === "production"
    ? configuredCorsOrigins
    : Array.from(new Set([...configuredCorsOrigins, ...LOCAL_CORS_ORIGINS]));

const smtpEnabled = Boolean(
  rawEnv.SMTP_HOST &&
    rawEnv.SMTP_PORT &&
    rawEnv.SMTP_USER &&
    rawEnv.SMTP_PASS &&
    rawEnv.SMTP_FROM,
);

const gmailApiEnabled = Boolean(
  rawEnv.GMAIL_API_CLIENT_ID &&
    rawEnv.GMAIL_API_CLIENT_SECRET &&
    rawEnv.GMAIL_API_REFRESH_TOKEN &&
    rawEnv.GMAIL_API_FROM,
);

const appVersion =
  rawEnv.APP_VERSION ?? rawEnv.RENDER_GIT_COMMIT ?? "development";

export const ENV = {
  nodeEnv,
  isDevelopment: nodeEnv === "development",
  isTest: nodeEnv === "test",
  isProduction: nodeEnv === "production",
  port,
  databaseUrl,
  databaseMaxConnections,
  appVersion,
  clientMinVersion: rawEnv.CLIENT_MIN_VERSION ?? appVersion,
  clientVersionGateEnforced: Boolean(rawEnv.CLIENT_MIN_VERSION),
  supabaseUrl: rawEnv.SUPABASE_URL,
  supabaseAnonKey: rawEnv.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: rawEnv.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: rawEnv.SUPABASE_STORAGE_BUCKET ?? "reports",
  cookieName: rawEnv.COOKIE_NAME ?? "app_session_id",
  adminCookieName: rawEnv.ADMIN_COOKIE_NAME ?? "admin_session_id",
  particularCookieName:
    rawEnv.PARTICULAR_COOKIE_NAME ?? "particular_session_id",
  corsOrigins,
  trustProxy: rawEnv.TRUST_PROXY ?? 1,
  cookieSecure: nodeEnv === "production",
  cookieSameSite: (nodeEnv === "production" ? "none" : "lax") as
    | "none"
    | "lax",
  ownerOpenId: rawEnv.OWNER_OPEN_ID ?? "",
  labUploadUsernames: parseDelimitedList(rawEnv.LAB_UPLOAD_USERNAMES),
  contactTo: parseDelimitedList(rawEnv.CONTACT_TO),
  maxUploadFileSizeMb: rawEnv.MAX_UPLOAD_FILE_SIZE_MB ?? 20,
  signedUrlExpiresInSeconds:
    rawEnv.SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS ?? 60 * 15,
  sessionTtlHours: rawEnv.SESSION_TTL_HOURS ?? 24,
  smtp: {
    enabled: smtpEnabled,
    host: rawEnv.SMTP_HOST ?? "",
    port: rawEnv.SMTP_PORT ?? 587,
    secure: rawEnv.SMTP_SECURE ?? false,
    user: rawEnv.SMTP_USER ?? "",
    pass: rawEnv.SMTP_PASS ?? "",
    from: rawEnv.SMTP_FROM ?? "",
  },
  gmailApi: {
    enabled: gmailApiEnabled,
    clientId: rawEnv.GMAIL_API_CLIENT_ID ?? "",
    clientSecret: rawEnv.GMAIL_API_CLIENT_SECRET ?? "",
    refreshToken: rawEnv.GMAIL_API_REFRESH_TOKEN ?? "",
    from: rawEnv.GMAIL_API_FROM ?? "",
  },
} as const;
