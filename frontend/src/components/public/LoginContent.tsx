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
import { loginUnified, RateLimitError } from "@/lib/api";
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
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  useEffect(() => {
    if (requestedSurface === "particular") {
      router.replace(ROUTES.particulares);
    }
  }, [requestedSurface, router]);

  useEffect(() => {
    if (rateLimitCooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRateLimitCooldown((prev) => {
        const next = prev - 1;
        return next <= 0 ? 0 : next;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [rateLimitCooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || rateLimitCooldown > 0) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await loginUnified({
        identifier: username,
        password,
      });

      setRateLimitCooldown(0);

      const safeNextPath = getSafeNextPath(searchParams.get("next"));
      const destination =
        response.role === "clinic" && response.redirectTo === ROUTES.dashboard
          ? safeNextPath
          : response.redirectTo;

      router.replace(destination);
      router.refresh();
    } catch (error) {
      if (error instanceof RateLimitError && error.retryAfterSeconds) {
        setRateLimitCooldown(error.retryAfterSeconds);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión. Intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBlocked = isSubmitting || rateLimitCooldown > 0;
  const clinicSubmitLabel = isSubmitting
    ? "Iniciando sesión..."
    : rateLimitCooldown > 0
      ? `Espere ${rateLimitCooldown}s`
      : "Iniciar sesión";

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
              Acceda al portal privado con sus credenciales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              aria-label="Formulario de inicio de sesión"
              onSubmit={handleSubmit}
            >
              <div>
                <label htmlFor="username" className="field-label">
                  Usuario o email
                </label>
                <Input
                  id="username"
                  suppressHydrationWarning
                  name="username"
                  type="text"
                  placeholder="nombre_usuario o email@dominio.com"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={isBlocked}
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
                    suppressHydrationWarning
                    name="password"
                    type={isPasswordVisible ? "text" : "password"}
                    data-auth-credential-input="true"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isBlocked}
                    className="h-12 rounded-lg pr-12"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-vetneb-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:opacity-55"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    disabled={isBlocked}
                    aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={isPasswordVisible}
                    aria-controls="password"
                    data-auth-credential-visibility-toggle="true"
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
                disabled={isBlocked}
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
