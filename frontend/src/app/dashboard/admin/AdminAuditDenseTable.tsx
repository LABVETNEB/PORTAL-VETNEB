import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminAuditDetailDialog } from "./AdminAuditDetailDialog";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type AdminAuditRow = {
  id: number;
  eventCode: string;
  eventLabel: string;
  eventVariant: BadgeVariant;
  actor: string;
  action: string;
  entity: string;
  detail: string;
  date: string;
};

type AdminAuditDenseTableProps = {
  rows: AdminAuditRow[];
  loadError: boolean;
  hasActiveFilters: boolean;
  // Measurement hook for the Zero-Scroll adaptive contract (viewport-safe
  // server pagination): the first row gives the real row height. The measured
  // container is the rows region owned by `AdminAuditCard`, not this wrapper —
  // this one is content-sized, so measuring it would be self-referential.
};

export function AdminAuditDenseTable({
  rows,
  loadError,
  hasActiveFilters,
}: AdminAuditDenseTableProps) {
  const emptyMessage = hasActiveFilters
    ? "No hay eventos para los filtros seleccionados."
    : "No hay eventos de auditoría disponibles.";

  return (
    <>
      <div className="dashboard-fitted-table hidden px-3 md:block sm:px-4">
        {loadError ? (
          <div className="mx-0 flex min-h-24 items-center justify-center rounded-lg border border-vetneb-line/70 bg-muted/20 px-4 text-center text-xs text-muted-foreground" role="alert">
            No se pudieron cargar los eventos. Reintentá la consulta.
          </div>
        ) : !rows.length ? (
          <div className="mx-0 flex min-h-24 items-center justify-center rounded-lg border border-vetneb-line/70 bg-muted/20 px-4 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <Table className="table-fixed text-[13px] [&_td]:h-9 [&_td]:px-2 [&_td]:py-1 [&_th]:h-8 [&_th]:px-2 [&_th]:text-xs [&_th]:font-semibold">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[9.5rem]">Fecha</TableHead>
                <TableHead className="w-[10rem]">Actor</TableHead>
                <TableHead className="w-[12rem]">Acción</TableHead>
                <TableHead className="hidden w-[10rem] lg:table-cell">Entidad</TableHead>
                <TableHead className="hidden xl:table-cell">Detalle</TableHead>
                <TableHead className="w-[4.5rem] text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="truncate text-xs text-muted-foreground">
                    {row.date}
                  </TableCell>
                  <TableCell className="truncate font-medium text-vetneb-ink">
                    {row.actor}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.eventVariant}
                      className="h-5 max-w-full truncate px-1.5 text-[11px] font-medium"
                    >
                      {row.eventLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden truncate text-xs text-muted-foreground lg:table-cell">
                    {row.entity}
                  </TableCell>
                  <TableCell className="hidden truncate text-xs text-muted-foreground xl:table-cell">
                    {row.detail}
                  </TableCell>
                  <TableCell className="text-right">
                    <AdminAuditDetailDialog row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="divide-y divide-vetneb-line/70 border-y border-vetneb-line/70 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="flex min-h-10 items-center gap-2 px-3 py-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={row.eventVariant}
                  className="h-5 max-w-[70%] truncate px-1.5 text-[11px] font-medium"
                >
                  {row.eventLabel}
                </Badge>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                  #{row.id}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-vetneb-ink">
                {row.actor} · {row.entity}
              </p>
            </div>
            <AdminAuditDetailDialog row={row} />
          </div>
        ))}
      </div>
    </>
  );
}
