import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_SESSIONS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin sessions card is client-side and imports required dependencies", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { useEffect, useMemo, useState, useTransition } from "react";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes('import { getAdminSessions, revokeAdminSession } from "@/lib/api";'));
  assert.ok(source.includes('import { formatDateTime } from "@/lib/utils";'));
});

test("admin sessions card keeps typed session contracts", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("AdminSessionStatus"));
  assert.ok(source.includes("AdminSessionSummary"));
  assert.ok(source.includes("AdminSessionType"));
  assert.ok(source.includes("AdminSessionsSnapshot"));
  assert.ok(source.includes("const PAGE_SIZE = 25;"));
});

test("admin sessions card keeps formatters and badge variants", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("function formatOptionalDate(value: string | null)"));
  assert.ok(source.includes('return value ? formatDateTime(value) : "—";'));
  assert.ok(source.includes("function formatSessionType(value: AdminSessionType)"));
  assert.ok(source.includes('if (value === "admin") return "Admin";'));
  assert.ok(source.includes('if (value === "clinic") return "Clínica";'));
  assert.ok(source.includes('return "Particular";'));
  assert.ok(source.includes("function formatActorType(value: AdminSessionSummary[\"actorType\"])"));
  assert.ok(source.includes('return "Token particular";'));
  assert.ok(source.includes("function getSessionTypeVariant("));
  assert.ok(source.includes("function getStatusVariant("));
  assert.ok(source.includes("function formatStatus(value: AdminSessionStatus)"));
});

test("admin sessions card keeps state for filters pagination errors and revocation", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("const [snapshot, setSnapshot] = useState<AdminSessionsSnapshot | null>(null);"));
  assert.ok(source.includes("const [sessionType, setSessionType] = useState<AdminSessionType | \"all\">("));
  assert.ok(source.includes("const [status, setStatus] = useState<AdminSessionStatus | \"all\">(\"all\");"));
  assert.ok(source.includes("const [offset, setOffset] = useState(0);"));
  assert.ok(source.includes("const [error, setError] = useState<string | null>(null);"));
  assert.ok(source.includes("const [revokingSessionKey, setRevokingSessionKey] = useState<string | null>("));
  assert.ok(source.includes("const [isPending, startTransition] = useTransition();"));
});

test("admin sessions card builds explicit query from selected filters", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("const query = useMemo("));
  assert.ok(source.includes('...(sessionType !== "all" ? { sessionType } : {})'));
  assert.ok(source.includes('...(status !== "all" ? { status } : {})'));
  assert.ok(source.includes("limit: PAGE_SIZE"));
  assert.ok(source.includes("offset"));
  assert.ok(source.includes("[offset, sessionType, status]"));
});

test("admin sessions card loads sessions and handles load errors", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("function loadSessions()"));
  assert.ok(source.includes("setError(null);"));
  assert.ok(source.includes("startTransition(() => {"));
  assert.ok(source.includes("const result = await getAdminSessions(query);"));
  assert.ok(source.includes("setSnapshot(result);"));
  assert.ok(source.includes('"No se pudieron cargar las sesiones."'));
  assert.ok(source.includes("useEffect(() => {"));
  assert.ok(source.includes("loadSessions();"));
});

test("admin sessions card revokes sessions only after explicit confirmation", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("async function handleRevokeSession(session: AdminSessionSummary)"));
  assert.ok(source.includes("const sessionKey = `${session.sessionType}-${session.sessionId}`;"));
  assert.ok(source.includes("const confirmed = window.confirm("));
  assert.ok(source.includes("Esta acción cerrará esa sesión y quedará auditada."));
  assert.ok(source.includes("if (!confirmed) {"));
  assert.ok(source.includes("await revokeAdminSession(session.sessionType, session.sessionId);"));
  assert.ok(source.includes("const refreshed = await getAdminSessions(query);"));
  assert.ok(source.includes("setSnapshot(refreshed);"));
  assert.ok(source.includes('"No se pudo revocar la sesión seleccionada."'));
  assert.ok(source.includes("setRevokingSessionKey(null);"));
});

test("admin sessions card renders safe description filters and table columns", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("Sesiones activas y expiradas"));
  assert.ok(source.includes("Vista de sesiones Admin, clínica y particulares. No expone tokens,"));
  assert.ok(source.includes("hashes ni cookies. La revocación requiere confirmación explícita."));
  assert.ok(source.includes("Total filtrado"));
  assert.ok(source.includes("Tipo de sesión"));
  assert.ok(source.includes("Estado"));
  assert.ok(source.includes("Página"));
  assert.ok(source.includes("<TableHead>Sesión</TableHead>"));
  assert.ok(source.includes("<TableHead>Actor</TableHead>"));
  assert.ok(source.includes("<TableHead>Estado</TableHead>"));
  assert.ok(source.includes("<TableHead>Creada</TableHead>"));
  assert.ok(source.includes("<TableHead>Último acceso</TableHead>"));
  assert.ok(source.includes("<TableHead>Expira</TableHead>"));
  assert.ok(source.includes('<TableHead className="text-right">Acción</TableHead>'));
});

test("admin sessions card renders rows actions empty state and pagination", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("snapshot.sessions.map((session) => {"));
  assert.ok(source.includes("formatSessionType(session.sessionType)"));
  assert.ok(source.includes("formatActorType(session.actorType)"));
  assert.ok(source.includes("formatStatus(session.status)"));
  assert.ok(source.includes("formatOptionalDate(session.createdAt)"));
  assert.ok(source.includes("formatOptionalDate(session.lastAccess)"));
  assert.ok(source.includes("formatOptionalDate(session.expiresAt)"));
  assert.ok(source.includes("onClick={() => void handleRevokeSession(session)}"));
  assert.ok(source.includes('isRevoking ? "Revocando..." : "Revocar"'));
  assert.ok(source.includes("Cargando sesiones..."));
  assert.ok(source.includes("No hay sesiones para los filtros seleccionados."));
  assert.ok(source.includes("const hasPreviousPage = offset > 0;"));
  assert.ok(source.includes("const hasNextPage = snapshot"));
  assert.ok(source.includes("Anterior"));
  assert.ok(source.includes("Siguiente"));
});

test("admin sessions card documents admin endpoints and avoids raw token fields", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);

  assert.ok(source.includes("GET /api/admin/sessions"));
  assert.ok(source.includes("POST /api/admin/sessions/:sessionType/:sessionId/revoke"));
  assert.ok(source.includes("La revocación queda auditada."));
  assert.equal(source.includes("password"), false);
  assert.equal(source.includes("sessionToken"), false);
  assert.equal(source.includes("tokenHash"), false);
});
