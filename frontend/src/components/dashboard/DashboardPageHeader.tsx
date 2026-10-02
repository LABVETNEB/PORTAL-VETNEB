import type { ReactNode } from "react";
import { WorkspaceScaffold } from "@/features/dashboard/presentation/layout";

export type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function DashboardPageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: DashboardPageHeaderProps) {
  return <WorkspaceScaffold kind="page-header" title={title} description={description} badge={badge} actions={actions} className={className} />;
}

