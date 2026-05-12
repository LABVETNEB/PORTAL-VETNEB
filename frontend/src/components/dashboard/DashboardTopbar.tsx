import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

interface DashboardTopbarProps {
  title: string;
  subtitle?: string;
}

export function DashboardTopbar({ title, subtitle }: DashboardTopbarProps) {
  return (
    <header
      className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b bg-white/95 px-4 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-6"
      data-dashboard-topbar-polish="true"
    >
      <div className="min-w-0">
        <div className="mb-1 hidden items-center gap-2 sm:flex">
          <span
            className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
            aria-hidden="true"
          />
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-blue-700">
            Portal operativo
          </span>
        </div>
        <h1 className="truncate text-lg font-semibold text-gray-900 sm:text-xl">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-gray-500 sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-2 sm:gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.login}>Cerrar sesión</Link>
        </Button>
      </div>
    </header>
  );
}
