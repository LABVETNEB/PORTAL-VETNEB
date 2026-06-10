"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
    <div className="clinical-muted-band rounded-lg px-3 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-vetneb-ink">
            {candidate.label}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {candidate.category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getCandidateVariant(candidate)}>
            {formatSupportLabel(candidate)}
          </Badge>
          <span className="clinical-pill px-2.5 py-0.5 text-xs tracking-normal">
            {candidate.count}
          </span>
        </div>
      </div>

      {candidate.destructiveAction ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Acción futura:{" "}
          <span className="font-mono">{candidate.destructiveAction}</span>
        </p>
      ) : null}

      {candidate.reason ? (
        <p className="mt-2 text-xs text-vetneb-navy">{candidate.reason}</p>
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
    <Card className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base">
            Mantenimiento seguro dry-run
          </CardTitle>
          <CardDescription>
            Analiza candidatos de limpieza sin borrar registros ni archivos.
          </CardDescription>
        </div>
        <Button type="button" onClick={handleAnalyze} disabled={isPending} aria-busy={isPending ? true : undefined}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isPending ? "Analizando..." : "Analizar limpieza"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
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
                <p className="text-xs text-muted-foreground">Dry-run</p>
                <Badge variant={snapshot.dryRun ? "default" : "outline"}>
                  {snapshot.dryRun ? "true" : "false"}
                </Badge>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Candidatos totales</p>
                <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                  {snapshot.totals.candidateRecords}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Candidatos soportados</p>
                <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                  {snapshot.totals.supportedCandidateRecords}
                </p>
              </div>
              <div className="surface-soft">
                <p className="text-xs text-muted-foreground">Grupos no soportados</p>
                <p className="mt-1 text-2xl font-bold text-vetneb-ink">
                  {snapshot.totals.unsupportedGroups}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
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
