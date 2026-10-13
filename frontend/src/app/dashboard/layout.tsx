import { DashboardNavigationProvider } from "@/components/dashboard/DashboardNavigationProvider";
import { PrivateDashboardShell } from "@/components/dashboard/PrivateDashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardNavigationProvider>
      <PrivateDashboardShell>{children}</PrivateDashboardShell>
    </DashboardNavigationProvider>
  );
}
