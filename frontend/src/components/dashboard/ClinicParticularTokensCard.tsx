"use client";

import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Filter } from "lucide-react";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import { DASHBOARD_PAGER_RESERVATION } from "@/components/dashboard/DashboardPager";
import {
  dashboardFilterActionClassName,
  dashboardFilterControlClassName,
  FilterBar,
  FilterField,
  type FilterBarDensity,
} from "@/components/dashboard/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
import {
  ParticularTokensEmptyPanel,
  ParticularTokensPanel,
  ParticularTokensPanelBody,
  ParticularTokensPanelFooter,
  ParticularTokensPanelHeader,
} from "@/components/dashboard/ParticularTokensCardPrimitives";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import {
  createClinicParticularToken,
  getClinicStudyTrackingCases,
  getClinicParticularTokens,
  type ClinicStudyTrackingCaseSummary,
  type ClinicParticularTokenCreatePayload,
  type ClinicParticularTokenSummary,
} from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

type ClinicParticularTokenFormState = {
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

type GeneratedTokenDetails = {
  petName: string;
  tutorLastName: string;
};

type ClinicParticularTokenFilterState = {
  token: string;
  reportId: string;
  patient: string;
  status: "" | "active" | "inactive";
  from: string;
  to: string;
};

/** Fallback tokens visible per page, used until the list body can be measured. */
const TOKENS_PAGE_SIZE = 4;

/** Row height fallback (px) before the first real row/card can be measured. */

// C6 (docs/audit/final-global-vetneb-50-60-pr-roadmap.md §4.3): rowsPerPage is
// measured adaptively (up to 50 on tall viewports) but the fetch used to stay
// fixed at a cap of ten, so the list could show fewer rows than the layout
// measured space for. The fetch now over-fetches a superset sized off
// rowsPerPage itself, capped so a very tall viewport can't ask for unbounded
// rows.
const TOKENS_FETCH_PAGE_MULTIPLIER = 3;
const TOKENS_FETCH_LIMIT_FALLBACK = 12;
const TOKENS_FETCH_LIMIT_MAX = 36;

function resolveTokensFetchLimit(rowsPerPage: number): number {
  return Math.min(
    TOKENS_FETCH_LIMIT_MAX,
    Math.max(TOKENS_FETCH_LIMIT_FALLBACK, rowsPerPage * TOKENS_FETCH_PAGE_MULTIPLIER),
  );
}

const CREATE_TOKEN_STEP_ORDER = ["contact", "patient", "sample"] as const;
type CreateTokenStep = (typeof CREATE_TOKEN_STEP_ORDER)[number];

const CREATE_TOKEN_STEP_LABELS: Record<CreateTokenStep, string> = {
  contact: "Vínculo",
  patient: "Paciente",
  sample: "Muestra",
};

const INITIAL_FORM_STATE: ClinicParticularTokenFormState = {
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

const INITIAL_FILTER_STATE: ClinicParticularTokenFilterState = {
  token: "",
  reportId: "",
  patient: "",
  status: "",
  from: "",
  to: "",
};

const REQUIRED_FIELD_LABELS: Array<{
  key: keyof Omit<
    ClinicParticularTokenFormState,
    "reportId"
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

const FORM_FIELD_STEPS: Record<keyof ClinicParticularTokenFormState, CreateTokenStep> = {
  reportId: "contact",
  particularEmail: "contact",
  tutorLastName: "contact",
  petName: "patient",
  petAge: "patient",
  petBreed: "patient",
  petSex: "patient",
  petSpecies: "patient",
  sampleLocation: "sample",
  sampleEvolution: "sample",
  detailsLesion: "sample",
  extractionDate: "sample",
  shippingDate: "sample",
};

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

function normalizeSearchText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesFilterText(
  source: string | number | null | undefined,
  query: string,
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchable = normalizeSearchText(source);
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => searchable.includes(token));
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function getTokenVisibleDate(token: ClinicParticularTokenSummary): string {
  return token.lastLoginAt ?? token.createdAt;
}

function matchesTokenVisibleDateRange(
  token: ClinicParticularTokenSummary,
  from: string,
  to: string,
) {
  const visibleDate = toDateInputValue(getTokenVisibleDate(token));
  if (from && visibleDate < from) return false;
  if (to && visibleDate > to) return false;
  return true;
}

function matchesClinicParticularTokenFilters(
  token: ClinicParticularTokenSummary,
  filters: ClinicParticularTokenFilterState,
) {
  const reportQuery = filters.reportId.replace(/^#/, "");
  const reportValue =
    token.hasLinkedReport && token.reportId
      ? String(token.reportId)
      : token.hasLinkedReport
        ? "Con informe"
        : "Sin informe";
  const statusValue = token.isActive ? "active" : "inactive";

  return (
    matchesFilterText(token.tokenLast4, filters.token) &&
    matchesFilterText(reportValue, reportQuery) &&
    (matchesFilterText(token.petName, filters.patient) ||
      matchesFilterText(token.tutorLastName, filters.patient)) &&
    (!filters.status || filters.status === statusValue) &&
    matchesTokenVisibleDateRange(token, filters.from, filters.to)
  );
}

function toIsoDate(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function normalizeText(value: string): string {
  return value.trim();
}

function buildManualTokenMessage(token: string, details: GeneratedTokenDetails): string {
  return `Hola. VETNEB informa que ya podés consultar el seguimiento/informe de ${details.petName}. Token de acceso: ${token}. Conservá este token; es personal y permite acceder a la consulta particular.`;
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

function getFirstMissingFieldStep(
  formState: ClinicParticularTokenFormState,
): CreateTokenStep | null {
  const missingField = REQUIRED_FIELD_LABELS.find(
    (field) => !String(formState[field.key]).trim(),
  );

  return missingField ? FORM_FIELD_STEPS[missingField.key] : null;
}

function buildPayload(
  formState: ClinicParticularTokenFormState,
): ClinicParticularTokenCreatePayload {
  validateFormState(formState);

  return {
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

function formatTokenSource(token: ClinicParticularTokenSummary): string {
  if (token.createdByClinicUserId) {
    return `Clínica #${token.createdByClinicUserId}`;
  }

  if (token.createdByAdminId) {
    return `Admin #${token.createdByAdminId}`;
  }

  return "Sistema";
}

const TRACKING_STAGE_LABELS: Record<ClinicStudyTrackingCaseSummary["currentStage"], string> = {
  reception: "Recepción de muestra",
  processing: "Procesamiento",
  evaluation: "Evaluación",
  report_development: "Desarrollo de informe",
  delivered: "Informe disponible / Publicado",
};

function getTrackingStageLabel(
  stage: ClinicStudyTrackingCaseSummary["currentStage"],
): string {
  return TRACKING_STAGE_LABELS[stage] ?? stage;
}

function getCreateStepIndex(step: CreateTokenStep): number {
  return CREATE_TOKEN_STEP_ORDER.indexOf(step);
}

export function ClinicParticularTokensCard() {
  // Alta in a dedicated dialog layer (audit §4): the form never grows `main`.
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateTokenStep>("contact");
  const [formState, setFormState] =
    useState<ClinicParticularTokenFormState>(INITIAL_FORM_STATE);
  const [tokens, setTokens] = useState<ClinicParticularTokenSummary[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [filterDraft, setFilterDraft] =
    useState<ClinicParticularTokenFilterState>(INITIAL_FILTER_STATE);
  const [appliedFilters, setAppliedFilters] =
    useState<ClinicParticularTokenFilterState>(INITIAL_FILTER_STATE);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [trackingCasesByTokenId, setTrackingCasesByTokenId] = useState<
    Record<number, ClinicStudyTrackingCaseSummary>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Callback-ref state (not `useRef`): these nodes sit behind the
  // `tokens.length` conditional and only mount once `loadTokens()` resolves,
  // on a render after this component's first commit. A `useRef` object's
  // identity never changes, so an effect depending on it would never re-run
  // once the node actually mounts; `useState` re-renders (and therefore
  // re-runs dependent effects) exactly when the node appears.
  const [panelBodyNode, setPanelBodyNode] = useState<HTMLDivElement | null>(null);

  // Desktop rows and mobile cards render at different heights, and the mobile
  // card wraps according to the RECORDS on screen — which is why probing them
  // made the page size depend on the active page (page 1 and page 2 measured
  // different heights, and the second came back shorter at 360x800). Both
  // grammars are now locked to their tier token, and the table head is reserved
  // by the token CSS also locks it to, so neither the rows nor the head are
  // measured and the two observers this card used to run are gone.
  const { capacity: rowsPerPage } = useDashboardCanvasCapacity({
    canvasNode: panelBodyNode,
    fallbackItems: TOKENS_PAGE_SIZE,
    minItems: 2,
  });
  const effectiveFetchLimit = resolveTokensFetchLimit(rowsPerPage);

  const filteredTokens = tokens.filter((token) =>
    matchesClinicParticularTokenFilters(token, appliedFilters),
  );
  const pagedTokens = usePagedRows(filteredTokens, rowsPerPage);
  const selectedToken =
    selectedTokenId === null
      ? null
      : (tokens.find((token) => token.id === selectedTokenId) ?? null);
  const selectedTrackingCase = selectedToken
    ? trackingCasesByTokenId[selectedToken.id]
    : undefined;

  const activeTokensCount = filteredTokens.filter((token) => token.isActive).length;
  const linkedReportsCount = filteredTokens.filter((token) => token.hasLinkedReport).length;
  const createStepIndex = getCreateStepIndex(createStep);
  const isLastCreateStep = createStep === "sample";

  async function loadTokens(limit: number) {
    setIsLoadingTokens(true);
    setTrackingLoadError(null);
    setErrorMessage(null);

    try {
      const snapshot = await getClinicParticularTokens({ limit, offset: 0 });
      const nextTokens = snapshot.particularTokens;
      setTokens(nextTokens);
      setSelectedTokenId((current) =>
        current && nextTokens.some((token) => token.id === current)
          ? current
          : null,
      );

      if (nextTokens.length === 0) {
        setTrackingCasesByTokenId({});
        return;
      }

      try {
        const trackingEntries = await Promise.all(
          nextTokens.map(async (token) => {
            const trackingSnapshot = await getClinicStudyTrackingCases({
              particularTokenId: token.id,
              limit: 1,
              offset: 0,
            });

            return [token.id, trackingSnapshot.trackingCases[0] ?? null] as const;
          }),
        );

        const nextTrackingByTokenId: Record<number, ClinicStudyTrackingCaseSummary> = {};

        for (const [tokenId, trackingCase] of trackingEntries) {
          if (trackingCase) {
            nextTrackingByTokenId[tokenId] = trackingCase;
          }
        }

        setTrackingCasesByTokenId(nextTrackingByTokenId);
      } catch (error) {
        setTrackingCasesByTokenId({});
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
    } finally {
      setIsLoadingTokens(false);
    }
  }

  // effectiveFetchLimit only changes when rowsPerPage crosses a multiplier/cap
  // boundary, so this effect reloads on mount and again whenever the adaptive
  // measurement implies a materially different superset — never on every
  // rowsPerPage tick, which is what keeps this from looping.
  useEffect(() => {
    void loadTokens(effectiveFetchLimit);
  }, [effectiveFetchLimit]);

  function updateField(
    field: keyof ClinicParticularTokenFormState,
    value: string,
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function updateFilterDraft<K extends keyof ClinicParticularTokenFilterState>(
    field: K,
    value: ClinicParticularTokenFilterState[K],
  ) {
    setFilterDraft((current) => ({ ...current, [field]: value }));
  }

  function applyAdvancedFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      token: filterDraft.token.trim(),
      reportId: filterDraft.reportId.trim(),
      patient: filterDraft.patient.trim(),
      status: filterDraft.status,
      from: filterDraft.from,
      to: filterDraft.to,
    });
    pagedTokens.setPage(0);
    setSelectedTokenId(null);
    setErrorMessage(null);
    setIsFilterDialogOpen(false);
  }

  function clearAdvancedFilters() {
    setFilterDraft(INITIAL_FILTER_STATE);
    setAppliedFilters(INITIAL_FILTER_STATE);
    pagedTokens.setPage(0);
    setSelectedTokenId(null);
    setErrorMessage(null);
    setIsFilterDialogOpen(false);
  }

  function handleCreateDialogOpenChange(open: boolean) {
    setIsCreateDialogOpen(open);
    if (!open) {
      setCreateStep("contact");
    }
  }

  function openTokenDetail(tokenId: number) {
    setSelectedTokenId(tokenId);
  }

  function goToPreviousCreateStep() {
    setCreateStep((current) => {
      const previousIndex = Math.max(0, getCreateStepIndex(current) - 1);
      return CREATE_TOKEN_STEP_ORDER[previousIndex];
    });
  }

  function goToNextCreateStep() {
    setCreateStep((current) => {
      const nextIndex = Math.min(
        CREATE_TOKEN_STEP_ORDER.length - 1,
        getCreateStepIndex(current) + 1,
      );
      return CREATE_TOKEN_STEP_ORDER[nextIndex];
    });
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
    setCreateStep("contact");
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

    if (!isLastCreateStep) {
      goToNextCreateStep();
      return;
    }

    let payload: ClinicParticularTokenCreatePayload;

    try {
      payload = buildPayload(formState);
    } catch (error) {
      const missingStep = getFirstMissingFieldStep(formState);
      if (missingStep) {
        setCreateStep(missingStep);
      } else if (formState.reportId.trim()) {
        setCreateStep("contact");
      }
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
      const response = await createClinicParticularToken(payload);

      setGeneratedToken(response.token);
      setGeneratedTokenRecipientEmail(generatedRecipientEmail || null);
      setGeneratedTokenDetails(nextGeneratedTokenDetails);
      setIsGeneratedTokenConfirmed(false);
      setCopyStatusMessage(null);
      setCopyErrorMessage(null);
      setStatusMessage(response.message);
      resetForm();
      await loadTokens(effectiveFetchLimit);
      setIsCreateDialogOpen(false);
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

  function renderAdvancedFilterForm(mobile = false) {
    const density: FilterBarDensity = mobile ? "module-card" : "compact";
    const controlClassName = dashboardFilterControlClassName(density);
    const buttonClassName = dashboardFilterActionClassName(density);

    return (
      <FilterBar
        data-clinic-access-filter-bar={mobile ? "advanced-mobile" : "advanced"}
        density={density}
        className={
          mobile
            ? "grid grid-cols-2 gap-2"
            : "mb-2 hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-[0.9fr_0.85fr_1.15fr_0.85fr_0.85fr_0.85fr_auto_auto]"
        }
        onSubmit={applyAdvancedFilters}
        aria-label={
          mobile
            ? "Filtros avanzados de tokens clínica mobile"
            : "Filtros avanzados de tokens clínica"
        }
      >
        <FilterField label="Token" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Últimos 4"
            value={filterDraft.token}
            onChange={(event) => updateFilterDraft("token", event.target.value)}
          />
        </FilterField>
        <FilterField label="Informe" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="#ID"
            value={filterDraft.reportId}
            onChange={(event) => updateFilterDraft("reportId", event.target.value)}
          />
        </FilterField>
        <FilterField label="Paciente / tutor" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Texto visible"
            value={filterDraft.patient}
            onChange={(event) => updateFilterDraft("patient", event.target.value)}
          />
        </FilterField>
        <FilterField label="Estado" density={density}>
          <Select
            className={controlClassName}
            value={filterDraft.status}
            onChange={(event) =>
              updateFilterDraft(
                "status",
                event.target.value as ClinicParticularTokenFilterState["status"],
              )
            }
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
        </FilterField>
        <FilterField label="Desde" density={density}>
          <Input
            className={controlClassName}
            type="date"
            value={filterDraft.from}
            onChange={(event) => updateFilterDraft("from", event.target.value)}
          />
        </FilterField>
        <FilterField label="Hasta" density={density}>
          <Input
            className={controlClassName}
            type="date"
            value={filterDraft.to}
            onChange={(event) => updateFilterDraft("to", event.target.value)}
          />
        </FilterField>
        <Button type="submit" size="sm" className={buttonClassName}>
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Aplicar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={buttonClassName}
          onClick={clearAdvancedFilters}
        >
          Limpiar
        </Button>
      </FilterBar>
    );
  }

  return (
    <ModuleCard
      ariaLabel="Tokens particulares de la clínica"
      dataAttributes={{
        id: "clinic-particular-tokens",
        "data-clinic-mobile-module": "tokens",
      }}
    >
          {/* CMP-10 (DIF-035) — always-rendered subtitle slot, mirroring
              AdminSessionsReadOnlyCard's header subtitle: the error/status
              text swaps in place of the default description, so the row
              never appears/disappears and nothing below it shifts.
              Below `md` only the error/status variants paint: the default
              description band is suppressed there so the toolbar owns the top
              of the card, matching the Admin mobile reference. Desktop keeps
              the always-rendered slot (and its `line-clamp-2`) untouched. */}
          <p
            className={`shrink-0 line-clamp-2 border-b border-vetneb-line/70 px-3 py-1 text-xs ${
              errorMessage
                ? "text-destructive"
                : statusMessage
                  ? "text-vetneb-teal"
                  : "text-muted-foreground max-md:hidden"
            }`}
            role={errorMessage ? "alert" : undefined}
          >
            {errorMessage ?? statusMessage ?? "Tokens particulares de la clínica."}
          </p>
          <div
            data-clinic-access-toolbar="true"
            className="flex shrink-0 items-center gap-1 border-b border-vetneb-line/70 p-1 md:flex-wrap md:justify-between md:gap-2 md:p-1.5"
          >
            {/* Second half of the removed band: the metric run is desktop-only
                below, the same `hidden md:*` grammar the mapped Admin reference
                (AdminUsersRolesReadOnlyCard) already uses for its own metrics. */}
            <ModuleMetricRun
              className="hidden md:flex"
              surfaceId="clinic-tokens"
              metrics={[
                { key: "tokens", label: "Tokens", value: tokens.length },
                { key: "activos", label: "Activos", value: activeTokensCount },
                { key: "informes", label: "Informes", value: linkedReportsCount },
              ]}
            />

            {/* Mobile: the three controls share the freed band in one row, each
                keeping its own control metrics (h-8 / px-2.5 / text-xs) and
                growing proportionally to its natural width. Desktop keeps the
                right-aligned wrapping group. */}
            <div className="flex w-full min-w-0 items-center gap-1 md:w-auto md:flex-wrap md:justify-end md:gap-2">
              <ModuleDialog
                open={isFilterDialogOpen}
                onOpenChange={setIsFilterDialogOpen}
                title="Filtrar tokens"
                description="Los filtros se aplican sobre los tokens cargados en la workspace."
                dashboardScopedPortal
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 flex-auto gap-1.5 px-2.5 text-xs md:hidden"
                  >
                    <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                    Filtros
                  </Button>
                }
              >
                {renderAdvancedFilterForm(true)}
              </ModuleDialog>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-auto px-2.5 text-xs md:flex-initial"
                onClick={() => void loadTokens(effectiveFetchLimit)}
                disabled={isLoadingTokens}
              >
                {isLoadingTokens ? "Actualizando..." : "Actualizar"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 flex-auto px-2.5 text-xs md:flex-initial"
                onClick={() => setIsCreateDialogOpen(true)}
                disabled={generatedToken !== null}
              >
                {/* One control, one handler, two labels. The mobile row needs
                    the short literal to fit three controls on one line; desktop
                    keeps the long one unchanged. The whole label is ONE flex
                    item on purpose — `Button` is `inline-flex gap-2`, so a bare
                    text node beside a span would become two items and open an
                    8px gap that desktop does not have today. */}
                <span>Generar token<span className="hidden md:inline"> particular</span></span>
              </Button>
            </div>
          </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        {tokens.length ? renderAdvancedFilterForm() : null}

        <section
          aria-label="Tokens particulares de la clínica"
          className="flex min-h-0 flex-1 flex-col"
        >
          {tokens.length ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <ParticularTokensPanel
                data-clinic-access-list-panel="true"
              >
                {/* The mapped Admin reference (AdminParticularTokensCard) mounts
                    its mobile list with NO header band at all: the list is the
                    first thing under the toolbar and the page indicator lives in
                    the pager, not above the rows. Below `md` this header follows
                    that reference — the title, the description and the `Pág. N`
                    badge stop painting and the band itself collapses, so the
                    freed vertical budget lands on the adaptive canvas instead of
                    on an empty strip. Desktop is untouched. */}
                <ParticularTokensPanelHeader className="max-md:hidden">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-vetneb-ink">
                      Últimos tokens de la clínica
                    </h3>
                    <p className="dashboard-section-description line-clamp-1">
                      Lista paginada sin scroll interno.
                    </p>
                    {trackingLoadError ? (
                      <p
                        className="line-clamp-1 text-[0.68rem] text-amber-700"
                        role="alert"
                      >
                        Seguimiento parcial: {trackingLoadError}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    Pág. {pagedTokens.page + 1}
                  </Badge>
                </ParticularTokensPanelHeader>

                {/* The alert is the one thing the retired band carried that may
                    not go with it: an error state has to stay visible in both
                    regimes. It gets its own `md:hidden` line so it costs a band
                    only while it exists, instead of keeping the whole header
                    mounted below `md` to host it. */}
                {trackingLoadError ? (
                  <p
                    className="line-clamp-1 shrink-0 border-b border-vetneb-line/70 px-3 py-1 text-[0.68rem] text-amber-700 md:hidden"
                    role="alert"
                  >
                    Seguimiento parcial: {trackingLoadError}
                  </p>
                ) : null}

                <ParticularTokensPanelBody
                  ref={setPanelBodyNode}
                  data-clinic-access-list-body="true"
                  data-dashboard-adaptive-rows-canvas="true"
            data-dashboard-row-pitch="card-below-md"
            data-dashboard-canvas-reserve="table-head"
                  className="relative"
                >
                  {filteredTokens.length ? (
                    <>
                      <div
                        data-clinic-access-table="true"
                        className="hidden min-h-0 shrink-0 overflow-hidden md:block"
                      >
                        <table className="w-full table-fixed text-[0.8125rem]">
                          <thead
                            className="border-b border-vetneb-line/65 bg-vetneb-surface-muted/65 text-xs font-semibold uppercase text-muted-foreground"
                          >
                            <tr>
                              <th className="w-[32%] px-3 py-2 text-left">Token / Paciente</th>
                              <th className="w-[13%] px-3 py-2 text-left">Estado</th>
                              <th className="w-[15%] px-3 py-2 text-left">Informe</th>
                              <th className="w-[24%] px-3 py-2 text-left">
                                Último acceso o creado
                              </th>
                              <th className="w-[16%] px-3 py-2 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-vetneb-line/60">
                            {pagedTokens.pageItems.map((token, index) => (
                              <tr
                                key={token.id}
                                data-clinic-access-table-row="true"
                                className="hover:bg-vetneb-cyan/8"
                              >
                                <td className="px-3 py-1.5">
                                  <p className="truncate font-mono text-xs font-semibold text-vetneb-ink">
                                    ****{token.tokenLast4}
                                  </p>
                                  <p className="truncate text-[0.6875rem] text-muted-foreground">
                                    {token.petName} · {token.tutorLastName}
                                  </p>
                                </td>
                                <td className="px-3 py-1.5">
                                  <Badge
                                    variant={token.isActive ? "default" : "outline"}
                                    className="h-5 px-1.5 text-[0.6875rem]"
                                  >
                                    {token.isActive ? "Activo" : "Inactivo"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-1.5 text-xs text-muted-foreground">
                                  {token.hasLinkedReport && token.reportId
                                    ? `#${token.reportId}`
                                    : token.hasLinkedReport
                                      ? "Con informe"
                                      : "Sin informe"}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-muted-foreground">
                                  {token.lastLoginAt
                                    ? `Acceso ${formatDate(token.lastLoginAt)}`
                                    : `Creado ${formatDate(token.createdAt)}`}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => openTokenDetail(token.id)}
                                  >
                                    Ver detalle
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div
                        data-clinic-access-mobile-list="true"
                        className="flex min-h-0 shrink-0 flex-col divide-y divide-vetneb-line/60 overflow-hidden md:hidden"
                      >
                        {pagedTokens.pageItems.map((token, index) => {
                          const trackingCase = trackingCasesByTokenId[token.id];

                          return (
                            <div
                              key={token.id}
                              id={`clinic-particular-token-${token.id}`}
                              data-clinic-access-mobile-row="true"
                  data-dashboard-adaptive-row="true"
                              className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-vetneb-ink">
                                  ****{token.tokenLast4} · {token.petName}
                                </p>
                                <p className="truncate text-[0.6875rem] text-muted-foreground">
                                  {token.isActive ? "Activo" : "Inactivo"} ·{" "}
                                  {token.hasLinkedReport ? "Informe" : "Sin informe"} ·{" "}
                                  {token.lastLoginAt
                                    ? formatDate(token.lastLoginAt)
                                    : formatDate(token.createdAt)}
                                </p>
                                <p className="truncate text-[0.6875rem] text-muted-foreground">
                                  {trackingCase
                                    ? getTrackingStageLabel(trackingCase.currentStage)
                                    : token.tutorLastName}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => openTokenDetail(token.id)}
                              >
                                Ver detalle
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-0 flex-1 p-3">
                      <EmptyState
                        title="Sin tokens para los filtros aplicados"
                        description="No hay tokens particulares que coincidan con los campos visibles seleccionados."
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  )}

                  <div
                    aria-hidden="true"
                    data-clinic-access-future-slots="true"
                  />
                </ParticularTokensPanelBody>

                <ParticularTokensPanelFooter
                  className="min-h-0 justify-center overflow-hidden py-0 md:justify-end"
                  style={DASHBOARD_PAGER_RESERVATION}
                  data-clinic-access-pagination-footer="true"
                  data-dashboard-adaptive-reserved-region="pager"
                >
                  <div
                    data-clinic-access-pagination-controls="true"
                    className="flex items-center justify-center gap-1.5 md:justify-end"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={!pagedTokens.hasPrev || isLoadingTokens}
                      onClick={() => {
                        setSelectedTokenId(null);
                        pagedTokens.goPrev();
                      }}
                      aria-label="Página anterior"
                    >
                      Anterior
                    </Button>
                    <span
                      data-clinic-access-pagination-status="true"
                      className="min-w-16 text-center"
                    >
                      Página {pagedTokens.page + 1} / {pagedTokens.pageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={!pagedTokens.hasNext || isLoadingTokens}
                      onClick={() => {
                        setSelectedTokenId(null);
                        pagedTokens.goNext();
                      }}
                      aria-label="Página siguiente"
                    >
                      Siguiente
                    </Button>
                  </div>
                </ParticularTokensPanelFooter>
              </ParticularTokensPanel>
            </div>
          ) : (
            <ParticularTokensEmptyPanel>
              <EmptyState
                title={
                  isLoadingTokens
                    ? "Cargando tokens particulares..."
                    : "Sin tokens particulares"
                }
                description={
                  isLoadingTokens
                    ? "Consultando los últimos tokens generados por la clínica."
                    : "No hay tokens particulares generados por esta clínica."
                }
                size="sm"
                className="w-full"
              />
            </ParticularTokensEmptyPanel>
          )}
        </section>
      </div>

      <ModuleDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        busy={isSubmitting}
        title="Generar token particular"
        description={`Paso ${createStepIndex + 1} de ${CREATE_TOKEN_STEP_ORDER.length}: ${CREATE_TOKEN_STEP_LABELS[createStep]}`}
      >
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={handleSubmit}
          autoComplete="off"
        >
          <div className="flex shrink-0 flex-wrap gap-2" aria-label="Pasos del alta de token">
            {CREATE_TOKEN_STEP_ORDER.map((step, index) => (
              <button
                key={step}
                type="button"
                onClick={() => setCreateStep(step)}
                className={cn(
                  "clinical-pill px-3 py-1 text-[0.68rem] tracking-normal",
                  step === createStep && "border-vetneb-teal bg-vetneb-teal/15",
                )}
                aria-current={step === createStep ? "step" : undefined}
              >
                {index + 1}. {CREATE_TOKEN_STEP_LABELS[step]}
              </button>
            ))}
          </div>

          <div className="min-h-0">
            {createStep === "contact" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="clinic-token-report-id" className="field-label">
                  ID informe vinculado
                </label>
                <Input
                  id="clinic-token-report-id"
                  name="reportId"
                  type="number"
                  autoComplete="off"
                  min="1"
                  inputMode="numeric"
                  placeholder="Opcional"
                  value={formState.reportId}
                  onChange={(event) => updateField("reportId", event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="clinic-token-particular-email" className="field-label">
                  Email del particular
                </label>
                <Input
                  id="clinic-token-particular-email"
                  name="particularEmail"
                  type="email"
                  autoComplete="off"
                  placeholder="email@ejemplo.com"
                  required
                  value={formState.particularEmail}
                  onChange={(event) =>
                    updateField("particularEmail", event.target.value)
                  }
                  disabled={isSubmitting}
                  aria-describedby="clinic-token-particular-email-help"
                />
                <p
                  id="clinic-token-particular-email-help"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  Obligatorio. El backend enviará el token a este email usando la
                  configuración de correo de VETNEB.
                </p>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="clinic-token-tutor-last-name" className="field-label">
                  Apellido del tutor
                </label>
                <Input
                  id="clinic-token-tutor-last-name"
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
            </div>
            ) : null}

            {createStep === "patient" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="clinic-token-pet-name" className="field-label">
                  Nombre del paciente
                </label>
                <Input
                  id="clinic-token-pet-name"
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
                <label htmlFor="clinic-token-pet-age" className="field-label">
                  Edad
                </label>
                <Input
                  id="clinic-token-pet-age"
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
                <label htmlFor="clinic-token-pet-breed" className="field-label">
                  Raza
                </label>
                <Input
                  id="clinic-token-pet-breed"
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
            </div>
            ) : null}

            {createStep === "sample" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="clinic-token-sample-location" className="field-label">
                  Ubicación de la muestra
                </label>
                <Input
                  id="clinic-token-sample-location"
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
                <label htmlFor="clinic-token-sample-evolution" className="field-label">
                  Evolución
                </label>
                <Input
                  id="clinic-token-sample-evolution"
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
                <label htmlFor="clinic-token-extraction-date" className="field-label">
                  Fecha de extracción
                </label>
                <Input
                  id="clinic-token-extraction-date"
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
                <label htmlFor="clinic-token-shipping-date" className="field-label">
                  Fecha de envío
                </label>
                <Input
                  id="clinic-token-shipping-date"
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

              <div className="md:col-span-2">
                <label htmlFor="clinic-token-details-lesion" className="field-label">
                  Detalle de lesión
                </label>
                <textarea
                  id="clinic-token-details-lesion"
                  name="detailsLesion"
                  className="field-textarea"
                  autoComplete="off"
                  required
                  value={formState.detailsLesion}
                  onChange={(event) =>
                    updateField("detailsLesion", event.target.value)
                  }
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>
            </div>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="clinical-alert-error px-3 py-2 text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-vetneb-line/70 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCreateDialogOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <div className="flex flex-wrap gap-2">
              {createStepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousCreateStep}
                  disabled={isSubmitting}
                >
                  Anterior
                </Button>
              ) : null}
              {isLastCreateStep ? (
                <Button type="submit" disabled={isSubmitting || generatedToken !== null}>
                  {isSubmitting ? "Generando token..." : "Generar token particular"}
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  Siguiente
                </Button>
              )}
            </div>
          </div>
        </form>
      </ModuleDialog>

      <ModuleDialog
        open={generatedToken !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseGeneratedToken();
          }
        }}
        busy={!isGeneratedTokenConfirmed}
        title="Token generado"
        description="Copiar ahora. El token completo solo se muestra una vez."
      >
        <div className="flex min-h-0 flex-col gap-3">
          <Input
            className="font-mono text-sm"
            readOnly
            value={generatedToken ?? ""}
            aria-label="Token particular generado"
          />
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
          <div className="flex justify-end border-t border-vetneb-line/70 pt-3">
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
        </div>
      </ModuleDialog>

      {selectedToken ? (
        <ModuleDialog
          open={selectedToken !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTokenId(null);
            }
          }}
          title={`Token ****${selectedToken.tokenLast4}`}
          description={`${selectedToken.petName} · ${selectedToken.tutorLastName}`}
          scrollableBody
        >
          <div
            data-clinic-access-detail-dialog="true"
            className="flex min-h-0 flex-col gap-3 text-xs"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={selectedToken.isActive ? "default" : "outline"}
                className="h-5 px-1.5 text-[0.6875rem]"
              >
                {selectedToken.isActive ? "Activo" : "Inactivo"}
              </Badge>
              <Badge
                variant={selectedToken.hasLinkedReport ? "default" : "outline"}
                className="h-5 px-1.5 text-[0.6875rem]"
              >
                {selectedToken.hasLinkedReport ? "Informe vinculado" : "Sin informe"}
              </Badge>
            </div>

            <dl className="grid grid-cols-1 divide-y divide-vetneb-line/55 rounded-lg border border-vetneb-line/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="min-w-0 space-y-1 p-2.5">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  Paciente
                </dt>
                <dd className="dashboard-detail-value font-medium text-vetneb-ink">
                  {selectedToken.petName} · {selectedToken.tutorLastName}
                </dd>
                <dd className="dashboard-detail-value text-muted-foreground">
                  {selectedToken.petSpecies} · {selectedToken.petBreed} ·{" "}
                  {selectedToken.petSex} · {selectedToken.petAge}
                </dd>
              </div>
              <div className="min-w-0 space-y-1 p-2.5">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  Vínculo
                </dt>
                <dd className="dashboard-detail-value font-medium text-vetneb-ink">
                  Tutor: {selectedToken.tutorLastName}
                </dd>
                <dd className="dashboard-detail-value text-muted-foreground">
                  Origen: {formatTokenSource(selectedToken)}
                </dd>
              </div>
            </dl>

            <dl className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">Muestra</dt>
                <dd className="dashboard-detail-value text-vetneb-ink">
                  {selectedToken.sampleLocation}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">Evolución</dt>
                <dd className="dashboard-detail-value text-vetneb-ink">
                  {selectedToken.sampleEvolution}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  Extracción
                </dt>
                <dd className="dashboard-detail-value">
                  {formatDate(selectedToken.extractionDate)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">Envío</dt>
                <dd className="dashboard-detail-value">
                  {formatDate(selectedToken.shippingDate)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  Informe
                </dt>
                <dd className="dashboard-detail-value">
                  {selectedToken.reportId ? `#${selectedToken.reportId}` : "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">
                  Último acceso
                </dt>
                <dd className="dashboard-detail-value">
                  {selectedToken.lastLoginAt
                    ? formatDate(selectedToken.lastLoginAt)
                    : "—"}
                </dd>
              </div>
            </dl>

            {selectedToken.detailsLesion ? (
              <div className="min-w-0 rounded-lg border border-vetneb-line/65 px-2.5 py-2">
                <p className="text-[0.6875rem] text-muted-foreground">
                  Detalle de lesión
                </p>
                <p className="dashboard-detail-value text-vetneb-ink">
                  {selectedToken.detailsLesion}
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-vetneb-line/65 px-2.5 py-2">
              <p className="text-[0.6875rem] text-muted-foreground">
                Seguimiento
              </p>
              {selectedTrackingCase ? (
                <>
                  <p className="mt-1 font-medium text-vetneb-ink">
                    {getTrackingStageLabel(selectedTrackingCase.currentStage)}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {selectedTrackingCase.specialStainRequired
                      ? "Alerta: Solicitud de tinción especial"
                      : "Sin alerta de tinción especial"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Sin seguimiento vinculado.
                </p>
              )}
            </div>
          </div>
        </ModuleDialog>
      ) : null}
    </ModuleCard>
  );
}
