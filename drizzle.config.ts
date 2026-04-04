import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: "localhost",
    port: 3306,
    user: "vetneb",
    password: "31731490neb",
    database: "vetneb",
  },
});