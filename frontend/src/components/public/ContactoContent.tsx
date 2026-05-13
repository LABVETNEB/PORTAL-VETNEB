"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { AmbientOrbs, Eyebrow, VisualIcon } from "@/components/public/VisualAccents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitContactMessage } from "@/lib/api";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
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

      setSuccessMessage(response.message);
      setNombre("");
      setApellido("");
      setEmail("");
      setClinica("");
      setMensaje("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el mensaje. Intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicLayout>
      <section className="public-hero-depth py-16 text-white md:py-20">
        <AmbientOrbs variant="dark" />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <Eyebrow>
            <Sparkles className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Contacto VETNEB
          </Eyebrow>
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">
            Contacto
          </h1>
          <p className="max-w-2xl public-copy text-xl text-blue-50">
            ¿Desea registrar su clínica, coordinar envío de muestras o resolver
            consultas sobre informes? Comuníquese con nuestro equipo.
          </p>
        </div>
      </section>

      <section className="public-soft-canvas py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid max-w-5xl grid-cols-1 gap-12 mx-auto lg:grid-cols-2">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
              <div className="mb-6 flex items-start gap-3">
                <VisualIcon icon={MessageCircle} tone="blue" className="h-11 w-11 rounded-xl" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-950">
                    Envíenos un mensaje
                  </h2>
                  <p className="mt-1 public-copy-tight text-sm text-gray-600">
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
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Nombre
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <Input
                        id="nombre"
                        type="text"
                        placeholder="Su nombre"
                        autoComplete="given-name"
                        required
                        value={nombre}
                        onChange={(event) => setNombre(event.target.value)}
                        disabled={isSubmitting}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="apellido"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Apellido
                    </label>
                    <Input
                      id="apellido"
                      type="text"
                      placeholder="Su apellido"
                      autoComplete="family-name"
                      value={apellido}
                      onChange={(event) => setApellido(event.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="su@email.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isSubmitting}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="clinica"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nombre de la clínica (opcional)
                  </label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                      id="clinica"
                      type="text"
                      placeholder="Clínica Veterinaria..."
                      autoComplete="organization"
                      value={clinica}
                      onChange={(event) => setClinica(event.target.value)}
                      disabled={isSubmitting}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="mensaje"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    rows={5}
                    placeholder="Describa su consulta o solicitud de acceso, e incluya tipo de muestra cuando corresponda..."
                    className="flex w-full resize-none rounded-xl border border-input bg-white/90 px-3 py-2 text-sm shadow-inner ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                    minLength={10}
                    value={mensaje}
                    onChange={(event) => setMensaje(event.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {errorMessage ? (
                  <p
                    className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                {successMessage ? (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    {successMessage}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-700 to-teal-600 shadow-[0_14px_35px_rgba(37,99,235,0.22)] hover:from-blue-800 hover:to-teal-700"
                  disabled={isSubmitting}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {isSubmitting ? "Enviando mensaje..." : "Enviar mensaje"}
                </Button>
              </form>
            </div>

            <div>
              <div className="mb-6 flex items-start gap-3">
                <VisualIcon icon={Phone} tone="emerald" className="h-11 w-11 rounded-xl" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-950">
                    Información de contacto
                  </h2>
                  <p className="mt-1 public-copy-tight text-sm text-gray-600">
                    Canales oficiales para coordinación de muestras, seguimiento
                    e integración.
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {contactInfo.map((info) => (
                  <Card key={info.label} className="premium-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-3">
                        <VisualIcon icon={info.icon} tone={info.tone} className="h-9 w-9 rounded-xl" />
                        {info.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {info.href ? (
                        <a
                          href={info.href}
                          className="text-gray-700 font-medium underline underline-offset-2 hover:text-primary"
                        >
                          {info.value}
                        </a>
                      ) : (
                        <p className="text-gray-700 font-medium">{info.value}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <h3 className="font-semibold text-blue-900 mb-2">
                  ¿Es una clínica veterinaria?
                </h3>
                <p className="text-sm public-copy text-blue-700">
                  Si desea registrar su clínica en Portal VETNEB, indíquelo en
                  su mensaje. Nuestro equipo se pondrá en contacto para
                  configurar su acceso y explicarle el proceso de integración,
                  trazabilidad y seguimiento de informes.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Solicitar integración clínica
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
