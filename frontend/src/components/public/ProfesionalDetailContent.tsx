"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  BriefcaseMedical,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPublicProfessional,
  type PublicProfessional,
} from "@/lib/api";
import {
  getPublicProfessionalLocation,
  isVerifiedPublicProfessional,
  parsePublicProfessionalClinicId,
} from "@/lib/public-professionals";
import { ROUTES } from "@/lib/routes";

type DetailState =
  | { status: "loading"; professional: null }
  | { status: "success"; professional: PublicProfessional }
  | { status: "error"; professional: null };

type ProfesionalDetailContentProps = {
  clinicId: string;
};

function buildWhatsAppHref(phone: string) {
  return `https://wa.me/549${phone.replace(/\D/g, "")}`;
}

export function ProfesionalDetailContent({
  clinicId,
}: ProfesionalDetailContentProps) {
  const parsedClinicId = parsePublicProfessionalClinicId(clinicId);
  const [state, setState] = useState<DetailState>({
    status: "loading",
    professional: null,
  });

  useEffect(() => {
    if (parsedClinicId === null) {
      setState({ status: "error", professional: null });
      return;
    }

    let isCurrent = true;

    setState({ status: "loading", professional: null });

    getPublicProfessional(parsedClinicId, { cache: "no-store" })
      .then((snapshot) => {
        if (!isCurrent) {
          return;
        }

        setState({
          status: "success",
          professional: snapshot.professional,
        });
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setState({ status: "error", professional: null });
      });

    return () => {
      isCurrent = false;
    };
  }, [parsedClinicId]);

  const professional = state.professional;
  const location = professional
    ? getPublicProfessionalLocation(professional)
    : null;
  const isVerified = professional
    ? isVerifiedPublicProfessional(professional)
    : false;

  return (
    <PublicLayout>
      <section
        className="public-secondary-hero-surface py-12 text-white md:py-16"
        aria-labelledby="professional-detail-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <PublicRouteControl
            href={ROUTES.profesionales}
            variant="textLink"
            className="mb-6 text-primary-foreground hover:text-primary-foreground focus-visible:text-primary-foreground"
            icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Volver a la búsqueda
          </PublicRouteControl>
          <h1
            id="professional-detail-page-title"
            className="max-w-4xl text-4xl font-bold md:text-5xl"
          >
            Perfil profesional
          </h1>
        </div>
      </section>

      <section className="public-soft-canvas py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            {state.status === "loading" ? (
              <div className="clinical-alert-info p-6">
                Cargando detalle del perfil profesional...
              </div>
            ) : null}

            {state.status === "error" ? (
              <div className="surface-empty p-6">
                No se pudo cargar el perfil profesional solicitado. Vuelva a la
                búsqueda e intente nuevamente.
              </div>
            ) : null}

            {state.status === "success" && professional ? (
              <article aria-labelledby="professional-detail-title">
                <Card className="premium-card overflow-hidden">
                  <CardHeader className="clinical-muted-band border-b">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      {professional.avatarUrl ? (
                        <Image
                          src={professional.avatarUrl}
                          alt={`Logo o avatar de ${professional.displayName}`}
                          width={96}
                          height={96}
                          className="h-24 w-24 rounded-2xl border border-vetneb-line/70 object-cover"
                          priority
                          unoptimized
                        />
                      ) : (
                        <span
                          className="professional-avatar-fallback flex h-24 w-24 items-center justify-center rounded-2xl border border-vetneb-line/70 bg-vetneb-cyan/12 text-vetneb-navy"
                          aria-hidden="true"
                        >
                          <BriefcaseMedical
                            className="h-10 w-10"
                            aria-hidden="true"
                          />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <CardTitle
                              id="professional-detail-title"
                              className="text-2xl text-vetneb-ink"
                            >
                              {professional.displayName}
                            </CardTitle>
                            {location ? (
                              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPin
                                  className="h-4 w-4 text-primary"
                                  aria-hidden="true"
                                />
                                {location}
                              </p>
                            ) : null}
                          </div>
                          {isVerified ? (
                            <span className="clinical-pill inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] tracking-[0.08em]">
                              <ShieldCheck
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              Perfil verificado
                            </span>
                          ) : null}
                        </div>
                        {professional.aboutText ? (
                          <p className="mt-4 leading-relaxed text-muted-foreground">
                            {professional.aboutText}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <section aria-labelledby="professional-care-heading">
                      <h2
                        id="professional-care-heading"
                        className="mb-3 flex items-center gap-2 text-lg font-semibold text-vetneb-ink"
                      >
                        <Stethoscope
                          className="h-5 w-5 text-primary"
                          aria-hidden="true"
                        />
                        Especialidades y servicios
                      </h2>
                      <div className="grid gap-3 md:grid-cols-2">
                        {professional.specialtyText ? (
                          <div className="surface-soft px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Especialidades
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-vetneb-ink">
                              {professional.specialtyText}
                            </p>
                          </div>
                        ) : null}
                        {professional.servicesText ? (
                          <div className="surface-soft px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Servicios
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-vetneb-ink">
                              {professional.servicesText}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </section>

                    <section aria-labelledby="professional-contact-heading">
                      <h2
                        id="professional-contact-heading"
                        className="mb-3 flex items-center gap-2 text-lg font-semibold text-vetneb-ink"
                      >
                        <UserRound
                          className="h-5 w-5 text-primary"
                          aria-hidden="true"
                        />
                        Responsable y contacto
                      </h2>
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="surface-soft px-4 py-3">
                          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Responsable / perfil
                          </dt>
                          <dd className="mt-2 text-sm text-vetneb-ink">
                            {professional.displayName}
                          </dd>
                        </div>
                        {professional.email ? (
                          <div className="surface-soft px-4 py-3">
                            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              <Mail
                                className="h-3.5 w-3.5 text-primary"
                                aria-hidden="true"
                              />
                              Email
                            </dt>
                            <dd className="mt-2">
                              <PublicExternalControl
                                href={`mailto:${professional.email}`}
                                target="_self"
                                className="text-sm font-semibold text-vetneb-navy underline underline-offset-2 hover:text-primary"
                                aria-label={`Enviar email a ${professional.displayName}`}
                              >
                                {professional.email}
                              </PublicExternalControl>
                            </dd>
                          </div>
                        ) : null}
                        {professional.phone ? (
                          <div className="surface-soft px-4 py-3">
                            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              <Phone
                                className="h-3.5 w-3.5 text-primary"
                                aria-hidden="true"
                              />
                              Teléfono
                            </dt>
                            <dd className="mt-2">
                              <PublicExternalControl
                                href={buildWhatsAppHref(professional.phone)}
                                target="_blank"
                                className="text-sm font-semibold text-vetneb-navy underline underline-offset-2 hover:text-primary"
                                aria-label={`Contactar por teléfono a ${professional.displayName}`}
                              >
                                {professional.phone}
                              </PublicExternalControl>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </section>

                    <section aria-labelledby="professional-location-heading">
                      <h2
                        id="professional-location-heading"
                        className="mb-3 flex items-center gap-2 text-lg font-semibold text-vetneb-ink"
                      >
                        <MapPin
                          className="h-5 w-5 text-primary"
                          aria-hidden="true"
                        />
                        Ubicación
                      </h2>
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {location ? (
                          <div className="surface-soft px-4 py-3">
                            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Localidad
                            </dt>
                            <dd className="mt-2 text-sm text-vetneb-ink">
                              {location}
                            </dd>
                          </div>
                        ) : null}
                        {professional.publicAddress ? (
                          <div className="surface-soft px-4 py-3">
                            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Dirección
                            </dt>
                            <dd className="mt-2 text-sm text-vetneb-ink">
                              {professional.publicAddress}
                            </dd>
                          </div>
                        ) : null}
                        {professional.mapLink ? (
                          <div className="surface-soft px-4 py-3 sm:col-span-2">
                            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              <ExternalLink
                                className="h-3.5 w-3.5 text-primary"
                                aria-hidden="true"
                              />
                              Mapa
                            </dt>
                            <dd className="mt-2">
                              <PublicExternalControl
                                href={professional.mapLink}
                                target="_blank"
                                className="text-sm font-semibold text-vetneb-navy underline underline-offset-2 hover:text-primary"
                                aria-label={`Abrir mapa de ${professional.displayName}`}
                              >
                                Ver ubicación en mapa
                              </PublicExternalControl>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </section>
                  </CardContent>
                </Card>
              </article>
            ) : null}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
