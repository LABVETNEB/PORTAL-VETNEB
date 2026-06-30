"use client";

import { Filter } from "lucide-react";
import {
  dashboardFilterActionClassName,
  dashboardFilterControlClassName,
  FilterBar,
  FilterField,
  type FilterBarDensity,
} from "@/components/dashboard/FilterBar";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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

function FilterForm({
  values,
  eventOptions,
  actorTypeOptions,
  hasActiveFilters,
  mobile = false,
}: FilterFormProps) {
  const density: FilterBarDensity = mobile ? "comfortable" : "compact";
  const controlClassName = dashboardFilterControlClassName(density);

  return (
    <FilterBar
      action="/dashboard/admin"
      method="get"
      aria-label={mobile ? "Filtros de auditoría mobile" : "Filtros de auditoría"}
      density={density}
      className={
        mobile
          ? "grid grid-cols-2 gap-2"
          : "mx-3 hidden sm:mx-4 md:grid md:grid-cols-4 lg:grid-cols-[minmax(11rem,1.4fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_auto_auto]"
      }
    >
      <input type="hidden" name="module" value="audit-log" />

      <FilterField label="Evento" density={density} className={mobile ? "col-span-2" : ""}>
        <Select name="event" defaultValue={values.event} className={controlClassName}>
          <option value="">Todos</option>
          {eventOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="Actor" density={density} className={mobile ? "col-span-2" : ""}>
        <Select name="actorType" defaultValue={values.actorType} className={controlClassName}>
          <option value="">Todos</option>
          {actorTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="Desde" density={density}>
        <Input type="date" name="from" defaultValue={values.from} className={controlClassName} />
      </FilterField>

      <FilterField label="Hasta" density={density}>
        <Input type="date" name="to" defaultValue={values.to} className={controlClassName} />
      </FilterField>

      <FilterField label="Clínica ID" density={density}>
        <Input
          type="number"
          name="clinicId"
          min="1"
          inputMode="numeric"
          defaultValue={values.clinicId}
          className={controlClassName}
        />
      </FilterField>

      <FilterField label="Informe ID" density={density}>
        <Input
          type="number"
          name="reportId"
          min="1"
          inputMode="numeric"
          defaultValue={values.reportId}
          className={controlClassName}
        />
      </FilterField>

      <Button type="submit" size="sm" className={dashboardFilterActionClassName(density)}>
        <Filter className="h-3.5 w-3.5" aria-hidden="true" />
        Aplicar
      </Button>

      {hasActiveFilters ? (
        <PublicRouteControl
          href="/dashboard/admin?module=audit-log"
          replace
          variant="bare"
          className={`${dashboardFilterActionClassName(density)} inline-flex items-center justify-center rounded-md font-semibold text-vetneb-navy hover:bg-muted`}
        >
          Limpiar
        </PublicRouteControl>
      ) : null}
    </FilterBar>
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
            <Button type="button" variant="outline" size="sm" className="h-10 min-h-10 gap-1.5 px-2.5 text-xs">
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
