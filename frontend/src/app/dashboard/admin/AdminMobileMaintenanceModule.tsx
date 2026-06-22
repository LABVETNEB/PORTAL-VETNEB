"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAdminMaintenancePurgeDryRun,
  getAdminSchemaHealth,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminSchemaHealthSnapshot,
  MaintenancePurgeCandidateGroup,
  MaintenancePurgeDryRunSnapshot,
} from "@/types";
import { AdminMobileConfigModule } from "./AdminMobileConfigModule";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";

const CANDIDATE_PAGE_SIZE = 3;

function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);
  return isMobileViewport;
}

function MaintenanceMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      data-admin-mobile-config-item="true"
      className="flex min-h-0 flex-col justify-center overflow-hidden rounded-md border border-vetneb-line/70 bg-card/95 px-2.5 py-1.5"
    >
      <p className="truncate text-[0.62rem] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-base font-semibold leading-tight text-vetneb-ink">
        {value}
      </p>
    </div>
  );
}

// ── Esquema ──────────────────────────────────────────────────────────────────
function MaintenanceSchemaSection() {
  const isMobileViewport = useIsMobileViewport();
  const [snapshot, setSnapshot] = useState<AdminSchemaHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isPending, startTransition] = useTransition();

  function loadSchema() {
    if (!isMobileViewport) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          setSnapshot(await getAdminSchemaHealth());
        } catch {
          setSnapshot(null);
          setError("No se pudo consultar el estado del esquema.");
        } finally {
          setHasLoadedOnce(true);
        }
      })();
    });
  }

  useEffect(() => {
    if (!isMobileViewport) return;
    loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobileViewport]);

  const summary = snapshot?.summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        {snapshot ? (
          <Badge variant={snapshot.status === "ok" ? "default" : "secondary"}>
            {snapshot.status === "ok" ? "Esquema compatible" : "Faltan columnas"}
          </Badge>
        ) : (
          <p className="truncate text-xs font-semibold text-vetneb-ink">
            Estado de esquema
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={loadSchema}
          disabled={isPending || !isMobileViewport}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Reintentar
        </Button>
      </div>

      {summary ? (
        <div className="grid shrink-0 grid-cols-2 gap-1.5">
          <MaintenanceMetric label="Tablas req." value={summary.requiredTables} />
          <MaintenanceMetric label="Columnas req." value={summary.requiredColumns} />
          <MaintenanceMetric label="Presentes" value={summary.presentColumns} />
          <MaintenanceMetric label="Faltantes" value={summary.missingColumns} />
        </div>
      ) : null}

      {snapshot ? (
        <div
          data-admin-mobile-config-item="true"
          className="min-h-0 flex-1 overflow-hidden rounded-md border border-vetneb-line/70 bg-card/92 px-2.5 py-1.5"
        >
          <p className="truncate text-[0.66rem] text-muted-foreground">
            Generado: {formatDateTime(snapshot.generatedAt)}
          </p>
          <p className="mt-0.5 truncate text-[0.66rem] text-muted-foreground">
            Revisado por:{" "}
            {snapshot.checkedBy
              ? `${snapshot.checkedBy.username} #${snapshot.checkedBy.adminUserId}`
              : "—"}
          </p>
          {snapshot.status === "degraded" ? (
            <p className="mt-1 line-clamp-2 text-[0.66rem] text-vetneb-navy">
              {snapshot.missing.length
                ? `${snapshot.missing.length} columna(s) crítica(s) faltante(s).`
                : "Faltan columnas críticas sin detalle."}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
          {error
            ? "Esquema no disponible."
            : !hasLoadedOnce || isPending
              ? "Consultando estado de esquema…"
              : "Sin datos de esquema."}
        </div>
      )}
    </div>
  );
}

// ── Dry-run ──────────────────────────────────────────────────────────────────
function MaintenanceDryRunSection() {
  const isMobileViewport = useIsMobileViewport();
  const [snapshot, setSnapshot] = useState<MaintenancePurgeDryRunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [isPending, startTransition] = useTransition();

  function analyze() {
    if (!isMobileViewport) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          setSnapshot(await getAdminMaintenancePurgeDryRun());
          setOffset(0);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "No se pudo analizar la limpieza.",
          );
        }
      })();
    });
  }

  const candidates: MaintenancePurgeCandidateGroup[] = useMemo(
    () => snapshot?.candidates ?? [],
    [snapshot],
  );
  const pageCandidates = useMemo(
    () => candidates.slice(offset, offset + CANDIDATE_PAGE_SIZE),
    [candidates, offset],
  );
  const page = Math.floor(offset / CANDIDATE_PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(candidates.length / CANDIDATE_PAGE_SIZE));
  const hasNext = offset + CANDIDATE_PAGE_SIZE < candidates.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-vetneb-ink">
          {snapshot ? `Dry-run: ${snapshot.dryRun ? "true" : "false"}` : "Mantenimiento dry-run"}
        </p>
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={analyze}
          disabled={isPending || !isMobileViewport}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Analizar
        </Button>
      </div>

      {snapshot ? (
        <>
          <div className="grid shrink-0 grid-cols-3 gap-1.5">
            <MaintenanceMetric label="Candidatos" value={snapshot.totals.candidateRecords} />
            <MaintenanceMetric label="Soportados" value={snapshot.totals.supportedCandidateRecords} />
            <MaintenanceMetric label="No sop." value={snapshot.totals.unsupportedGroups} />
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-3 gap-1.5 overflow-hidden">
            {pageCandidates.length ? (
              pageCandidates.map((candidate) => (
                <div
                  key={candidate.category}
                  data-admin-mobile-config-item="true"
                  className="flex min-h-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-vetneb-line/70 bg-card/95 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-vetneb-ink">
                      {candidate.label}
                    </p>
                    <p className="truncate font-mono text-[0.62rem] text-muted-foreground">
                      {candidate.category}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      variant={candidate.supported ? "secondary" : "outline"}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {candidate.supported ? "Soportado" : "No sop."}
                    </Badge>
                    <span className="text-xs font-semibold tabular-nums text-vetneb-ink">
                      {candidate.count}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="row-span-3 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
                Sin candidatos de limpieza.
              </div>
            )}
          </div>
          <AdminMobileOpsPager
            ariaLabel="Paginación de candidatos"
            page={candidates.length ? page : 0}
            pageCount={pageCount}
            rangeLabel={
              candidates.length
                ? `${offset + 1}–${Math.min(offset + CANDIDATE_PAGE_SIZE, candidates.length)} de ${candidates.length}`
                : "Sin candidatos"
            }
            previousDisabled={offset === 0}
            nextDisabled={!hasNext}
            disabled={isPending}
            onPrevious={() => setOffset(Math.max(0, offset - CANDIDATE_PAGE_SIZE))}
            onNext={() => setOffset(offset + CANDIDATE_PAGE_SIZE)}
          />
        </>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
          {error
            ? error
            : isPending
              ? "Analizando…"
              : "Sin análisis ejecutado. Presioná Analizar para consultar el endpoint dry-run."}
        </div>
      )}
    </div>
  );
}

export function AdminMobileMaintenanceModule() {
  return (
    <AdminMobileConfigModule
      moduleKey="admin-maintenance"
      ariaLabel="Mantenimiento del sistema"
      sections={[
        { id: "esquema", label: "Esquema", content: <MaintenanceSchemaSection /> },
        { id: "dry-run", label: "Dry-run", content: <MaintenanceDryRunSection /> },
      ]}
    />
  );
}
