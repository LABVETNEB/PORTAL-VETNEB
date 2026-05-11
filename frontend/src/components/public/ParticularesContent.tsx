"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

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
    <section className="bg-gray-50 py-16">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            Acceso para particulares
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-gray-950 md:text-5xl">
            Consulte el estado de su caso con token seguro
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
            El acceso particular está limitado al caso vinculado al token. La
            sesión no expone información de clínicas, rutas internas,
            profesionales ni otros estudios.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Token", "Ingreso individual entregado por VETNEB o clínica."],
              ["Sesión", "Cookie particular independiente del portal clínico."],
              ["Informe", "Vista y descarga solo si el caso tiene informe asociado."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <h2 className="font-semibold text-gray-950">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-gray-200 bg-white shadow-lg">
          <CardHeader>
            <CardTitle>
              {session ? "Sesión particular activa" : "Ingresar con token"}
            </CardTitle>
            <CardDescription>
              {session
                ? "Datos visibles para el token actualmente autenticado."
                : "Pegue el token recibido para iniciar una sesión particular."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isCheckingSession ? (
              <p className="text-sm text-gray-500">Verificando sesión...</p>
            ) : session ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-gray-500">Tutor</dt>
                      <dd className="text-gray-950">{session.tutorLastName}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Mascota</dt>
                      <dd className="text-gray-950">{session.petName}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Especie</dt>
                      <dd className="text-gray-950">{session.petSpecies}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Raza</dt>
                      <dd className="text-gray-950">{session.petBreed}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">
                        Extracción
                      </dt>
                      <dd className="text-gray-950">
                        {formatDate(session.extractionDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Envío</dt>
                      <dd className="text-gray-950">
                        {formatDate(session.shippingDate)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {session.report ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <h3 className="font-semibold text-blue-950">
                      Informe vinculado
                    </h3>
                    <p className="mt-1 text-sm text-blue-900">
                      {session.report.studyType ?? "Estudio"} ·{" "}
                      {session.report.fileName ?? "Archivo disponible"}
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        onClick={() => openReport("preview")}
                        disabled={isOpeningReport}
                      >
                        Ver informe
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openReport("download")}
                        disabled={isOpeningReport}
                      >
                        Descargar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    El caso todavía no tiene un informe vinculado.
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

                <Button type="button" variant="secondary" onClick={handleLogout}>
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
                  {isSubmitting ? "Validando token..." : "Ingresar"}
                </Button>

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
      </div>
    </section>
  );
}