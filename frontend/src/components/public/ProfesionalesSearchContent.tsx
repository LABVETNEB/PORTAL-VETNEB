"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseMedical,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRoundSearch,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { AmbientOrbs, VisualIcon } from "@/components/public/VisualAccents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  searchPublicProfessionals,
  type PublicProfessional,
} from "@/lib/api";
import { ROUTES } from "@/lib/routes";

type SearchState =
  | { status: "idle"; professionals: PublicProfessional[]; total: number }
  | { status: "loading"; professionals: PublicProfessional[]; total: number }
  | { status: "success"; professionals: PublicProfessional[]; total: number }
  | { status: "error"; professionals: PublicProfessional[]; total: number };

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
        limit: 20,
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
      <section className="public-hero-depth py-16 text-white md:py-20">
        <AmbientOrbs variant="dark" />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
<h1 className="mb-4 max-w-4xl text-4xl font-bold md:text-5xl">
            Red de profesionales veterinarios
          </h1>
          <p className="max-w-2xl public-copy text-xl text-primary-foreground/92">
            Banco público de profesionales vinculados a VETNEB, con búsqueda
            directa, clara y optimizada para coordinar derivaciones e
            interconsultas con datos verificables.
          </p>
        </div>
      </section>

      <section className="public-soft-canvas py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-start gap-4">
              <VisualIcon icon={UserRoundSearch} tone="blue" className="hidden sm:inline-flex" />
              <div>
                <h2 className="mb-3 text-2xl font-bold text-vetneb-ink">
                  Buscar profesionales
                </h2>
                <p className="public-copy-tight text-sm text-muted-foreground">
                  Ingrese texto libre, incluso una sola letra. La búsqueda
                  admite coincidencias por nombre, especialidad, servicios,
                  localidad, país, email, teléfono o descripción, y facilita la
                  coordinación profesional con trazabilidad de contacto.
                </p>
              </div>
            </div>

            <form
              className="premium-card flex flex-col gap-3 p-4 sm:flex-row"
              aria-label="Buscador de profesionales"
              onSubmit={handleSubmit}
            >
              <label htmlFor="professional-search" className="sr-only">
                Buscar profesional
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
                  placeholder="Buscar desde una letra: nombre, especialidad, localidad o dato asociado"
                  className="h-11 w-full rounded-xl border border-input bg-white/90 pl-10 pr-3 text-sm shadow-inner ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <Button
                type="submit"
                className="h-11 clinical-primary-gradient clinical-primary-gradient-hover shadow-[0_14px_35px_hsl(var(--vetneb-navy)/0.22)]"
              >
                Buscar
              </Button>
            </form>

            <div className="mt-8" aria-live="polite">
              {!currentQuery ? (
                <div className="surface-empty p-6">
                  Realice una búsqueda para consultar el banco público y
                  coordinar contacto profesional.
                </div>
              ) : null}

              {state.status === "loading" ? (
                <div className="clinical-alert-info p-6">
                  Buscando profesionales vinculados a VETNEB...
                </div>
              ) : null}

              {state.status === "error" ? (
                <div className="clinical-alert-error p-6">
                  No se pudo realizar la búsqueda. Intente nuevamente.
                </div>
              ) : null}

              {state.status === "success" && state.professionals.length === 0 ? (
                <div className="surface-empty p-6">
                  No se encontraron profesionales para “{currentQuery}”. Revise
                  la ortografía o pruebe otro dato de búsqueda.
                </div>
              ) : null}

              {state.status === "success" && state.professionals.length > 0 ? (
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {state.total} resultado(s) para “{currentQuery}”. Seleccione
                    el perfil con los datos de contacto más adecuados para su
                    coordinación clínica.
                  </p>
                  <div className="space-y-4">
                    {state.professionals.map((professional) => (
                      <Card
                        key={professional.clinicId}
                        className="premium-card overflow-hidden"
                      >
                        <CardHeader className="clinical-muted-band border-b">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <VisualIcon icon={BriefcaseMedical} tone="emerald" className="h-11 w-11 rounded-xl" />
                              <div>
                                <CardTitle className="text-lg text-vetneb-ink">
                                  {professional.displayName}
                                </CardTitle>
                                {(professional.locality || professional.country) ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {[professional.locality, professional.country]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <span className="clinical-pill px-2 py-0.5 text-[0.65rem] tracking-[0.08em]">
                              Perfil verificado
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-5 text-sm text-muted-foreground">
                          {professional.specialtyText ? (
                            <div className="clinical-muted-band rounded-lg px-3 py-2">
                              <p className="clinical-pill px-2 py-0.5 text-[0.62rem] tracking-[0.08em]">
                                Especialidad
                              </p>
                              <p className="mt-2">{professional.specialtyText}</p>
                            </div>
                          ) : null}
                          {professional.servicesText ? (
                            <div className="clinical-muted-band rounded-lg px-3 py-2">
                              <p className="clinical-pill px-2 py-0.5 text-[0.62rem] tracking-[0.08em]">
                                Servicios
                              </p>
                              <p className="mt-2">{professional.servicesText}</p>
                            </div>
                          ) : null}
                          {professional.aboutText ? (
                            <p className="leading-relaxed">
                              {professional.aboutText}
                            </p>
                          ) : null}
                          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {professional.locality || professional.country ? (
                              <div className="surface-soft px-3 py-2.5">
                                <dt className="flex items-center gap-1.5 font-medium text-vetneb-ink">
                                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                  Ubicación
                                </dt>
                                <dd className="mt-1 text-muted-foreground">
                                  {[professional.locality, professional.country]
                                    .filter(Boolean)
                                    .join(", ")}
                                </dd>
                              </div>
                            ) : null}
                            {professional.email ? (
                              <div className="surface-soft px-3 py-2.5">
                                <dt className="flex items-center gap-1.5 font-medium text-vetneb-ink">
                                  <Mail className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                  Email
                                </dt>
                                <dd className="mt-1">
                                  <a
                                    href={`mailto:${professional.email}`}
                                    className="underline underline-offset-2 hover:text-primary"
                                  >
                                    {professional.email}
                                  </a>
                                </dd>
                              </div>
                            ) : null}
                            {professional.phone ? (
                              <div className="surface-soft px-3 py-2.5">
                                <dt className="flex items-center gap-1.5 font-medium text-vetneb-ink">
                                  <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                  Teléfono
                                </dt>
                                <dd className="mt-1">
                                  <a
                                    href={`https://wa.me/549${professional.phone.replace(/\D/g, "")}`}
                                    className="underline underline-offset-2 hover:text-primary"
                                  >
                                    {professional.phone}
                                  </a>
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
