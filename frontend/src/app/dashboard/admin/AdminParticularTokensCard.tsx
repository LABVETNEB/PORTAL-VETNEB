"use client";

import { FormEvent, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { UploadReportModal } from "@/components/dashboard/UploadReportModal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createAdminParticularToken,
  deleteAdminParticularToken,
  getAdminUsersRoles,
  getAdminParticularTokens,
  getAdminStudyTrackingCases,
  updateAdminStudyTrackingCase,
  type AdminStudyTrackingStage,
  type AdminStudyTrackingCaseSummary,
  type AdminParticularTokenCreatePayload,
  type AdminParticularTokenSummary,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

type AdminParticularTokenFormState = {
  clinicId: string;
  reportId: string;
  particularEmail: string;
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
  hasResolvedName: boolean;
  usernames: string[];
  locality: string | null;
};

type GeneratedTokenDetails = {
  petName: string;
  tutorLastName: string;
};

const INITIAL_FORM_STATE: AdminParticularTokenFormState = {
  clinicId: "",
  reportId: "",
  particularEmail: "",
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
  key: keyof Omit<
    AdminParticularTokenFormState,
    "clinicId" | "reportId"
  >;
  label: string;
}> = [
  { key: "particularEmail", label: "Email del particular" },
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
      name: current.hasResolvedName ? current.name : option.name,
      hasResolvedName: current.hasResolvedName || option.hasResolvedName,
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

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toIsoDateFromInput(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function normalizeText(value: string): string {
  return value.trim();
}

function buildManualTokenMessage(token: string, details: GeneratedTokenDetails): string {
  return `Hola. VETNEB informa que ya podés consultar el seguimiento/informe de ${details.petName}. Token de acceso: ${token}. Conservá este token; es personal y permite acceder a la consulta particular.`;
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
    recipientEmail: normalizeText(formState.particularEmail),
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

function getTrackingLabReceivedAt(
  trackingCase: AdminStudyTrackingCaseSummary,
): string {
  return trackingCase.labReceivedAt ?? trackingCase.receptionAt;
}

const TRACKING_STAGE_LABELS: Record<AdminStudyTrackingCaseSummary["currentStage"], string> = {
  reception: "Recepción de muestra",
  processing: "Procesamiento",
  evaluation: "Evaluación",
  report_development: "Desarrollo de informe",
  delivered: "Informe disponible / Publicado",
};

const TRACKING_STAGE_OPTIONS: Array<{
  value: AdminStudyTrackingStage;
  label: string;
}> = [
  { value: "reception", label: "Recepción de muestra" },
  { value: "processing", label: "Procesamiento" },
  { value: "evaluation", label: "Evaluación" },
  { value: "report_development", label: "Desarrollo de informe" },
  { value: "delivered", label: "Informe disponible / Publicado" },
];

function getTrackingStageLabel(
  stage: AdminStudyTrackingCaseSummary["currentStage"],
): string {
  return TRACKING_STAGE_LABELS[stage] ?? stage;
}

function resolveClinicName(
  clinicOptions: ClinicOption[],
  clinicId: number,
): string | null {
  const clinic = clinicOptions.find((option) => option.id === clinicId);

  return clinic?.hasResolvedName ? clinic.name : null;
}

function formatTokenTitle(
  clinicOptions: ClinicOption[],
  token: AdminParticularTokenSummary,
): string {
  const clinicName = resolveClinicName(clinicOptions, token.clinicId);

  return `${clinicName ?? `Clínica #${token.clinicId}`} · ${token.petName}`;
}

function formatTokenClinicLink(
  clinicOptions: ClinicOption[],
  clinicId: number,
): string {
  const clinicName = resolveClinicName(clinicOptions, clinicId);

  return clinicName
    ? `Clínica: ${clinicName} (#${clinicId})`
    : `Clínica #${clinicId}`;
}

function buildTokenPresetClinic(
  clinicOptions: ClinicOption[],
  token: AdminParticularTokenSummary,
) {
  const clinicName = resolveClinicName(clinicOptions, token.clinicId);

  return {
    id: token.clinicId,
    name: clinicName ?? `Clínica #${token.clinicId}`,
  };
}

export function AdminParticularTokensCard() {
  const [formState, setFormState] =
    useState<AdminParticularTokenFormState>(INITIAL_FORM_STATE);
  const [clinicSearch, setClinicSearch] = useState("");
  const [clinicOptions, setClinicOptions] = useState<ClinicOption[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AdminParticularTokenSummary[]>([]);
  const [trackingCasesByTokenId, setTrackingCasesByTokenId] = useState<
    Record<number, AdminStudyTrackingCaseSummary>
  >({});
  const [trackingLoadError, setTrackingLoadError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedTokenRecipientEmail, setGeneratedTokenRecipientEmail] =
    useState<string | null>(null);
  const [generatedTokenDetails, setGeneratedTokenDetails] =
    useState<GeneratedTokenDetails | null>(null);
  const [isGeneratedTokenConfirmed, setIsGeneratedTokenConfirmed] =
    useState(false);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(
    null,
  );
  const [copyErrorMessage, setCopyErrorMessage] = useState<string | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<number | null>(null);
  const [updatingTrackingCaseIds, setUpdatingTrackingCaseIds] = useState<
    Record<number, boolean>
  >({});
  const [trackingStageDraftsByCaseId, setTrackingStageDraftsByCaseId] =
    useState<Record<number, AdminStudyTrackingStage>>({});
  const [labReceivedDraftsByCaseId, setLabReceivedDraftsByCaseId] = useState<
    Record<number, string>
  >({});
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
    setTrackingLoadError(null);

    try {
      const snapshot = await getAdminParticularTokens({ limit: 10, offset: 0 });
      setTokens(snapshot.particularTokens);

      if (snapshot.particularTokens.length === 0) {
        setTrackingCasesByTokenId({});
        setTrackingStageDraftsByCaseId({});
        setLabReceivedDraftsByCaseId({});
        return;
      }

      try {
        const trackingEntries = await Promise.all(
          snapshot.particularTokens.map(async (token) => {
            const trackingSnapshot = await getAdminStudyTrackingCases({
              particularTokenId: token.id,
              limit: 1,
              offset: 0,
            });

            return [token.id, trackingSnapshot.trackingCases[0] ?? null] as const;
          }),
        );

        const nextTrackingByTokenId: Record<number, AdminStudyTrackingCaseSummary> = {};
        const nextTrackingStageDraftsByCaseId: Record<
          number,
          AdminStudyTrackingStage
        > = {};
        const nextLabReceivedDraftsByCaseId: Record<number, string> = {};

        for (const [tokenId, trackingCase] of trackingEntries) {
          if (trackingCase) {
            nextTrackingByTokenId[tokenId] = trackingCase;
            nextTrackingStageDraftsByCaseId[trackingCase.id] =
              trackingCase.currentStage;
            nextLabReceivedDraftsByCaseId[trackingCase.id] = toDateInputValue(
              getTrackingLabReceivedAt(trackingCase),
            );
          }
        }

        setTrackingCasesByTokenId(nextTrackingByTokenId);
        setTrackingStageDraftsByCaseId(nextTrackingStageDraftsByCaseId);
        setLabReceivedDraftsByCaseId(nextLabReceivedDraftsByCaseId);
      } catch (error) {
        setTrackingCasesByTokenId({});
        setTrackingStageDraftsByCaseId({});
        setLabReceivedDraftsByCaseId({});
        setTrackingLoadError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el seguimiento de los tokens listados.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los tokens particulares.",
      );
      setTrackingCasesByTokenId({});
      setTrackingStageDraftsByCaseId({});
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
              name: user.clinicName?.trim() || `Clínica #${user.clinicId}`,
              hasResolvedName: Boolean(user.clinicName?.trim()),
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

  function clearGeneratedTokenState() {
    setGeneratedToken(null);
    setGeneratedTokenRecipientEmail(null);
    setGeneratedTokenDetails(null);
    setIsGeneratedTokenConfirmed(false);
    setCopyStatusMessage(null);
    setCopyErrorMessage(null);
  }

  async function handleCopyManualMessage() {
    if (!generatedToken || !generatedTokenDetails) {
      return;
    }

    setCopyStatusMessage(null);
    setCopyErrorMessage(null);

    if (!navigator.clipboard?.writeText) {
      setCopyErrorMessage(
        "No se pudo acceder al portapapeles. Copiá el token manualmente antes de cerrar este bloque.",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildManualTokenMessage(generatedToken, generatedTokenDetails),
      );
      setCopyStatusMessage("Mensaje copiado al portapapeles.");
    } catch {
      setCopyErrorMessage(
        "No se pudo copiar el mensaje. Copiá el token manualmente antes de cerrar este bloque.",
      );
    }
  }

  function handleCloseGeneratedToken() {
    if (!isGeneratedTokenConfirmed) {
      return;
    }

    clearGeneratedTokenState();
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

    if (generatedToken) {
      setErrorMessage(
        "Cerrá el token visible luego de confirmar la comunicación antes de generar otro.",
      );
      return;
    }

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

    const generatedRecipientEmail = formState.particularEmail.trim();
    const nextGeneratedTokenDetails: GeneratedTokenDetails = {
      petName: payload.petName,
      tutorLastName: payload.tutorLastName,
    };

    setIsSubmitting(true);

    try {
      const response = await createAdminParticularToken(payload);

      setGeneratedToken(response.token);
      setGeneratedTokenRecipientEmail(generatedRecipientEmail || null);
      setGeneratedTokenDetails(nextGeneratedTokenDetails);
      setIsGeneratedTokenConfirmed(false);
      setCopyStatusMessage(null);
      setCopyErrorMessage(null);
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

  async function handleDeleteToken(token: AdminParticularTokenSummary) {
    if (revokingTokenId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar permanentemente el token ****${token.tokenLast4} de ${token.petName}? Esta acción no se puede deshacer y eliminará el token del servidor.`,
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setRevokingTokenId(token.id);

    try {
      const response = await deleteAdminParticularToken(token.id);
      setStatusMessage(response.message);
      setTokens((current) => current.filter((t) => t.id !== token.id));
      setTrackingCasesByTokenId((current) => {
        const next = { ...current };
        delete next[token.id];
        return next;
      });
      setTrackingStageDraftsByCaseId((current) => {
        const next = { ...current };
        const trackingCase = trackingCasesByTokenId[token.id];

        if (trackingCase) {
          delete next[trackingCase.id];
        }

        return next;
      });
      setLabReceivedDraftsByCaseId((current) => {
        const next = { ...current };
        const trackingCase = trackingCasesByTokenId[token.id];

        if (trackingCase) {
          delete next[trackingCase.id];
        }

        return next;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el token particular.",
      );
    } finally {
      setRevokingTokenId(null);
    }
  }

  function handleTrackingStageDraftChange(
    trackingCase: AdminStudyTrackingCaseSummary,
    nextStage: AdminStudyTrackingStage,
  ) {
    setTrackingStageDraftsByCaseId((current) => ({
      ...current,
      [trackingCase.id]: nextStage,
    }));
    setErrorMessage(null);
  }

  function handleLabReceivedDraftChange(
    trackingCase: AdminStudyTrackingCaseSummary,
    nextLabReceivedAt: string,
  ) {
    setLabReceivedDraftsByCaseId((current) => ({
      ...current,
      [trackingCase.id]: nextLabReceivedAt,
    }));
    setErrorMessage(null);
  }

  async function handleLabReceivedAtUpdate(
    tokenId: number,
    trackingCase: AdminStudyTrackingCaseSummary,
  ) {
    const currentLabReceivedAt = toDateInputValue(
      getTrackingLabReceivedAt(trackingCase),
    );
    const nextLabReceivedAt =
      labReceivedDraftsByCaseId[trackingCase.id] ?? currentLabReceivedAt;

    if (!nextLabReceivedAt || nextLabReceivedAt === currentLabReceivedAt) {
      return;
    }

    setErrorMessage(null);
    setUpdatingTrackingCaseIds((current) => ({
      ...current,
      [trackingCase.id]: true,
    }));

    try {
      const response = await updateAdminStudyTrackingCase(trackingCase.id, {
        labReceivedAt: toIsoDateFromInput(nextLabReceivedAt),
      });

      setTrackingCasesByTokenId((current) => ({
        ...current,
        [tokenId]: response.trackingCase,
      }));
      setTrackingStageDraftsByCaseId((current) => ({
        ...current,
        [response.trackingCase.id]: response.trackingCase.currentStage,
      }));
      setLabReceivedDraftsByCaseId((current) => ({
        ...current,
        [response.trackingCase.id]: toDateInputValue(
          getTrackingLabReceivedAt(response.trackingCase),
        ),
      }));
    } catch {
      setErrorMessage("No se pudo actualizar la entrega en laboratorio.");
    } finally {
      setUpdatingTrackingCaseIds((current) => {
        const next = { ...current };
        delete next[trackingCase.id];
        return next;
      });
    }
  }

  async function handleTrackingStageUpdate(
    tokenId: number,
    trackingCase: AdminStudyTrackingCaseSummary,
  ) {
    const nextStage =
      trackingStageDraftsByCaseId[trackingCase.id] ?? trackingCase.currentStage;

    if (trackingCase.currentStage === nextStage) {
      return;
    }

    setErrorMessage(null);
    setUpdatingTrackingCaseIds((current) => ({
      ...current,
      [trackingCase.id]: true,
    }));

    try {
      const response = await updateAdminStudyTrackingCase(trackingCase.id, {
        currentStage: nextStage,
      });

      setTrackingCasesByTokenId((current) => ({
        ...current,
        [tokenId]: response.trackingCase,
      }));
      setTrackingStageDraftsByCaseId((current) => ({
        ...current,
        [response.trackingCase.id]: response.trackingCase.currentStage,
      }));
    } catch {
      setErrorMessage("No se pudo cambiar la etapa del seguimiento.");
    } finally {
      setUpdatingTrackingCaseIds((current) => {
        const next = { ...current };
        delete next[trackingCase.id];
        return next;
      });
    }
  }

  async function handleSpecialStainChange(
    tokenId: number,
    trackingCase: AdminStudyTrackingCaseSummary,
  ) {
    setErrorMessage(null);
    setUpdatingTrackingCaseIds((current) => ({
      ...current,
      [trackingCase.id]: true,
    }));

    try {
      const response = await updateAdminStudyTrackingCase(trackingCase.id, {
        specialStainRequired: !trackingCase.specialStainRequired,
      });

      setTrackingCasesByTokenId((current) => ({
        ...current,
        [tokenId]: response.trackingCase,
      }));
    } catch {
      setErrorMessage("No se pudo actualizar la alerta de tinción especial.");
    } finally {
      setUpdatingTrackingCaseIds((current) => {
        const next = { ...current };
        delete next[trackingCase.id];
        return next;
      });
    }
  }

  return (
    <Card className="dashboard-surface">
      <CardHeader className="border-b border-vetneb-line/70">
        <CardTitle className="text-base">Generación de tokens particulares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
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
                        className={`dashboard-option-row clinical-hover-row flex w-full items-center justify-between gap-2 border-b border-vetneb-line/35 px-3 py-2 text-left text-sm last:border-b-0 ${
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
                autoComplete="off"
                value={formState.reportId}
                onChange={(event) => updateField("reportId", event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="admin-token-particular-email" className="field-label">
                Email del particular
              </label>
              <Input
                id="admin-token-particular-email"
                name="particularEmail"
                type="email"
                placeholder="email@ejemplo.com"
                autoComplete="off"
                required
                value={formState.particularEmail}
                onChange={(event) =>
                  updateField("particularEmail", event.target.value)
                }
                disabled={isSubmitting}
                aria-describedby="admin-token-particular-email-help"
              />
              <p
                id="admin-token-particular-email-help"
                className="mt-1 text-xs text-muted-foreground"
              >
                Obligatorio. El backend enviará el token a este email usando la
                configuración de correo de VETNEB.
              </p>
            </div>

            <div>
              <label htmlFor="admin-token-tutor-last-name" className="field-label">
                Apellido del tutor
              </label>
              <Input
                id="admin-token-tutor-last-name"
                name="tutorLastName"
                type="text"
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
              autoComplete="off"
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
            <div className="clinical-muted-band space-y-3 rounded-lg p-4">
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
              <div className="clinical-alert-error px-3 py-2">
                <p className="text-sm font-semibold">
                  IMPORTANTE: el token completo solo se muestra una vez.
                </p>
                <p className="mt-1 text-sm">
                  Antes de cerrar este bloque, verificá que el token haya sido
                  copiado si necesitás respaldo operativo.
                </p>
              </div>
              <p className="text-sm text-vetneb-ink">
                {generatedTokenRecipientEmail
                  ? `Email enviado a: ${generatedTokenRecipientEmail}`
                  : "El backend informó envío correcto del email."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyManualMessage()}
                >
                  Copiar mensaje para enviar
                </Button>
              </div>
              {copyStatusMessage ? (
                <p className="clinical-alert-success px-3 py-2 text-sm">
                  {copyStatusMessage}
                </p>
              ) : null}
              {copyErrorMessage ? (
                <p className="clinical-alert-error px-3 py-2 text-sm" role="alert">
                  {copyErrorMessage}
                </p>
              ) : null}
              <label className="flex items-start gap-2 text-sm text-vetneb-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={isGeneratedTokenConfirmed}
                  onChange={(event) =>
                    setIsGeneratedTokenConfirmed(event.target.checked)
                  }
                />
                <span>
                  Confirmo que registré el token visible o que no necesito copia
                  adicional.
                </span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseGeneratedToken}
                disabled={!isGeneratedTokenConfirmed}
              >
                Cerrar token visible
              </Button>
            </div>
          ) : null}

          <Button type="submit" disabled={isSubmitting || generatedToken !== null}>
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

          {trackingLoadError ? (
            <p className="clinical-alert-warning px-3 py-2 text-sm" role="alert">
              {trackingLoadError}
            </p>
          ) : null}

          {tokens.length ? (
            <div className="space-y-2">
              {tokens.map((token) => {
                const trackingCase = trackingCasesByTokenId[token.id];
                const isUpdatingTrackingCase = trackingCase
                  ? Boolean(updatingTrackingCaseIds[trackingCase.id])
                  : false;
                const trackingStageDraft = trackingCase
                  ? trackingStageDraftsByCaseId[trackingCase.id] ??
                    trackingCase.currentStage
                  : null;
                const hasTrackingStageChange = trackingCase
                  ? trackingStageDraft !== trackingCase.currentStage
                  : false;
                const labReceivedDraft = trackingCase
                  ? labReceivedDraftsByCaseId[trackingCase.id] ??
                    toDateInputValue(getTrackingLabReceivedAt(trackingCase))
                  : "";
                const hasLabReceivedChange = trackingCase
                  ? labReceivedDraft !==
                    toDateInputValue(getTrackingLabReceivedAt(trackingCase))
                  : false;

                return (
                  <div
                    key={token.id}
                    className="rounded-lg border border-vetneb-line/75 bg-vetneb-surface-raised/74 px-4 py-3 shadow-[0_8px_20px_rgba(15,45,62,0.06)]"
                  >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-vetneb-ink">
                        {formatTokenTitle(clinicOptions, token)}
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

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-6">
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
                      {token.hasLinkedReport && token.reportId ? (
                        <div className="mt-2">
                          <p className="mb-1 text-xs font-semibold text-vetneb-navy">
                            Acciones
                          </p>
                          <ReportFileActions
                            reportId={token.reportId}
                            scope="admin"
                            align="start"
                          />
                        </div>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Último acceso: {token.lastLoginAt ? formatDate(token.lastLoginAt) : "—"}
                      </p>
                    </div>

                    <div className="clinical-muted-band rounded-lg px-3 py-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                        Vínculo
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTokenClinicLink(clinicOptions, token.clinicId)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Origen: {formatTokenSource(token)}
                      </p>
                    </div>

                    <div className="clinical-muted-band rounded-lg px-3 py-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                        Seguimiento
                      </p>
                      {trackingCase ? (
                        <>
                          <p className="mt-1 text-xs text-vetneb-ink">
                            Etapa: {getTrackingStageLabel(trackingCase.currentStage)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Entrega en laboratorio:{" "}
                            {formatDate(getTrackingLabReceivedAt(trackingCase))}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Estimación informe:{" "}
                            {formatDate(trackingCase.estimatedDeliveryAt)}
                          </p>
                          <label
                            htmlFor={`admin-tracking-lab-received-${trackingCase.id}`}
                            className="mt-2 block text-xs font-semibold text-vetneb-navy"
                          >
                            Entrega en laboratorio
                          </label>
                          <Input
                            id={`admin-tracking-lab-received-${trackingCase.id}`}
                            type="date"
                            className="mt-1 text-xs"
                            value={labReceivedDraft}
                            onChange={(event) =>
                              handleLabReceivedDraftChange(
                                trackingCase,
                                event.target.value,
                              )
                            }
                            disabled={isUpdatingTrackingCase}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Impacta la estimación del informe.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() =>
                              void handleLabReceivedAtUpdate(token.id, trackingCase)
                            }
                            disabled={
                              !hasLabReceivedChange || isUpdatingTrackingCase
                            }
                          >
                            Actualizar entrega
                          </Button>
                          <label
                            htmlFor={`admin-tracking-stage-${trackingCase.id}`}
                            className="mt-2 block text-xs font-semibold text-vetneb-navy"
                          >
                            Cambiar etapa del seguimiento
                          </label>
                          <select
                            id={`admin-tracking-stage-${trackingCase.id}`}
                            className="field-select mt-1 text-xs"
                            value={trackingStageDraft ?? trackingCase.currentStage}
                            onChange={(event) =>
                              handleTrackingStageDraftChange(
                                trackingCase,
                                event.target.value as AdminStudyTrackingStage,
                              )
                            }
                            disabled={isUpdatingTrackingCase}
                          >
                            {TRACKING_STAGE_OPTIONS.map((stageOption) => (
                              <option key={stageOption.value} value={stageOption.value}>
                                {stageOption.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() =>
                              void handleTrackingStageUpdate(token.id, trackingCase)
                            }
                            disabled={
                              !hasTrackingStageChange || isUpdatingTrackingCase
                            }
                          >
                            {isUpdatingTrackingCase
                              ? "Actualizando..."
                              : "Actualizar estado"}
                          </Button>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {trackingCase.specialStainRequired
                              ? "Alerta: Solicitud de tinción especial"
                              : "Sin alerta de tinción especial"}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() =>
                              void handleSpecialStainChange(token.id, trackingCase)
                            }
                            disabled={isUpdatingTrackingCase}
                          >
                            {trackingCase.specialStainRequired
                              ? "Resolver tinción especial"
                              : "Solicitar tinción especial"}
                          </Button>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Sin seguimiento vinculado.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <UploadReportModal
                      triggerLabel={
                        token.hasLinkedReport && token.reportId
                          ? "Reemplazar informe"
                          : "Subir informe para este token"
                      }
                      presetClinic={buildTokenPresetClinic(clinicOptions, token)}
                      presetParticularToken={token}
                      onUploaded={loadTokens}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={revokingTokenId === token.id}
                      onClick={() => void handleDeleteToken(token)}
                      className="min-h-[2.75rem]"
                    >
                      {revokingTokenId === token.id ? "Eliminando..." : "Eliminar token"}
                    </Button>
                  </div>
                  </div>
                );
              })}
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
