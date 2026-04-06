import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_DB_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("reports"),
  COOKIE_NAME: z.string().min(1).default("app_session_id"),
  CORS_ORIGIN: z.string().optional(),
  OWNER_OPEN_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Configuración de entorno inválida");
}

const env = parsed.data;
const databaseUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL");
}

export const ENV = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  databaseUrl,
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: env.SUPABASE_STORAGE_BUCKET,
  cookieName: env.COOKIE_NAME,
  corsOrigin: env.CORS_ORIGIN,
  ownerOpenId: env.OWNER_OPEN_ID ?? "",
} as const;
