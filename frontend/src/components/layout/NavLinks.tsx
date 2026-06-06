"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { PublicRouteControl } from "@/components/public/PublicRouteControl";
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

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navLinks.map((link) => (
        <PublicRouteControl
          key={link.href}
          href={link.href}
          variant="bare"
          aria-current={pathname === link.href ? "page" : undefined}
          className="public-navbar-link rounded-md px-3.5 py-2 text-sm font-medium text-vetneb-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
        >
          {link.label}
        </PublicRouteControl>
      ))}
    </>
  );
}

export function MobileNavLinks() {
  const pathname = usePathname();

  useEffect(() => {
    const open = document.querySelectorAll<HTMLDetailsElement>("details[open]");
    open.forEach((d) => d.removeAttribute("open"));
  }, [pathname]);

  function closeMenu() {
    const open = document.querySelectorAll<HTMLDetailsElement>("details[open]");
    open.forEach((d) => d.removeAttribute("open"));
  }

  return (
    <ul className="flex flex-col gap-1">
      {mobileNavLinks.map((link) => (
        <li key={link.href}>
          <PublicRouteControl
            href={link.href}
            variant="bare"
            aria-current={pathname === link.href ? "page" : undefined}
            onClick={closeMenu}
            className="public-navbar-mobile-link block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-vetneb-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
          >
            {link.label}
          </PublicRouteControl>
        </li>
      ))}
    </ul>
  );
}
