"use client";

import { useLayoutEffect, useRef, useState, useTransition, type Ref } from "react";
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
import { CompactPager } from "@/components/dashboard/CompactPager";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { useAdaptiveRowsPerPage } from "@/hooks/useAdaptiveRowsPerPage";
import { getAdminMaintenancePurgeDryRun } from "@/lib/api";
import type {
  MaintenancePurgeCandidateGroup,
  MaintenancePurgeDryRunSnapshot,
} from "@/types";

const CANDIDATES_FALLBACK_ROWS = 4;
const CANDIDATE_ROW_HEIGHT_FALLBACK_PX = 76;
// Matches the space-y-2 gap between candidate rows so the adaptive measurement
// accounts for the full per-row footprint, not just the row's own height.
const CANDIDATE_ROW_GAP_PX = 8;

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
  ref,
}: {
  candidate: MaintenancePurgeCandidateGroup;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} className="clinical-muted-band rounded-lg px-3 py-3">
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
  const [candidatesListNode, setCandidatesListNode] =
    useState<HTMLDivElement | null>(null);
  const [firstCandidateRowNode, setFirstCandidateRowNode] =
    useState<HTMLDivElement | null>(null);
  const [rowHeightPx, setRowHeightPx] = useState(
    CANDIDATE_ROW_HEIGHT_FALLBACK_PX,
  );

  const candidatePitchRef = useRef({ containerHeight: 0, rowHeightPx: 0 });
  const onFirstCandidatePageRef = useRef(true);

  useLayoutEffect(() => {
    if (!firstCandidateRowNode) {
      return;
    }

    // Row pitch belongs to the LAYOUT, not to the page on screen: candidate
    // labels and counts differ per group, so learning the pitch from another
    // page changed `rowsPerPage` and re-sliced the list mid-transition. It is learned ONCE per canvas
      // geometry: content changes never re-learn it, a real resize does.
    const measureRowHeight = () => {
      const containerHeight =
        candidatesListNode?.getBoundingClientRect().height ?? 0;
      const cached = candidatePitchRef.current;

      if (
        cached.rowHeightPx > 0 &&
        (!onFirstCandidatePageRef.current ||
          cached.containerHeight === containerHeight)
      ) {
        return;
      }

      const rows = candidatesListNode
        ? (Array.from(candidatesListNode.children) as HTMLElement[])
        : [];
      const height = rows.reduce(
        (maximum, row) => Math.max(maximum, row.getBoundingClientRect().height),
        firstCandidateRowNode.getBoundingClientRect().height,
      );

      if (height > 0) {
        const pitch = height + CANDIDATE_ROW_GAP_PX;
        candidatePitchRef.current = { containerHeight, rowHeightPx: pitch };
        setRowHeightPx((previous) => (previous === pitch ? previous : pitch));
      }
    };

    const observer = new ResizeObserver(measureRowHeight);
    observer.observe(firstCandidateRowNode);
    if (candidatesListNode) {
      observer.observe(candidatesListNode);
    }

    const mutationObserver = new MutationObserver(measureRowHeight);
    if (candidatesListNode) {
      mutationObserver.observe(candidatesListNode, {
        childList: true,
        subtree: true,
      });
    }

    measureRowHeight();

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [firstCandidateRowNode, candidatesListNode]);

  const { rowsPerPage } = useAdaptiveRowsPerPage({
    containerNode: candidatesListNode,
    fallbackRows: CANDIDATES_FALLBACK_ROWS,
    rowHeightPx,
  });

  const pagedCandidates = usePagedRows(snapshot?.candidates ?? [], rowsPerPage);

  useLayoutEffect(() => {
    onFirstCandidatePageRef.current = pagedCandidates.page === 0;
  }, [pagedCandidates.page]);


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
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden">
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

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
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

            <div
              ref={setCandidatesListNode}
              data-admin-maintenance-candidates-list="true"
              className="min-h-0 flex-1 space-y-2 overflow-hidden"
            >
              {pagedCandidates.pageItems.map((candidate, index) => (
                <MaintenanceCandidateRow
                  key={candidate.category}
                  candidate={candidate}
                  ref={index === 0 ? setFirstCandidateRowNode : undefined}
                />
              ))}
            </div>
            <CompactPager
              page={pagedCandidates.page}
              pageCount={pagedCandidates.pageCount}
              rangeStart={pagedCandidates.rangeStart}
              rangeEnd={pagedCandidates.rangeEnd}
              total={pagedCandidates.total}
              hasPrev={pagedCandidates.hasPrev}
              hasNext={pagedCandidates.hasNext}
              onPrev={pagedCandidates.goPrev}
              onNext={pagedCandidates.goNext}
              itemLabel="grupos"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
