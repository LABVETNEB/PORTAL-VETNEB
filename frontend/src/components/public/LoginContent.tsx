"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/routes";

export function LoginContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href={ROUTES.home}
            className="inline-flex items-center gap-3"
            aria-label="Portal VETNEB — Inicio"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary font-bold text-lg">
              VN
            </div>
            <span className="text-white font-bold text-2xl">Portal VETNEB</span>
          </Link>
          <p className="text-blue-200 text-sm mt-2">
            Laboratorio veterinario digital
          </p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingrese sus credenciales para acceder al portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              aria-label="Formulario de inicio de sesión"
              onSubmit={(e) => e.preventDefault()}
            >
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Usuario
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="nombre_usuario"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <strong>Nota de desarrollo:</strong> La autenticación real se
                conectará con{" "}
                <code className="font-mono">POST /api/auth/login</code> en un
                próximo PR.
              </p>

              <Button type="submit" className="w-full" disabled>
                Iniciar sesión (próximamente)
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link href={ROUTES.dashboard}>
                  Ver dashboard (demo sin auth)
                </Link>
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                ¿Su clínica no tiene acceso?{" "}
                <Link
                  href={ROUTES.contacto}
                  className="text-primary hover:underline font-medium"
                >
                  Solicite acceso
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-blue-300 text-xs mt-6">
          <Link href={ROUTES.home} className="hover:text-white transition-colors">
            ← Volver al sitio público
          </Link>
        </p>
      </div>
    </div>
  );
}
