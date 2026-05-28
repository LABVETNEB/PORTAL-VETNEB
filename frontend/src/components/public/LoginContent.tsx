"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { loginClinic } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

const SAFE_LOGIN_REDIRECT_ORIGIN = "https://portal.vetneb.local";

function getSafeNextPath(nextPath: string | null): string {
  const candidate = nextPath?.trim();

  if (!candidate) {
    return ROUTES.dashboard;
  }

  if (candidate.startsWith("//")) {
    return ROUTES.dashboard;
  }

  let parsedNextPath: URL;

  try {
    parsedNextPath = new URL(candidate, SAFE_LOGIN_REDIRECT_ORIGIN);
  } catch {
    return ROUTES.dashboard;
  }

  if (parsedNextPath.origin !== SAFE_LOGIN_REDIRECT_ORIGIN) {
    return ROUTES.dashboard;
  }

  const pathname = parsedNextPath.pathname;

  if (
    parsedNextPath.pathname === ROUTES.dashboardAdmin ||
    parsedNextPath.pathname.startsWith(`${ROUTES.dashboardAdmin}/`)
  ) {
    return ROUTES.dashboard;
  }

  if (
    pathname === ROUTES.dashboard ||
    pathname.startsWith(`${ROUTES.dashboard}/`)
  ) {
    return `${pathname}${parsedNextPath.search}`;
  }

  return ROUTES.dashboard;
}

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSurface = searchParams.get("tipo") ?? searchParams.get("surface");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (requestedSurface === "particular") {
      router.replace(ROUTES.particulares);
    }
  }, [requestedSurface, router]);

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

  const clinicSubmitLabel = isSubmitting ? "Iniciando sesión..." : "Iniciar sesión";

  return (
    <div
      className="min-h-screen public-page-canvas flex items-center justify-center p-4"
      data-auth-login-polish="true"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <PublicRouteControl
            href={ROUTES.home}
            variant="bare"
            className="inline-flex items-center justify-center"
            aria-label="PORTAL VETNEB — Inicio"
          >
            <span className="text-2xl font-bold text-vetneb-ink">
              PORTAL VETNEB
            </span>
          </PublicRouteControl>
          <p className="mt-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground">
            Patología veterinaria
          </p>
        </div>

        <Card
          className="border border-vetneb-line/80 bg-card/95 shadow-[0_18px_52px_rgba(15,45,62,0.12)]"
          data-auth-login-card="true"
        >
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-vetneb-cyan/25 bg-vetneb-cyan/10 text-vetneb-navy ring-1 ring-vetneb-cyan/20">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Acceda como clínica o ingrese con token particular
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="mb-5 grid grid-cols-2 rounded-lg border border-vetneb-line/90 bg-vetneb-surface-muted/75 p-1"
              aria-label="Tipo de acceso"
            >
              <button
                type="button"
                className="rounded-md border border-vetneb-teal/30 bg-card px-3 py-2 text-sm font-medium text-vetneb-ink shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:opacity-55"
                disabled={isSubmitting}
                aria-pressed="true"
                data-auth-clinic-access-tab="true"
              >
                Clínicas
              </button>
              <PublicRouteControl
                href={ROUTES.particulares}
                variant="bare"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-vetneb-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:opacity-55"
                aria-pressed="false"
                data-auth-particular-access-link="true"
              >
                Particulares
              </PublicRouteControl>
            </div>

            <form
              className="space-y-4"
              aria-label="Formulario de inicio de sesión"
              onSubmit={handleSubmit}
            >
              <div>
                <label htmlFor="username" className="field-label">
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
                  className="h-12 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="password" className="field-label">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={isPasswordVisible ? "text" : "password"}
                    data-auth-password-input="true"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    className="h-12 rounded-lg pr-12"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-vetneb-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:opacity-55"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    disabled={isSubmitting}
                    aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={isPasswordVisible}
                    aria-controls="password"
                    data-auth-password-visibility-toggle="true"
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <p
                  className="clinical-alert-error px-3 py-2"
                  role="alert"
                >
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                className="public-cta-primary w-full"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {clinicSubmitLabel}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-vetneb-cyan/25 bg-vetneb-cyan/10 px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
                ¿Su clínica no tiene acceso?{" "}
                <PublicRouteControl
                  href={ROUTES.contacto}
                  variant="textLink"
                  className="font-medium text-primary hover:underline"
                >
                  Solicite acceso
                </PublicRouteControl>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <PublicRouteControl
            href={ROUTES.home}
            variant="textLink"
            className="transition-colors hover:text-primary"
          >
            ← Volver al sitio público
          </PublicRouteControl>
        </p>
      </div>
    </div>
  );
}
