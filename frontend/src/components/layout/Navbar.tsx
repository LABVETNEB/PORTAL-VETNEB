import Link from "next/link";
import { ArrowRight, Microscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const navLinks = [
  { label: "Servicios", href: ROUTES.servicios },
  { label: "Profesionales", href: ROUTES.profesionales },
  { label: "Clínicas", href: ROUTES.clinicas },
  { label: "Particulares", href: ROUTES.particulares },
  { label: "Contacto", href: ROUTES.contacto },
  { label: "Precios", href: ROUTES.precios },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-vetneb-line/80 bg-card/88 shadow-[0_10px_34px_rgba(15,45,62,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/78">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={ROUTES.home}
          className="group flex items-center gap-2.5"
          aria-label="VETNEB — Inicio"
        >
          <span className="flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground shadow-[0_10px_26px_hsl(var(--vetneb-navy)/0.20)] ring-1 ring-vetneb-teal/30 transition-transform group-hover:-translate-y-0.5">
            <Microscope className="h-4 w-4" aria-hidden="true" />
            VETNEB
          </span>
          <span className="hidden text-xs font-semibold text-muted-foreground lg:inline">
            Patología veterinaria
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-lg border border-vetneb-line/80 bg-vetneb-surface-raised/80 p-1 shadow-inner md:flex"
          aria-label="Navegación principal"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-foreground/72 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="bg-card/85 shadow-sm">
            <Link href={ROUTES.login}>Iniciar sesión</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="hidden shadow-[0_14px_34px_hsl(var(--vetneb-navy)/0.20)] sm:flex"
          >
            <Link href={ROUTES.contacto}>
              Solicitar acceso
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
