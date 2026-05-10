"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginClinic } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

function getSafeNextPath(nextPath: string | null): string {
  if (!nextPath?.startsWith("/dashboard")) {
    return ROUTES.dashboard;
  }

  return nextPath;
}

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await loginClinic({ username, password });
      router.replace(getSafeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión. Intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link
            href={ROUTES.home}
            className="inline-flex items-center gap-3"
            aria-label="Portal VETNEB — Inicio"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-lg font-bold text-primary shadow-sm">
              VN
            </div>
            <span className="text-2xl font-bold text-white">Portal VETNEB</span>
          </Link>
          <p className="mt-2 text-sm text-blue-200">
            Laboratorio veterinario digital
          </p>
        </div>

        <Card className="border border-white/80 bg-white/95 shadow-2xl backdrop-blur">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingrese sus credenciales para acceder al portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              aria-label="Formulario de inicio de sesión"
              onSubmit={handleSubmit}
            >
              <div>
                <label
                  htmlFor="username"
                  className="field-label"
                >
                  Usuario
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="nombre_usuario"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="field-label"
                >
                  Contraseña
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {errorMessage ? (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {errorMessage}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
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

        <p className="mt-6 text-center text-xs text-blue-300">
          <Link href={ROUTES.home} className="hover:text-white transition-colors">
            ← Volver al sitio público
          </Link>
        </p>
      </div>
    </div>
  );
}
