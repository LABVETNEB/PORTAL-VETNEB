const REPORT_FOREIGN_ACCESS_BACKEND_FILES = new Set([
  "server/db-report-access.ts",
  "server/db.ts",
  "server/routes/particular-auth.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/public-report-access.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/reports-status.fastify.ts",
  "server/routes/reports.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
]);

export function isReportForeignAccessBackendFile(file: string): boolean {
  return REPORT_FOREIGN_ACCESS_BACKEND_FILES.has(file.replace(/\\/g, "/"));
}
