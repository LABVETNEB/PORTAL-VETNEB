import type { ReactNode } from "react";
import type { ClinicModule } from "./ClinicDashboardWorkspaceController";
import { WorkspaceScaffold } from "@/features/dashboard/presentation/layout";

type ClinicMobileModuleFrameProps = {
  moduleId: ClinicModule;
  children: ReactNode;
};

export function ClinicMobileModuleFrame({
  moduleId,
  children,
}: ClinicMobileModuleFrameProps) {
  return <WorkspaceScaffold kind="mobile" moduleId={moduleId}>{children}</WorkspaceScaffold>;
}
