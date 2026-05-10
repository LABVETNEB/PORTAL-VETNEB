"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PublicLayout } from "@/components/layout/PublicLayout";
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
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 py-16 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">
            Red de profesionales veterinarios
          </h1>
          <p className="max-w-2xl text-xl text-blue-100">
            Banco público de profesionales vinculados a VETNEB.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              Buscar profesionales
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-gray-600">
              Ingrese texto libre, incluso una sola letra. La búsqueda admite coincidencias por nombre,
              especialidad, servicios, localidad, país, email, teléfono o
              descripción para reducir errores por escritura parcial.
            </p>

            <form
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row"
              aria-label="Buscador de profesionales"
              onSubmit={handleSubmit}
            >
              <label htmlFor="professional-search" className="sr-only">
                Buscar profesional
              </label>
              <input
                id="professional-search"
                name="q"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar desde una letra: nombre, especialidad, localidad o dato asociado"
                className="h-11 flex-1 rounded-md border border-input bg-white px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Button type="submit" className="h-11">
                Buscar
              </Button>
            </form>

            <div className="mt-8" aria-live="polite">
              {!currentQuery ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                  Realice una búsqueda para consultar el banco público de
                  profesionales.
                </div>
              ) : null}

              {state.status === "loading" ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 text-sm text-blue-700">
                  Buscando profesionales...
                </div>
              ) : null}

              {state.status === "error" ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
                  No se pudo realizar la búsqueda. Intente nuevamente.
                </div>
              ) : null}

              {state.status === "success" && state.professionals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                  No se encontraron profesionales para “{currentQuery}”.
                </div>
              ) : null}

              {state.status === "success" && state.professionals.length > 0 ? (
                <div>
                  <p className="mb-4 text-sm text-gray-500">
                    {state.total} resultado(s) para “{currentQuery}”.
                  </p>
                  <div className="space-y-4">
                    {state.professionals.map((professional) => (
                      <Card
                        key={professional.clinicId}
                        className="border-gray-100"
                      >
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {professional.displayName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-gray-600">
                          {professional.specialtyText ? (
                            <p>{professional.specialtyText}</p>
                          ) : null}
                          {professional.servicesText ? (
                            <p>{professional.servicesText}</p>
                          ) : null}
                          {professional.aboutText ? (
                            <p className="leading-relaxed">
                              {professional.aboutText}
                            </p>
                          ) : null}
                          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {professional.locality || professional.country ? (
                              <div>
                                <dt className="font-medium text-gray-900">
                                  Ubicación
                                </dt>
                                <dd>
                                  {[professional.locality, professional.country]
                                    .filter(Boolean)
                                    .join(", ")}
                                </dd>
                              </div>
                            ) : null}
                            {professional.email ? (
                              <div>
                                <dt className="font-medium text-gray-900">
                                  Email
                                </dt>
                                <dd>
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
                              <div>
                                <dt className="font-medium text-gray-900">
                                  Teléfono
                                </dt>
                                <dd>
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