import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardHubHeroMetric = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export type DashboardHubHeroStatusTone = "ok" | "warn" | "down" | "neutral";

export type DashboardHubHeroProps = {
  variant: "clinic" | "admin";
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  metrics: DashboardHubHeroMetric[];
  statusLabel?: string;
  statusTone?: DashboardHubHeroStatusTone;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
};

const STATUS_DOT_CLASS: Record<DashboardHubHeroStatusTone, string> = {
  ok: "bg-emerald-300",
  warn: "bg-amber-300",
  down: "bg-rose-300",
  neutral: "bg-white/70",
};

export function DashboardHubHero({
  variant,
  icon: Icon,
  eyebrow,
  title,
  description,
  metrics,
  statusLabel,
  statusTone = "neutral",
  primaryActionLabel,
  onPrimaryAction,
}: DashboardHubHeroProps) {
  return (
    <section
      data-dashboard-hub-hero={variant}
      aria-labelledby="dashboard-hub-hero-title"
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-vetneb-navy via-vetneb-navy to-vetneb-teal/80 p-4 text-white shadow-[0_22px_60px_rgba(8,35,50,0.30)] sm:p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-vetneb-cyan/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-6 h-48 w-48 rounded-full bg-vetneb-teal/20 blur-3xl"
      />

      <div className="relative flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20">
          <Icon className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/75">
          {eyebrow}
        </span>
      </div>

      {statusLabel ? (
        <span className="relative mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-0.5 text-[0.66rem] font-semibold text-white/90 ring-1 ring-white/15">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT_CLASS[statusTone])}
            aria-hidden="true"
          />
          {statusLabel}
        </span>
      ) : null}

      <h2
        id="dashboard-hub-hero-title"
        className="relative mt-2.5 text-lg font-semibold leading-tight sm:text-xl"
      >
        {title}
      </h2>
      <p className="relative mt-1 text-[0.82rem] leading-relaxed text-white/78">
        {description}
      </p>

      <div className="relative mt-4 flex min-h-0 flex-1 flex-col justify-center gap-2.5">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-white/12 bg-white/[0.08] px-3.5 py-2.5 backdrop-blur-sm"
          >
            <p className="text-[0.64rem] font-semibold uppercase tracking-wide text-white/70">
              {metric.label}
            </p>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <p className="text-2xl font-bold leading-none">{metric.value}</p>
              {metric.hint ? (
                <p className="truncate text-[0.64rem] leading-snug text-white/65">
                  {metric.hint}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {primaryActionLabel && onPrimaryAction ? (
        <button
          type="button"
          onClick={onPrimaryAction}
          className="dashboard-btn-interactive relative mt-4 inline-flex min-h-[2.6rem] items-center justify-center gap-1.5 rounded-md bg-white/95 px-4 text-sm font-semibold text-vetneb-navy shadow-[0_10px_26px_rgba(8,35,50,0.24)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85 focus-visible:ring-offset-2 focus-visible:ring-offset-vetneb-navy"
        >
          <span>{primaryActionLabel}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
