"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminMaintenancePurgeDryRun } from "@/lib/api";
import type {
  MaintenancePurgeCandidateGroup,
  MaintenancePurgeDryRunSnapshot,
} from "@/types";

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getCandidateVariant(
  candidate: MaintenancePurgeCandidateGroup,
): "default" | "secondary" | "destructive" | "outline" {
  return candidate.supported ? "secondary" : "outline";
}

function formatSupportLabel(candidate: MaintenancePurgeCandidateGroup) {
  return candidate.supported ? "Soportado" : "No soportado";
}

function MaintenanceCandidateRow({
  candidate,
}: {
  candidate: MaintenancePurgeCandidateGroup;
}) {
  return (
    <div className="surface-soft">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {candidate.label}
          </p>
          <p className="mt-1 font-mono text-xs text-gray-400">
            {candidate.category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getCandidateVariant(candidate)}>
            {formatSupportLabel(candidate)}
          </Badge>
          <span className="text-lg font-bold text-gray-900">
            {candidate.count}
          </span>
        </div>
      </div>

      {candidate.destructiveAction ? (
        <p className="mt-2 text-xs text-gray-400">
          Acción futura:{" "}
          <span className="font-mono">{candidate.destructiveAction}</span>
        </p>
      ) : null}

      {candidate.reason ? (
        <p className="mt-2 text-xs text-amber-700">{candidate.reason}</p>
      ) : null}
    </div>
  );
}

export function AdminMaintenanceDryRunCard() {
  const [snapshot, setSnapshot] =
    useState<MaintenancePurgeDryRunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAnalyze() {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminMaintenancePurgeDryRun();
          setSnapshot(result);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo analizar la limpieza.",
          );
        }
      })();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base">
            Mantenimiento seguro dry-run
          </CardTitle>
          <CardDescription>
            Analiza candidatos de limpieza sin borrar registros ni archivos.
          </CardDescription>
        </div>
        <Button type="button" onClick={handleAnalyze} disabled={isPending}>
          {isPending ? "Analizando..." : "Analizar limpieza"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="clinical-alert-error">
            {error}
          </div>
        ) : null}

        {!snapshot ? (
          <div className="surface-empty">
            Sin análisis ejecutado. Presioná{" "}
            <span className="font-semibold">Analizar limpieza</span> para
            consultar el endpoint dry-run.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="surface-soft">
                <p className="text-xs text-gray-400">Dry-run</p>
                <Badge variant={snapshot.dryRun ? "default" : "destructive"}>
                  {snapshot.dryRun ? "true" : "false"}
                </Badge>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-gray-400">Candidatos totales</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {snapshot.totals.candidateRecords}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-gray-400">Candidatos soportados</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {snapshot.totals.supportedCandidateRecords}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-gray-400">Grupos no soportados</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {snapshot.totals.unsupportedGroups}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-gray-400">
              <p>Generado: {formatGeneratedAt(snapshot.generatedAt)}</p>
              {snapshot.checkedBy ? (
                <p>
                  Admin: {snapshot.checkedBy.username} #
                  {snapshot.checkedBy.adminUserId}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              {snapshot.candidates.map((candidate) => (
                <MaintenanceCandidateRow
                  key={candidate.category}
                  candidate={candidate}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
