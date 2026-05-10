import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const navLinks = [
  { label: "Servicios", href: ROUTES.servicios },
  { label: "Profesionales", href: ROUTES.profesionales },
  { label: "Clínicas", href: ROUTES.clinicas },
  { label: "Contacto", href: ROUTES.contacto },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={ROUTES.home}
          className="flex items-center"
          aria-label="VETNEB — Inicio"
        >
          <span className="flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-bold tracking-wide text-white">
            VETNEB
          </span>
        </Link>

        <nav
          className="hidden items-center gap-6 md:flex"
          aria-label="Navegación principal"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.login}>Iniciar sesión</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:flex">
            <Link href={ROUTES.contacto}>Solicitar acceso</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}