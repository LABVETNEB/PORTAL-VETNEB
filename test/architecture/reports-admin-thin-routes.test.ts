import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const application =
  "server/features/reports/application/report-route-service.ts";
const composition =
  "server/features/reports/composition/report-route-composition.ts";
const infrastructure =
  "server/features/reports/infrastructure/db-report-workflow.ts";
const reportsRoute = "server/routes/admin-reports.fastify.ts";
const workflowRoute = "server/routes/admin-report-workflow.fastify.ts";
const shim = "server/db-report-workflow.ts";

const m39ProductionInventory = [
  reportsRoute,
  workflowRoute,
  application,
  "server/features/reports/application/index.ts",
  "server/features/reports/application/README.md",
  infrastructure,
  "server/features/reports/infrastructure/index.ts",
  "server/features/reports/infrastructure/README.md",
  composition,
  "server/features/reports/composition/index.ts",
  "server/features/reports/composition/README.md",
  "server/features/reports/README.md",
  shim,
] as const;

test("M39 materializa exactamente el inventario productivo contratado", () => {
  assert.deepEqual(m39ProductionInventory, [
    reportsRoute,
    workflowRoute,
    application,
    "server/features/reports/application/index.ts",
    "server/features/reports/application/README.md",
    infrastructure,
    "server/features/reports/infrastructure/index.ts",
    "server/features/reports/infrastructure/README.md",
    composition,
    "server/features/reports/composition/index.ts",
    "server/features/reports/composition/README.md",
    "server/features/reports/README.md",
    shim,
  ]);
  for (const path of m39ProductionInventory) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
});

test("application es framework-agnostic, inyectada y expone seis operaciones", () => {
  const source = read(application);

  for (const marker of [
    "export function createReportRouteService",
    "getSignedPreviewUrl",
    "getSignedDownloadUrl",
    "uploadAdminReport",
    "listAdminWorkflow",
    "changeWorkflowStage",
    "changeSpecialStain",
    'type: "clinic_not_found"',
    'type: "file_missing"',
    'type: "token_not_found"',
    'type: "token_clinic_mismatch"',
    'type: "not_found"',
  ]) {
    assert.ok(source.includes(marker), marker);
  }

  for (const forbidden of [
    "fastify",
    "server/db",
    "drizzle",
    "schema.ts",
    "supabase",
    "AUDIT_EVENTS",
    "authenticate",
    "console.",
    "reply.code",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

test("rutas M39 quedan limitadas a transporte y no alcanzan owners concretos", () => {
  const reports = read(reportsRoute);
  const workflow = read(workflowRoute);

  for (const source of [reports, workflow]) {
    assert.equal(source.includes('../db.ts'), false);
    assert.equal(source.includes("drizzle-orm"), false);
    assert.equal(source.includes(".select("), false);
    assert.equal(source.includes(".update("), false);
    assert.ok(source.includes("authenticateFastifyAdmin"));
    assert.ok(source.includes("enforceTrustedOrigin"));
  }
  assert.equal(workflow.includes("db-report-workflow.ts"), false);
  for (const forbidden of [
    "deps.uploadReport",
    "deps.upsertReport",
    "deps.updateParticularTokenReport",
    "deps.updateStudyTrackingCase",
    "deps.writeAuditLog",
    "createReportWorkflowNotification",
  ]) {
    assert.equal(reports.includes(forbidden), false, forbidden);
  }
});

test("Options, endpoints, preflight y mensajes HTTP permanecen explícitos", () => {
  const reports = read(reportsRoute);
  const workflow = read(workflowRoute);

  for (const marker of [
    "export type AdminReportsNativeRoutesOptions",
    "upsertReport?:",
    'app.options("/upload"',
    'app.get<{',
    '}>("/:reportId/preview-url"',
    '}>("/:reportId/download-url"',
    'app.post("/upload"',
    '"POST,OPTIONS"',
    "Origen no permitido",
    "ID de informe invalido",
    "Informe no encontrado",
    "clinicId es obligatorio",
    "particularTokenId inválido",
    "Clinica no encontrada",
    "No se proporciono ningun archivo",
    "Token particular no encontrado",
    "El token particular no pertenece a la clínica indicada",
    "Informe subido correctamente",
  ]) {
    assert.ok(reports.includes(marker), marker);
  }

  for (const marker of [
    "export type AdminReportWorkflowNativeRoutesOptions",
    'app.options("/"',
    'app.options("/:id/stage"',
    'app.options("/:id/special-stain"',
    'app.get<{ Querystring: WorkflowQuery }>("/"',
    '"/:id/stage"',
    '"/:id/special-stain"',
    '"GET,PATCH,OPTIONS"',
    "ID de informe inválido",
    "Etapa de workflow inválida",
    "Solicitud de tinción especial inválida",
    "Informe no encontrado",
  ]) {
    assert.ok(workflow.includes(marker), marker);
  }
});

test("infrastructure conserva queries y no depende de composition", () => {
  const source = read(infrastructure);

  for (const marker of [
    "export type AdminReportWorkflowItem",
    "normalizeListPagination",
    "defaultLimit: 20",
    "maxLimit: 21",
    "desc(reports.uploadDate)",
    "desc(reports.createdAt)",
    "desc(reports.id)",
    ".limit(limit)",
    ".offset(offset)",
    ".limit(1)",
    "workflowUpdatedAt: now",
    "updatedAt: now",
    "createWorkflowCommunicationSafely",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
  assert.equal(source.includes("../composition"), false);
});

test("composition es el único bridge lazy y la inyección completa evita defaults", () => {
  const source = read(composition);

  for (const marker of [
    "createAdminReportsRouteComposition",
    "createAdminReportWorkflowRouteComposition",
    "hasAllAdminReportsDependencies(options)",
    "hasAllWorkflowDependencies(options)",
    "? undefined",
    "await loadDefaultAdminReportsDependencies()",
    "await loadDefaultWorkflowDependencies()",
    "reportCommands.createOrEditReport",
    "reportCommandRepository.getReportById",
    "createDbReportWorkflowRepository",
    "createReportWorkflowNotification",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
  assert.equal(source.includes(" from \"../../../db.ts\""), false);
});

test("shim M41 no contiene implementación ni tiene consumidores runtime M39", () => {
  const source = read(shim);
  const reports = read(reportsRoute);
  const workflow = read(workflowRoute);

  assert.ok(source.includes("Shim temporal de compatibilidad"));
  assert.ok(source.includes("Retiro previsto para M41"));
  for (const forbidden of [
    "drizzle-orm",
    "./db.ts",
    ".select(",
    ".update(",
    "normalizeListPagination",
    "console.",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(reports.includes("db-report-workflow"), false);
  assert.equal(workflow.includes("db-report-workflow"), false);
});

test("M40 sigue ausente y los shims M41 siguen presentes", () => {
  assert.equal(
    existsSync(
      resolve(
        root,
        "server/features/reports/application/report-query-use-cases.ts",
      ),
    ),
    false,
  );
  for (const path of [
    "server/db-report-workflow.ts",
    "server/lib/report-workflow-communication.ts",
    "server/lib/report-status.ts",
    "server/lib/report-study-types.ts",
    "server/lib/reports.ts",
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
});
