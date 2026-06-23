import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import type { DashboardModuleCard } from "./DashboardModuleHub";

type AdminMobileLauncherTileProps = {
  card: DashboardModuleCard;
};

export function AdminMobileLauncherTile({ card }: AdminMobileLauncherTileProps) {
  const ariaLabel = `${card.title}: ${card.description}`;
  const sharedClassName =
    "admin-mobile-hub-tile group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2";

  const body = (
    <>
      <span className="admin-mobile-hub-tile-icon">
        <card.icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="admin-mobile-hub-tile-label">{card.title}</span>
    </>
  );

  if (card.onClick) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        data-admin-mobile-hub-tile={card.moduleId}
        onClick={card.onClick}
        className={sharedClassName}
      >
        {body}
      </button>
    );
  }

  return (
    <PublicRouteControl
      href={card.href ?? "#"}
      variant="bare"
      aria-label={ariaLabel}
      data-admin-mobile-hub-tile={card.moduleId}
      className={sharedClassName}
    >
      {body}
    </PublicRouteControl>
  );
}
