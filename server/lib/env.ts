import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
    PORT: z.coerce.number().int().positive().optional(),

    DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SUPABASE_DB_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_STORAGE_BUCKET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

    COOKIE_NAME: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    OWNER_OPEN_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

    MAX_UPLOAD_FILE_SIZE_MB: z.coerce.number().int().positive().max(200).optional(),
    SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().max(86400).optional(),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.SUPABASE_DB_URL && !data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Falta SUPABASE_DB_URL o DATABASE_URL",
        path: ["SUPABASE_DB_URL"],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Configuración de entorno inválida");
}

const rawEnv = parsed.data;
const nodeEnv = rawEnv.NODE_ENV ?? "development";
const port = rawEnv.PORT ?? 3000;
const databaseUrl = rawEnv.SUPABASE_DB_URL ?? rawEnv.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL");
}

export const ENV = {
  nodeEnv,
  isDevelopment: nodeEnv === "development",
  isProduction: nodeEnv === "production",
  port,
  databaseUrl,
  supabaseUrl: rawEnv.SUPABASE_URL,
  supabaseAnonKey: rawEnv.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: rawEnv.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: rawEnv.SUPABASE_STORAGE_BUCKET ?? "reports",
  cookieName: rawEnv.COOKIE_NAME ?? "app_session_id",
  corsOrigin: rawEnv.CORS_ORIGIN,
  ownerOpenId: rawEnv.OWNER_OPEN_ID ?? "",
  maxUploadFileSizeMb: rawEnv.MAX_UPLOAD_FILE_SIZE_MB ?? 20,
  signedUrlExpiresInSeconds:
    rawEnv.SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS ?? 60 * 15,
  sessionTtlHours: rawEnv.SESSION_TTL_HOURS ?? 24,
} as const;
