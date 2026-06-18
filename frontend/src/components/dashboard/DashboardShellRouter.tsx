"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import {
  VETNEB_APP_SHELL_LABEL,
  VETNEB_APP_SHELL_RELEASE,
} from "@/lib/app-shell-release";

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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
