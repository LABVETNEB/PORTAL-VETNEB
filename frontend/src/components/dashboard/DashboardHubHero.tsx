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
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-vetneb-navy via-vetneb-navy to-vetneb-teal/80 p-3 text-white shadow-[0_22px_60px_rgba(8,35,50,0.30)] sm:rounded-2xl sm:p-5"
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
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20 sm:h-9 sm:w-9">
          <Icon className="h-4 w-4 text-white sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/75">
          {eyebrow}
        </span>
      </div>

      {statusLabel ? (
        <span className="relative mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-0.5 text-[0.66rem] font-semibold text-white/90 ring-1 ring-white/15 sm:mt-3">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT_CLASS[statusTone])}
            aria-hidden="true"
          />
          {statusLabel}
        </span>
      ) : null}

      <h2
        id="dashboard-hub-hero-title"
        className="relative mt-2 text-base font-semibold leading-tight sm:mt-2.5 sm:text-xl"
      >
        {title}
      </h2>
      <p className="relative mt-1 hidden text-[0.82rem] leading-relaxed text-white/78 sm:block">
        {description}
      </p>

      <div className="relative mt-3 grid min-h-0 grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-col sm:justify-start sm:gap-2.5">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-white/12 bg-white/[0.08] px-2.5 py-2 backdrop-blur-sm sm:rounded-xl sm:px-3.5 sm:py-2.5"
          >
            <p className="line-clamp-1 text-[0.62rem] font-semibold uppercase tracking-wide text-white/70 sm:text-[0.64rem]">
              {metric.label}
            </p>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <p className="text-xl font-bold leading-none sm:text-2xl">{metric.value}</p>
              {metric.hint ? (
                <p className="hidden truncate text-[0.64rem] leading-snug text-white/65 sm:block">
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
          className="dashboard-btn-interactive relative mt-3 inline-flex min-h-[2.35rem] items-center justify-center gap-1.5 rounded-md bg-white/95 px-3 text-xs font-semibold text-vetneb-navy shadow-[0_10px_26px_rgba(8,35,50,0.24)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85 focus-visible:ring-offset-2 focus-visible:ring-offset-vetneb-navy sm:mt-auto sm:min-h-[2.6rem] sm:px-4 sm:text-sm"
        >
          <span>{primaryActionLabel}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
