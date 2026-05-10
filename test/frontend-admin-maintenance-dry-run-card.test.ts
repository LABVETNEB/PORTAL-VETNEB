import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_MAINTENANCE_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin maintenance dry-run card is client-side and imports required dependencies", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { useState, useTransition } from "react";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes('import { getAdminMaintenancePurgeDryRun } from "@/lib/api";'));
  assert.ok(source.includes("MaintenancePurgeCandidateGroup"));
  assert.ok(source.includes("MaintenancePurgeDryRunSnapshot"));
});

test("admin maintenance dry-run card keeps generated date formatting", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("function formatGeneratedAt(value: string)"));
  assert.ok(source.includes("const date = new Date(value);"));
  assert.ok(source.includes("if (Number.isNaN(date.getTime()))"));
  assert.ok(source.includes("return value;"));
  assert.ok(source.includes('new Intl.DateTimeFormat("es-AR"'));
  assert.ok(source.includes('dateStyle: "short"'));
  assert.ok(source.includes('timeStyle: "short"'));
});

test("admin maintenance dry-run card keeps candidate support variants and labels", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("function getCandidateVariant("));
  assert.ok(source.includes("candidate.supported ? \"secondary\" : \"outline\""));
  assert.ok(source.includes("function formatSupportLabel(candidate: MaintenancePurgeCandidateGroup)"));
  assert.ok(source.includes('candidate.supported ? "Soportado" : "No soportado"'));
});

test("admin maintenance dry-run card renders candidate rows safely", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("function MaintenanceCandidateRow({"));
  assert.ok(source.includes("candidate: MaintenancePurgeCandidateGroup;"));
  assert.ok(source.includes("{candidate.label}"));
  assert.ok(source.includes("{candidate.category}"));
  assert.ok(source.includes("<Badge variant={getCandidateVariant(candidate)}>"));
  assert.ok(source.includes("{formatSupportLabel(candidate)}"));
  assert.ok(source.includes("{candidate.count}"));
  assert.ok(source.includes("candidate.destructiveAction ? ("));
  assert.ok(source.includes("Acción futura:"));
  assert.ok(source.includes("{candidate.destructiveAction}"));
  assert.ok(source.includes("candidate.reason ? ("));
  assert.ok(source.includes("{candidate.reason}"));
});

test("admin maintenance dry-run card keeps state and transition handling", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("export function AdminMaintenanceDryRunCard()"));
  assert.ok(source.includes("useState<MaintenancePurgeDryRunSnapshot | null>(null);"));
  assert.ok(source.includes("const [error, setError] = useState<string | null>(null);"));
  assert.ok(source.includes("const [isPending, startTransition] = useTransition();"));
});

test("admin maintenance dry-run card calls dry-run API without destructive action", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("function handleAnalyze()"));
  assert.ok(source.includes("setError(null);"));
  assert.ok(source.includes("startTransition(() => {"));
  assert.ok(source.includes("const result = await getAdminMaintenancePurgeDryRun();"));
  assert.ok(source.includes("setSnapshot(result);"));
  assert.ok(source.includes('"No se pudo analizar la limpieza."'));
  assert.equal(source.includes("delete"), false);
  assert.equal(source.includes("purge("), false);
});

test("admin maintenance dry-run card renders safe title description and trigger", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("Mantenimiento seguro dry-run"));
  assert.ok(source.includes("Analiza candidatos de limpieza sin borrar registros ni archivos."));
  assert.ok(source.includes('<Button type="button" onClick={handleAnalyze} disabled={isPending}>'));
  assert.ok(source.includes('isPending ? "Analizando..." : "Analizar limpieza"'));
});

test("admin maintenance dry-run card renders initial empty state and errors", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("error ? ("));
  assert.ok(source.includes("{error}"));
  assert.ok(source.includes("!snapshot ? ("));
  assert.ok(source.includes("Sin análisis ejecutado. Presioná"));
  assert.ok(source.includes("Analizar limpieza"));
  assert.ok(source.includes("consultar el endpoint dry-run."));
});

test("admin maintenance dry-run card renders dry-run totals and audit context", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("Dry-run"));
  assert.ok(source.includes('snapshot.dryRun ? "default" : "destructive"'));
  assert.ok(source.includes('snapshot.dryRun ? "true" : "false"'));
  assert.ok(source.includes("Candidatos totales"));
  assert.ok(source.includes("snapshot.totals.candidateRecords"));
  assert.ok(source.includes("Candidatos soportados"));
  assert.ok(source.includes("snapshot.totals.supportedCandidateRecords"));
  assert.ok(source.includes("Grupos no soportados"));
  assert.ok(source.includes("snapshot.totals.unsupportedGroups"));
  assert.ok(source.includes("Generado: {formatGeneratedAt(snapshot.generatedAt)}"));
  assert.ok(source.includes("snapshot.checkedBy ? ("));
  assert.ok(source.includes("snapshot.checkedBy.username"));
  assert.ok(source.includes("snapshot.checkedBy.adminUserId"));
});

test("admin maintenance dry-run card renders candidate list from snapshot", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);

  assert.ok(source.includes("snapshot.candidates.map((candidate) => ("));
  assert.ok(source.includes("<MaintenanceCandidateRow"));
  assert.ok(source.includes("key={candidate.category}"));
  assert.ok(source.includes("candidate={candidate}"));
});
