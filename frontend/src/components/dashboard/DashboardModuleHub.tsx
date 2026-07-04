import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { AdminMobileHubLauncher } from "./AdminMobileHubLauncher";
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
  const isDenseLauncher = cards.length > 6;
  const showDescription = !isDenseLauncher;

  return (
    <div
      data-dashboard-hub-root="true"
      className={cn("dashboard-cockpit min-h-0 lg:flex-1", className)}
    >
      {hero ? (
        <div
          data-dashboard-hub-hero-slot="true"
          className={cn(
            "dashboard-cockpit-rail",
            isDenseLauncher && "admin-mobile-hub-hero-slot",
          )}
        >
          {hero}
        </div>
      ) : null}
      {isDenseLauncher ? (
        <AdminMobileHubLauncher heading={heading} cards={cards} />
      ) : null}
      <section
        aria-label={heading}
        data-dashboard-module-hub="true"
        className={cn(
          "dashboard-cockpit-launcher",
          isDenseLauncher && "dashboard-cockpit-launcher-dense admin-mobile-hub-desktop-launcher",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="dashboard-section-heading">{heading}</h2>
            {description ? (
              <p className="dashboard-section-description hidden sm:line-clamp-1">{description}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full border border-vetneb-line/70 bg-vetneb-surface-muted/60 px-2.5 py-0.5 text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {cards.length} módulos
          </span>
        </div>

        <ul
          className={cn(
            "dashboard-cockpit-grid list-none p-0",
            isDenseLauncher && "dashboard-cockpit-grid-dense",
          )}
        >
          {cards.map((card) => {
            const key = card.moduleId ?? card.href ?? card.title;
            const ariaLabel = `${card.title}: ${card.description}`;
            const cardBody = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="dashboard-cockpit-tile-icon rounded-lg">
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
                  <p
                    className={cn(
                      "hidden text-xs leading-relaxed text-muted-foreground",
                      // Dense launchers surface descriptions only where the 10-tile
                      // grid has vertical headroom (>=1440px keeps 1366x768 no-scroll).
                      showDescription ? "sm:line-clamp-2" : "min-[1440px]:line-clamp-2",
                    )}
                  >
                    {card.description}
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-1 pt-0.5 text-xs font-semibold text-vetneb-teal">
                  <span className="truncate">{card.actionLabel ?? "Abrir"}</span>
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
