"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseMedical,
  Check,
  ChevronRight,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import { VisualIcon } from "@/components/public/VisualAccents";
import { Button } from "@/components/ui/button";
import {
  searchPublicProfessionals,
  type PublicProfessional,
} from "@/lib/api";
import {
  buildProfessionalDetailHref,
  getPublicProfessionalLocation,
  isVerifiedPublicProfessional,
  PUBLIC_PROFESSIONALS_PAGE_SIZE,
  summarizePublicProfessional,
} from "@/lib/public-professionals";
import { ROUTES } from "@/lib/routes";

type SearchState =
  | { status: "idle"; professionals: PublicProfessional[]; total: number }
  | { status: "loading"; professionals: PublicProfessional[]; total: number }
  | { status: "success"; professionals: PublicProfessional[]; total: number }
  | { status: "error"; professionals: PublicProfessional[]; total: number };

const trustHighlights = [
  {
    icon: ShieldCheck,
    tone: "blue" as const,
    title: "Fichas verificadas",
    description:
      "Cada entrada en la red fue revisada y confirmada directamente por el laboratorio VETNEB antes de publicarse.",
  },
  {
    icon: Network,
    tone: "emerald" as const,
    title: "Red de clínicas y profesionales",
    description:
      "La red incluye clínicas veterinarias y profesionales vinculados al servicio diagnóstico con datos actualizados.",
  },
  {
    icon: UsersRound,
    tone: "amber" as const,
    title: "Coordinación diagnóstica",
    description:
      "Los perfiles verificados articulan la derivación de muestras, el seguimiento y la comunicación clínica con VETNEB.",
  },
];

export function ProfesionalesSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(currentQuery);
  const [state, setState] = useState<SearchState>({
    status: "idle",
    professionals: [],
    total: 0,
  });

  useEffect(() => {
    setQuery(currentQuery);

    if (!currentQuery) {
      setState({ status: "idle", professionals: [], total: 0 });
      return;
    }

    let isCurrent = true;

    setState((previous) => ({
      status: "loading",
      professionals: previous.professionals,
      total: previous.total,
    }));

    searchPublicProfessionals(
      {
        query: currentQuery,
        limit: PUBLIC_PROFESSIONALS_PAGE_SIZE,
        offset: 0,
      },
      { cache: "no-store" },
    )
      .then((snapshot) => {
        if (!isCurrent) {
          return;
        }

        setState({
          status: "success",
          professionals: snapshot.professionals,
          total: snapshot.total,
        });
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setState({ status: "error", professionals: [], total: 0 });
      });

    return () => {
      isCurrent = false;
    };
  }, [currentQuery]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = query.trim();
    const params = new URLSearchParams();

    if (nextQuery) {
      params.set("q", nextQuery);
    }

    router.push(`${ROUTES.profesionales}${params.size ? `?${params}` : ""}`);
  }

  return (
    <PublicLayout>
      {/* Hero superpremium */}
      <section
        className="public-secondary-hero-surface text-white"
        aria-labelledby="professionals-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <div className="max-w-3xl">
            <div className="sec-hero-eyebrow">
              <span className="sec-hero-eyebrow-dot" aria-hidden="true" />
              Red verificada VETNEB
            </div>

            <h1
              id="professionals-page-title"
              className="sec-hero-title mt-5"
            >
              Clínicas y profesionales verificados que trabajan con VETNEB.
            </h1>

            <p className="sec-hero-lead mt-5">
              Cada ficha fue revisada y confirmada por el laboratorio.
              Consultá la red verificada para coordinar derivaciones, informes
              y seguimiento diagnóstico.
            </p>

            <div className="sec-hero-scope mt-7">
              <span>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Clínicas veterinarias
              </span>
              <span>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Profesionales vinculados
              </span>
              <span>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Perfiles verificados
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Sección editorial: trust highlights */}
      <div className="sec-page-canvas">
        <section
          className="sec-page-section"
          aria-label="Por qué confiamos en la red"
          style={{ paddingBottom: "3rem" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="sec-bento-grid-light" style={{ maxWidth: "64rem", margin: "0 auto" }}>
                {trustHighlights.map((item) => {
                  const TrustIcon = item.icon;

                  return (
                    <article
                      key={item.title}
                      data-scroll-reveal-item
                      data-size="third"
                      className="sec-bento-card-light"
                    >
                      <VisualIcon
                        icon={TrustIcon}
                        tone={item.tone}
                        className="mb-4 h-11 w-11 rounded-xl"
                      />
                      <h2 className="sec-bento-title">{item.title}</h2>
                      <p className="sec-bento-desc">{item.description}</p>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Búsqueda */}
        <section
          className="sec-page-section"
          aria-labelledby="professionals-search-heading"
          style={{ paddingTop: 0 }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <PublicScrollReveal variant="section">
                <div className="mb-6 flex items-start gap-4">
                  <VisualIcon
                    icon={UserRoundSearch}
                    tone="blue"
                    className="hidden sm:inline-flex"
                  />
                  <div>
                    <h2
                      id="professionals-search-heading"
                      className="mb-3 text-2xl font-bold text-vetneb-ink"
                    >
                      Consultar la red verificada
                    </h2>
                    <p className="public-copy-tight text-sm text-muted-foreground">
                      Ingrese texto libre, incluso una sola letra. La consulta
                      admite coincidencias por nombre, especialidad, servicios,
                      localidad, país o descripción para ubicar perfiles
                      institucionales dentro de la red VETNEB.
                    </p>
                  </div>
                </div>
              </PublicScrollReveal>

              <form
                className="premium-card flex flex-col gap-3 p-4 sm:flex-row"
                aria-label="Consulta de la red profesional"
                onSubmit={handleSubmit}
              >
                <label htmlFor="professional-search" className="sr-only">
                  Consultar profesional
                </label>
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="professional-search"
                    name="q"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nombre, especialidad, localidad o dato operativo de la red"
                    className="h-11 w-full rounded-xl border border-input bg-white/90 pl-10 pr-3 text-sm shadow-inner ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <Button type="submit" className="public-cta-primary h-11">
                  Consultar
                </Button>
              </form>

              <section
                className="mt-8"
                aria-labelledby="professionals-results-heading"
                aria-live="polite"
              >
                <h2 id="professionals-results-heading" className="sr-only">
                  Resultados de la búsqueda profesional
                </h2>
                {!currentQuery ? (
                  <div className="surface-empty p-6">
                    Realice una consulta para revisar clínicas y profesionales
                    verificados de la red VETNEB.
                  </div>
                ) : null}

                {state.status === "loading" ? (
                  <div className="clinical-alert-info p-6">
                    Consultando la red de profesionales vinculados a VETNEB...
                  </div>
                ) : null}

                {state.status === "error" ? (
                  <div className="clinical-alert-error p-6">
                    No se pudo realizar la búsqueda. Intente nuevamente.
                  </div>
                ) : null}

                {state.status === "success" && state.professionals.length === 0 ? (
                  <div className="surface-empty p-6">
                    No se encontraron profesionales para &quot;{currentQuery}&quot;. Revise
                    la ortografía o pruebe otro dato de búsqueda.
                  </div>
                ) : null}

                {state.status === "success" && state.professionals.length > 0 ? (
                  <div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      {state.total} resultado(s) para &quot;{currentQuery}&quot;. Seleccione
                      un perfil para ver la ficha institucional y sus datos de
                      coordinación clínica.
                    </p>
                    <div className="space-y-3">
                      {state.professionals.map((professional) => {
                        const location = getPublicProfessionalLocation(professional);
                        const summary = summarizePublicProfessional(professional);
                        const isVerified =
                          isVerifiedPublicProfessional(professional);

                        return (
                          <article key={professional.clinicId}>
                            <PublicRouteControl
                              href={buildProfessionalDetailHref(
                                professional.clinicId,
                              )}
                              variant="bare"
                              aria-label={`Abrir detalle del perfil ${professional.displayName}`}
                              className="premium-card group flex w-full items-start gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-vetneb-teal/45 hover:shadow-lg"
                            >
                              <span className="shrink-0">
                                {professional.avatarUrl ? (
                                  <Image
                                    src={professional.avatarUrl}
                                    alt={`Logo o avatar de ${professional.displayName}`}
                                    width={56}
                                    height={56}
                                    className="h-14 w-14 rounded-xl border border-vetneb-line/70 object-cover"
                                    loading="lazy"
                                    unoptimized
                                  />
                                ) : (
                                  <span
                                    className="professional-avatar-fallback flex h-14 w-14 items-center justify-center rounded-xl border border-vetneb-line/70 bg-vetneb-cyan/12 text-vetneb-navy"
                                    aria-hidden="true"
                                  >
                                    <BriefcaseMedical
                                      className="h-6 w-6"
                                      aria-hidden="true"
                                    />
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <span className="min-w-0">
                                    <span className="block text-base font-semibold text-vetneb-ink">
                                      {professional.displayName}
                                    </span>
                                    {location ? (
                                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <MapPin
                                          className="h-3.5 w-3.5 text-primary"
                                          aria-hidden="true"
                                        />
                                        {location}
                                      </span>
                                    ) : null}
                                  </span>
                                  {isVerified ? (
                                    <span className="clinical-pill inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] tracking-[0.08em]">
                                      <ShieldCheck
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                      Perfil verificado
                                    </span>
                                  ) : null}
                                </span>
                                {summary ? (
                                  <span className="mt-3 block text-sm leading-relaxed text-muted-foreground">
                                    {summary}
                                  </span>
                                ) : null}
                              </span>
                              <ChevronRight
                                className="mt-4 h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                                aria-hidden="true"
                              />
                            </PublicRouteControl>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
