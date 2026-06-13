import { ArrowRight, ChevronDown, Microscope } from "lucide-react";

import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";
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
    <header className="sticky top-0 z-50 w-full border-b border-vetneb-line/80 bg-card/92 backdrop-blur-sm shadow-[0_10px_28px_rgba(15,45,62,0.08)]">
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
                    <PublicRouteControl
                      href={link.href}
                      variant="bare"
                      className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-vetneb-ink/85 transition-colors hover:bg-accent/70 hover:text-vetneb-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                      activeClassName="bg-accent/80 text-vetneb-ink shadow-sm"
                    >
                      {link.label}
                    </PublicRouteControl>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>

        <PublicRouteControl
          href={ROUTES.home}
          variant="bare"
          aria-label="VETNEB — Inicio"
          className="group hidden cursor-pointer items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 lg:flex"
        >
          <span className="flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground shadow-[0_10px_26px_hsl(var(--vetneb-navy)/0.20)] ring-1 ring-vetneb-teal/30 transition-[background-color,box-shadow,border-color] group-hover:shadow-[0_12px_30px_hsl(var(--vetneb-navy)/0.24)]">
            <Microscope className="h-4 w-4" aria-hidden="true" />
            VETNEB
          </span>
          <span className="hidden text-xs font-semibold text-muted-foreground lg:inline">
            Patología veterinaria
          </span>
        </PublicRouteControl>

        <nav
          className="hidden items-center gap-1 rounded-md border border-vetneb-line/80 bg-card/88 p-1 lg:flex"
          aria-label="Navegación principal"
        >
          {navLinks.map((link) => (
            <PublicRouteControl
              key={link.href}
              href={link.href}
              variant="bare"
              className="rounded-md px-3.5 py-2 text-sm font-medium text-vetneb-ink/80 transition-colors hover:bg-accent/70 hover:text-vetneb-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
              activeClassName="bg-accent/80 text-vetneb-ink shadow-sm"
            >
              {link.label}
            </PublicRouteControl>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeModeToggle />
          <PublicRouteControl
            href={ROUTES.login}
            variant="bare"
            className="public-cta-outline inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
          >
            Iniciar sesión
          </PublicRouteControl>
          <PublicRouteControl
            href={ROUTES.contacto}
            variant="bare"
            className="public-cta-primary hidden h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 sm:flex"
          >
            Solicitar acceso
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </PublicRouteControl>
        </div>
      </div>
    </header>
  );
}
