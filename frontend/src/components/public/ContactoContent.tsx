"use client";

import { FormEvent, useState } from "react";
import {
  Building2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  UserRound,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicExternalControl } from "@/components/public/PublicRouteControl";
import { VisualIcon } from "@/components/public/VisualAccents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PUBLIC_API_CONFIGURATION_ERROR_MESSAGE,
  submitContactMessage,
} from "@/lib/api";

const contactInfo = [
  {
    icon: Mail,
    label: "Email",
    value: "lab.vetneb@gmail.com",
    href: "mailto:lab.vetneb@gmail.com",
    tone: "blue" as const,
  },
  {
    icon: Phone,
    label: "Teléfono",
    value: "3534138946",
    href: "https://wa.me/5493534138946",
    tone: "emerald" as const,
  },
  {
    icon: MapPin,
    label: "Ubicación",
    value: "Villa María, Córdoba, Argentina",
    href: null,
    tone: "amber" as const,
  },
];

export function ContactoContent() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [clinica, setClinica] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFeedbackMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setWarningMessage(null);
  }

  function resolveContactSubmitErrorMessage(error: unknown) {
    const fallbackMessage = "No se pudo enviar el mensaje. Intente nuevamente.";

    if (!(error instanceof Error)) {
      return fallbackMessage;
    }

    const normalizedMessage = error.message.trim();

    if (!normalizedMessage) {
      return fallbackMessage;
    }

    if (normalizedMessage === PUBLIC_API_CONFIGURATION_ERROR_MESSAGE) {
      return normalizedMessage;
    }

    const normalizedMessageLower = normalizedMessage.toLowerCase();

    if (
      normalizedMessageLower === "failed to fetch" ||
      normalizedMessageLower === "fetch failed" ||
      normalizedMessageLower.includes("networkerror")
    ) {
      return "No se pudo contactar al servidor. Verifique la conexión o intente nuevamente.";
    }

    return normalizedMessage;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearFeedbackMessages();
    setIsSubmitting(true);

    try {
      const fullName = [nombre.trim(), apellido.trim()]
        .filter(Boolean)
        .join(" ");

      const response = await submitContactMessage({
        name: fullName,
        email: email.trim(),
        clinicName: clinica.trim() || null,
        message: mensaje.trim(),
      });

      if (response.sent === false || response.reason === "smtp_disabled") {
        setWarningMessage(response.message);
      } else if (response.sent === true) {
        setSuccessMessage(response.message);
        setNombre("");
        setApellido("");
        setEmail("");
        setClinica("");
        setMensaje("");
      }
    } catch (error) {
      setErrorMessage(resolveContactSubmitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicLayout>
      <section
        className="public-secondary-hero-surface py-16 text-white md:py-20"
        aria-labelledby="contact-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <h1 id="contact-page-title" className="mb-4 text-4xl font-bold md:text-5xl">
            Contacto
          </h1>
          <p className="max-w-2xl public-copy text-xl text-primary-foreground/92">
            ¿Desea registrar su clínica, coordinar envío de muestras o resolver
            consultas sobre informes? Comuníquese con nuestro equipo.
          </p>
        </div>
      </section>

      <section className="public-soft-canvas py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid max-w-5xl grid-cols-1 gap-12 mx-auto lg:grid-cols-2">
            <section
              className="premium-card p-6"
              aria-labelledby="contact-form-heading"
            >
              <div className="mb-6 flex items-start gap-3">
                <VisualIcon icon={MessageCircle} tone="blue" className="h-11 w-11 rounded-xl" />
                <div>
                  <h2 id="contact-form-heading" className="text-2xl font-bold text-vetneb-ink">
                    Envíenos un mensaje
                  </h2>
                  <p className="mt-1 public-copy-tight text-sm text-muted-foreground">
                    Complete el formulario con su consulta clínica o
                    institucional. Nuestro equipo responderá por el canal
                    indicado para coordinar próximos pasos.
                  </p>
                </div>
              </div>

              <form
                className="space-y-4"
                aria-label="Formulario de contacto"
                onSubmit={handleSubmit}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="nombre"
                      className="field-label"
                    >
                      Nombre
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="nombre"
                        type="text"
                        placeholder="Su nombre"
                        autoComplete="given-name"
                        required
                        value={nombre}
                        onChange={(event) => {
                          clearFeedbackMessages();
                          setNombre(event.target.value);
                        }}
                        disabled={isSubmitting}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="apellido"
                      className="field-label"
                    >
                      Apellido
                    </label>
                    <Input
                      id="apellido"
                      type="text"
                      placeholder="Su apellido"
                      autoComplete="family-name"
                      value={apellido}
                      onChange={(event) => {
                        clearFeedbackMessages();
                        setApellido(event.target.value);
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="field-label"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="su@email.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => {
                        clearFeedbackMessages();
                        setEmail(event.target.value);
                      }}
                      disabled={isSubmitting}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="clinica"
                    className="field-label"
                  >
                    Nombre de la clínica (opcional)
                  </label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="clinica"
                      type="text"
                      placeholder="Clínica Veterinaria..."
                      autoComplete="organization"
                      value={clinica}
                      onChange={(event) => {
                        clearFeedbackMessages();
                        setClinica(event.target.value);
                      }}
                      disabled={isSubmitting}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="mensaje"
                    className="field-label"
                  >
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    rows={5}
                    placeholder="Describa su consulta o solicitud de acceso, e incluya tipo de muestra cuando corresponda..."
                    className="field-textarea"
                    required
                    minLength={10}
                    value={mensaje}
                    onChange={(event) => {
                      clearFeedbackMessages();
                      setMensaje(event.target.value);
                    }}
                    disabled={isSubmitting}
                  />
                </div>

                {errorMessage ? (
                  <p
                    className="clinical-alert-error px-3 py-2"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                {successMessage ? (
                  <p
                    className="clinical-alert-success px-3 py-2"
                    role="status"
                    aria-live="polite"
                  >
                    {successMessage}
                  </p>
                ) : null}

                {warningMessage ? (
                  <p
                    className="clinical-alert-warning px-3 py-2"
                    role="status"
                    aria-live="polite"
                  >
                    {warningMessage}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="public-cta-primary w-full"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {isSubmitting ? "Enviando mensaje..." : "Enviar mensaje"}
                </Button>
              </form>
            </section>

            <section aria-labelledby="contact-info-heading">
              <div className="mb-6 flex items-start gap-3">
                <VisualIcon icon={Phone} tone="emerald" className="h-11 w-11 rounded-xl" />
                <div>
                  <h2 id="contact-info-heading" className="text-2xl font-bold text-vetneb-ink">
                    Información de contacto
                  </h2>
                  <p className="mt-1 public-copy-tight text-sm text-muted-foreground">
                    Canales oficiales para coordinación de muestras, seguimiento
                    e integración.
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {contactInfo.map((info) => {
                  const infoHeadingId = `contact-info-${info.label.toLowerCase()}`;

                  return (
                    <article key={info.label} aria-labelledby={infoHeadingId}>
                      <Card className="premium-card">
                        <CardHeader className="pb-2">
                          <CardTitle id={infoHeadingId} className="text-base flex items-center gap-3">
                            <VisualIcon icon={info.icon} tone={info.tone} className="h-9 w-9 rounded-xl" />
                            {info.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {info.href ? (
                            <PublicExternalControl
                              href={info.href}
                              target={info.href.startsWith("http") ? "_blank" : "_self"}
                              className="text-vetneb-ink font-medium underline underline-offset-2 hover:text-primary"
                            >
                              {info.value}
                            </PublicExternalControl>
                          ) : (
                            <p className="text-vetneb-ink font-medium">{info.value}</p>
                          )}
                        </CardContent>
                      </Card>
                    </article>
                  );
                })}
              </div>

              <div className="clinical-muted-band rounded-lg p-6 clinical-surface-shadow">
                <h3 className="mb-2 font-semibold text-vetneb-navy">
                  ¿Es una clínica veterinaria?
                </h3>
                <p className="public-copy text-sm text-muted-foreground">
                  Si desea registrar su clínica en Portal VETNEB, indíquelo en
                  su mensaje. Nuestro equipo se pondrá en contacto para
                  configurar su acceso y explicarle el proceso de integración,
                  trazabilidad y seguimiento de informes.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
