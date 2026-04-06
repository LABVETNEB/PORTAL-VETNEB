import dotenv from "dotenv";

dotenv.config({ override: true });

const databaseUrl =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL en .env");
}

export const ENV = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl,
  cookieSecret: process.env.COOKIE_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "reports",
} as const;