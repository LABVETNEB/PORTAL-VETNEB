"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

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
import { loginParticular } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

type LoginMode = "clinic" | "particular";

function getSafeNextPath(nextPath: string | null): string {
  if (!nextPath?.startsWith("/dashboard")) {
    return ROUTES.dashboard;
  }

  return nextPath;
}

function getInitialLoginMode(value: string | null): LoginMode {
  return value === "particular" ? "particular" : "clinic";
}

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(() =>
    getInitialLoginMode(searchParams.get("tipo") ?? searchParams.get("surface")),
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
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
      if (mode === "particular") {
        await loginParticular({ token });
        router.replace(ROUTES.particulares);
        router.refresh();
        return;
      }

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

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setErrorMessage(null);
  }

  const clinicSubmitLabel = isSubmitting ? "Iniciando sesión..." : "Iniciar sesión";

  return (
    <div className="min-h-screen public-page-canvas flex items-center justify-center p-4"
      data-auth-login-polish="true">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href={ROUTES.home}
            className="inline-flex items-center justify-center"
            aria-label="PORTAL VETNEB — Inicio"
          >
            <span className="text-2xl font-bold text-vetneb-ink">
              PORTAL VETNEB
            </span>
          </Link>
          <p className="mt-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground">
            Patología veterinaria
          </p>
        </div>

        <Card className="border border-vetneb-line/80 bg-card/95 shadow-[0_18px_52px_rgba(15,45,62,0.12)]"
          data-auth-login-card="true">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-vetneb-cyan/25 bg-vetneb-cyan/10 text-vetneb-navy ring-1 ring-vetneb-cyan/20">
              {mode === "particular" ? (
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              )}
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
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === "clinic"
                    ? "border border-vetneb-teal/30 bg-card text-vetneb-ink shadow-sm"
                    : "text-muted-foreground hover:text-vetneb-ink"
                }`}
                onClick={() => selectMode("clinic")}
                disabled={isSubmitting}
              >
                Clínicas
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === "particular"
                    ? "border border-vetneb-teal/30 bg-card text-vetneb-ink shadow-sm"
                    : "text-muted-foreground hover:text-vetneb-ink"
                }`}
                onClick={() => selectMode("particular")}
                disabled={isSubmitting}
              >
                Particulares
              </button>
            </div>

            <form
              className="space-y-4"
              aria-label="Formulario de inicio de sesión"
              onSubmit={handleSubmit}
            >
              {mode === "particular" ? (
                <div>
                  <label htmlFor="token" className="field-label">
                    Token de acceso
                  </label>
                  <Input
                    id="token"
                    name="token"
                    type="password"
                    placeholder="Ingrese el token recibido"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    disabled={isSubmitting}
                    className="h-12 rounded-lg"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    El token habilita una sesión particular limitada al caso
                    vinculado.
                  </p>
                </div>
              ) : (
                <>
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
                      className="h-12 rounded-lg"
                    />
                  </div>
                </>
              )}

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
                className="w-full clinical-primary-gradient clinical-primary-gradient-hover text-primary-foreground shadow-[0_14px_35px_hsl(var(--vetneb-navy)/0.22)]"
                data-auth-login-submit="true" disabled={isSubmitting}>
                {mode === "particular"
                  ? isSubmitting
                    ? "Iniciando sesión..."
                    : "Ingresar con token"
                  : clinicSubmitLabel}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-vetneb-cyan/25 bg-vetneb-cyan/10 px-4 py-3 text-center">
              {mode === "particular" ? (
                <p className="text-sm text-muted-foreground">
                  ¿Necesita ayuda con su token?{" "}
                  <Link
                    href={ROUTES.contacto}
                    className="font-medium text-primary hover:underline"
                  >
                    Contacte a VETNEB
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ¿Su clínica no tiene acceso?{" "}
                  <Link
                    href={ROUTES.contacto}
                    className="font-medium text-primary hover:underline"
                  >
                    Solicite acceso
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href={ROUTES.home} className="transition-colors hover:text-primary">
            ← Volver al sitio público
          </Link>
        </p>
      </div>
    </div>
  );
}



