import { DashboardShellRouter } from "@/components/dashboard/DashboardShellRouter";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShellRouter>{children}</DashboardShellRouter>;
}
