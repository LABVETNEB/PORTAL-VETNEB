import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

interface DashboardTopbarProps {
  title: string;
  subtitle?: string;
}

export function DashboardTopbar({ title, subtitle }: DashboardTopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-xs text-gray-500">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Usuario mock — reemplazar con estado real de sesión */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
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
