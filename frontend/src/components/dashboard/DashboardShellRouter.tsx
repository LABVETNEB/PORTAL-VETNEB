"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import {
  VETNEB_APP_SHELL_LABEL,
  VETNEB_APP_SHELL_RELEASE,
} from "@/lib/app-shell-release";
import { BackForwardCacheGuard } from "./BackForwardCacheGuard";
import { DashboardMobileNav } from "./DashboardMobileNav";

export function DashboardShellRouter({
  children,
}: {
  children: React.ReactNode;
}) {
  const selectedSegment = useSelectedLayoutSegment();
  const isAdminDashboard = selectedSegment === "admin";
  const surface = isAdminDashboard ? "admin" : "clinic";

  return (
    <div
      className="dashboard-app-shell flex flex-col h-dvh overflow-hidden bg-vetneb-surface"
      data-vetneb-app-shell="true"
      data-vetneb-app-shell-release={VETNEB_APP_SHELL_RELEASE}
      data-vetneb-app-shell-surface={surface}
      aria-label={VETNEB_APP_SHELL_LABEL}
    >
      <BackForwardCacheGuard />
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        data-vetneb-app-shell-frame="true"
      >
        {children}
      </div>
      {/* B09: one mobile navigation model for both roles, mounted here as a
          real flex item so the shell subtracts its height from `main` instead
          of letting it cover content. Below 768px it is the ONLY module
          navigation on either surface; from 768px up the CSS hides it and the
          B07/B08 lateral band owns navigation. */}
      <DashboardMobileNav surface={surface} />
      {/* B05: dedicated, always-empty portal target so a `ModuleDialog` can
          opt into mounting inside `.dashboard-app-shell` (see its
          portal-scoping prop) instead of `document.body`, letting
          dashboard-scoped CSS custom properties reach its portalled
          content. A fixed-position dialog placed here still positions
          against the viewport: nothing in this tree sets a transform, filter
          or `contain` that would create a containing block. */}
      <div data-dashboard-portal-root="true" />
    </div>
  );
}
