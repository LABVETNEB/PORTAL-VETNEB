"use client";

import { FormEvent, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createClinicParticularToken,
  getClinicParticularTokens,
  type ClinicParticularTokenCreatePayload,
  type ClinicParticularTokenSummary,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

type ClinicParticularTokenFormState = {
  reportId: string;
  tutorLastName: string;
  petName: string;
  petAge: string;
  petBreed: string;
  petSex: string;
  petSpecies: string;
  sampleLocation: string;
  sampleEvolution: string;
  detailsLesion: string;
  extractionDate: string;
  shippingDate: string;
};

const INITIAL_FORM_STATE: ClinicParticularTokenFormState = {
  reportId: "",
  tutorLastName: "",
  petName: "",
  petAge: "",
  petBreed: "",
  petSex: "",
  petSpecies: "",
  sampleLocation: "",
  sampleEvolution: "",
  detailsLesion: "",
  extractionDate: "",
  shippingDate: "",
};

const REQUIRED_FIELD_LABELS: Array<{
  key: keyof Omit<ClinicParticularTokenFormState, "reportId">;
  label: string;
}> = [
  { key: "tutorLastName", label: "Apellido del tutor" },
  { key: "petName", label: "Nombre del paciente" },
  { key: "petAge", label: "Edad" },
  { key: "petBreed", label: "Raza" },
  { key: "petSex", label: "Sexo" },
  { key: "petSpecies", label: "Especie" },
  { key: "sampleLocation", label: "Ubicación de la muestra" },
  { key: "sampleEvolution", label: "Evolución" },
  { key: "detailsLesion", label: "Detalle de lesión" },
  { key: "extractionDate", label: "Fecha de extracción" },
  { key: "shippingDate", label: "Fecha de envío" },
];

const PET_SEX_OPTIONS = [
  { value: "", label: "Seleccionar sexo" },
  { value: "Macho", label: "Macho" },
  { value: "Hembra", label: "Hembra" },
  { value: "No informado", label: "No informado" },
];

const PET_SPECIES_OPTIONS = [
  { value: "", label: "Seleccionar especie" },
  { value: "Canina", label: "Canina" },
  { value: "Felina", label: "Felina" },
  { value: "Equina", label: "Equina" },
  { value: "Otra", label: "Otra" },
];

function toIsoDate(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function normalizeText(value: string): string {
  return value.trim();
}

function parseOptionalReportId(value: string): number | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error("El ID de informe debe ser un número entero positivo.");
  }

  return parsedValue;
}

function validateFormState(formState: ClinicParticularTokenFormState): void {
  const missingField = REQUIRED_FIELD_LABELS.find(
    (field) => !String(formState[field.key]).trim(),
  );

  if (missingField) {
    throw new Error(`Complete el campo obligatorio: ${missingField.label}.`);
  }
}

function buildPayload(
  formState: ClinicParticularTokenFormState,
): ClinicParticularTokenCreatePayload {
  validateFormState(formState);

  return {
    reportId: parseOptionalReportId(formState.reportId),
    tutorLastName: normalizeText(formState.tutorLastName),
    petName: normalizeText(formState.petName),
    petAge: normalizeText(formState.petAge),
    petBreed: normalizeText(formState.petBreed),
    petSex: normalizeText(formState.petSex),
    petSpecies: normalizeText(formState.petSpecies),
    sampleLocation: normalizeText(formState.sampleLocation),
    sampleEvolution: normalizeText(formState.sampleEvolution),
    detailsLesion: normalizeText(formState.detailsLesion),
    extractionDate: toIsoDate(formState.extractionDate),
    shippingDate: toIsoDate(formState.shippingDate),
  };
}

function formatTokenSource(token: ClinicParticularTokenSummary): string {
  if (token.createdByClinicUserId) {
    return `Clínica #${token.createdByClinicUserId}`;
  }

  if (token.createdByAdminId) {
    return `Admin #${token.createdByAdminId}`;
  }

  return "Sistema";
}

export function ClinicParticularTokensCard() {
  const [formState, setFormState] =
    useState<ClinicParticularTokenFormState>(INITIAL_FORM_STATE);
  const [tokens, setTokens] = useState<ClinicParticularTokenSummary[]>([]);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadTokens() {
    setIsLoadingTokens(true);

    try {
      const snapshot = await getClinicParticularTokens({ limit: 10, offset: 0 });
      setTokens(snapshot.particularTokens);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los tokens particulares.",
      );
    } finally {
      setIsLoadingTokens(false);
    }
  }

  useEffect(() => {
    void loadTokens();
  }, []);

  function updateField(
    field: keyof ClinicParticularTokenFormState,
    value: string,
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function resetForm() {
    setFormState(INITIAL_FORM_STATE);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setGeneratedToken(null);

    let payload: ClinicParticularTokenCreatePayload;

    try {
      payload = buildPayload(formState);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Revise los datos obligatorios del token.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createClinicParticularToken(payload);

      setGeneratedToken(response.token);
      setStatusMessage(response.message);
      resetForm();
      await loadTokens();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo generar el token particular.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card id="clinic-particular-tokens">
      <CardHeader>
        <CardTitle className="text-base">Generación de tokens particulares</CardTitle>
        <CardDescription>
          Alta clinic-scoped en <code>POST /api/particular-tokens</code>. Todos
          los datos programados son obligatorios, excepto el informe vinculado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="clinic-token-report-id" className="field-label">
                ID informe vinculado
              </label>
              <Input
                id="clinic-token-report-id"
                name="reportId"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="Opcional"
                value={formState.reportId}
                onChange={(event) => updateField("reportId", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-tutor-last-name" className="field-label">
                Apellido del tutor
              </label>
              <Input
                id="clinic-token-tutor-last-name"
                name="tutorLastName"
                type="text"
                required
                value={formState.tutorLastName}
                onChange={(event) =>
                  updateField("tutorLastName", event.target.value)
                }
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-pet-name" className="field-label">
                Nombre del paciente
              </label>
              <Input
                id="clinic-token-pet-name"
                name="petName"
                type="text"
                required
                value={formState.petName}
                onChange={(event) => updateField("petName", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-pet-age" className="field-label">
                Edad
              </label>
              <Input
                id="clinic-token-pet-age"
                name="petAge"
                type="text"
                required
                value={formState.petAge}
                onChange={(event) => updateField("petAge", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-pet-breed" className="field-label">
                Raza
              </label>
              <Input
                id="clinic-token-pet-breed"
                name="petBreed"
                type="text"
                required
                value={formState.petBreed}
                onChange={(event) => updateField("petBreed", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-pet-sex" className="field-label">
                Sexo
              </label>
              <select
                id="clinic-token-pet-sex"
                name="petSex"
                className="field-select"
                required
                value={formState.petSex}
                onChange={(event) => updateField("petSex", event.target.value)}
                disabled={isSubmitting}
              >
                {PET_SEX_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="clinic-token-pet-species" className="field-label">
                Especie
              </label>
              <select
                id="clinic-token-pet-species"
                name="petSpecies"
                className="field-select"
                required
                value={formState.petSpecies}
                onChange={(event) =>
                  updateField("petSpecies", event.target.value)
                }
                disabled={isSubmitting}
              >
                {PET_SPECIES_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="clinic-token-sample-location" className="field-label">
                Ubicación de la muestra
              </label>
              <Input
                id="clinic-token-sample-location"
                name="sampleLocation"
                type="text"
                required
                value={formState.sampleLocation}
                onChange={(event) =>
                  updateField("sampleLocation", event.target.value)
                }
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-sample-evolution" className="field-label">
                Evolución
              </label>
              <Input
                id="clinic-token-sample-evolution"
                name="sampleEvolution"
                type="text"
                required
                value={formState.sampleEvolution}
                onChange={(event) =>
                  updateField("sampleEvolution", event.target.value)
                }
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-extraction-date" className="field-label">
                Fecha de extracción
              </label>
              <Input
                id="clinic-token-extraction-date"
                name="extractionDate"
                type="date"
                required
                value={formState.extractionDate}
                onChange={(event) =>
                  updateField("extractionDate", event.target.value)
                }
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="clinic-token-shipping-date" className="field-label">
                Fecha de envío
              </label>
              <Input
                id="clinic-token-shipping-date"
                name="shippingDate"
                type="date"
                required
                value={formState.shippingDate}
                onChange={(event) =>
                  updateField("shippingDate", event.target.value)
                }
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="clinic-token-details-lesion" className="field-label">
              Detalle de lesión
            </label>
            <textarea
              id="clinic-token-details-lesion"
              name="detailsLesion"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
              value={formState.detailsLesion}
              onChange={(event) => updateField("detailsLesion", event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {errorMessage ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {statusMessage ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {statusMessage}
            </p>
          ) : null}

          {generatedToken ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                Token generado
              </p>
              <Input
                className="mt-2 font-mono text-sm"
                readOnly
                value={generatedToken}
                aria-label="Token particular generado"
              />
              <p className="mt-2 text-xs text-blue-700">
                Copiar ahora. El token completo solo se muestra una vez.
              </p>
            </div>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generando token..." : "Generar token particular"}
          </Button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Últimos tokens de la clínica
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadTokens()}
              disabled={isLoadingTokens}
            >
              {isLoadingTokens ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>

          {tokens.length ? (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {token.petName} · {token.tutorLastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Token ****{token.tokenLast4} · {token.petSpecies} ·{" "}
                        {token.petBreed}
                      </p>
                    </div>
                    <Badge variant={token.isActive ? "default" : "destructive"}>
                      {token.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-500 md:grid-cols-3">
                    <p>Extracción: {formatDate(token.extractionDate)}</p>
                    <p>Envío: {formatDate(token.shippingDate)}</p>
                    <p>Origen: {formatTokenSource(token)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="surface-empty">
              {isLoadingTokens
                ? "Cargando tokens particulares..."
                : "No hay tokens particulares generados por esta clínica."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
