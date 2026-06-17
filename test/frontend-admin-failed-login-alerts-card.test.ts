import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin failed login alerts card is client-side and imports required dependencies", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { useEffect, useMemo, useState, useTransition } from "react";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes('import { PublicExternalControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes("buildAdminFailedLoginAlertsCsvUrl"));
  assert.ok(source.includes("getAdminFailedLoginAlerts"));
  assert.ok(source.includes('import { formatDateTime } from "@/lib/utils";'));
});

test("admin failed login alerts card keeps typed contracts and pagination size", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("AdminFailedLoginAlertReason"));
  assert.ok(source.includes("AdminFailedLoginAlertsSnapshot"));
  assert.ok(source.includes("AdminFailedLoginAlertSurface"));
  assert.ok(source.includes("const PAGE_SIZE = 5;"));
});

test("admin failed login alerts card keeps surface reason and nullable formatters", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("function formatSurface(value: AdminFailedLoginAlertSurface)"));
  assert.ok(source.includes('if (value === "admin") return "Admin";'));
  assert.ok(source.includes('if (value === "clinic") return "Clínica";'));
  assert.ok(source.includes('return "Particular";'));
  assert.ok(source.includes("function formatReason(value: AdminFailedLoginAlertReason)"));
  assert.ok(source.includes('if (value === "missing_credentials") return "Credenciales faltantes";'));
  assert.ok(source.includes('if (value === "invalid_credentials") return "Credenciales inválidas";'));
  assert.ok(source.includes('return "Bloqueo temporal";'));
  assert.ok(source.includes("function formatNullable(value: string | null)"));
  assert.ok(source.includes('return value && value.trim() ? value : "—";'));
});

test("admin failed login alerts card keeps badge variants for surfaces and reasons", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("function getSurfaceVariant("));
  assert.ok(source.includes('if (value === "admin") return "default";'));
  assert.ok(source.includes('if (value === "clinic") return "secondary";'));
  assert.ok(source.includes('return "outline";'));
  assert.ok(source.includes("function getReasonVariant("));
  assert.ok(source.includes('if (value === "rate_limited") return "secondary";'));
  assert.ok(source.includes('if (value === "invalid_credentials") return "secondary";'));
  assert.ok(source.includes('return "outline";'));
});

test("admin failed login alerts card keeps state for filters pagination and errors", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("useState<AdminFailedLoginAlertsSnapshot | null>(null);"));
  assert.ok(source.includes("const [surface, setSurface] = useState<"));
  assert.ok(source.includes("AdminFailedLoginAlertSurface | \"all\""));
  assert.ok(source.includes("const [reason, setReason] = useState<AdminFailedLoginAlertReason | \"all\">("));
  assert.ok(source.includes("const [offset, setOffset] = useState(0);"));
  assert.ok(source.includes("const [error, setError] = useState<string | null>(null);"));
  assert.ok(source.includes("const [isPending, startTransition] = useTransition();"));
});

test("admin failed login alerts card builds API query and CSV URL from filters", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("const query = useMemo("));
  assert.ok(source.includes('...(surface !== "all" ? { surface } : {})'));
  assert.ok(source.includes('...(reason !== "all" ? { reason } : {})'));
  assert.ok(source.includes("limit: PAGE_SIZE"));
  assert.ok(source.includes("offset"));
  assert.ok(source.includes("[offset, reason, surface]"));
  assert.ok(source.includes("const csvUrl = useMemo("));
  assert.ok(source.includes("buildAdminFailedLoginAlertsCsvUrl({"));
  assert.ok(source.includes("[reason, surface]"));
});

test("admin failed login alerts card keeps reversible filters and load behavior", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("function clearFailedLoginAlertFilters()"));
  assert.ok(source.includes('setSurface("all");'));
  assert.ok(source.includes('setReason("all");'));
  assert.ok(source.includes("setOffset(0);"));
  assert.ok(source.includes("function loadFailedLoginAlerts()"));
  assert.ok(source.includes("const result = await getAdminFailedLoginAlerts(query);"));
  assert.ok(source.includes("setSnapshot(result);"));
  assert.ok(source.includes('"No se pudieron cargar los intentos fallidos."'));
  assert.ok(source.includes("useEffect(() => {"));
  assert.ok(source.includes("loadFailedLoginAlerts();"));
});

test("admin failed login alerts card renders header and actions without technical copy", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);
  const removedReadOnlyCopy = "Vista Admin read-" + "only";

  assert.ok(source.includes('id="failed-login-alerts"'));
  assert.ok(source.includes("Intentos fallidos de login"));
  assert.ok(source.includes("Limpiar filtros"));
  assert.ok(source.includes("<PublicExternalControl"));
  assert.ok(source.includes("href={csvUrl}"));
  assert.ok(source.includes('target="_self"'));
  assert.ok(source.includes("Exportar CSV"));
  assert.ok(source.includes('isPending ? "Actualizando..." : "Actualizar"'));
  assert.equal(source.includes(removedReadOnlyCopy), false);
  assert.equal(source.includes("passwords, tokens, hashes ni cookies."), false);
});

test("admin failed login alerts card renders filters table columns and rows", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("Total filtrado"));
  assert.ok(source.includes("Superficie"));
  assert.ok(source.includes("Motivo"));
  assert.ok(source.includes("Página"));
  assert.ok(source.includes("<TableHead>ID</TableHead>"));
  assert.ok(source.includes("<TableHead>Superficie</TableHead>"));
  assert.ok(source.includes("<TableHead>Usuario</TableHead>"));
  assert.ok(source.includes("<TableHead>Motivo</TableHead>"));
  assert.ok(source.includes("<TableHead>IP</TableHead>"));
  assert.ok(source.includes("<TableHead>User agent</TableHead>"));
  assert.ok(source.includes("<TableHead>Fecha</TableHead>"));
  assert.ok(source.includes("snapshot.failedLoginAlerts.map((alert) =>"));
  assert.ok(source.includes("formatSurface(alert.surface)"));
  assert.ok(source.includes("formatReason(alert.reason)"));
  assert.ok(source.includes("formatNullable(alert.username)"));
  assert.ok(source.includes("formatNullable(alert.ipAddress)"));
  assert.ok(source.includes("formatNullable(alert.userAgent)"));
  assert.ok(source.includes("formatDateTime(alert.createdAt)"));
});

test("admin failed login alerts card keeps empty state and pagination without endpoint copy", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);
  const removedAlertsEndpoint = "GET " + "/api/admin/failed-login-alerts";
  const removedAlertsCsvEndpoint = "GET " + "/api/admin/failed-login-alerts/export.csv";
  const removedReadOnlyFilters = "read-" + "only con filtros reversibles";

  assert.ok(source.includes("isPending ?"));
  assert.ok(source.includes("LoadingState"));
  assert.ok(source.includes('"No se pudieron cargar los intentos fallidos."'));
  assert.ok(source.includes("No hay intentos fallidos para los filtros seleccionados."));
  assert.ok(source.includes("const hasPreviousPage = offset > 0;"));
  assert.ok(source.includes("const hasNextPage = snapshot"));
  assert.ok(source.includes("Anterior"));
  assert.ok(source.includes("Siguiente"));
  assert.equal(source.includes(removedAlertsEndpoint), false);
  assert.equal(source.includes(removedAlertsCsvEndpoint), false);
  assert.equal(source.includes(removedReadOnlyFilters), false);
  assert.equal(source.includes("no bloquea usuarios, no revoca sesiones y no dispara notificaciones."), false);
});
