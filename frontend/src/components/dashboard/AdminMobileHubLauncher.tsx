"use client";

import { useState } from "react";
import type { DashboardModuleCard } from "./DashboardModuleHub";
import { AdminMobileLauncherTile } from "./AdminMobileLauncherTile";
import { AdminMobileHubPager } from "./AdminMobileHubPager";

const PAGE_SIZE = 6;

type AdminMobileHubLauncherProps = {
  heading: string;
  cards: DashboardModuleCard[];
};

export function AdminMobileHubLauncher({ heading, cards }: AdminMobileHubLauncherProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const pageCards = cards.slice(start, start + PAGE_SIZE);

  return (
    <section
      aria-label={heading}
      data-admin-mobile-hub-launcher="true"
      className="admin-mobile-hub-launcher"
    >
      <ul className="admin-mobile-hub-launcher-grid list-none p-0">
        {pageCards.map((card) => (
          <li key={card.moduleId ?? card.href ?? card.title} className="min-h-0">
            <AdminMobileLauncherTile card={card} />
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <AdminMobileHubPager page={page} pageCount={pageCount} onPageChange={setPage} />
      ) : null}
    </section>
  );
}
