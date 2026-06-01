import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const CARD_PATH =
  "frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx";
const SIDEBAR_PATH =
  "frontend/src/components/dashboard/AdminDashboardSidebar.tsx";
const API_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard Admin integra la tarjeta de seguimiento sin retirar la carga PDF", () => {
  const page = read(PAGE_PATH);

  assert.ok(
    page.includes(
      'import { AdminReportWorkflowViewerCard } from "@/components/dashboard/AdminReportWorkflowViewerCard";',
    ),
  );
  assert.ok(page.includes('id="admin-report-workflow"'));
  assert.ok(page.includes("<AdminReportWorkflowViewerCard />"));
  assert.ok(page.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal";'));
  assert.ok(page.includes("<UploadReportModal />"));
});

test("sidebar Admin enlaza al seguimiento de informes renderizado", () => {
  const sidebar = read(SIDEBAR_PATH);
  const page = read(PAGE_PATH);

  assert.ok(sidebar.includes('label: "Seguimiento de informes"'));
  assert.ok(
    sidebar.includes('href: `${ROUTES.dashboardAdmin}#admin-report-workflow`'),
  );
  assert.ok(page.includes('id="admin-report-workflow"'));
  assert.ok(page.includes("<AdminReportWorkflowViewerCard />"));
});

test("tarjeta presenta cinco etapas globales y tinción especial como alerta aparte", () => {
  const card = read(CARD_PATH);
  const stagesStart = card.indexOf("const WORKFLOW_STAGES");
  const stagesEnd = card.indexOf("];", stagesStart);
  const stages = card.slice(stagesStart, stagesEnd);

  for (const stage of [
    "Recepción de muestra",
    "Procesamiento",
    "Evaluación",
    "Desarrollo de informe",
    "Informe disponible / Publicado",
  ]) {
    assert.ok(stages.includes(stage), `debe mostrar ${stage}`);
  }

  assert.equal(stages.includes("tinción"), false);
  assert.ok(card.includes("Seguimiento de informes"));
  assert.ok(card.includes("Alerta tinción especial"));
  assert.ok(card.includes("Solicitar"));
  assert.ok(card.includes("Resolver"));
  assert.ok(card.includes("Reporte / token"));
  assert.equal(card.includes("citologia"), false);
  assert.equal(card.includes("histopatologia"), false);
  assert.equal(card.includes("hemoparasitos"), false);
});

test("tarjeta y cliente API soportan paginación y mutaciones manuales", () => {
  const card = read(CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("const PAGE_LIMIT = 20;"));
  assert.ok(card.includes("limit: PAGE_LIMIT"));
  assert.ok(card.includes("Anterior"));
  assert.ok(card.includes("Siguiente"));
  assert.ok(card.includes("handleStageChange"));
  assert.ok(card.includes("handleSpecialStainChange"));
  assert.ok(api.includes("export async function getAdminStudyTrackingCases("));
  assert.ok(api.includes("export async function updateAdminStudyTrackingCase("));
  assert.ok(api.includes("`/api/admin/study-tracking${qs ? `?${qs}` : \"\"}`"));
  assert.ok(api.includes("`/api/admin/study-tracking/${trackingCaseId}`"));
  assert.ok(api.includes('credentials: options.credentials ?? "include",'));
});
