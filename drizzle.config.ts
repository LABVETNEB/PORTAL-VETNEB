import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ override: true });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "Falta SUPABASE_DB_URL o DATABASE_URL en el archivo .env",
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});