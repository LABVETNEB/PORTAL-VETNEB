import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolveDrizzleDbUrl } from "./scripts/db/resolve-drizzle-db-url.mjs";

const envPath = resolve(process.cwd(), ".env");
const dotenvEnv = existsSync(envPath) ? dotenv.parse(readFileSync(envPath)) : {};
const dbUrl = resolveDrizzleDbUrl(process.env, dotenvEnv);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
