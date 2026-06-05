import { PrivateDashboardShell } from "@/components/dashboard/PrivateDashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrivateDashboardShell>{children}</PrivateDashboardShell>;
}
