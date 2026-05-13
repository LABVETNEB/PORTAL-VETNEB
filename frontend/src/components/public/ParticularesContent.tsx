"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  Eye,
  FileText,
  KeyRound,
  LogOut,
  PawPrint,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  getParticularReportDownloadUrl,
  getParticularReportPreviewUrl,
  getParticularSession,
  loginParticular,
  logoutParticular,
} from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import type { ParticularSession } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AmbientOrbs,
  PremiumPanel,
  VisualIcon,
} from "@/components/public/VisualAccents";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const accessHighlights = [
  {
    title: "Token",
    description: "Clave individual emitida por VETNEB o por su clínica tratante.",
    icon: KeyRound,
    tone: "blue" as const,
  },
  {
    title: "Sesión",
    description: "Acceso aislado del portal clínico, limitado al caso autorizado.",
    icon: ShieldCheck,
    tone: "emerald" as const,
  },
  {
    title: "Informe",
    description: "Consulta y descarga cuando finaliza la validación profesional.",
    icon: FileText,
    tone: "amber" as const,
  },
];

export function ParticularesContent() {
  const [token, setToken] = useState("");
  const [session, setSession] = useState<ParticularSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningReport, setIsOpeningReport] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshSession() {
    setIsCheckingSession(true);

    try {
      const response = await getParticularSession();
      setSession(response?.particular ?? null);
    } finally {
      setIsCheckingSession(false);
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await loginParticular({ token });
      setSession(response.particular);
      setToken("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo validar el token. Intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setErrorMessage(null);

    try {
      await logoutParticular();
    } catch {
      // La salida local se completa aunque el backend ya no tenga sesión activa.
    } finally {
      setSession(null);
    }
  }

  async function openReport(kind: "preview" | "download") {
    if (isOpeningReport) {
      return;
    }

    setErrorMessage(null);
    setIsOpeningReport(true);

    try {
      const url =
        kind === "preview"
          ? await getParticularReportPreviewUrl()
          : await getParticularReportDownloadUrl();

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo abrir el informe solicitado.",
      );
    } finally {
      setIsOpeningReport(false);
    }
  }

  return (
    <section className="relative overflow-hidden public-soft-canvas py-16 md:py-20">
      <AmbientOrbs />
      <div className="container relative z-10 mx-auto grid grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
        <div>
<h1 className="max-w-3xl text-4xl font-bold text-gray-950 md:text-5xl">
            Acceda al seguimiento y al informe de su caso con token seguro
          </h1>
          <p className="mt-5 max-w-2xl public-copy text-lg text-gray-600">
            El acceso particular está limitado al caso vinculado al token.
            Permite consultar estado, fechas e informe sin exponer información
            de clínicas, rutas internas, profesionales ni otros estudios.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {accessHighlights.map((item) => (
              <div key={item.title} className="premium-card-muted p-4">
                <VisualIcon
                  icon={item.icon}
                  tone={item.tone}
                  className="mb-4 h-11 w-11 rounded-xl"
                />
                <h2 className="font-semibold text-gray-950">{item.title}</h2>
                <p className="mt-2 public-copy-tight text-sm text-gray-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-emerald-100 bg-gradient-to-r from-white/90 via-emerald-50/80 to-blue-50/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex items-start gap-3">
              <VisualIcon
                icon={ShieldCheck}
                tone="emerald"
                className="h-10 w-10 shrink-0 rounded-xl"
              />
              <div>
                <h2 className="font-semibold text-gray-950">
                  Sesión separada del portal clínico
                </h2>
                <p className="mt-1 public-copy-tight text-sm text-gray-600">
                  El token particular funciona en una superficie separada para
                  resguardar confidencialidad y trazabilidad del caso
                  autorizado.
                </p>
              </div>
            </div>
          </div>
        </div>

        <PremiumPanel className="overflow-hidden">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="border-b border-white/70 bg-gradient-to-r from-white/80 via-blue-50/70 to-emerald-50/70">
              <div className="flex items-start gap-3">
                <VisualIcon
                  icon={session ? UserRound : KeyRound}
                  tone={session ? "emerald" : "blue"}
                  className="h-11 w-11 rounded-xl"
                />
                <div>
                  <CardTitle className="text-xl text-gray-950">
                    {session ? "Sesión particular activa" : "Ingresar con token"}
                  </CardTitle>
                  <CardDescription className="mt-1 leading-relaxed">
                    {session
                      ? "Datos visibles del caso autenticado con seguimiento trazable del proceso diagnóstico."
                      : "Pegue el token recibido para consultar el estado del estudio y acceder al informe cuando esté disponible."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {isCheckingSession ? (
                <div className="premium-card-muted p-4 text-sm text-gray-500">
                  Verificando sesión...
                </div>
              ) : session ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-inner">
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50/80 p-3">
                        <dt className="flex items-center gap-1.5 font-medium text-gray-500">
                          <UserRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Tutor
                        </dt>
                        <dd className="mt-1 font-semibold text-gray-950">
                          {session.tutorLastName}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 p-3">
                        <dt className="flex items-center gap-1.5 font-medium text-gray-500">
                          <PawPrint className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Mascota
                        </dt>
                        <dd className="mt-1 font-semibold text-gray-950">
                          {session.petName}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 p-3">
                        <dt className="font-medium text-gray-500">Especie</dt>
                        <dd className="mt-1 text-gray-950">
                          {session.petSpecies}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 p-3">
                        <dt className="font-medium text-gray-500">Raza</dt>
                        <dd className="mt-1 text-gray-950">
                          {session.petBreed}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 p-3">
                        <dt className="flex items-center gap-1.5 font-medium text-gray-500">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Extracción
                        </dt>
                        <dd className="mt-1 text-gray-950">
                          {formatDate(session.extractionDate)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-slate-50/80 p-3">
                        <dt className="flex items-center gap-1.5 font-medium text-gray-500">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Envío
                        </dt>
                        <dd className="mt-1 text-gray-950">
                          {formatDate(session.shippingDate)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {session.report ? (
                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <VisualIcon
                          icon={FileText}
                          tone="blue"
                          className="h-10 w-10 shrink-0 rounded-xl"
                        />
                        <div>
                          <h3 className="font-semibold text-blue-950">
                            Informe vinculado
                          </h3>
                          <p className="mt-1 text-sm text-blue-900">
                            {session.report.studyType ?? "Estudio"} ·{" "}
                            {session.report.fileName ?? "Archivo disponible"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          onClick={() => openReport("preview")}
                          disabled={isOpeningReport}
                          className="bg-gradient-to-r from-blue-700 to-teal-600 shadow-[0_14px_35px_rgba(37,99,235,0.20)] hover:from-blue-800 hover:to-teal-700"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Ver informe
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openReport("download")}
                          disabled={isOpeningReport}
                          className="bg-white/80"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          Descargar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-sm text-amber-900 shadow-sm">
                      El caso todavía no tiene un informe vinculado. El estudio
                      continúa en evaluación profesional y se habilitará cuando
                      finalice la validación diagnóstica.
                    </div>
                  )}

                  {errorMessage ? (
                    <p
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      role="alert"
                    >
                      {errorMessage}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleLogout}
                    className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Cerrar sesión particular
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  aria-label="Formulario de acceso particular por token"
                  onSubmit={handleSubmit}
                >
                  <div>
                    <label htmlFor="particular-token" className="field-label">
                      Token de acceso
                    </label>
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <Input
                        id="particular-token"
                        name="token"
                        type="password"
                        placeholder="Ingrese el token recibido"
                        autoComplete="one-time-code"
                        required
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        disabled={isSubmitting}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {errorMessage ? (
                    <p
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      role="alert"
                    >
                      {errorMessage}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-700 to-teal-600 shadow-[0_14px_35px_rgba(37,99,235,0.22)] hover:from-blue-800 hover:to-teal-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Validando token..." : "Ingresar"}
                  </Button>

                  <p className="text-center text-xs text-gray-500">
                    La disponibilidad del informe depende de la complejidad
                    diagnóstica y del proceso de validación profesional.
                  </p>

                  <p className="text-center text-sm text-gray-500">
                    ¿Tiene credenciales de clínica?{" "}
                    <Link
                      href={ROUTES.login}
                      className="font-medium text-primary hover:underline"
                    >
                      Inicie sesión en el portal
                    </Link>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </PremiumPanel>
      </div>
    </section>
  );
}
