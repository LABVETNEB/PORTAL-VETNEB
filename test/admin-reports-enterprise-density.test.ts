import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const CARD_PATH = "frontend/src/app/dashboard/admin/AdminReportsCard.tsx";
const UPLOAD_PATH =
  "frontend/src/app/dashboard/admin/AdminReportsUploadPanel.tsx";
const STATUS_PATH =
  "frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx";
const GLOBALS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("Admin Informes preserva el identificador real y monta la consola dedicada", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);

  assert.ok(page.includes('id="admin-report-upload"'));
  assert.ok(page.includes('import { AdminReportsCard } from "./AdminReportsCard";'));
  assert.ok(page.includes("<AdminReportsCard />"));
  assert.ok(controller.includes('"admin-report-upload": {'));
  assert.ok(controller.includes('title: "Informes"'));
  assert.ok(
    controller.includes(
      'description: "Carga, estado y trazabilidad de informes administrados."',
    ),
  );
});

test("Admin Informes usa paginación server-side viewport-safe de nueve filas", () => {
  const card = read(CARD_PATH);

  assert.ok(card.includes("const PAGE_SIZE = 9;"));
  assert.ok(card.includes("getAdminReportWorkflow({"));
  assert.ok(card.includes("limit: PAGE_SIZE"));
  assert.ok(card.includes("offset: nextPage * PAGE_SIZE"));
  assert.ok(card.includes("snapshot.pagination.hasMore"));
  assert.equal(card.includes("slice("), false);
  assert.ok(card.includes('aria-label="Paginación de informes admin"'));
  assert.ok(card.includes("Página anterior"));
  assert.ok(card.includes("Página siguiente"));
});

test("Admin Informes presenta tabla y lista mobile densas con detalle en diálogo", () => {
  const card = read(CARD_PATH);

  for (const marker of [
    "Caso / paciente",
    "Clínica",
    "Estudio",
    "Estado",
    "Fecha",
    "Archivo",
    "Acción",
    "dashboard-table-responsive hidden min-h-0 flex-1 md:block",
    "md:hidden",
    "<ModuleDialog",
    "AdminReportStatusBadge",
  ]) {
    assert.ok(card.includes(marker), `falta contrato visual: ${marker}`);
  }

  assert.equal(card.includes("detalle inline"), false);
  assert.equal(card.includes("dropzone"), false);
});

test("Admin Informes respeta los límites de densidad y no introduce scroll regional", () => {
  const source = [read(CARD_PATH), read(UPLOAD_PATH), read(STATUS_PATH)].join("\n");

  for (const forbidden of [
    "text-2xl",
    "text-3xl",
    "p-6",
    "p-8",
    "gap-6",
    "gap-8",
    "h-14",
    "h-16",
    "overflow-y-auto",
    "overflow-y-scroll",
    "data-dashboard-scroll-region",
  ]) {
    assert.equal(source.includes(forbidden), false, `token prohibido: ${forbidden}`);
  }

  const globals = read(GLOBALS_PATH);
  assert.match(
    globals,
    /\.dashboard-main\s*\{[\s\S]*?@apply[^;]*overflow-hidden[^;]*;[\s\S]*?\}/,
  );
});

test("la subida compacta conserva campos y evita cargar el catálogo global", () => {
  const upload = read(UPLOAD_PATH);

  assert.ok(upload.includes("<ModuleDialog"));
  assert.ok(upload.includes('type UploadStep = "assignment" | "document";'));
  assert.ok(upload.includes("getAdminClinics({"));
  assert.ok(upload.includes("search: query"));
  assert.ok(upload.includes("limit: CLINIC_RESULT_LIMIT"));
  assert.ok(upload.includes("getAdminParticularTokens({"));
  assert.ok(upload.includes("uploadAdminReport(formData)"));
  assert.ok(upload.includes('formData.append("clinicId"'));
  assert.ok(upload.includes('formData.append("file", file)'));
  assert.ok(upload.includes('formData.append("particularTokenId"'));
  assert.ok(upload.includes('accept="application/pdf"'));
  assert.equal(upload.includes("getAdminUsersRoles"), false);
  assert.equal(upload.includes("Promise.all"), false);
});

test("seguridad de archivos y trazabilidad permanecen bajo contratos admin", () => {
  const source = [read(CARD_PATH), read(UPLOAD_PATH)].join("\n");

  assert.ok(source.includes("updateAdminReportWorkflowStage"));
  assert.ok(source.includes("updateAdminReportSpecialStain"));
  assert.ok(source.includes("<ReportFileActions"));
  assert.ok(source.includes('scope="admin"'));
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
  assert.equal(source.includes("console.log"), false);
  assert.equal(source.includes("console.info"), false);
  assert.equal(source.includes("downloadUrl"), false);
  assert.equal(source.includes("previewUrl"), false);
  assert.equal(source.includes("fetch("), false);
});
