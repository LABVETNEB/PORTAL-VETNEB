import { cn } from "@/lib/utils";

interface ReportPreviewCardProps {
  className?: string;
}

export function ReportPreviewCard({ className }: ReportPreviewCardProps) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-vetneb-line/80 bg-card shadow-[0_20px_56px_rgba(15,45,62,0.12)]",
        className,
      )}
      aria-labelledby="report-preview-card-title"
    >
      {/* Banner demostrativo */}
      <div
        className="flex items-center gap-2.5 border-b border-vetneb-amber/30 bg-vetneb-amber/[0.10] px-4 py-2.5"
        role="note"
        aria-label="Este es un informe de muestra demostrativo, no es un informe real"
      >
        <span className="text-xs font-bold text-amber-800/85" aria-hidden="true">⚠</span>
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800/80">
          Muestra · Demostrativo — Ejemplo visual sin datos reales
        </span>
      </div>

      {/* Cabecera del informe */}
      <div className="clinical-card-header px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/68">
              VETNEB · Laboratorio Patológico Veterinario
            </p>
            <h3
              id="report-preview-card-title"
              className="mt-1 text-base font-bold leading-snug text-primary-foreground"
            >
              Informe Anatomopatológico
            </h3>
            <p className="mt-0.5 text-xs text-primary-foreground/62">
              N° DEMO-000 · Canino demostrativo · Biopsia incisional
            </p>
          </div>
          <div
            className="shrink-0 rounded border border-white/22 bg-white/[0.08] px-2.5 py-1.5 text-center"
            aria-hidden="true"
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/58">
              Estado
            </p>
            <p className="text-xs font-bold text-primary-foreground">Emitido</p>
          </div>
        </div>
      </div>

      {/* Metadatos del caso */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-b border-vetneb-line/70 bg-vetneb-surface-muted/40 px-5 py-2.5 text-xs">
        <span>
          <span className="font-semibold text-vetneb-ink">Paciente:</span>{" "}
          <span className="text-muted-foreground">Paciente demostrativo</span>
        </span>
        <span>
          <span className="font-semibold text-vetneb-ink">Especie:</span>{" "}
          <span className="text-muted-foreground">Canino demostrativo</span>
        </span>
        <span>
          <span className="font-semibold text-vetneb-ink">Muestra:</span>{" "}
          <span className="text-muted-foreground">Tejido remitido para evaluación</span>
        </span>
        <span>
          <span className="font-semibold text-vetneb-ink">Código:</span>{" "}
          <span className="text-muted-foreground">DEMO-000</span>
        </span>
      </div>

      {/* Secciones del informe */}
      <div className="divide-y divide-vetneb-line/55 px-5">
        <div className="py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-vetneb-teal">
            Macroscopía
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Fragmento tisular de consistencia firme, pardo claro, de 1,2 × 0,9 cm. Superficie
            irregular. Se realizan cortes seriados para procesamiento histológico.
          </p>
        </div>

        <div className="py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-vetneb-teal">
            Microscopía
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Proliferación de mastocitos con granulación citoplasmática moderada. Sin figuras
            mitóticas en el área evaluada. Estroma fibrovascular leve.
          </p>
        </div>

        <div className="py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-vetneb-teal">
            Diagnóstico
          </p>
          <p className="text-sm font-semibold leading-snug text-vetneb-ink">
            Mastocitoma de grado II (clasificación Patnaik)
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Margen de resección libre — ≥ 3 mm
          </p>
        </div>

        <div className="py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-vetneb-teal">
            Comentario
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Se sugiere correlación clínico-patológica con el equipo tratante para la definición
            de conducta terapéutica.
          </p>
        </div>

        <div className="py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-vetneb-teal">
            Acceso digital · Trazabilidad
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded border border-vetneb-teal/28 bg-vetneb-teal/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold text-vetneb-navy">
              Disponible en portal clínica
            </span>
            <span className="inline-flex items-center rounded border border-vetneb-line/70 bg-vetneb-surface-muted/60 px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">
              Acceso tutor por código privado
            </span>
          </div>
        </div>
      </div>

      {/* Pie institucional */}
      <div className="border-t border-vetneb-line/70 bg-vetneb-surface-muted/30 px-5 py-3">
        <p className="text-xs font-semibold text-vetneb-ink">Dr. N. E. Barbé · MV Patólogo</p>
        <p className="text-[10px] text-muted-foreground">
          VETNEB Laboratorio Patológico Veterinario
        </p>
      </div>
    </article>
  );
}
