"use client";

import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  Clipboard,
  Download,
  Eye,
  FileText,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  PawPrint,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  getParticularReportDownloadUrl,
  getParticularReportPreviewUrl,
  getParticularStudyTrackingCase,
  getParticularSession,
  loginParticular,
  logoutParticular,
  RateLimitError,
  type AdminStudyTrackingCaseSummary,
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
  PremiumPanel,
  VisualIcon,
} from "@/components/public/VisualAccents";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";

const ParticularNotificationsBell = dynamic(
  () =>
    import("@/components/dashboard/DashboardNotificationsBell").then(
      (mod) => mod.DashboardNotificationsBell,
    ),
  {
    loading: () => (
      <span
        className="particular-notifications-bell-placeholder inline-flex h-9 w-9 rounded-md border border-input bg-card shadow-[0_1px_2px_rgba(15,45,62,0.05)]"
        aria-hidden="true"
      />
    ),
  },
);

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

const TRACKING_STAGE_LABELS: Record<AdminStudyTrackingCaseSummary["currentStage"], string> = {
  reception: "Recepción de muestra",
  processing: "Procesamiento",
  evaluation: "Evaluación",
  report_development: "Desarrollo de informe",
  delivered: "Informe disponible / Publicado",
};

function getTrackingStageLabel(
  stage: AdminStudyTrackingCaseSummary["currentStage"],
) {
  return TRACKING_STAGE_LABELS[stage] ?? stage;
}

const SPECIAL_STAIN_WHATSAPP_HREF =
  "https://wa.me/5493534138946?text=Hola%20VETNEB%2C%20consulto%20por%20una%20solicitud%20de%20tinción%20especial%20de%20mi%20caso.";
const SPECIAL_STAIN_EMAIL_HREF =
  "mailto:lab.vetneb@gmail.com?subject=Consulta%20tinción%20especial&body=Hola%20VETNEB%2C%20consulto%20por%20una%20solicitud%20de%20tinción%20especial%20de%20mi%20caso.";

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
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [isOpeningReport, setIsOpeningReport] = useState(false);
  const [trackingCase, setTrackingCase] = useState<AdminStudyTrackingCaseSummary | null>(null);
  const [trackingLoadError, setTrackingLoadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionCheckError, setSessionCheckError] = useState(false);
  const [clipboardSupported, setClipboardSupported] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  async function refreshSession() {
    setIsCheckingSession(true);
    setErrorMessage(null);
    setSessionCheckError(false);
    setTrackingLoadError(null);

    try {
      const response = await getParticularSession();
      setSession(response?.particular ?? null);
      const nextSession = response?.particular ?? null;

      if (nextSession) {
        try {
          const trackingSnapshot = await getParticularStudyTrackingCase();
          setTrackingCase(trackingSnapshot);
        } catch (error) {
          setTrackingCase(null);
          setTrackingLoadError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el seguimiento del estudio.",
          );
        }
      } else {
        setTrackingCase(null);
      }
    } catch (error) {
      setSessionCheckError(true);
      setTrackingCase(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo verificar la sesión particular. Intente nuevamente.",
      );
    } finally {
      setIsCheckingSession(false);
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    setClipboardSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.readText === "function",
    );
  }, []);

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

  const isBlocked = isSubmitting || rateLimitCooldown > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBlocked) {
      return;
    }

    setErrorMessage(null);
    setSessionCheckError(false);
    setIsSubmitting(true);

    try {
      const response = await loginParticular({ token });
      setRateLimitCooldown(0);
      setSession(response.particular);
      setTrackingLoadError(null);
      try {
        const trackingSnapshot = await getParticularStudyTrackingCase();
        setTrackingCase(trackingSnapshot);
      } catch (error) {
        setTrackingCase(null);
        setTrackingLoadError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el seguimiento del estudio.",
        );
      }
      setToken("");
    } catch (error) {
      setTrackingCase(null);

      if (error instanceof RateLimitError && error.retryAfterSeconds) {
        setRateLimitCooldown(error.retryAfterSeconds);
      }

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
    setTrackingLoadError(null);

    try {
      await logoutParticular();
    } catch {
      // La salida local se completa aunque el backend ya no tenga sesión activa.
    } finally {
      setSession(null);
      setTrackingCase(null);
    }
  }

  async function handlePasteToken() {
    if (!navigator.clipboard?.readText || isPasting) {
      return;
    }

    setIsPasting(true);

    try {
      const text = await navigator.clipboard?.readText?.();
      const cleaned = text.trim();
      if (cleaned) {
        setToken(cleaned);
      }
    } catch {
      // Usuario denegó permiso o portapapeles no disponible — fallo silencioso.
    } finally {
      setIsPasting(false);
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
    <section className="public-secondary-hero-surface py-16 md:py-20">
      <div className="container relative z-10 mx-auto grid grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
        {/* Columna info: oculta en móvil cuando la sesión está activa para evitar duplicación visual */}
        <div className={session !== null ? "hidden lg:block" : ""}>
<h1 className="max-w-3xl text-4xl font-bold text-primary-foreground md:text-5xl">
            Acceda al seguimiento y al informe de su caso con token seguro
          </h1>
          <p className="mt-5 max-w-2xl public-copy text-lg text-primary-foreground/88">
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
                <h2 className="font-semibold text-vetneb-ink">{item.title}</h2>
                <p className="mt-2 public-copy-tight text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="clinical-muted-band mt-8 rounded-lg p-5 clinical-surface-shadow">
            <div className="flex items-start gap-3">
              <VisualIcon
                icon={ShieldCheck}
                tone="emerald"
                className="h-10 w-10 shrink-0 rounded-xl"
              />
              <div>
                <h2 className="font-semibold text-vetneb-ink">
                  Sesión separada del portal clínico
                </h2>
                <p className="mt-1 public-copy-tight text-sm text-muted-foreground">
                  El token particular funciona en una superficie separada para
                  resguardar confidencialidad y trazabilidad del caso
                  autorizado.
                </p>
              </div>
            </div>
          </div>
        </div>

        <PremiumPanel
          className="overflow-hidden"
          data-particular-session-panel={session ? "true" : undefined}
        >
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="clinical-muted-band border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <VisualIcon
                    icon={session ? UserRound : KeyRound}
                    tone={session ? "emerald" : "blue"}
                    className="h-11 w-11 rounded-xl"
                  />
                  <div>
                    <CardTitle className="text-xl text-vetneb-ink">
                      {session ? "Sesión particular activa" : "Ingresar con token"}
                    </CardTitle>
                    <CardDescription className="mt-1 leading-relaxed">
                      {session
                        ? "Datos visibles del caso autenticado con seguimiento trazable del proceso diagnóstico."
                        : "Pegue el token recibido para consultar el estado del estudio y acceder al informe cuando esté disponible."}
                    </CardDescription>
                  </div>
                </div>
                {session ? (
                  <div className="particular-notifications-bell-layer shrink-0">
                    <ParticularNotificationsBell surface="particular" />
                  </div>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {isCheckingSession ? (
                <div className="surface-empty p-4 text-sm">
                  Verificando sesión...
                </div>
              ) : session ? (
                <div className="space-y-5">
                  <div
                    className="rounded-lg border border-vetneb-line bg-card p-3 sm:hidden"
                    data-particular-mobile-safe-summary="true"
                  >
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-3 py-2.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">
                          Tutor
                        </dt>
                        <dd className="mt-1 font-semibold text-vetneb-ink">
                          {session.tutorLastName}
                        </dd>
                      </div>
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-3 py-2.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">
                          Mascota
                        </dt>
                        <dd className="mt-1 font-semibold text-vetneb-ink">
                          {session.petName}
                        </dd>
                      </div>
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-3 py-2.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">Especie</dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {session.petSpecies}
                        </dd>
                      </div>
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-3 py-2.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">Raza</dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {session.petBreed}
                        </dd>
                      </div>
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-3 py-2.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">
                          Extracción
                        </dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {formatDate(session.extractionDate)}
                        </dd>
                      </div>
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-3 py-2.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">
                          Envío
                        </dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {formatDate(session.shippingDate)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div
                    className="hidden clinical-muted-band rounded-lg p-4 sm:block"
                    data-particular-session-summary="true"
                  >
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div
                        className="surface-soft px-3 py-2.5"
                        data-particular-session-field="true"
                      >
                        <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <UserRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Tutor
                        </dt>
                        <dd className="mt-1 font-semibold text-vetneb-ink">
                          {session.tutorLastName}
                        </dd>
                      </div>
                      <div
                        className="surface-soft px-3 py-2.5"
                        data-particular-session-field="true"
                      >
                        <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <PawPrint className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Mascota
                        </dt>
                        <dd className="mt-1 font-semibold text-vetneb-ink">
                          {session.petName}
                        </dd>
                      </div>
                      <div
                        className="surface-soft px-3 py-2.5"
                        data-particular-session-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">Especie</dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {session.petSpecies}
                        </dd>
                      </div>
                      <div
                        className="surface-soft px-3 py-2.5"
                        data-particular-session-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">Raza</dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {session.petBreed}
                        </dd>
                      </div>
                      <div
                        className="surface-soft px-3 py-2.5"
                        data-particular-session-field="true"
                      >
                        <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Extracción
                        </dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {formatDate(session.extractionDate)}
                        </dd>
                      </div>
                      <div
                        className="surface-soft px-3 py-2.5"
                        data-particular-session-field="true"
                      >
                        <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Envío
                        </dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {formatDate(session.shippingDate)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div
                    id="particular-study-tracking"
                    className="clinical-muted-band rounded-lg p-4 shadow-sm"
                  >
                    <h3 className="font-semibold text-vetneb-navy">
                      Seguimiento del estudio
                    </h3>
                    {trackingCase ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-vetneb-ink">
                          Estado del estudio:{" "}
                          <span className="font-semibold">
                            {getTrackingStageLabel(trackingCase.currentStage)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Actualizado: {formatDate(trackingCase.updatedAt)}
                        </p>
                        {trackingCase.specialStainRequired ? (
                          <div className="space-y-3">
                            <div className="clinical-alert-warning p-3 text-sm">
                              Alerta: Solicitud de tinción especial.
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <PublicExternalControl
                                href={SPECIAL_STAIN_WHATSAPP_HREF}
                                target="_blank"
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-vetneb-line/90 bg-card/95 px-4 py-2 text-sm font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised"
                                aria-label="Consultar por WhatsApp sobre tinción especial"
                              >
                                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Consultar por WhatsApp
                              </PublicExternalControl>
                              <PublicExternalControl
                                href={SPECIAL_STAIN_EMAIL_HREF}
                                target="_self"
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-vetneb-line/90 bg-card/95 px-4 py-2 text-sm font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised"
                                aria-label="Enviar email a VETNEB sobre tinción especial"
                              >
                                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Enviar email
                              </PublicExternalControl>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No hay seguimiento operativo vinculado para esta sesión.
                      </p>
                    )}
                  </div>

                  {session.report ? (
                    <div
                      id="particular-report"
                      className="clinical-muted-band rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <VisualIcon
                          icon={FileText}
                          tone="blue"
                          className="h-10 w-10 shrink-0 rounded-xl"
                        />
                        <div>
                          <h3 className="font-semibold text-vetneb-navy">
                            Informe vinculado
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
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
                          className="public-cta-primary"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Ver informe
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openReport("download")}
                          disabled={isOpeningReport}
                          className="public-cta-outline"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          Descargar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="clinical-alert-warning p-4">
                      {trackingCase
                        ? `El caso todavía no tiene un informe vinculado. Estado del estudio: ${getTrackingStageLabel(trackingCase.currentStage)}.`
                        : "El caso todavía no tiene un informe vinculado. El estudio continúa en evaluación profesional y se habilitará cuando finalice la validación diagnóstica."}
                    </div>
                  )}

                  {trackingLoadError ? (
                    <p
                      className="clinical-alert-warning px-3 py-2 text-sm"
                      role="alert"
                    >
                      {trackingLoadError}
                    </p>
                  ) : null}

                  {errorMessage ? (
                    <p
                      className="clinical-alert-error px-3 py-2"
                      role="alert"
                    >
                      {errorMessage}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLogout}
                    className="public-cta-outline"
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
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
                        disabled={isBlocked}
                        className="pl-10"
                      />
                    </div>
                    {clipboardSupported ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePasteToken}
                        disabled={isBlocked || isPasting}
                        className="mt-2 w-full public-cta-outline text-sm"
                        aria-label="Pegar token"
                      >
                        <Clipboard className="h-4 w-4" aria-hidden="true" />
                        {isPasting ? "Pegando..." : "Pegar token"}
                      </Button>
                    ) : null}
                  </div>

                  {errorMessage ? (
                    <div role="alert">
                      <p className="clinical-alert-error px-3 py-2">
                        {errorMessage}
                      </p>
                      {sessionCheckError ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { void refreshSession(); }}
                          disabled={isCheckingSession}
                          className="mt-2 w-full public-cta-outline text-sm"
                        >
                          {isCheckingSession
                            ? "Verificando..."
                            : "Reintentar verificación"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    className="public-cta-primary w-full"
                    disabled={isBlocked}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting
                      ? "Validando token..."
                      : rateLimitCooldown > 0
                        ? `Espere ${rateLimitCooldown}s`
                        : "Ingresar"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    La disponibilidad del informe depende de la complejidad
                    diagnóstica y del proceso de validación profesional.
                  </p>

                  <p className="text-center text-sm text-muted-foreground">
                    ¿Tiene credenciales de clínica?{" "}
                    <PublicRouteControl
                      href={ROUTES.login}
                      variant="textLink"
                      className="font-medium text-primary hover:underline"
                    >
                      Inicie sesión en el portal
                    </PublicRouteControl>
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
