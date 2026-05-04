import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-gray-50" role="contentinfo">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Marca */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white font-bold text-sm">
                VN
              </div>
              <span className="font-semibold text-gray-900">Portal VETNEB</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Laboratorio veterinario digital. Informes, estudios y gestión
              operativa para clínicas y profesionales.
            </p>
          </div>

          {/* Navegación */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Navegación
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Servicios", href: ROUTES.servicios },
                { label: "Profesionales", href: ROUTES.profesionales },
                { label: "Clínicas", href: ROUTES.clinicas },
                { label: "Contacto", href: ROUTES.contacto },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Acceso */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Acceso
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href={ROUTES.login}
                  className="text-sm text-gray-500 hover:text-primary transition-colors"
                >
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.contacto}
                  className="text-sm text-gray-500 hover:text-primary transition-colors"
                >
                  Solicitar acceso
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-400">
            &copy; {year} VETNEB. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-400">
            Laboratorio veterinario digital — Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
