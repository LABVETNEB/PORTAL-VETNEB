import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

interface DashboardTopbarProps {
  title: string;
  subtitle?: string;
}

export function DashboardTopbar({ title, subtitle }: DashboardTopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b bg-white/95 px-4 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-6">
      <div className="min-w-0">
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
        {/* Usuario mock — reemplazar con estado real de sesión */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            CL
          </div>
          <span className="hidden sm:block">Clínica Demo</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={ROUTES.login}>Cerrar sesión</Link>
        </Button>
      </div>
    </header>
  );
}
