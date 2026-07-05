"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  Clipboard,
  Clock,
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

const SPECIAL_STAIN_WHATSAPP_PHONE = "5493534138946";
const SPECIAL_STAIN_EMAIL_ADDRESS = "lab.vetneb@gmail.com";
const SPECIAL_STAIN_EMAIL_SUBJECT = "Consulta tinción especial";

type SpecialStainContactValue = string | number | null | undefined;

function formatSpecialStainContactValue(value: SpecialStainContactValue) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function formatSpecialStainContactDate(value: string | null | undefined) {
  return value ? formatDate(value) : null;
}

function formatSpecialStainContactId(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `#${value}`
    : null;
}

function appendSpecialStainContactLine(
  lines: string[],
  label: string,
  value: SpecialStainContactValue,
) {
  const formattedValue = formatSpecialStainContactValue(value);

  if (!formattedValue) {
    return;
  }

  lines.push(`${label}: ${formattedValue}`);
}

function buildSpecialStainReportSummary(session: ParticularSession) {
  if (!session.report) {
    return null;
  }

  return [
    formatSpecialStainContactId(session.report.id),
    formatSpecialStainContactValue(session.report.studyType),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" - ");
}

function buildSpecialStainContactMessage(
  trackingCase: AdminStudyTrackingCaseSummary,
  session: ParticularSession,
) {
  const lines = [
    "Hola VETNEB, consulto por una solicitud de tinción especial.",
    "",
    "Datos del caso:",
  ];
  const reportId =
    trackingCase.reportId ?? session.reportId ?? session.report?.id ?? null;
  const clinicId = trackingCase.clinicId ?? session.clinicId;

  appendSpecialStainContactLine(
    lines,
    "Token",
    session.tokenLast4 ? `terminación ${session.tokenLast4}` : null,
  );
  appendSpecialStainContactLine(
    lines,
    "Caso",
    formatSpecialStainContactId(trackingCase.id),
  );
  appendSpecialStainContactLine(
    lines,
    "ReportId",
    formatSpecialStainContactId(reportId),
  );
  appendSpecialStainContactLine(
    lines,
    "Clínica",
    formatSpecialStainContactId(clinicId),
  );
  appendSpecialStainContactLine(lines, "Tutor", session.tutorLastName);
  appendSpecialStainContactLine(lines, "Paciente", session.petName);
  appendSpecialStainContactLine(lines, "Especie", session.petSpecies);
  appendSpecialStainContactLine(lines, "Raza", session.petBreed);
  appendSpecialStainContactLine(
    lines,
    "Extracción",
    formatSpecialStainContactDate(session.extractionDate),
  );
  appendSpecialStainContactLine(
    lines,
    "Envío",
    formatSpecialStainContactDate(session.shippingDate),
  );
  appendSpecialStainContactLine(
    lines,
    "Estado",
    getTrackingStageLabel(trackingCase.currentStage),
  );
  appendSpecialStainContactLine(
    lines,
    "Actualizado",
    formatSpecialStainContactDate(trackingCase.updatedAt),
  );
  appendSpecialStainContactLine(
    lines,
    "Informe vinculado",
    buildSpecialStainReportSummary(session),
  );

  lines.push("", "Por favor, indíquenme cómo continuar.");
  return lines.join("\n");
}

function buildSpecialStainWhatsAppHref(
  trackingCase: AdminStudyTrackingCaseSummary,
  session: ParticularSession,
) {
  const message = buildSpecialStainContactMessage(trackingCase, session);
  return `https://wa.me/${SPECIAL_STAIN_WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function buildSpecialStainEmailHref(
  trackingCase: AdminStudyTrackingCaseSummary,
  session: ParticularSession,
) {
  const message = buildSpecialStainContactMessage(trackingCase, session);
  return `mailto:${SPECIAL_STAIN_EMAIL_ADDRESS}?subject=${encodeURIComponent(
    SPECIAL_STAIN_EMAIL_SUBJECT,
  )}&body=${encodeURIComponent(message)}`;
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

const PARTICULAR_ACCESS_ERROR_MESSAGE =
  "No pudimos verificar el acceso. Reintente en unos minutos o contacte a VETNEB.";
const PARTICULAR_SESSION_EXPIRED_MESSAGE =
  "La sesión venció. Ingresá nuevamente el token para consultar el informe.";
const PARTICULAR_CLIPBOARD_MANUAL_HINT =
  "Si no podés pegar el código automáticamente, escribilo manualmente tal como lo recibiste.";
const PARTICULAR_SESSION_EXPIRED_API_MESSAGE = "Sesión particular expirada";

function isTechnicalParticularAccessMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  return (
    /b[a]ckend/.test(normalizedMessage) ||
    /c[o]rs/.test(normalizedMessage) ||
    /l[o]gs/.test(normalizedMessage) ||
    /a[d]min/.test(normalizedMessage) ||
    /^http\s+\d{3}$/.test(normalizedMessage)
  );
}

function isParticularSessionExpiredError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.trim() === PARTICULAR_SESSION_EXPIRED_API_MESSAGE
  );
}

function getParticularAccessErrorMessage(error: unknown, fallback: string) {
  if (isParticularSessionExpiredError(error)) {
    return PARTICULAR_SESSION_EXPIRED_MESSAGE;
  }

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();

  if (!message) {
    return fallback;
  }

  return isTechnicalParticularAccessMessage(message)
    ? PARTICULAR_ACCESS_ERROR_MESSAGE
    : message;
}

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
  const hasActiveSessionRef = useRef(false);

  const closeExpiredParticularSession = useCallback(() => {
    hasActiveSessionRef.current = false;
    setSession(null);
    setTrackingCase(null);
    setTrackingLoadError(null);
    setErrorMessage(PARTICULAR_SESSION_EXPIRED_MESSAGE);
  }, []);

  const refreshSession = useCallback(async function refreshSession() {
    const hadActiveSession = hasActiveSessionRef.current;

    setIsCheckingSession(true);
    setErrorMessage(null);
    setSessionCheckError(false);
    setTrackingLoadError(null);

    try {
      const response = await getParticularSession();
      const nextSession = response?.particular ?? null;
      setSession(nextSession);

      if (nextSession) {
        hasActiveSessionRef.current = true;
        try {
          const trackingSnapshot = await getParticularStudyTrackingCase();
          setTrackingCase(trackingSnapshot);
        } catch (error) {
          setTrackingCase(null);
          setTrackingLoadError(
            getParticularAccessErrorMessage(
              error,
              "No se pudo cargar el seguimiento del estudio.",
            ),
          );
        }
      } else {
        hasActiveSessionRef.current = false;
        setTrackingCase(null);
        if (hadActiveSession) {
          setErrorMessage(PARTICULAR_SESSION_EXPIRED_MESSAGE);
        }
      }
    } catch (error) {
      if (isParticularSessionExpiredError(error)) {
        closeExpiredParticularSession();
        return;
      }
      setSessionCheckError(true);
      setTrackingCase(null);
      setErrorMessage(
        getParticularAccessErrorMessage(error, PARTICULAR_ACCESS_ERROR_MESSAGE),
      );
    } finally {
      setIsCheckingSession(false);
    }
  }, [closeExpiredParticularSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    setClipboardSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.readText === "function",
    );
  }, []);

  // Authenticated no-scroll contract (R-18): while a particular session is
  // active, the public page becomes a fixed-viewport operational layout. The
  // attribute scopes the CSS override block
  // (particular-authenticated-operational-viewport in globals.css) and is
  // removed on logout/expiry/unmount so the marketing page keeps its normal
  // document flow.
  useEffect(() => {
    const root = document.documentElement;

    if (session) {
      root.setAttribute("data-particular-operational-viewport", "true");
    } else {
      root.removeAttribute("data-particular-operational-viewport");
    }

    return () => {
      root.removeAttribute("data-particular-operational-viewport");
    };
  }, [session]);

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
      hasActiveSessionRef.current = true;
      setSession(response.particular);
      setTrackingLoadError(null);
      try {
        const trackingSnapshot = await getParticularStudyTrackingCase();
        setTrackingCase(trackingSnapshot);
      } catch (error) {
        setTrackingCase(null);
        setTrackingLoadError(
          getParticularAccessErrorMessage(
            error,
            "No se pudo cargar el seguimiento del estudio.",
          ),
        );
      }
      setToken("");
    } catch (error) {
      setTrackingCase(null);

      if (error instanceof RateLimitError && error.retryAfterSeconds) {
        setRateLimitCooldown(error.retryAfterSeconds);
      }

      setErrorMessage(
        getParticularAccessErrorMessage(
          error,
          "No se pudo validar el token. Intente nuevamente.",
        ),
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
      // La salida local se completa aunque la sesión remota ya no esté activa.
    } finally {
      hasActiveSessionRef.current = false;
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
      // Usuario denegó permiso o portapapeles no disponible; fallo silencioso.
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
      if (isParticularSessionExpiredError(error)) {
        closeExpiredParticularSession();
        return;
      }

      setErrorMessage(
        getParticularAccessErrorMessage(
          error,
          "No se pudo abrir el informe solicitado.",
        ),
      );
    } finally {
      setIsOpeningReport(false);
    }
  }

  const nextStepCopy = session
    ? session.report
      ? "Use los botones de arriba para ver o descargar el informe vinculado a su caso."
      : "Su caso sigue en evaluación profesional. El informe se habilitará automáticamente cuando finalice la validación diagnóstica."
    : "Ingrese el token recibido por su clínica o por VETNEB para consultar el estado de su caso.";

  return (
    <section className="public-secondary-hero-surface py-16 md:py-20">
      <div
        className="container relative z-10 mx-auto grid grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8"
        data-particulares-hero="true"
      >
        {/* Columna info: oculta en móvil cuando la sesión está activa para evitar duplicación visual */}
        <div
          className={`order-2 lg:order-1 ${session !== null ? "hidden lg:block" : ""}`}
        >
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
          className={`order-1 overflow-hidden lg:order-2 ${
            session ? "flex min-h-0 flex-col" : ""
          }`}
          data-particular-session-panel={session ? "true" : undefined}
          data-particulares-primary-action="true"
        >
          <Card
            className={
              session
                ? "flex h-full min-h-0 flex-col border-0 bg-transparent shadow-none"
                : "border-0 bg-transparent shadow-none"
            }
          >
            <CardHeader
              className="particular-operational-header clinical-muted-band border-b"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <VisualIcon
                    icon={session ? UserRound : KeyRound}
                    tone={session ? "emerald" : "blue"}
                    className="h-11 w-11 rounded-xl"
                  />
                  <div>
                    <CardTitle className="text-lg leading-tight text-vetneb-ink sm:text-xl">
                      {session ? "Sesión particular activa" : "Ingresar con token"}
                    </CardTitle>
                    <CardDescription
                      className="particular-operational-description mt-1 leading-relaxed"
                    >
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

            <CardContent
              className={
                session
                  ? "particular-operational-body flex min-h-0 flex-1 flex-col p-3 sm:p-4"
                  : "pt-6"
              }
            >
              {isCheckingSession ? (
                <div
                  className="surface-empty p-4 text-sm"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  data-particulares-session-state="checking"
                >
                  Verificando sesión...
                </div>
              ) : session ? (
                <div
                  className="grid min-h-0 max-w-full gap-2 overflow-hidden sm:gap-3"
                  data-particular-mobile-flat-stack="true"
                >
                  <div
                    className="particular-operational-summary rounded-lg border border-vetneb-line bg-card p-2.5 sm:hidden"
                    data-particular-mobile-safe-summary="true"
                  >
                    <dl className="grid grid-cols-2 gap-1.5 text-sm">
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-2.5 py-1.5"
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
                        className="rounded-md border border-vetneb-line bg-card px-2.5 py-1.5"
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
                        className="rounded-md border border-vetneb-line bg-card px-2.5 py-1.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">Especie</dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {session.petSpecies}
                        </dd>
                      </div>
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-2.5 py-1.5"
                        data-particular-mobile-safe-field="true"
                      >
                        <dt className="font-medium text-muted-foreground">Raza</dt>
                        <dd className="mt-1 text-vetneb-ink">
                          {session.petBreed}
                        </dd>
                      </div>
                      <div
                        className="rounded-md border border-vetneb-line bg-card px-2.5 py-1.5"
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
                        className="rounded-md border border-vetneb-line bg-card px-2.5 py-1.5"
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
                    className="particular-operational-summary hidden clinical-muted-band rounded-lg p-4 sm:block"
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

                  {/* Mobile flat tracking — sin clinical-muted-band ni capas compuestas */}
                  <div
                    data-particular-mobile-flat-card="tracking"
                    className="min-w-0 max-w-full overflow-hidden rounded-lg border border-vetneb-line bg-card p-3 sm:hidden"
                  >
                    <h3 className="min-w-0 max-w-full overflow-hidden font-semibold text-vetneb-navy [overflow-wrap:anywhere]">
                      Seguimiento del estudio
                    </h3>
                    {trackingCase ? (
                      <div className="mt-2 space-y-2">
                        <p className="min-w-0 max-w-full overflow-hidden text-sm text-vetneb-ink [overflow-wrap:anywhere]">
                          Estado del estudio:{" "}
                          <span className="font-semibold">
                            {getTrackingStageLabel(trackingCase.currentStage)}
                          </span>
                        </p>
                        <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Actualizado: {formatDate(trackingCase.updatedAt)}
                        </p>
                        <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Entrega en laboratorio: {formatDate(trackingCase.receptionAt)}
                        </p>
                        <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Estimación informe: {formatDate(trackingCase.estimatedDeliveryAt)}
                        </p>
                        {trackingCase.specialStainRequired ? (
                          <div className="space-y-3">
                            <div className="clinical-alert-warning p-3 text-sm">
                              Alerta: Solicitud de tinción especial.
                            </div>
                            <div className="flex flex-col gap-2">
                              <PublicExternalControl
                                href={buildSpecialStainWhatsAppHref(trackingCase, session)}
                                target="_blank"
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-vetneb-line/90 bg-card px-4 py-2 text-sm font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised"
                                aria-label="Consultar por WhatsApp sobre tinción especial"
                              >
                                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Consultar por WhatsApp
                              </PublicExternalControl>
                              <PublicExternalControl
                                href={buildSpecialStainEmailHref(trackingCase, session)}
                                target="_self"
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-vetneb-line/90 bg-card px-4 py-2 text-sm font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised"
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

                  {/* Desktop tracking — oculto en mobile, visible desde sm */}
                  <div
                    className="hidden sm:block min-w-0 max-w-full overflow-hidden rounded-lg p-4 shadow-sm clinical-muted-band"
                    id="particular-study-tracking"
                  >
                    <h3 className="min-w-0 max-w-full overflow-hidden font-semibold text-vetneb-navy [overflow-wrap:anywhere]">
                      Seguimiento del estudio
                    </h3>
                    {trackingCase ? (
                      <div className="mt-2 space-y-2">
                        <p className="min-w-0 max-w-full overflow-hidden text-sm text-vetneb-ink [overflow-wrap:anywhere]">
                          Estado del estudio:{" "}
                          <span className="font-semibold">
                            {getTrackingStageLabel(trackingCase.currentStage)}
                          </span>
                        </p>
                        <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Actualizado: {formatDate(trackingCase.updatedAt)}
                        </p>
                        <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Entrega en laboratorio: {formatDate(trackingCase.receptionAt)}
                        </p>
                        <p className="min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Estimación informe: {formatDate(trackingCase.estimatedDeliveryAt)}
                        </p>
                        {trackingCase.specialStainRequired ? (
                          <div className="space-y-3">
                            <div className="clinical-alert-warning p-3 text-sm">
                              Alerta: Solicitud de tinción especial.
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <PublicExternalControl
                                href={buildSpecialStainWhatsAppHref(trackingCase, session)}
                                target="_blank"
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-vetneb-line/90 bg-card/95 px-4 py-2 text-sm font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised"
                                aria-label="Consultar por WhatsApp sobre tinción especial"
                              >
                                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Consultar por WhatsApp
                              </PublicExternalControl>
                              <PublicExternalControl
                                href={buildSpecialStainEmailHref(trackingCase, session)}
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
                    <>
                      {/* Mobile flat report — sin VisualIcon ni clinical-muted-band */}
                      <div
                        data-particular-mobile-flat-card="report"
                        data-particulares-report-state="available"
                        className="min-w-0 max-w-full overflow-hidden rounded-lg border border-vetneb-line bg-card p-3 sm:hidden"
                      >
                        <div className="flex min-w-0 max-w-full items-start gap-3 overflow-hidden">
                          <FileText
                            className="mt-0.5 h-5 w-5 shrink-0 text-vetneb-navy"
                            aria-hidden="true"
                            strokeWidth={1.8}
                          />
                          <div className="min-w-0 max-w-full overflow-hidden">
                            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 overflow-hidden">
                              <h3 className="min-w-0 max-w-full overflow-hidden font-semibold text-vetneb-navy [overflow-wrap:anywhere]">
                                Informe vinculado
                              </h3>
                              <span className="inline-flex items-center rounded-full border border-vetneb-teal/40 bg-vetneb-teal/10 px-2 py-0.5 text-xs font-semibold text-vetneb-teal">
                                Disponible
                              </span>
                            </div>
                            <p className="mt-1 min-w-0 max-w-full overflow-hidden text-sm text-muted-foreground [overflow-wrap:anywhere]">
                              {session.report.studyType ?? "Estudio"} ·{" "}
                              {session.report.fileName ?? "Archivo disponible"}
                            </p>
                          </div>
                        </div>

                        <div
                          data-particular-mobile-flat-actions="true"
                          data-particulares-report-actions="true"
                          className="mt-3 grid grid-cols-2 gap-2"
                        >
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

                      {/* Desktop report — oculto en mobile, visible desde sm */}
                      <div
                        className="hidden sm:block min-w-0 max-w-full overflow-hidden rounded-lg p-4 shadow-sm clinical-muted-band"
                        id="particular-report"
                        data-particulares-report-state="available"
                      >
                        <div className="flex min-w-0 max-w-full items-start gap-3 overflow-hidden">
                          <VisualIcon
                            icon={FileText}
                            tone="blue"
                            className="h-10 w-10 shrink-0 rounded-xl"
                          />
                          <div className="min-w-0 max-w-full overflow-hidden">
                            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 overflow-hidden">
                              <h3 className="min-w-0 max-w-full overflow-hidden font-semibold text-vetneb-navy [overflow-wrap:anywhere]">
                                Informe vinculado
                              </h3>
                              <span className="inline-flex items-center rounded-full border border-vetneb-teal/40 bg-vetneb-teal/10 px-2 py-0.5 text-xs font-semibold text-vetneb-teal">
                                Disponible
                              </span>
                            </div>
                            <p className="mt-1 min-w-0 max-w-full overflow-hidden text-sm text-muted-foreground [overflow-wrap:anywhere]">
                              {session.report.studyType ?? "Estudio"} ·{" "}
                              {session.report.fileName ?? "Archivo disponible"}
                            </p>
                          </div>
                        </div>

                        <div
                          data-particulares-report-actions="true"
                          className="mt-4 flex flex-col gap-3 sm:flex-row"
                        >
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
                    </>
                  ) : (
                    <div
                      data-particulares-report-state="pending"
                      className="clinical-alert-info flex items-start gap-3 p-4"
                    >
                      <Clock
                        className="mt-0.5 h-5 w-5 shrink-0"
                        aria-hidden="true"
                        strokeWidth={1.8}
                      />
                      <div>
                        <h3 className="font-semibold text-vetneb-navy">
                          Sin informe vinculado todavía
                        </h3>
                        <p className="mt-1 text-sm">
                          {trackingCase
                            ? `El caso continúa en evaluación profesional. Estado del estudio: ${getTrackingStageLabel(trackingCase.currentStage)}. El informe se habilitará automáticamente al finalizar.`
                            : "El caso continúa en evaluación profesional. El informe se habilitará automáticamente cuando finalice la validación diagnóstica."}
                        </p>
                      </div>
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
                    className="public-cta-outline w-full justify-center"
                    data-particular-logout-action="true"
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
                        suppressHydrationWarning
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
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {PARTICULAR_CLIPBOARD_MANUAL_HINT}
                      </p>
                    )}
                  </div>

                  {errorMessage ? (
                    <div
                      role="alert"
                      aria-live="assertive"
                      data-particulares-session-state={
                        sessionCheckError
                          ? "recoverable-error"
                          : errorMessage === PARTICULAR_SESSION_EXPIRED_MESSAGE
                            ? "expired"
                            : undefined
                      }
                    >
                      <p className="clinical-alert-error px-3 py-2">
                        {errorMessage}
                      </p>
                      {sessionCheckError ? (
                        <>
                          <p className="mt-1 px-3 text-xs text-muted-foreground">
                            Esto no significa que haya perdido el acceso a su caso. Puede reintentar la verificación.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => { void refreshSession(); }}
                            disabled={isCheckingSession}
                            aria-busy={isCheckingSession}
                            aria-label="Reintentar verificación de sesión"
                            data-particulares-session-retry="true"
                            className="mt-2 w-full public-cta-outline text-sm"
                          >
                            {isCheckingSession
                              ? "Verificando..."
                              : "Reintentar verificación"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    className="public-cta-primary w-full"
                    disabled={isBlocked}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span role="status" aria-live="polite">
                        Validando token...
                      </span>
                    ) : rateLimitCooldown > 0 ? (
                      `Espere ${rateLimitCooldown}s`
                    ) : (
                      "Ingresar"
                    )}
                  </Button>

                  {rateLimitCooldown > 0 ? (
                    <p
                      className="text-center text-xs text-muted-foreground"
                      role="status"
                      aria-live="polite"
                      data-particulares-cooldown="true"
                    >
                      Espere {rateLimitCooldown}s antes de volver a intentar; su caso no se ve afectado.
                    </p>
                  ) : null}

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

            <div
              className="clinical-muted-band mx-6 mb-6 rounded-lg p-4"
              data-particulares-next-step-zone="true"
            >
              <h3 className="text-sm font-semibold text-vetneb-ink">
                Próximos pasos
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-vetneb-ink">
                    ¿Qué hago ahora?
                  </span>{" "}
                  {nextStepCopy}
                </li>
                <li>
                  <span className="font-medium text-vetneb-ink">
                    ¿Qué pasa si no hay informe vinculado?
                  </span>{" "}
                  El estudio continúa en evaluación profesional; vuelva a
                  consultar más tarde.
                </li>
                <li>
                  <span className="font-medium text-vetneb-ink">
                    ¿Cómo contacto a VETNEB?
                  </span>{" "}
                  <PublicRouteControl
                    href={ROUTES.contacto}
                    variant="textLink"
                    className="font-medium text-primary hover:underline"
                  >
                    Escríbanos desde contacto
                  </PublicRouteControl>
                  .
                </li>
              </ul>
            </div>
          </Card>
        </PremiumPanel>
      </div>
    </section>
  );
}
