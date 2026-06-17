"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { CompactPager } from "@/components/dashboard/CompactPager";
import { usePagedRows } from "@/components/dashboard/usePagedRows";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type AdminAuditLogRow = {
  id: number;
  eventLabel: string;
  eventVariant: BadgeVariant;
  actor: string;
  actorTypeLabel: string;
  target: string;
  detail: string;
  date: string;
};

type AdminAuditLogTableProps = {
  rows: AdminAuditLogRow[];
  totalCount: number;
  loadError: boolean;
  hasActiveFilters: boolean;
  selectedAuditEventLabel: string;
  selectedActorTypeLabel: string;
};

// Single-viewport App Shell: the audit registry is paginated client-side so a
// page fits one desktop viewport without scroll. The full filtered dataset stays
// reachable through the compact pager instead of being scrolled or truncated.
const PAGE_SIZE = 8;

export function AdminAuditLogTable({
  rows,
  totalCount,
  loadError,
  hasActiveFilters,
  selectedAuditEventLabel,
  selectedActorTypeLabel,
}: AdminAuditLogTableProps) {
  const paged = usePagedRows(rows, PAGE_SIZE);

  return (
    <Card id="audit-log" className="dashboard-surface flex min-h-0 flex-1 flex-col">
      <CardHeader className="shrink-0 pb-3">
        <CardTitle className="text-base">
          Log de auditoría ({rows.length}/{totalCount})
        </CardTitle>
        <CardDescription>
          Filtros activos: evento <strong>{selectedAuditEventLabel}</strong>
          {" · "}actor <strong>{selectedActorTypeLabel}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-0">
        {hasActiveFilters ? (
          <div className="clinical-muted-band mx-6 mt-3 flex flex-col gap-2 rounded-lg px-4 py-2 text-sm text-vetneb-navy md:flex-row md:items-center md:justify-between">
            <span>
              Mostrando {rows.length} de {totalCount} eventos.
            </span>
            <PublicRouteControl
              href="/dashboard/admin?module=audit-log"
              replace
              variant="textLink"
              className="font-semibold text-vetneb-navy hover:text-vetneb-teal"
            >
              Limpiar filtros
            </PublicRouteControl>
          </div>
        ) : null}

        <div className="dashboard-fitted-table px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Tipo actor</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadError ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    role="alert"
                    className="clinical-table-state clinical-alert-warning"
                  >
                    No se pudieron cargar los eventos de auditoría. Intente nuevamente.
                  </TableCell>
                </TableRow>
              ) : paged.pageItems.length ? (
                paged.pageItems.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      #{entry.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.eventVariant}>{entry.eventLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-vetneb-ink/88">
                      {entry.actor}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.actorTypeLabel}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.target}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal wrap-break-word text-xs text-muted-foreground">
                      {entry.detail}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.date}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="clinical-table-state">
                    {hasActiveFilters
                      ? "No hay eventos para los filtros seleccionados."
                      : "No hay eventos de auditoría disponibles."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-6 pb-4">
          <CompactPager
            page={paged.page}
            pageCount={paged.pageCount}
            rangeStart={paged.rangeStart}
            rangeEnd={paged.rangeEnd}
            total={paged.total}
            hasPrev={paged.hasPrev}
            hasNext={paged.hasNext}
            onPrev={paged.goPrev}
            onNext={paged.goNext}
            itemLabel="eventos"
          />
        </div>
      </CardContent>
    </Card>
  );
}
