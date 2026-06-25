import type { ReactNode } from "react";
import type { ClinicModule } from "./ClinicDashboardWorkspaceController";

type ClinicMobileModuleFrameProps = {
  moduleId: ClinicModule;
  children: ReactNode;
};

export function ClinicMobileModuleFrame({
  moduleId,
  children,
}: ClinicMobileModuleFrameProps) {
  return (
    <section
      data-clinic-mobile-module={moduleId}
      className="clinic-mobile-module-frame"
    >
      {children}
    </section>
  );
}
