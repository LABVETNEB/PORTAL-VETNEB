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
      className="sticky top-0 z-40 flex min-h-[4.5rem] items-center justify-between border-b border-vetneb-line/80 bg-card/90 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/78 sm:px-6"
      data-dashboard-topbar-polish="true"
    >
      <div className="min-w-0">
        <div className="mb-1 hidden items-center gap-2 sm:flex">
          <span
            className="h-2 w-2 rounded-full bg-vetneb-teal shadow-[0_0_0_4px_hsl(var(--vetneb-teal)/0.14)]"
            aria-hidden="true"
          />
          <span className="text-[0.66rem] font-semibold tracking-wide text-vetneb-teal">
            Portal operativo
          </span>
          <span className="text-[0.64rem] text-muted-foreground">
            Sesión clínica segura
          </span>
        </div>
        <h1 className="truncate text-xl font-semibold leading-tight text-vetneb-ink sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
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
