"use client";

import { FormEvent, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createAdminParticularToken,
  getAdminUsersRoles,
  getAdminParticularTokens,
  revokeAdminParticularToken,
  type AdminParticularTokenCreatePayload,
  type AdminParticularTokenSummary,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

type AdminParticularTokenFormState = {
  clinicId: string;
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

type ClinicOption = {
  id: number;
  name: string;
  usernames: string[];
  locality: string | null;
};

const INITIAL_FORM_STATE: AdminParticularTokenFormState = {
  clinicId: "",
  reportId: "",
  tutorLastName: "",
  petName: "",
  petAge: "",
  petBreed: "",
  petSex: "Macho",
  petSpecies: "Caninos",
  sampleLocation: "",
  sampleEvolution: "",
  detailsLesion: "",
  extractionDate: "",
  shippingDate: "",
};

const REQUIRED_FIELD_LABELS: Array<{
  key: keyof Omit<AdminParticularTokenFormState, "clinicId" | "reportId">;
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
  { value: "Macho", label: "Macho" },
  { value: "Hembra", label: "Hembra" },
];

const PET_SPECIES_OPTIONS = [
  { value: "Caninos", label: "Caninos" },
  { value: "Felinos", label: "Felinos" },
  { value: "Exóticos", label: "Exóticos" },
  { value: "Bovinos", label: "Bovinos" },
  { value: "Equinos", label: "Equinos" },
  { value: "Porcinos", label: "Porcinos" },
  { value: "Ovinos", label: "Ovinos" },
  { value: "Caprinos", label: "Caprinos" },
  { value: "Aves", label: "Aves" },
];

function normalizeSearchText(value: string | number): string {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function buildClinicSearchText(option: ClinicOption): string {
  return normalizeSearchText(
    [option.id, option.name, option.locality ?? "", ...option.usernames].join(
      " ",
    ),
  );
}

function matchClinicOption(option: ClinicOption, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchable = buildClinicSearchText(option);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return tokens.every((token) => searchable.includes(token));
}

function sortClinicOptions(a: ClinicOption, b: ClinicOption): number {
  const nameComparison = a.name.localeCompare(b.name, "es", {
    sensitivity: "base",
  });

  return nameComparison || a.id - b.id;
}

function dedupeClinicOptions(options: ClinicOption[]): ClinicOption[] {
  const byId = new Map<number, ClinicOption>();

  for (const option of options) {
    const current = byId.get(option.id);

    if (!current) {
      byId.set(option.id, {
        ...option,
        usernames: [...option.usernames],
      });
      continue;
    }

    byId.set(option.id, {
      ...current,
      name: current.name || option.name,
      locality: current.locality ?? option.locality,
      usernames: Array.from(
        new Set([...current.usernames, ...option.usernames]),
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    });
  }

  return Array.from(byId.values()).sort(sortClinicOptions);
}

function toIsoDate(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function normalizeText(value: string): string {
  return value.trim();
}

function parsePositiveInteger(value: string, label: string): number {
  const parsedValue = Number(value.trim());

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} debe ser un número entero positivo.`);
  }

  return parsedValue;
}

function parseOptionalReportId(value: string): number | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  return parsePositiveInteger(normalizedValue, "El ID de informe");
}

function validateFormState(formState: AdminParticularTokenFormState): void {
  const missingField = REQUIRED_FIELD_LABELS.find(
    (field) => !String(formState[field.key]).trim(),
  );

  if (missingField) {
    throw new Error(`Complete el campo obligatorio: ${missingField.label}.`);
  }
}

function buildPayload(
  formState: AdminParticularTokenFormState,
  selectedClinic: ClinicOption | undefined,
): AdminParticularTokenCreatePayload {
  validateFormState(formState);

  if (!selectedClinic) {
    throw new Error("Seleccione una clínica registrada del listado.");
  }

  return {
    clinicId: selectedClinic.id,
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

function formatTokenSource(token: AdminParticularTokenSummary): string {
  if (token.createdByAdminId) {
    return `Admin #${token.createdByAdminId}`;
  }

  if (token.createdByClinicUserId) {
    return `Clínica #${token.createdByClinicUserId}`;
  }

  return "Sistema";
}

export function AdminParticularTokensCard() {
  const [formState, setFormState] =
    useState<AdminParticularTokenFormState>(INITIAL_FORM_STATE);
  const [clinicSearch, setClinicSearch] = useState("");
  const [clinicOptions, setClinicOptions] = useState<ClinicOption[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AdminParticularTokenSummary[]>([]);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedClinic = clinicOptions.find(
    (option) => String(option.id) === formState.clinicId,
  );
  const hasClinicQuery = normalizeSearchText(clinicSearch).length > 0;
  const filteredClinicOptions = hasClinicQuery
    ? clinicOptions
        .filter((option) => matchClinicOption(option, clinicSearch))
        .slice(0, 20)
    : selectedClinic
      ? [selectedClinic]
      : [];

  async function loadTokens() {
    setIsLoadingTokens(true);

    try {
      const snapshot = await getAdminParticularTokens({ limit: 10, offset: 0 });
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

  useEffect(() => {
    let cancelled = false;

    async function loadClinicOptions() {
      setIsLoadingClinics(true);
      setClinicLoadError(null);

      try {
        const limit = 100;
        let offset = 0;
        let total = Number.POSITIVE_INFINITY;
        const options: ClinicOption[] = [];

        while (offset < total) {
          const snapshot = await getAdminUsersRoles({
            userType: "clinic",
            limit,
            offset,
          });

          total = snapshot.total;

          for (const user of snapshot.users) {
            if (user.userType !== "clinic") {
              continue;
            }

            options.push({
              id: user.clinicId,
              name: user.clinicName ?? `Clínica #${user.clinicId}`,
              usernames: [user.username],
              locality: user.clinicLocality ?? null,
            });
          }

          offset += snapshot.users.length;

          if (snapshot.users.length === 0) {
            break;
          }
        }

        if (!cancelled) {
          setClinicOptions(dedupeClinicOptions(options));
        }
      } catch (error) {
        if (!cancelled) {
          setClinicLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las clínicas registradas.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClinics(false);
        }
      }
    }

    void loadClinicOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(
    field: keyof AdminParticularTokenFormState,
    value: string,
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function resetForm() {
    setFormState(INITIAL_FORM_STATE);
    setClinicSearch("");
    setErrorMessage(null);
  }

  function selectClinic(option: ClinicOption) {
    setFormState((current) => ({ ...current, clinicId: String(option.id) }));
    setClinicSearch(option.name);
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function handleClinicSearchChange(value: string) {
    setClinicSearch(value);
    setFormState((current) => ({ ...current, clinicId: "" }));
    setErrorMessage(null);
    setStatusMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setGeneratedToken(null);

    let payload: AdminParticularTokenCreatePayload;

    try {
      payload = buildPayload(formState, selectedClinic);
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
      const response = await createAdminParticularToken(payload);

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

  async function handleRevokeToken(token: AdminParticularTokenSummary) {
    if (revokingTokenId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `¿Revocar el token ****${token.tokenLast4} de ${token.petName}? Esta acción inhabilita su uso para acceso particular.`,
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setGeneratedToken(null);
    setRevokingTokenId(token.id);

    try {
      const response = await revokeAdminParticularToken(token.id);
      setStatusMessage(response.message);
      await loadTokens();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo revocar el token particular.",
      );
    } finally {
      setRevokingTokenId(null);
    }
  }

  return (
    <Card className="dashboard-surface">
      <CardHeader className="border-b border-vetneb-line/70">
        <CardTitle className="text-base">Generación de tokens particulares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="admin-token-clinic-search" className="field-label">
                Clínica
              </label>
              <Input
                id="admin-token-clinic-search"
                name="clinicSearch"
                type="text"
                placeholder="Buscar clínica por nombre, localidad, usuario o ID..."
                autoComplete="off"
                required
                value={clinicSearch}
                onChange={(event) => handleClinicSearchChange(event.target.value)}
                disabled={isSubmitting}
                aria-describedby="admin-token-clinic-help"
              />
              <input
                id="admin-token-clinic-id"
                name="clinicId"
                type="hidden"
                value={formState.clinicId}
                readOnly
              />
              <p
                id="admin-token-clinic-help"
                className="mt-1 text-xs text-muted-foreground"
              >
                Seleccione una clínica del listado. La búsqueda admite texto
                parcial, acentos, localidad, ID y usuarios asociados.
              </p>

              {clinicLoadError ? (
                <p
                  className="mt-2 clinical-alert-error px-3 py-2"
                  role="alert"
                >
                  {clinicLoadError}
                </p>
              ) : null}

              <div
                className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-vetneb-line/80 bg-card/92"
                role="listbox"
                aria-label="Clínicas registradas"
              >
                {isLoadingClinics ? (
                  <p className="surface-empty m-2 py-3">
                    Cargando clínicas registradas...
                  </p>
                ) : null}

                {!isLoadingClinics &&
                hasClinicQuery &&
                filteredClinicOptions.length === 0 ? (
                  <p className="surface-empty m-2 py-3">
                    No hay clínicas registradas que coincidan con la búsqueda.
                  </p>
                ) : null}

                {!isLoadingClinics
                  ? filteredClinicOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`clinical-hover-row flex w-full items-center justify-between gap-2 border-b border-vetneb-line/35 px-3 py-2 text-left text-sm last:border-b-0 ${
                          String(option.id) === formState.clinicId
                            ? "bg-vetneb-teal/12 text-vetneb-navy shadow-[inset_0_0_0_1px_rgba(16,60,96,0.28)]"
                            : "text-vetneb-ink/88"
                        }`}
                        onClick={() => selectClinic(option)}
                        disabled={isSubmitting}
                        role="option"
                        aria-selected={String(option.id) === formState.clinicId}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {option.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            ID #{option.id} · Localidad:{" "}
                            {option.locality ?? "No informada"}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            Usuarios:{" "}
                            {option.usernames.length
                              ? option.usernames.join(", ")
                              : "Sin usuarios asociados"}
                          </span>
                        </span>
                        {String(option.id) === formState.clinicId ? (
                          <span className="clinical-pill shrink-0 px-2 py-0.5 text-xs tracking-normal">
                            Seleccionada
                          </span>
                        ) : null}
                      </button>
                    ))
                  : null}
              </div>
            </div>

            <div>
              <label htmlFor="admin-token-report-id" className="field-label">
                ID informe vinculado
              </label>
              <Input
                id="admin-token-report-id"
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
              <label htmlFor="admin-token-tutor-last-name" className="field-label">
                Apellido del tutor
              </label>
              <Input
                id="admin-token-tutor-last-name"
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
              <label htmlFor="admin-token-pet-name" className="field-label">
                Nombre del paciente
              </label>
              <Input
                id="admin-token-pet-name"
                name="petName"
                type="text"
                required
                value={formState.petName}
                onChange={(event) => updateField("petName", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="admin-token-pet-age" className="field-label">
                Edad
              </label>
              <Input
                id="admin-token-pet-age"
                name="petAge"
                type="text"
                required
                value={formState.petAge}
                onChange={(event) => updateField("petAge", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="admin-token-pet-breed" className="field-label">
                Raza
              </label>
              <Input
                id="admin-token-pet-breed"
                name="petBreed"
                type="text"
                required
                value={formState.petBreed}
                onChange={(event) => updateField("petBreed", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="admin-token-pet-sex" className="field-label">
                Sexo
              </label>
              <select
                id="admin-token-pet-sex"
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
              <label htmlFor="admin-token-pet-species" className="field-label">
                Especie
              </label>
              <select
                id="admin-token-pet-species"
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
              <label htmlFor="admin-token-sample-location" className="field-label">
                Ubicación de la muestra
              </label>
              <Input
                id="admin-token-sample-location"
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
              <label htmlFor="admin-token-sample-evolution" className="field-label">
                Evolución
              </label>
              <Input
                id="admin-token-sample-evolution"
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
              <label htmlFor="admin-token-extraction-date" className="field-label">
                Fecha de extracción
              </label>
              <Input
                id="admin-token-extraction-date"
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
              <label htmlFor="admin-token-shipping-date" className="field-label">
                Fecha de envío
              </label>
              <Input
                id="admin-token-shipping-date"
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
            <label htmlFor="admin-token-details-lesion" className="field-label">
              Detalle de lesión
            </label>
            <textarea
              id="admin-token-details-lesion"
              name="detailsLesion"
              className="field-textarea"
              required
              value={formState.detailsLesion}
              onChange={(event) =>
                updateField("detailsLesion", event.target.value)
              }
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

          {statusMessage ? (
            <p className="clinical-alert-success px-3 py-2">
              {statusMessage}
            </p>
          ) : null}

          {generatedToken ? (
            <div className="clinical-muted-band rounded-lg p-4">
              <p className="text-sm font-semibold text-vetneb-navy">
                Token generado
              </p>
              <Input
                className="mt-2 font-mono text-sm"
                readOnly
                value={generatedToken}
                aria-label="Token particular generado por admin"
              />
              <p className="mt-2 text-xs text-muted-foreground">
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
            <h3 className="text-sm font-semibold text-vetneb-ink">
              Últimos tokens administrados
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
                  className="rounded-lg border border-vetneb-line/75 bg-vetneb-surface-raised/74 px-4 py-3 shadow-[0_8px_20px_rgba(15,45,62,0.06)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-vetneb-ink">
                        Clínica #{token.clinicId} · {token.petName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tutor: {token.tutorLastName} · Token ****{token.tokenLast4}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          token.isActive
                            ? "clinical-pill shrink-0 px-2.5 py-0.5 text-[0.68rem] tracking-[0.08em]"
                            : "inline-flex shrink-0 items-center rounded-full border border-vetneb-line/90 bg-card/80 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                        }
                      >
                        {token.isActive ? "Activo" : "Inactivo"}
                      </span>
                      <Badge variant={token.hasLinkedReport ? "default" : "outline"}>
                        {token.hasLinkedReport ? "Informe vinculado" : "Sin informe"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
                    <div className="clinical-muted-band rounded-lg px-3 py-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                        Paciente
                      </p>
                      <p className="mt-1 text-xs text-vetneb-ink">
                        {token.petSpecies} · {token.petBreed} · {token.petSex}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Edad: {token.petAge}</p>
                    </div>

                    <div className="clinical-muted-band rounded-lg px-3 py-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                        Muestra
                      </p>
                      <p className="mt-1 text-xs text-vetneb-ink">{token.sampleLocation}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Evolución: {token.sampleEvolution}
                      </p>
                    </div>

                    <div className="clinical-muted-band rounded-lg px-3 py-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                        Fechas
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Extracción: {formatDate(token.extractionDate)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Envío: {formatDate(token.shippingDate)}
                      </p>
                    </div>

                    <div className="clinical-muted-band rounded-lg px-3 py-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                        Publicación
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Informe: {token.reportId ? `#${token.reportId}` : "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Último acceso: {token.lastLoginAt ? formatDate(token.lastLoginAt) : "—"}
                      </p>
                    </div>

                    <div className="clinical-muted-band rounded-lg px-3 py-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                        Vínculo
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Clínica #{token.clinicId}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Origen: {formatTokenSource(token)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={!token.isActive || revokingTokenId === token.id}
                      onClick={() => void handleRevokeToken(token)}
                    >
                      {revokingTokenId === token.id
                        ? "Revocando..."
                        : token.isActive
                          ? "Revocar token"
                          : "Token inactivo"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="surface-empty">
              {isLoadingTokens
                ? "Cargando tokens particulares..."
                : "No hay tokens particulares administrados."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
