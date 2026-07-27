const SHARED_BACKEND_SCOPE_EXCEPTIONS = new Set([
  "server/features/users-roles/infrastructure/admin-users-roles-repository.ts",
  "server/routes/admin-users-roles.fastify.ts",
  "server/features/report-access/infrastructure/report-access-repository.ts",
  "server/db.ts",
  "server/lib/http-runtime.ts",
  "server/routes/particular-auth.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/public-report-access.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/reports-status.fastify.ts",
  "server/routes/reports.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
  "server/fastify-app.ts",
  "server/lib/env.ts",
  "server/middlewares/version-gate.ts",
  "server/routes/app-version.fastify.ts",
]);

export function isSharedBackendScopeException(file: string): boolean {
  return SHARED_BACKEND_SCOPE_EXCEPTIONS.has(file.replace(/\\/g, "/"));
}

export function isReportForeignAccessBackendFile(file: string): boolean {
  return isSharedBackendScopeException(file);
}
