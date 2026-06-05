import type { ReactNode } from "react";
import { DashboardShellRouter } from "./DashboardShellRouter";

export type PrivateDashboardShellProps = {
  children: ReactNode;
};

export function PrivateDashboardShell({
  children,
}: PrivateDashboardShellProps) {
  return <DashboardShellRouter>{children}</DashboardShellRouter>;
}

