import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const TOPBAR_PATH = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const SIDEBAR_PATH =
  "frontend/src/components/dashboard/AdminDashboardSidebar.tsx";
const ADMIN_PARTICULAR_TOKENS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const BELL_PATH =
  "frontend/src/components/dashboard/DashboardNotificationsBell.tsx";
const API_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard admin elimina seguimiento redundante y mueve carga de informes al token", () => {
  const page = read(PAGE_PATH);
  const card = read(ADMIN_PARTICULAR_TOKENS_CARD_PATH);

  assert.equal(
    page.includes(
      'import { AdminReportWorkflowViewerCard } from "@/components/dashboard/AdminReportWorkflowViewerCard";',
    ),
    false,
  );
  assert.equal(page.includes('id="admin-report-workflow"'), false);
  assert.equal(page.includes("<AdminReportWorkflowViewerCard />"), false);
  assert.equal(
    page.includes(
      'import { UploadReportModal } from "@/components/dashboard/UploadReportModal";',
    ),
    false,
  );
  assert.equal(page.includes("<UploadReportModal />"), false);
  assert.ok(
    card.includes(
      'import { UploadReportModal } from "@/components/dashboard/UploadReportModal";',
    ),
  );
  assert.ok(card.includes("triggerLabel={"));
  assert.ok(card.includes('"Subir informe para este token"'));
  assert.ok(card.includes('"Reemplazar informe"'));
  assert.ok(card.includes("presetParticularToken={token}"));
});

test("sidebar admin no muestra seguimiento de informes y conserva anclas operativas", () => {
  const sidebar = read(SIDEBAR_PATH);

  assert.equal(sidebar.includes('label: "Seguimiento de informes"'), false);
  assert.equal(sidebar.includes("#admin-report-workflow"), false);
  assert.ok(sidebar.includes('label: "Tokens particulares"'));
  assert.ok(sidebar.includes('label: "Auditoría"'));
});

test("admin tokens card permite solicitar y resolver tinción especial por tracking case", () => {
  const card = read(ADMIN_PARTICULAR_TOKENS_CARD_PATH);

  assert.ok(card.includes("handleSpecialStainChange("));
  assert.ok(card.includes("updateAdminStudyTrackingCase(trackingCase.id, {"));
  assert.ok(card.includes("specialStainRequired: !trackingCase.specialStainRequired"));
  assert.ok(card.includes("Solicitar tinción especial"));
  assert.ok(card.includes("Resolver tinción especial"));
  assert.ok(card.includes("Alerta: Solicitud de tinción especial"));
  assert.ok(card.includes("Sin alerta de tinción especial"));
  assert.ok(card.includes("No se pudo actualizar la alerta de tinción especial."));
  assert.ok(card.includes("[tokenId]: response.trackingCase"));
});

test("dashboard topbar soporta notifications='admin' y monta la campana", () => {
  const topbar = read(TOPBAR_PATH);
  const page = read(PAGE_PATH);

  assert.ok(
    topbar.includes(
      'import { DashboardNotificationsBell } from "./DashboardNotificationsBell";',
    ),
  );
  assert.ok(
    topbar.includes('notifications?: "admin" | "clinic" | "particular" | false;'),
  );
  assert.ok(topbar.includes("notifications = false,"));
  assert.ok(
    topbar.includes(
      "{notifications ? <DashboardNotificationsBell surface={notifications} /> : null}",
    ),
  );
  assert.ok(page.includes('notifications="admin"'));
});

test("campana de notificaciones admin existe con UX in-app y polling", () => {
  const bell = read(BELL_PATH);

  assert.ok(bell.includes('"use client";'));
  assert.ok(bell.includes('import { Bell, X } from "lucide-react";'));
  assert.ok(bell.includes("aria-label=\"Notificaciones\""));
  assert.ok(bell.includes("Notificaciones"));
  assert.ok(bell.includes("Activar notificaciones"));
  assert.ok(bell.includes("Actualizar"));
  assert.ok(bell.includes("Marcar todo como leído"));
  assert.ok(bell.includes("No hay notificaciones."));
  assert.ok(bell.includes("No se pudieron cargar las notificaciones."));
  assert.ok(bell.includes("POLLING_INTERVAL_MS = 30_000"));
  assert.ok(bell.includes("window.setInterval(() => {"));
  assert.ok(bell.includes("window.clearInterval(intervalId);"));
});

test("campana usa API de notificaciones por surface para listar y marcar leídas", () => {
  const bell = read(BELL_PATH);

  assert.ok(bell.includes("surface: DashboardNotificationSurface;"));
  assert.ok(bell.includes("getDashboardNotifications(surface, {"));
  assert.ok(bell.includes("markDashboardNotificationRead("));
  assert.ok(bell.includes("markAllDashboardNotificationsRead(surface)"));
  assert.ok(bell.includes("setNotifications(response.notifications);"));
  assert.ok(bell.includes("response.notification"));
  assert.ok(bell.includes("Marcar todo como leído"));
});

test("campana mantiene dropdown responsive y acciones sin overflow", () => {
  const bell = read(BELL_PATH);

  assert.ok(
    bell.includes(
      "w-[min(28rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden",
    ),
  );
  assert.ok(bell.includes("absolute right-0 z-50"));
  assert.ok(bell.includes('className="mb-2 flex flex-col gap-2"'));
  assert.ok(
    bell.includes(
      'className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"',
    ),
  );
  assert.ok(
    bell.includes(
      'className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap"',
    ),
  );
  assert.ok(
    bell.includes('listClassName: "max-h-72 space-y-2 overflow-y-auto pr-1"'),
  );
  assert.ok(
    bell.includes("hidden w-[min(28rem,calc(100vw-2rem))]"),
    "desktop dropdown must be hidden on mobile",
  );
  assert.ok(bell.includes("sm:block"));
});

test("api frontend expone funciones de notificaciones por surface y compat admin", () => {
  const api = read(API_PATH);

  assert.ok(api.includes("export type AdminStudyTrackingNotificationSummary = {"));
  assert.ok(api.includes("export type DashboardNotificationSurface ="));
  assert.ok(api.includes('case "admin":'));
  assert.ok(api.includes('case "clinic":'));
  assert.ok(api.includes('case "particular":'));
  assert.ok(api.includes("export async function getDashboardNotifications("));
  assert.ok(api.includes("export async function markDashboardNotificationRead("));
  assert.ok(api.includes("export async function markAllDashboardNotificationsRead("));
  assert.ok(api.includes("export async function getAdminStudyTrackingNotifications("));
  assert.ok(api.includes("export async function getClinicStudyTrackingNotifications("));
  assert.ok(api.includes("export async function getParticularStudyTrackingNotifications("));
  assert.ok(api.includes("export async function markAdminStudyTrackingNotificationRead("));
  assert.ok(api.includes("export async function markClinicStudyTrackingNotificationRead("));
  assert.ok(api.includes("export async function markParticularStudyTrackingNotificationRead("));
  assert.ok(api.includes("export async function markAllAdminStudyTrackingNotificationsRead("));
  assert.ok(api.includes("export async function markAllClinicStudyTrackingNotificationsRead("));
  assert.ok(api.includes("export async function markAllParticularStudyTrackingNotificationsRead("));
});
