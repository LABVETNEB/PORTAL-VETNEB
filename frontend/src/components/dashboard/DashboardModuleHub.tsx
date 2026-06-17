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
  // Dense launchers (admin, 10 modules) drop the tile description so every tile
  // fits the viewport height without scroll; sparse launchers (clinic) keep it.
  const showDescription = cards.length <= 6;

  return (
    <div className={cn("dashboard-cockpit min-h-0 lg:flex-1", className)}>
      {hero ? (
        <div data-dashboard-hub-hero-slot="true" className="dashboard-cockpit-rail">
          {hero}
        </div>
      ) : null}
      <section
        aria-label={heading}
        data-dashboard-module-hub="true"
        className="dashboard-cockpit-launcher"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="dashboard-section-heading">{heading}</h2>
            {description ? (
              <p className="dashboard-section-description line-clamp-1">{description}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full border border-vetneb-line/70 bg-vetneb-surface-muted/60 px-2.5 py-0.5 text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {cards.length} módulos
          </span>
        </div>

        <ul className="dashboard-cockpit-grid list-none p-0">
          {cards.map((card) => {
            const key = card.moduleId ?? card.href ?? card.title;
            const ariaLabel = `${card.title}: ${card.description}`;
            const cardBody = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="dashboard-cockpit-tile-icon rounded-lg bg-gradient-to-br from-vetneb-teal/15 to-vetneb-cyan/20">
                    <card.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {card.badge != null ? (
                    <div className="shrink-0">{card.badge}</div>
                  ) : null}
                </div>
                <p className="line-clamp-1 text-sm font-semibold leading-snug text-vetneb-ink">
                  {card.title}
                </p>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {showDescription ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {card.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 pt-0.5 text-xs font-semibold text-vetneb-teal">
                  <span>{card.actionLabel ?? "Abrir"}</span>
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </>
            );

            const sharedClassName = cn(
              "dashboard-cockpit-tile dashboard-card-interactive group w-full",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
            );

            return (
              <li key={key} className="min-h-0">
                {card.onClick ? (
                  <button
                    type="button"
                    aria-label={ariaLabel}
                    title={card.description}
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
                    title={card.description}
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
