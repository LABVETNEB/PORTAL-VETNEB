import Link from "next/link";
import { ArrowRight, ChevronDown, Microscope } from "lucide-react";

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

const mobileNavLinks = [{ label: "Inicio", href: ROUTES.home }, ...navLinks];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-vetneb-line/80 bg-card/96 shadow-[0_10px_28px_rgba(15,45,62,0.08)]">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="relative lg:hidden">
          <details className="group">
            <summary
              className="flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground shadow-[0_10px_26px_hsl(var(--vetneb-navy)/0.20)] ring-1 ring-vetneb-teal/30 transition-[background-color,box-shadow,border-color] hover:shadow-[0_12px_30px_hsl(var(--vetneb-navy)/0.24)] [&::-webkit-details-marker]:hidden"
              aria-label="Abrir navegación VETNEB"
            >
              <Microscope className="h-4 w-4" aria-hidden="true" />
              <span>VETNEB</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </summary>
            <nav
              className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-vetneb-line/80 bg-card p-2 shadow-[0_18px_45px_rgba(15,45,62,0.16)]"
              aria-label="Navegación mobile"
            >
              <ul className="flex flex-col gap-1">
                {mobileNavLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-md px-3 py-2.5 text-sm font-medium text-vetneb-ink/85 transition-colors hover:bg-accent/70 hover:text-vetneb-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>

        <Link
          href={ROUTES.home}
          className="group hidden items-center gap-2.5 lg:flex"
          aria-label="VETNEB — Inicio"
        >
          <span className="flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground shadow-[0_10px_26px_hsl(var(--vetneb-navy)/0.20)] ring-1 ring-vetneb-teal/30 transition-[background-color,box-shadow,border-color] group-hover:shadow-[0_12px_30px_hsl(var(--vetneb-navy)/0.24)]">
            <Microscope className="h-4 w-4" aria-hidden="true" />
            VETNEB
          </span>
          <span className="hidden text-xs font-semibold text-muted-foreground lg:inline">
            Patología veterinaria
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-md border border-vetneb-line/80 bg-card/88 p-1 lg:flex"
          aria-label="Navegación principal"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-vetneb-ink/80 transition-colors hover:bg-accent/70 hover:text-vetneb-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="outline" size="sm" className="public-cta-outline">
            <Link href={ROUTES.login}>Iniciar sesión</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="public-cta-primary hidden sm:flex"
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
