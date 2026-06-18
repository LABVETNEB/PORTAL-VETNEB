"use client";

import { FormEvent, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
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
import { cn, formatDate } from "@/lib/utils";

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

type WorkspacePanel = "tokens" | "create";

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

const TRACKING_STAGE_LABELS: Record<
  AdminStudyTrackingCaseSummary["currentStage"],
  string
> = {
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

export function AdminParticularTokensCard() {
  const [activePanel, setActivePanel] = useState<WorkspacePanel>("tokens");
  const [formState, setFormState] =
    useState<AdminParticularTokenFormState>(INITIAL_FORM_STATE);
  const [clinicSearch, setClinicSearch] = useState("");
  const [clinicOptions, setClinicOptions] = useState<ClinicOption[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AdminParticularTokenSummary[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
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
        .slice(0, 8)
    : selectedClinic
      ? [selectedClinic]
      : [];

  const selectedToken =
    selectedTokenId === null
      ? (tokens[0] ?? null)
      : (tokens.find((token) => token.id === selectedTokenId) ?? tokens[0] ?? null);
  const selectedTrackingCase = selectedToken
    ? trackingCasesByTokenId[selectedToken.id]
    : null;
  const selectedTrackingStageDraft = selectedTrackingCase
    ? trackingStageDraftsByCaseId[selectedTrackingCase.id] ??
      selectedTrackingCase.currentStage
    : null;
  const selectedLabReceivedDraft = selectedTrackingCase
    ? labReceivedDraftsByCaseId[selectedTrackingCase.id] ??
      toDateInputValue(getTrackingLabReceivedAt(selectedTrackingCase))
    : "";
  const selectedHasTrackingStageChange = selectedTrackingCase
    ? selectedTrackingStageDraft !== selectedTrackingCase.currentStage
    : false;
  const selectedHasLabReceivedChange = selectedTrackingCase
    ? selectedLabReceivedDraft !==
      toDateInputValue(getTrackingLabReceivedAt(selectedTrackingCase))
    : false;
  const isSelectedTrackingUpdating = selectedTrackingCase
    ? Boolean(updatingTrackingCaseIds[selectedTrackingCase.id])
    : false;

  const activeTokensCount = tokens.filter((token) => token.isActive).length;
  const linkedReportsCount = tokens.filter((token) => token.hasLinkedReport).length;
  const trackingCount = Object.keys(trackingCasesByTokenId).length;

  async function loadTokens() {
    setIsLoadingTokens(true);
    setTrackingLoadError(null);

    try {
      const snapshot = await getAdminParticularTokens({ limit: 8, offset: 0 });
      const nextTokens = snapshot.particularTokens;
      setTokens(nextTokens);
      setSelectedTokenId((current) =>
        current && nextTokens.some((token) => token.id === current)
          ? current
          : nextTokens[0]?.id ?? null,
      );

      if (nextTokens.length === 0) {
        setTrackingCasesByTokenId({});
        setTrackingStageDraftsByCaseId({});
        setLabReceivedDraftsByCaseId({});
        return;
      }

      try {
        const trackingEntries = await Promise.all(
          nextTokens.map(async (token) => {
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
      setActivePanel("tokens");
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
      setTokens((current) => {
        const nextTokens = current.filter((t) => t.id !== token.id);
        setSelectedTokenId((currentSelectedId) =>
          currentSelectedId === token.id
            ? nextTokens[0]?.id ?? null
            : currentSelectedId,
        );

        return nextTokens;
      });
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
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b border-vetneb-line/70">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="text-base">Generación de tokens particulares</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestión compacta: generar token, seleccionar de la lista y editar el
              seguimiento solo desde el detalle.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 xl:min-w-[34rem]">
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-muted-foreground">Tokens</p>
              <p className="mt-0.5 font-semibold text-vetneb-ink">{tokens.length}</p>
            </div>
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-muted-foreground">Activos</p>
              <p className="mt-0.5 font-semibold text-vetneb-ink">
                {activeTokensCount}
              </p>
            </div>
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-muted-foreground">Informes</p>
              <p className="mt-0.5 font-semibold text-vetneb-ink">
                {linkedReportsCount}
              </p>
            </div>
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-muted-foreground">Seguimientos</p>
              <p className="mt-0.5 font-semibold text-vetneb-ink">
                {trackingCount}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
        <div
          role="tablist"
          aria-label="Secciones de tokens particulares"
          className="flex shrink-0 flex-wrap gap-2 rounded-xl border border-vetneb-line/75 bg-card/78 p-1"
        >
          <Button
            type="button"
            variant={activePanel === "tokens" ? "default" : "ghost"}
            size="sm"
            role="tab"
            aria-selected={activePanel === "tokens"}
            onClick={() => setActivePanel("tokens")}
          >
            Tokens administrados
          </Button>
          <Button
            type="button"
            variant={activePanel === "create" ? "default" : "ghost"}
            size="sm"
            role="tab"
            aria-selected={activePanel === "create"}
            onClick={() => setActivePanel("create")}
          >
            Generar token
          </Button>
        </div>

        {generatedToken ? (
          <section
            aria-labelledby="generated-token-heading"
            className="shrink-0 rounded-xl border border-vetneb-cyan/45 bg-vetneb-cyan/10 p-4 shadow-[0_10px_32px_rgba(14,116,144,0.08)]"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h3
                  id="generated-token-heading"
                  className="text-sm font-semibold text-vetneb-navy"
                >
                  Token generado recientemente
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  IMPORTANTE: el token completo solo se muestra una vez. Antes de cerrar este bloque, verificá que el token haya sido copiado si necesitás respaldo operativo.
                </p>
              </div>
              <Badge variant="default">Visible una vez</Badge>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
              <label className="block">
                <span className="field-label">Token completo</span>
                <Input
                  className="font-mono text-sm"
                  readOnly
                  value={generatedToken}
                  aria-label="Token particular generado por admin"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyManualMessage()}
              >
                Copiar mensaje para enviar
              </Button>
            </div>

            <p className="mt-3 text-sm text-vetneb-ink">
              {generatedTokenRecipientEmail
                ? `Email enviado a: ${generatedTokenRecipientEmail}`
                : "El backend informó envío correcto del email."}
            </p>

            {copyStatusMessage ? (
              <p className="clinical-alert-success mt-3 px-3 py-2 text-sm">
                {copyStatusMessage}
              </p>
            ) : null}

            {copyErrorMessage ? (
              <p className="clinical-alert-error mt-3 px-3 py-2 text-sm" role="alert">
                {copyErrorMessage}
              </p>
            ) : null}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          </section>
        ) : null}

        {errorMessage ? (
          <p className="clinical-alert-error shrink-0 px-3 py-2" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {statusMessage ? (
          <p className="clinical-alert-success shrink-0 px-3 py-2">{statusMessage}</p>
        ) : null}

        {activePanel === "create" ? (
          <section
            role="tabpanel"
            aria-label="Generar token particular"
            className="dashboard-inline-scroll rounded-xl border border-vetneb-line/75 bg-card/82 p-4"
          >
            <div className="mb-4">
              <h3 className="dashboard-section-heading">Nuevo token particular</h3>
              <p className="dashboard-section-description">
                Formulario compacto para crear el acceso. El informe se vincula por
                ID si ya existe en el circuito del token.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                <div className="lg:col-span-2">
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
                    Seleccione una clínica registrada.
                  </p>

                  {clinicLoadError ? (
                    <p className="clinical-alert-error mt-2 px-3 py-2" role="alert">
                      {clinicLoadError}
                    </p>
                  ) : null}

                  <div
                    className="mt-2 rounded-lg border border-vetneb-line/80 bg-card/92"
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
                        No hay clínicas registradas que coincidan.
                      </p>
                    ) : null}

                    {!isLoadingClinics
                      ? filteredClinicOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={cn(
                              "dashboard-option-row clinical-hover-row flex w-full items-center justify-between gap-2 border-b border-vetneb-line/35 px-3 py-2 text-left text-sm last:border-b-0",
                              String(option.id) === formState.clinicId
                                ? "bg-vetneb-teal/12 text-vetneb-navy shadow-[inset_0_0_0_1px_rgba(16,60,96,0.28)]"
                                : "text-vetneb-ink/88",
                            )}
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
                                ID #{option.id} · Localidad: {option.locality ?? "No informada"} · Usuarios: {option.usernames.join(", ")}
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

                <label className="block">
                  <span className="field-label">ID informe vinculado</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Email particular</span>
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
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Obligatorio. El backend enviará el token a este email usando la
                    configuración de correo de VETNEB.
                  </p>
                </label>

                <label className="block">
                  <span className="field-label">Apellido tutor</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Paciente</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Edad</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Raza</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Sexo</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Especie</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Ubicación muestra</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Evolución</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Extracción</span>
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
                </label>

                <label className="block">
                  <span className="field-label">Envío</span>
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
                </label>

                <label className="block lg:col-span-4">
                  <span className="field-label">Detalle de lesión</span>
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
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || generatedToken !== null}
                >
                  {isSubmitting ? "Generando token..." : "Generar token particular"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Limpiar formulario
                </Button>
              </div>
            </form>
          </section>
        ) : (
          <section
            role="tabpanel"
            aria-label="Tokens particulares administrados"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="dashboard-master-panel dashboard-inline-list flex-1 rounded-xl border border-vetneb-line/75 bg-card/82">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-vetneb-line/70 px-4 py-3">
                <div>
                  <h3 className="dashboard-section-heading">
                    Últimos tokens administrados
                  </h3>
                  <p className="dashboard-section-description">
                    Seleccionar un token despliega el detalle dentro del propio token.
                  </p>
                </div>
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
                <p className="clinical-alert-warning m-3 shrink-0 px-3 py-2 text-sm" role="alert">
                  {trackingLoadError}
                </p>
              ) : null}

              {tokens.length ? (
                <div className="dashboard-inline-scroll divide-y divide-vetneb-line/60">
                  {tokens.map((token) => {
                    const isSelected = selectedToken?.id === token.id;
                    const trackingCase = trackingCasesByTokenId[token.id];

                    return (
                      <div key={token.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedTokenId(token.id)}
                          aria-pressed={isSelected}
                          aria-expanded={isSelected}
                          className={cn(
                            "block w-full px-4 py-3 text-left transition-colors hover:bg-vetneb-cyan/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-inset",
                            isSelected && "bg-vetneb-cyan/12",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-vetneb-ink">
                              {formatTokenTitle(clinicOptions, token)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              Tutor: {token.tutorLastName} · Token ****
                              {token.tokenLast4}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {trackingCase
                                ? getTrackingStageLabel(trackingCase.currentStage)
                                : "Sin seguimiento vinculado"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge variant={token.isActive ? "default" : "outline"}>
                              {token.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                            <Badge variant={token.hasLinkedReport ? "default" : "outline"}>
                              {token.hasLinkedReport ? "Informe" : "Sin informe"}
                            </Badge>
                          </div>
                        </div>
                        </button>

                        {isSelected && selectedToken ? (
                          <div
                            data-detail-state="selected"
                            className="dashboard-inline-detail border-t border-vetneb-line/60 bg-vetneb-surface-muted/40"
                          >
                <div className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 border-b border-vetneb-line/70 pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Detalle del token
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-vetneb-ink">
                        {formatTokenTitle(clinicOptions, selectedToken)}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatTokenClinicLink(clinicOptions, selectedToken.clinicId)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedToken.isActive ? "default" : "outline"}>
                        {selectedToken.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Badge
                        variant={selectedToken.hasLinkedReport ? "default" : "outline"}
                      >
                        {selectedToken.hasLinkedReport
                          ? "Informe vinculado"
                          : "Sin informe"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="surface-soft">
                      <p className="text-xs text-muted-foreground">Paciente</p>
                      <p className="mt-1 font-semibold text-vetneb-ink">
                        {selectedToken.petName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedToken.petSpecies} · {selectedToken.petBreed} ·{" "}
                        {selectedToken.petSex} · {selectedToken.petAge}
                      </p>
                    </div>
                    <div className="surface-soft">
                      <p className="text-xs text-muted-foreground">Tutor</p>
                      <p className="mt-1 font-semibold text-vetneb-ink">
                        {selectedToken.tutorLastName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Token ****{selectedToken.tokenLast4}
                      </p>
                    </div>
                    <div className="surface-soft">
                      <p className="text-xs text-muted-foreground">Muestra</p>
                      <p className="mt-1 font-semibold text-vetneb-ink">
                        {selectedToken.sampleLocation}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Evolución: {selectedToken.sampleEvolution}
                      </p>
                    </div>
                    <div className="surface-soft">
                      <p className="text-xs text-muted-foreground">Fechas</p>
                      <p className="mt-1 text-sm text-vetneb-ink">
                        Extracción: {formatDate(selectedToken.extractionDate)}
                      </p>
                      <p className="mt-1 text-sm text-vetneb-ink">
                        Envío: {formatDate(selectedToken.shippingDate)}
                      </p>
                    </div>
                    <div className="surface-soft">
                      <p className="text-xs text-muted-foreground">Publicación</p>
                      <p className="mt-1 font-semibold text-vetneb-ink">
                        {selectedToken.reportId ? `Informe #${selectedToken.reportId}` : "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Último acceso:{" "}
                        {selectedToken.lastLoginAt
                          ? formatDate(selectedToken.lastLoginAt)
                          : "—"}
                      </p>
                    </div>
                    <div className="surface-soft">
                      <p className="text-xs text-muted-foreground">Origen</p>
                      <p className="mt-1 font-semibold text-vetneb-ink">
                        {formatTokenSource(selectedToken)}
                      </p>
                    </div>
                  </div>

                  <section className="space-y-3">
                    <div>
                      <h4 className="text-base font-semibold text-vetneb-ink">
                        Detalle de lesión
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedToken.detailsLesion}
                      </p>
                    </div>
                  </section>

                  {selectedToken.hasLinkedReport && selectedToken.reportId ? (
                    <section className="space-y-2">
                      <h4 className="text-base font-semibold text-vetneb-ink">
                        Informe vinculado
                      </h4>
                      <ReportFileActions
                        reportId={selectedToken.reportId}
                        scope="admin"
                        align="start"
                      />
                    </section>
                  ) : null}

                  <section className="space-y-3 rounded-xl border border-vetneb-line/75 bg-vetneb-surface-raised/60 p-3">
                    <div>
                      <h4 className="text-base font-semibold text-vetneb-ink">
                        Seguimiento y modificaciones
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Las modificaciones se realizan solo sobre el token seleccionado.
                      </p>
                    </div>

                    {selectedTrackingCase ? (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <div className="surface-soft">
                          <p className="text-xs text-muted-foreground">Etapa actual</p>
                          <p className="mt-1 font-semibold text-vetneb-ink">
                            {getTrackingStageLabel(selectedTrackingCase.currentStage)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Impacta la estimación del informe. Estimación informe:{" "}
                            {formatDate(selectedTrackingCase.estimatedDeliveryAt)}
                          </p>
                        </div>

                        <label className="block">
                          <span className="field-label">Entrega en laboratorio</span>
                          <Input
                            id={`admin-tracking-lab-received-${selectedTrackingCase.id}`}
                            type="date"
                            value={selectedLabReceivedDraft}
                            onChange={(event) =>
                              handleLabReceivedDraftChange(
                                selectedTrackingCase,
                                event.target.value,
                              )
                            }
                            disabled={isSelectedTrackingUpdating}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() =>
                              void handleLabReceivedAtUpdate(
                                selectedToken.id,
                                selectedTrackingCase,
                              )
                            }
                            disabled={
                              !selectedHasLabReceivedChange ||
                              isSelectedTrackingUpdating
                            }
                          >
                            Actualizar entrega
                          </Button>
                        </label>

                        <label className="block">
                          <span className="field-label">Etapa</span>
                          <select
                            id={`admin-tracking-stage-${selectedTrackingCase.id}`}
                            className="field-select"
                            value={
                              selectedTrackingStageDraft ??
                              selectedTrackingCase.currentStage
                            }
                            onChange={(event) =>
                              handleTrackingStageDraftChange(
                                selectedTrackingCase,
                                event.target.value as AdminStudyTrackingStage,
                              )
                            }
                            disabled={isSelectedTrackingUpdating}
                          >
                            {TRACKING_STAGE_OPTIONS.map((stageOption) => (
                              <option
                                key={stageOption.value}
                                value={stageOption.value}
                              >
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
                              void handleTrackingStageUpdate(
                                selectedToken.id,
                                selectedTrackingCase,
                              )
                            }
                            disabled={
                              !selectedHasTrackingStageChange ||
                              isSelectedTrackingUpdating
                            }
                          >
                            {isSelectedTrackingUpdating
                              ? "Actualizando..."
                              : "Actualizar estado"}
                          </Button>
                        </label>

                        <div className="lg:col-span-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void handleSpecialStainChange(
                                selectedToken.id,
                                selectedTrackingCase,
                              )
                            }
                            disabled={isSelectedTrackingUpdating}
                          >
                            {selectedTrackingCase.specialStainRequired
                              ? "Resolver tinción especial"
                              : "Solicitar tinción especial"}
                          </Button>
                          <span className="inline-flex items-center text-sm text-muted-foreground">
                            {selectedTrackingCase.specialStainRequired
                              ? "Alerta: Solicitud de tinción especial"
                              : "Sin alerta de tinción especial."}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="surface-empty">
                        Sin seguimiento vinculado para este token.
                      </p>
                    )}
                  </section>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={revokingTokenId === selectedToken.id}
                      onClick={() => void handleDeleteToken(selectedToken)}
                    >
                      {revokingTokenId === selectedToken.id
                        ? "Eliminando..."
                        : "Eliminar token"}
                    </Button>
                  </div>
                </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="surface-empty m-4">
                  {isLoadingTokens
                    ? "Cargando tokens particulares..."
                    : "No hay tokens particulares administrados."}
                </p>
              )}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}