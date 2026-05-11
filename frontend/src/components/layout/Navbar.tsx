import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const navLinks = [
  { label: "Servicios", href: ROUTES.servicios },
  { label: "Profesionales", href: ROUTES.profesionales },
  { label: "Clínicas", href: ROUTES.clinicas },
  { label: "Particulares", href: ROUTES.particulares },
  { label: "Contacto", href: ROUTES.contacto },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/82 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={ROUTES.home}
          className="group flex items-center gap-2"
          aria-label="VETNEB — Inicio"
        >
          <span className="flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-bold tracking-wide text-white bg-gradient-to-br from-blue-700 via-blue-600 to-teal-500 shadow-[0_12px_30px_rgba(37,99,235,0.25)] ring-1 ring-white/60 transition-transform group-hover:-translate-y-0.5">
            VETNEB
          </span>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 lg:inline">
            Patología veterinaria
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 p-1 shadow-inner md:flex"
          aria-label="Navegación principal"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="border-slate-200 bg-white/70 shadow-sm">
            <Link href={ROUTES.login}>Iniciar sesión</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="hidden bg-gradient-to-r from-blue-700 to-teal-600 shadow-[0_14px_35px_rgba(37,99,235,0.25)] hover:from-blue-800 hover:to-teal-700 sm:flex"
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