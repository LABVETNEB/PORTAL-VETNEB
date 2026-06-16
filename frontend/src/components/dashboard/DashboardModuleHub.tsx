import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { cn } from "@/lib/utils";

export type DashboardModuleCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  badge?: ReactNode;
  actionLabel?: string;
  moduleId?: string;
};

type DashboardModuleHubProps = {
  heading: string;
  description?: string;
  cards: DashboardModuleCard[];
  hero?: ReactNode;
  className?: string;
};

export function DashboardModuleHub({
  heading,
  description,
  cards,
  hero,
  className,
}: DashboardModuleHubProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {hero ? (
        <div data-dashboard-hub-hero-slot="true">{hero}</div>
      ) : null}
      <section
        aria-label={heading}
        data-dashboard-module-hub="true"
        className="space-y-5"
      >
        <div>
          <h2 className="dashboard-section-heading">{heading}</h2>
          {description ? (
            <p className="dashboard-section-description">{description}</p>
          ) : null}
        </div>
      <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const key = card.moduleId ?? card.href ?? card.title;
          const ariaLabel = `${card.title}: ${card.description}`;
          const cardBody = (
            <div className="flex flex-col p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-vetneb-navy to-vetneb-teal/80 shadow-[0_6px_18px_rgba(15,45,62,0.22)]">
                  <card.icon className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                {card.badge != null ? (
                  <div className="shrink-0">{card.badge}</div>
                ) : null}
              </div>
              <p className="text-sm font-semibold leading-snug text-vetneb-ink">
                {card.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {card.description}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-vetneb-teal">
                <span>{card.actionLabel ?? "Abrir"}</span>
                <ChevronRight
                  className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
            </div>
          );

          const sharedClassName = cn(
            "group flex w-full flex-col rounded-xl border border-vetneb-line/80 bg-card/95",
            "shadow-[0_12px_34px_rgba(15,45,62,0.08)] ring-1 ring-white/55",
            "dashboard-card-interactive",
            "hover:border-vetneb-teal/42 hover:shadow-[0_20px_50px_rgba(15,45,62,0.13)] hover:ring-vetneb-teal/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
          );

          return (
            <li key={key}>
              {card.onClick ? (
                <button
                  type="button"
                  aria-label={ariaLabel}
                  data-dashboard-module-card={card.moduleId}
                  onClick={card.onClick}
                  className={sharedClassName}
                >
                  {cardBody}
                </button>
              ) : (
                <PublicRouteControl
                  href={card.href ?? "#"}
                  variant="bare"
                  aria-label={ariaLabel}
                  data-dashboard-module-card={card.moduleId}
                  className={sharedClassName}
                >
                  {cardBody}
                </PublicRouteControl>
              )}
            </li>
          );
        })}
      </ul>
      </section>
    </div>
  );
}
