import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";

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
        {/* Logo */}
        <Link
          href={ROUTES.home}
          className="flex items-center gap-2"
          aria-label="Portal VETNEB — Inicio"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white font-bold text-sm">
            VN
          </div>
          <span className="font-semibold text-gray-900 text-lg hidden sm:block">
            Portal VETNEB
          </span>
        </Link>

        {/* Navegación desktop */}
        <nav
          className="hidden md:flex items-center gap-6"
          aria-label="Navegación principal"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
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
