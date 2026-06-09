"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { AdminDashboardSidebar } from "./AdminDashboardSidebar";
import { ClinicDashboardSidebar } from "./ClinicDashboardSidebar";

export function DashboardShellRouter({
  children,
}: {
  children: React.ReactNode;
}) {
  const selectedSegment = useSelectedLayoutSegment();
  const isAdminDashboard = selectedSegment === "admin";

  return (
    <div className="flex h-dvh overflow-hidden bg-vetneb-surface">
      {isAdminDashboard ? (
        <AdminDashboardSidebar />
      ) : (
        <ClinicDashboardSidebar />
      )}
      <div className="flex flex-1 flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
