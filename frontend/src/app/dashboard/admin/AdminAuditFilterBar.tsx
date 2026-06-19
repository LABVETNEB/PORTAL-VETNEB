"use client";

import { Filter } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { Button } from "@/components/ui/button";

export type AdminAuditFilterValues = {
  event: string;
  actorType: string;
  from: string;
  to: string;
  clinicId: string;
  reportId: string;
};

type FilterOption = {
  value: string;
  label: string;
};

type AdminAuditFilterBarProps = {
  values: AdminAuditFilterValues;
  eventOptions: FilterOption[];
  actorTypeOptions: FilterOption[];
  hasActiveFilters: boolean;
};

type FilterFormProps = AdminAuditFilterBarProps & {
  mobile?: boolean;
};

const controlClassName =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-vetneb-ink outline-none focus:border-vetneb-teal focus:ring-2 focus:ring-vetneb-teal/15";

function FilterForm({
  values,
  eventOptions,
  actorTypeOptions,
  hasActiveFilters,
  mobile = false,
}: FilterFormProps) {
  const labelClassName = mobile
    ? "grid gap-1 text-[11px] font-medium text-muted-foreground"
    : "grid min-w-24 flex-1 gap-1 text-[11px] font-medium text-muted-foreground";

  return (
    <form
      action="/dashboard/admin"
      method="get"
      aria-label={mobile ? "Filtros de auditoría mobile" : "Filtros de auditoría"}
      className={
        mobile
          ? "grid grid-cols-2 gap-2"
          : "mx-3 hidden flex-wrap items-end gap-2 rounded-lg border border-vetneb-line/70 bg-muted/15 px-3 py-2 md:flex sm:mx-4"
      }
    >
      <input type="hidden" name="module" value="audit-log" />

      <label className={`${labelClassName} ${mobile ? "col-span-2" : "min-w-44 flex-[1.4]"}`}>
        Evento
        <select name="event" defaultValue={values.event} className={controlClassName}>
          <option value="">Todos</option>
          {eventOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={`${labelClassName} ${mobile ? "col-span-2" : "min-w-32"}`}>
        Actor
        <select name="actorType" defaultValue={values.actorType} className={controlClassName}>
          <option value="">Todos</option>
          {actorTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={`${labelClassName} ${mobile ? "" : "min-w-32"}`}>
        Desde
        <input type="date" name="from" defaultValue={values.from} className={controlClassName} />
      </label>

      <label className={`${labelClassName} ${mobile ? "" : "min-w-32"}`}>
        Hasta
        <input type="date" name="to" defaultValue={values.to} className={controlClassName} />
      </label>

      <label className={labelClassName}>
        Clínica ID
        <input
          type="number"
          name="clinicId"
          min="1"
          inputMode="numeric"
          defaultValue={values.clinicId}
          className={controlClassName}
        />
      </label>

      <label className={labelClassName}>
        Informe ID
        <input
          type="number"
          name="reportId"
          min="1"
          inputMode="numeric"
          defaultValue={values.reportId}
          className={controlClassName}
        />
      </label>

      <button
        type="submit"
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-vetneb-navy px-3 text-xs font-semibold text-white transition hover:bg-vetneb-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
      >
        <Filter className="h-3.5 w-3.5" aria-hidden="true" />
        Aplicar
      </button>

      {hasActiveFilters ? (
        <PublicRouteControl
          href="/dashboard/admin?module=audit-log"
          replace
          variant="bare"
          className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-vetneb-navy hover:bg-muted"
        >
          Limpiar
        </PublicRouteControl>
      ) : null}
    </form>
  );
}

export function AdminAuditFilterBar(props: AdminAuditFilterBarProps) {
  return (
    <>
      <FilterForm {...props} />
      <div className="flex shrink-0 items-center justify-between border-b border-vetneb-line/70 px-3 py-1.5 md:hidden">
        <span className="text-xs text-muted-foreground">
          {props.hasActiveFilters ? "Filtros activos" : "Todos los eventos"}
        </span>
        <ModuleDialog
          title="Filtrar auditoría"
          description="Los filtros se aplican sobre el registro completo."
          trigger={
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Filtros
            </Button>
          }
        >
          <FilterForm {...props} mobile />
        </ModuleDialog>
      </div>
    </>
  );
}
