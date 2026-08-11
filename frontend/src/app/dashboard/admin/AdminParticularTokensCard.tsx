"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Filter } from "lucide-react";
import {
  dashboardFilterActionClassName,
  dashboardFilterControlClassName,
  FilterBar,
  FilterField,
  type FilterBarDensity,
} from "@/components/dashboard/FilterBar";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import {
  ParticularTokensMetricStrip,
  ParticularTokensMobileList,
} from "@/components/dashboard/ParticularTokensCardPrimitives";
import { ReportFileActions } from "@/components/dashboard/ReportDownloadButton";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdaptiveItemsPerPage } from "@/hooks/useAdaptiveItemsPerPage";
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

type AdminParticularTokenFilterState = {
  token: string;
  clinic: string;
  reportId: string;
  patient: string;
  status: "" | "active" | "inactive";
  from: string;
  to: string;
};

const CREATE_STEP_ORDER = ["clinic", "patient", "sample"] as const;
type CreateStep = (typeof CREATE_STEP_ORDER)[number];
type DetailTab = "summary" | "tracking";

const CREATE_STEP_LABELS: Record<CreateStep, string> = {
  clinic: "Vínculo",
  patient: "Paciente",
  sample: "Muestra",
};

// The endpoint exposes no `total`: fetch a bounded initial window, paginate it
// client-side with usePagedRows, and offer "Cargar más" when the last fetched
// batch was full. The initial window covers two complete pages at the largest
// adaptive cardinality observed across the 13 canonical A02 viewports.
const TOKENS_FALLBACK_ROWS = 9;
const TOKENS_MAX_OBSERVED_ADAPTIVE_ROWS = 17;
const TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE =
  TOKENS_MAX_OBSERVED_ADAPTIVE_ROWS * 2;
// Preserve the established adaptive clamp and explicit incremental batch.
// They are deliberately separate from the initial two-page window.
const TOKENS_ADAPTIVE_MAX_ROWS = 30;
const TOKENS_LOAD_MORE_BATCH_SIZE = 30;
// Fixed header row height of the desktop table (`[&_th]:h-7`), discounted from
// the measured region so the row math never counts the header as a data row.
const TOKENS_TABLE_HEADER_PX = 28;
// Fallback item height used until a real row is measured.
const TOKENS_ROW_HEIGHT_FALLBACK_PX = 36;

type Measurement = {
  containerNode: HTMLElement | null;
  rowHeightPx: number;
  headerHeightPx: number;
};

function measurementsEqual(a: Measurement, b: Measurement) {
  return (
    a.containerNode === b.containerNode &&
    a.rowHeightPx === b.rowHeightPx &&
    a.headerHeightPx === b.headerHeightPx
  );
}

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

const INITIAL_FILTER_STATE: AdminParticularTokenFilterState = {
  token: "",
  clinic: "",
  reportId: "",
  patient: "",
  status: "",
  from: "",
  to: "",
};

const REQUIRED_FIELD_LABELS: Array<{
  key: keyof Omit<AdminParticularTokenFormState, "clinicId" | "reportId">;
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

const FORM_FIELD_STEPS: Record<keyof AdminParticularTokenFormState, CreateStep> = {
  clinicId: "clinic",
  reportId: "clinic",
  particularEmail: "clinic",
  tutorLastName: "patient",
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

  if (!normalizedQuery) return true;

  const searchable = buildClinicSearchText(option);
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => searchable.includes(token));
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
      byId.set(option.id, { ...option, usernames: [...option.usernames] });
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
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function matchesFilterText(
  source: string | number | null | undefined,
  query: string,
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return normalizeSearchText(source ?? "").includes(normalizedQuery);
}

function isFilterStateEmpty(filters: AdminParticularTokenFilterState) {
  return Object.values(filters).every((value) => !value.trim());
}

function matchesCreatedAtRange(
  token: AdminParticularTokenSummary,
  from: string,
  to: string,
) {
  const createdAt = toDateInputValue(token.createdAt);
  if (from && createdAt < from) return false;
  if (to && createdAt > to) return false;
  return true;
}

function matchesAdminParticularTokenFilters(
  token: AdminParticularTokenSummary,
  filters: AdminParticularTokenFilterState,
  clinicOptions: ClinicOption[],
) {
  const clinicName =
    resolveClinicName(clinicOptions, token.clinicId) ?? `Clínica #${token.clinicId}`;
  const reportQuery = filters.reportId.replace(/^#/, "");
  const reportValue = token.reportId ? String(token.reportId) : "Sin vínculo";
  const statusValue = token.isActive ? "active" : "inactive";

  return (
    matchesFilterText(token.tokenLast4, filters.token) &&
    (matchesFilterText(clinicName, filters.clinic) ||
      matchesFilterText(token.clinicId, filters.clinic)) &&
    matchesFilterText(reportValue, reportQuery) &&
    (matchesFilterText(token.petName, filters.patient) ||
      matchesFilterText(token.tutorLastName, filters.patient)) &&
    (!filters.status || filters.status === statusValue) &&
    matchesCreatedAtRange(token, filters.from, filters.to)
  );
}

function toIsoDateFromInput(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function normalizeText(value: string): string {
  return value.trim();
}

function buildManualTokenMessage(
  token: string,
  details: GeneratedTokenDetails,
): string {
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
  return normalizedValue
    ? parsePositiveInteger(normalizedValue, "El ID de informe")
    : null;
}

function validateFormState(formState: AdminParticularTokenFormState): void {
  const missingField = REQUIRED_FIELD_LABELS.find(
    (field) => !String(formState[field.key]).trim(),
  );
  if (missingField) {
    throw new Error(`Complete el campo obligatorio: ${missingField.label}.`);
  }
}

function getFirstMissingFieldStep(
  formState: AdminParticularTokenFormState,
): CreateStep | null {
  if (!formState.clinicId) return "clinic";
  const missingField = REQUIRED_FIELD_LABELS.find(
    (field) => !String(formState[field.key]).trim(),
  );
  return missingField ? FORM_FIELD_STEPS[missingField.key] : null;
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
  if (token.createdByAdminId) return `Admin #${token.createdByAdminId}`;
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

function getCreateStepIndex(step: CreateStep): number {
  return CREATE_STEP_ORDER.indexOf(step);
}

export function AdminParticularTokensCard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>("clinic");
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [filterDraft, setFilterDraft] =
    useState<AdminParticularTokenFilterState>(INITIAL_FILTER_STATE);
  const [appliedFilters, setAppliedFilters] =
    useState<AdminParticularTokenFilterState>(INITIAL_FILTER_STATE);
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
  const [trackingLoadedTokenIds, setTrackingLoadedTokenIds] = useState<
    Record<number, boolean>
  >({});
  const [trackingLoadError, setTrackingLoadError] = useState<string | null>(null);
  const [trackingLoadingTokenId, setTrackingLoadingTokenId] = useState<
    number | null
  >(null);
  const [trackingRetryNonce, setTrackingRetryNonce] = useState(0);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedTokenRecipientEmail, setGeneratedTokenRecipientEmail] =
    useState<string | null>(null);
  const [generatedTokenDetails, setGeneratedTokenDetails] =
    useState<GeneratedTokenDetails | null>(null);
  const [isGeneratedTokenConfirmed, setIsGeneratedTokenConfirmed] =
    useState(false);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(null);
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
  // The server exposes no `total` for this endpoint (R-04): hasMoreFromServer
  // is a requested-batch-full heuristic driving the explicit "Cargar más"
  // affordance instead of a real page count.
  const [hasMoreFromServer, setHasMoreFromServer] = useState(false);
  const [isLoadingMoreTokens, setIsLoadingMoreTokens] = useState(false);
  const latestRequestRef = useRef(0);

  // One collapsed runtime feeds both presentations, so the visible container
  // (desktop table region or mobile list region) drives a single cardinality.
  // The old second fetch pipeline (a fixed mobile row count gated by a media
  // query) is gone: no more double fetch, no more divergent limit/offset.
  const [desktopBodyNode, setDesktopBodyNode] = useState<HTMLElement | null>(
    null,
  );
  const [mobileBodyNode, setMobileBodyNode] = useState<HTMLElement | null>(null);
  const [desktopRowNode, setDesktopRowNode] = useState<HTMLElement | null>(null);
  const [mobileRowNode, setMobileRowNode] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState<Measurement>({
    containerNode: null,
    rowHeightPx: TOKENS_ROW_HEIGHT_FALLBACK_PX,
    headerHeightPx: 0,
  });

  useLayoutEffect(() => {
    const nodes = [
      desktopBodyNode,
      mobileBodyNode,
      desktopRowNode,
      mobileRowNode,
    ].filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) {
      return;
    }

    let frame: number | null = null;

    const recompute = () => {
      frame = null;

      const mobileHeight = mobileBodyNode?.getBoundingClientRect().height ?? 0;
      if (mobileHeight > 0 && mobileBodyNode) {
        const rowHeight = mobileRowNode?.getBoundingClientRect().height ?? 0;
        setMeasurement((previous) => {
          const next: Measurement = {
            containerNode: mobileBodyNode,
            rowHeightPx:
              rowHeight > 0 ? rowHeight : TOKENS_ROW_HEIGHT_FALLBACK_PX,
            headerHeightPx: 0,
          };
          return measurementsEqual(previous, next) ? previous : next;
        });
        return;
      }

      const desktopHeight = desktopBodyNode?.getBoundingClientRect().height ?? 0;
      if (desktopHeight > 0 && desktopBodyNode) {
        const rowHeight = desktopRowNode?.getBoundingClientRect().height ?? 0;
        setMeasurement((previous) => {
          const next: Measurement = {
            containerNode: desktopBodyNode,
            rowHeightPx:
              rowHeight > 0 ? rowHeight : TOKENS_ROW_HEIGHT_FALLBACK_PX,
            headerHeightPx: TOKENS_TABLE_HEADER_PX,
          };
          return measurementsEqual(previous, next) ? previous : next;
        });
      }
    };

    const scheduleRecompute = () => {
      if (frame === null) {
        frame = requestAnimationFrame(recompute);
      }
    };

    const observer = new ResizeObserver(scheduleRecompute);
    nodes.forEach((node) => observer.observe(node));
    scheduleRecompute();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [desktopBodyNode, mobileBodyNode, desktopRowNode, mobileRowNode]);

  // The desktop table is pinned to nine populated rows at the shortest
  // supported desktop viewport (1366×768) by the App Shell contract
  // (`expectNinePopulatedRows`). The desktop context (detected by the
  // discounted table header) keeps a floor of nine — matching the
  // pre-adaptive fixed page size — while still adapting upward on taller
  // viewports. The mobile list (no table header) keeps a floor of one so it
  // can shrink freely on short phones. Same exception as Reports/Users-Roles.
  const isDesktopMeasurement = measurement.headerHeightPx > 0;
  const { itemsPerPage: rowsPerPage } = useAdaptiveItemsPerPage({
    containerNode: measurement.containerNode,
    fallbackItems: TOKENS_FALLBACK_ROWS,
    itemHeightPx: measurement.rowHeightPx,
    headerHeightPx: measurement.headerHeightPx,
    minItems: isDesktopMeasurement ? TOKENS_FALLBACK_ROWS : 1,
    maxItems: TOKENS_ADAPTIVE_MAX_ROWS,
  });

  const selectedClinic = clinicOptions.find(
    (option) => String(option.id) === formState.clinicId,
  );
  const hasClinicQuery = normalizeSearchText(clinicSearch).length > 0;
  const filteredClinicOptions = hasClinicQuery
    ? clinicOptions
        .filter((option) => matchClinicOption(option, clinicSearch))
        .slice(0, 4)
    : selectedClinic
      ? [selectedClinic]
      : [];
  const selectedToken =
    selectedTokenId === null
      ? null
      : (tokens.find((token) => token.id === selectedTokenId) ?? null);
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
  const hasActiveFilters = !isFilterStateEmpty(appliedFilters);
  const filteredTokens = tokens.filter((token) =>
    matchesAdminParticularTokenFilters(token, appliedFilters, clinicOptions),
  );
  const pagedTokens = usePagedRows(filteredTokens, rowsPerPage);
  const visibleTokens = pagedTokens.pageItems;
  const activeTokensCount = visibleTokens.filter((token) => token.isActive).length;
  const linkedReportsCount = visibleTokens.filter(
    (token) => token.hasLinkedReport,
  ).length;
  const createStepIndex = getCreateStepIndex(createStep);
  const isLastCreateStep = createStep === "sample";

  // The initial bounded window has no `total` clamp (R-04), so pagination is
  // client-side and "Cargar más" only re-fetches at the loaded edge.
  const loadTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    setErrorMessage(null);
    const requestId = ++latestRequestRef.current;

    try {
      const snapshot = await getAdminParticularTokens({
        limit: TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE,
        offset: 0,
      });
      if (requestId !== latestRequestRef.current) return;
      setTokens(snapshot.particularTokens);
      setHasMoreFromServer(
        snapshot.particularTokens.length ===
          TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE,
      );
      setSelectedTokenId((current) =>
        current && snapshot.particularTokens.some((token) => token.id === current)
          ? current
          : null,
      );
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      setTokens([]);
      setHasMoreFromServer(false);
      setSelectedTokenId(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los tokens particulares.",
      );
    } finally {
      if (requestId === latestRequestRef.current) setIsLoadingTokens(false);
    }
  }, []);

  const loadMoreTokens = useCallback(async () => {
    if (isLoadingMoreTokens || !hasMoreFromServer) return;
    setIsLoadingMoreTokens(true);
    setErrorMessage(null);
    const requestId = ++latestRequestRef.current;

    try {
      const snapshot = await getAdminParticularTokens({
        limit: TOKENS_LOAD_MORE_BATCH_SIZE,
        offset: tokens.length,
      });
      if (requestId !== latestRequestRef.current) return;
      setTokens((current) => [...current, ...snapshot.particularTokens]);
      setHasMoreFromServer(
        snapshot.particularTokens.length === TOKENS_LOAD_MORE_BATCH_SIZE,
      );
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar más tokens particulares.",
      );
    } finally {
      if (requestId === latestRequestRef.current) setIsLoadingMoreTokens(false);
    }
  }, [isLoadingMoreTokens, hasMoreFromServer, tokens.length]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  // The clinic catalogue resolves visible names in the list and powers the
  // advanced clinic filter without changing the tokens API contract.
  useEffect(() => {
    if (clinicOptions.length > 0) return;

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
            if (user.userType !== "clinic") continue;
            options.push({
              id: user.clinicId,
              name: user.clinicName?.trim() || `Clínica #${user.clinicId}`,
              hasResolvedName: Boolean(user.clinicName?.trim()),
              usernames: [user.username],
              locality: user.clinicLocality ?? null,
            });
          }

          offset += snapshot.users.length;
          if (snapshot.users.length === 0) break;
        }

        if (!cancelled) setClinicOptions(dedupeClinicOptions(options));
      } catch (error) {
        if (!cancelled) {
          setClinicLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las clínicas registradas.",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingClinics(false);
      }
    }

    void loadClinicOptions();
    return () => {
      cancelled = true;
    };
  }, [clinicOptions.length]);

  // No batch endpoint exists for tracking. Load exactly one case when the
  // operator opens a token, cache it, and never issue one request per table row.
  useEffect(() => {
    if (
      !isDetailDialogOpen ||
      !selectedTokenId ||
      trackingLoadedTokenIds[selectedTokenId]
    ) {
      return;
    }

    const tokenId = selectedTokenId;
    let cancelled = false;
    async function loadSelectedTracking() {
      setTrackingLoadingTokenId(tokenId);
      setTrackingLoadError(null);

      try {
        const trackingSnapshot = await getAdminStudyTrackingCases({
          particularTokenId: tokenId,
          limit: 1,
          offset: 0,
        });
        const trackingCase = trackingSnapshot.trackingCases[0] ?? null;
        if (cancelled) return;

        if (trackingCase) {
          setTrackingCasesByTokenId((current) => ({
            ...current,
            [tokenId]: trackingCase,
          }));
          setTrackingStageDraftsByCaseId((current) => ({
            ...current,
            [trackingCase.id]: trackingCase.currentStage,
          }));
          setLabReceivedDraftsByCaseId((current) => ({
            ...current,
            [trackingCase.id]: toDateInputValue(
              getTrackingLabReceivedAt(trackingCase),
            ),
          }));
        }
        setTrackingLoadedTokenIds((current) => ({
          ...current,
          [tokenId]: true,
        }));
      } catch (error) {
        if (!cancelled) {
          setTrackingLoadError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el seguimiento del token seleccionado.",
          );
        }
      } finally {
        if (!cancelled) setTrackingLoadingTokenId(null);
      }
    }

    void loadSelectedTracking();
    return () => {
      cancelled = true;
    };
  }, [
    isDetailDialogOpen,
    selectedTokenId,
    trackingLoadedTokenIds,
    trackingRetryNonce,
  ]);

  function updateField(
    field: keyof AdminParticularTokenFormState,
    value: string,
  ) {
    setFormState((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function handleCreateDialogOpenChange(open: boolean) {
    setIsCreateDialogOpen(open);
    setErrorMessage(null);
    if (!open) setCreateStep("clinic");
  }

  function goToPreviousCreateStep() {
    setCreateStep((current) =>
      CREATE_STEP_ORDER[Math.max(0, getCreateStepIndex(current) - 1)],
    );
  }

  function goToNextCreateStep() {
    setCreateStep((current) =>
      CREATE_STEP_ORDER[
        Math.min(CREATE_STEP_ORDER.length - 1, getCreateStepIndex(current) + 1)
      ],
    );
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
    if (!generatedToken || !generatedTokenDetails) return;
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
    if (isGeneratedTokenConfirmed) clearGeneratedTokenState();
  }

  function resetForm() {
    setFormState(INITIAL_FORM_STATE);
    setClinicSearch("");
    setCreateStep("clinic");
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

  function updateFilterDraft<K extends keyof AdminParticularTokenFilterState>(
    field: K,
    value: AdminParticularTokenFilterState[K],
  ) {
    setFilterDraft((current) => ({ ...current, [field]: value }));
    setErrorMessage(null);
  }

  function applyAdvancedFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      token: filterDraft.token.trim(),
      clinic: filterDraft.clinic.trim(),
      reportId: filterDraft.reportId.trim(),
      patient: filterDraft.patient.trim(),
      status: filterDraft.status,
      from: filterDraft.from,
      to: filterDraft.to,
    });
    pagedTokens.setPage(0);
    setErrorMessage(null);
  }

  function clearAdvancedFilters() {
    setFilterDraft(INITIAL_FILTER_STATE);
    setAppliedFilters(INITIAL_FILTER_STATE);
    pagedTokens.setPage(0);
    setErrorMessage(null);
  }

  function renderAdvancedFilterForm(mobile = false) {
    const density: FilterBarDensity = mobile ? "comfortable" : "compact";
    const controlClassName = dashboardFilterControlClassName(density);
    const buttonClassName = dashboardFilterActionClassName(density);

    return (
      <FilterBar
        data-admin-filter-bar={mobile ? "advanced-mobile" : "advanced"}
        density={density}
        className={
          mobile
            ? "grid grid-cols-2 gap-2"
            : "hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-[1.05fr_1.25fr_0.8fr_1fr_0.8fr_0.85fr_0.85fr_auto_auto] lg:px-2"
        }
        onSubmit={applyAdvancedFilters}
        aria-label={
          mobile
            ? "Filtros avanzados de tokens particulares mobile"
            : "Filtros avanzados de tokens particulares"
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
        <FilterField label="Clínica" density={density}>
          <Input
            className={controlClassName}
            type="text"
            placeholder="Nombre o ID"
            value={filterDraft.clinic}
            onChange={(event) => updateFilterDraft("clinic", event.target.value)}
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
                event.target.value as AdminParticularTokenFilterState["status"],
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
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" size="sm" className={buttonClassName} onClick={clearAdvancedFilters}>
              Limpiar
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={buttonClassName}
            onClick={() => void loadTokens()}
            disabled={isLoadingTokens}
          >
            {isLoadingTokens ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
      </FilterBar>
    );
  }

  function openTokenDetail(token: AdminParticularTokenSummary) {
    setSelectedTokenId(token.id);
    setDetailTab("summary");
    setTrackingLoadError(null);
    setIsDetailDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

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

    let payload: AdminParticularTokenCreatePayload;
    try {
      payload = buildPayload(formState, selectedClinic);
    } catch (error) {
      setCreateStep(getFirstMissingFieldStep(formState) ?? "clinic");
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
      pagedTokens.setPage(0);
      await loadTokens();
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

  async function handleDeleteToken(token: AdminParticularTokenSummary) {
    if (revokingTokenId !== null) return;
    const confirmed = window.confirm(
      `¿Eliminar permanentemente el token ****${token.tokenLast4} de ${token.petName}? Esta acción no se puede deshacer y eliminará el token del servidor.`,
    );
    if (!confirmed) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setRevokingTokenId(token.id);

    try {
      const response = await deleteAdminParticularToken(token.id);
      setStatusMessage(response.message);
      setIsDetailDialogOpen(false);
      setSelectedTokenId(null);
      setTrackingCasesByTokenId((current) => {
        const next = { ...current };
        delete next[token.id];
        return next;
      });
      setTrackingLoadedTokenIds((current) => {
        const next = { ...current };
        delete next[token.id];
        return next;
      });
      await loadTokens();
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
    if (!nextLabReceivedAt || nextLabReceivedAt === currentLabReceivedAt) return;

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
    if (trackingCase.currentStage === nextStage) return;

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
      <CardHeader className="hidden shrink-0 border-b border-vetneb-line/70 px-4 py-3 md:flex md:py-2">
        <div className="flex flex-col gap-2 md:gap-1 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-xl md:text-base">Tokens particulares</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Accesos sensibles, trazabilidad bajo demanda y acciones controladas.
            </p>
          </div>
          <ParticularTokensMetricStrip
            metrics={[
              { label: "En página", value: visibleTokens.length },
              { label: "Activos", value: activeTokensCount },
              { label: "Con informe", value: linkedReportsCount },
              { label: "Página", value: pagedTokens.page + 1 },
            ]}
            className="flex min-h-10 items-center rounded-lg md:min-h-8"
            itemClassName="min-w-[4.5rem] px-3 py-1 text-center md:px-2 md:py-0.5"
            valueClassName="text-xl leading-5 md:text-base md:leading-4"
          />
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 py-2 md:gap-1.5 md:py-2">
        <div
          data-admin-particulars-toolbar="true"
          className="flex min-h-9 shrink-0 flex-col gap-1.5 rounded-lg border border-vetneb-line/70 bg-card/80 px-2 py-1 md:min-h-8 md:flex-row md:items-center md:justify-between md:py-0.5"
        >
          <div
            role="tablist"
            aria-label="Secciones de tokens particulares"
            className="flex flex-wrap items-center gap-1"
          >
            <Button
              type="button"
              size="sm"
              role="tab"
              aria-selected={!isCreateDialogOpen}
              className="h-8 px-2 text-xs"
            >
              Tokens administrados
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={isCreateDialogOpen}
              className="h-8 px-2 text-xs"
              onClick={() => handleCreateDialogOpenChange(true)}
              disabled={generatedToken !== null}
            >
              Generar token
            </Button>
          </div>

          <form
            className="flex w-full min-w-0 items-center gap-1 md:hidden"
            onSubmit={applyAdvancedFilters}
          >
            <span className="sr-only">
              {hasActiveFilters ? "Filtros activos" : "Todos los tokens"}
            </span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Nombre de clínica</span>
              <Input
                className="h-10 min-w-0 text-xs"
                type="text"
                placeholder="Clínica"
                value={filterDraft.clinic}
                onChange={(event) => updateFilterDraft("clinic", event.target.value)}
              />
            </label>
            <Button type="submit" variant="outline" size="sm" className="h-10 min-h-10 px-2 text-xs">
              Filtrar
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 min-h-10 px-2 text-xs"
                onClick={clearAdvancedFilters}
              >
                Limpiar
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 min-h-10 px-2 text-xs"
              onClick={() => void loadTokens()}
              disabled={isLoadingTokens}
            >
              {isLoadingTokens ? "Actualizando…" : "Actualizar"}
            </Button>
          </form>
        </div>

        {renderAdvancedFilterForm()}

        {errorMessage ? (
          <p className="clinical-alert-error shrink-0 px-3 py-1.5 text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {statusMessage ? (
          <p className="clinical-alert-success shrink-0 px-3 py-1.5 text-xs">
            {statusMessage}
          </p>
        ) : null}

        <section
          aria-label="Tabla de tokens particulares"
          className="flex min-h-0 flex-1 flex-col"
        >
          <div
            ref={setDesktopBodyNode}
            data-dashboard-adaptive-rows-canvas="true"
            className="dashboard-table-responsive hidden min-h-0 flex-1 md:block"
          >
            <Table className="table-fixed text-xs [&_th]:h-7 [&_th]:px-2 [&_td]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Token / paciente</TableHead>
                  <TableHead className="w-[18%]">Clínica</TableHead>
                  <TableHead className="w-[11%]">Estado</TableHead>
                  <TableHead className="w-[12%]">Informe</TableHead>
                  <TableHead className="hidden w-[15%] lg:table-cell">Último acceso</TableHead>
                  <TableHead className="hidden w-[14%] xl:table-cell">Creado</TableHead>
                  <TableHead className="w-[10%] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTokens.map((token, index) => (
                  <TableRow
                    key={token.id}
                    ref={index === 0 ? setDesktopRowNode : undefined}
                  >
                    <TableCell className="py-0.5">
                      <p className="truncate font-mono text-xs font-semibold text-vetneb-ink">
                        ****{token.tokenLast4}
                      </p>
                      <p className="truncate text-[0.6875rem] text-muted-foreground">
                        {token.petName} · {token.tutorLastName}
                      </p>
                    </TableCell>
                    <TableCell className="py-0.5">
                      <p className="truncate">{`Clínica #${token.clinicId}`}</p>
                    </TableCell>
                    <TableCell className="py-0.5">
                      <Badge
                        variant={token.isActive ? "default" : "outline"}
                        className="h-5 px-1.5 text-[0.6875rem]"
                      >
                        {token.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-0.5 text-xs">
                      {token.reportId ? `#${token.reportId}` : "Sin vínculo"}
                    </TableCell>
                    <TableCell className="hidden py-0.5 text-xs lg:table-cell">
                      {token.lastLoginAt ? formatDate(token.lastLoginAt) : "—"}
                    </TableCell>
                    <TableCell className="hidden py-0.5 text-xs xl:table-cell">
                      {formatDate(token.createdAt)}
                    </TableCell>
                    <TableCell className="py-0.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openTokenDetail(token)}
                      >
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div
            className="flex h-full min-h-0 flex-1 flex-col gap-1.5 md:hidden"
            data-admin-mobile-core-module="tokens"
          >
            <ParticularTokensMobileList
              ref={setMobileBodyNode}
              data-dashboard-adaptive-rows-canvas="true"
              data-admin-particulars-mobile-list="true"
            >
              {visibleTokens.map((token, index) => (
                <div
                  key={token.id}
                  ref={index === 0 ? setMobileRowNode : undefined}
                  className="flex min-h-9 items-center gap-2 px-2.5 py-1"
                  data-admin-mobile-core-item="true"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold">
                      ****{token.tokenLast4} · {token.petName}
                    </p>
                    <p className="truncate text-[0.6875rem] text-muted-foreground">
                      {resolveClinicName(clinicOptions, token.clinicId) ?? `Clínica #${token.clinicId}`} ·{" "}
                      {token.reportId ? `Informe #${token.reportId}` : "Sin informe"}
                    </p>
                  </div>
                  <Badge
                    variant={token.isActive ? "default" : "outline"}
                    className="h-5 px-1.5 text-[0.6875rem]"
                  >
                    {token.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => openTokenDetail(token)}
                  >
                    Ver
                  </Button>
                </div>
              ))}
            </ParticularTokensMobileList>

            {!filteredTokens.length ? (
              <p className="surface-empty flex min-h-20 flex-1 items-center justify-center text-xs">
                {isLoadingTokens
                  ? "Cargando tokens particulares…"
                  : hasActiveFilters
                    ? "No hay tokens que coincidan con los filtros aplicados."
                    : "No hay tokens particulares administrados."}
              </p>
            ) : null}

            {filteredTokens.length ? (
              <div
                className="flex shrink-0 items-center justify-center gap-1.5 border-t border-vetneb-line/65 pt-1.5 text-xs text-muted-foreground"
                data-admin-mobile-core-pager="true"
                data-dashboard-adaptive-reserved-region="pager"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-xs"
                  disabled={!pagedTokens.hasPrev || isLoadingTokens}
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    pagedTokens.goPrev();
                  }}
                >
                  Anterior
                </Button>
                <span className="min-w-12 text-center">Pág. {pagedTokens.page + 1}</span>
                {!pagedTokens.hasNext && hasMoreFromServer ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 text-xs"
                    disabled={isLoadingMoreTokens}
                    onClick={() => void loadMoreTokens()}
                  >
                    {isLoadingMoreTokens ? "Cargando…" : "Cargar más"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 text-xs"
                    disabled={!pagedTokens.hasNext || isLoadingTokens}
                    onClick={() => {
                      setIsDetailDialogOpen(false);
                      pagedTokens.goNext();
                    }}
                  >
                    Siguiente
                  </Button>
                )}
              </div>
            ) : null}
          </div>

          {!filteredTokens.length ? (
            <p className="surface-empty hidden min-h-20 flex-1 items-center justify-center text-xs md:flex">
              {isLoadingTokens
                ? "Cargando tokens particulares…"
                : hasActiveFilters
                  ? "No hay tokens que coincidan con los filtros aplicados."
                  : "No hay tokens particulares administrados."}
            </p>
          ) : null}

          <div
            data-dashboard-adaptive-reserved-region="pager"
            className="mt-2 hidden min-h-10 shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/65 px-1 pt-2 text-xs text-muted-foreground md:mt-1 md:flex md:min-h-8 md:pt-1"
          >
            <span>
              {filteredTokens.length
                ? `${pagedTokens.rangeStart}–${pagedTokens.rangeEnd}`
                : "0 resultados"}{" "}
              · {rowsPerPage} por página
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="md:h-8 md:px-2 md:text-xs"
                disabled={!pagedTokens.hasPrev || isLoadingTokens}
                onClick={() => {
                  setIsDetailDialogOpen(false);
                  pagedTokens.goPrev();
                }}
              >
                Anterior
              </Button>
              <span className="min-w-16 text-center">Página {pagedTokens.page + 1}</span>
              {!pagedTokens.hasNext && hasMoreFromServer ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="md:h-8 md:px-2 md:text-xs"
                  disabled={isLoadingMoreTokens}
                  onClick={() => void loadMoreTokens()}
                >
                  {isLoadingMoreTokens ? "Cargando…" : "Cargar más"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="md:h-8 md:px-2 md:text-xs"
                  disabled={!pagedTokens.hasNext || isLoadingTokens}
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    pagedTokens.goNext();
                  }}
                >
                  Siguiente
                </Button>
              )}
            </div>
          </div>
        </section>
      </CardContent>

      <ModuleDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        busy={isSubmitting}
        title="Generar token"
        description={`Paso ${createStepIndex + 1} de ${CREATE_STEP_ORDER.length}: ${CREATE_STEP_LABELS[createStep]}`}
      >
        <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
          <div className="flex shrink-0 gap-1.5" aria-label="Pasos del alta de token">
            {CREATE_STEP_ORDER.map((step, index) => (
              <button
                key={step}
                type="button"
                onClick={() => setCreateStep(step)}
                className={cn(
                  "clinical-pill px-2.5 py-1 text-[0.6875rem] tracking-normal",
                  step === createStep && "border-vetneb-teal bg-vetneb-teal/15",
                )}
                aria-current={step === createStep ? "step" : undefined}
              >
                {index + 1}. {CREATE_STEP_LABELS[step]}
              </button>
            ))}
          </div>

          {createStep === "clinic" ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="admin-token-clinic-search" className="field-label">
                  Clínica vinculada
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
                />
                <input id="admin-token-clinic-id" name="clinicId" type="hidden" value={formState.clinicId} readOnly />

                {clinicLoadError ? (
                  <p className="clinical-alert-error mt-1.5 px-2.5 py-1.5 text-xs" role="alert">
                    {clinicLoadError}
                  </p>
                ) : null}
                <div className="mt-1.5 rounded-lg border border-vetneb-line/80" role="listbox" aria-label="Clínicas registradas">
                  {isLoadingClinics ? (
                    <p className="surface-empty m-1.5 py-2 text-xs">Cargando clínicas registradas…</p>
                  ) : null}
                  {!isLoadingClinics && hasClinicQuery && filteredClinicOptions.length === 0 ? (
                    <p className="surface-empty m-1.5 py-2 text-xs">No hay clínicas registradas que coincidan.</p>
                  ) : null}
                  {!isLoadingClinics
                    ? filteredClinicOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={cn(
                            "dashboard-option-row flex w-full items-center justify-between gap-2 border-b border-vetneb-line/35 px-2.5 py-1.5 text-left text-xs last:border-b-0",
                            String(option.id) === formState.clinicId
                              ? "bg-vetneb-teal/12 text-vetneb-navy"
                              : "hover:bg-vetneb-cyan/8",
                          )}
                          onClick={() => selectClinic(option)}
                          disabled={isSubmitting}
                          role="option"
                          aria-selected={String(option.id) === formState.clinicId}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{option.name}</span>
                            <span className="block truncate text-[0.6875rem] text-muted-foreground">
                              ID #{option.id} · Localidad: {option.locality ?? "No informada"} · Usuarios: {option.usernames.join(", ")}
                            </span>
                          </span>
                        </button>
                      ))
                    : null}
                </div>
              </div>

              <label className="block md:col-span-2">
                <span className="field-label">Email del particular</span>
                <Input
                  id="admin-token-particular-email"
                  name="particularEmail"
                  type="email"
                  placeholder="email@ejemplo.com"
                  autoComplete="off"
                  required
                  value={formState.particularEmail}
                  onChange={(event) => updateField("particularEmail", event.target.value)}
                  disabled={isSubmitting}
                />
                <span className="mt-1 block text-[0.6875rem] text-muted-foreground">
                  Obligatorio. El backend enviará el token a este email usando la configuración de correo de VETNEB.
                </span>
              </label>
            </div>
          ) : null}

          {createStep === "patient" ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="field-label">Apellido tutor</span>
                <Input id="admin-token-tutor-last-name" name="tutorLastName" type="text" autoComplete="off" required value={formState.tutorLastName} onChange={(event) => updateField("tutorLastName", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="field-label">Paciente</span>
                <Input id="admin-token-pet-name" name="petName" type="text" autoComplete="off" required value={formState.petName} onChange={(event) => updateField("petName", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="field-label">Edad</span>
                <Input id="admin-token-pet-age" name="petAge" type="text" autoComplete="off" required value={formState.petAge} onChange={(event) => updateField("petAge", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="field-label">Raza</span>
                <Input id="admin-token-pet-breed" name="petBreed" type="text" autoComplete="off" required value={formState.petBreed} onChange={(event) => updateField("petBreed", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="field-label">Sexo</span>
                <select id="admin-token-pet-sex" name="petSex" className="field-select" required value={formState.petSex} onChange={(event) => updateField("petSex", event.target.value)} disabled={isSubmitting}>
                  {PET_SEX_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="field-label">Especie</span>
                <select id="admin-token-pet-species" name="petSpecies" className="field-select" required value={formState.petSpecies} onChange={(event) => updateField("petSpecies", event.target.value)} disabled={isSubmitting}>
                  {PET_SPECIES_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          ) : null}

          {createStep === "sample" ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <label className="block">
                <span className="field-label">Ubicación muestra</span>
                <Input id="admin-token-sample-location" name="sampleLocation" type="text" autoComplete="off" required value={formState.sampleLocation} onChange={(event) => updateField("sampleLocation", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="field-label">Evolución</span>
                <Input id="admin-token-sample-evolution" name="sampleEvolution" type="text" autoComplete="off" required value={formState.sampleEvolution} onChange={(event) => updateField("sampleEvolution", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="field-label">Extracción</span>
                <Input id="admin-token-extraction-date" name="extractionDate" type="date" autoComplete="off" required value={formState.extractionDate} onChange={(event) => updateField("extractionDate", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block">
                <span className="field-label">Envío</span>
                <Input id="admin-token-shipping-date" name="shippingDate" type="date" autoComplete="off" required value={formState.shippingDate} onChange={(event) => updateField("shippingDate", event.target.value)} disabled={isSubmitting} />
              </label>
              <label className="block md:col-span-2">
                <span className="field-label">Detalle de lesión</span>
                <textarea id="admin-token-details-lesion" name="detailsLesion" className="field-textarea" autoComplete="off" required rows={3} value={formState.detailsLesion} onChange={(event) => updateField("detailsLesion", event.target.value)} disabled={isSubmitting} />
              </label>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="clinical-alert-error px-2.5 py-1.5 text-xs" role="alert">{errorMessage}</p>
          ) : null}

          <div className="flex flex-wrap shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/70 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={isSubmitting}>Limpiar</Button>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {createStepIndex > 0 ? <Button type="button" variant="outline" size="sm" onClick={goToPreviousCreateStep} disabled={isSubmitting}>Anterior</Button> : null}
              {isLastCreateStep ? (
                <Button type="submit" size="sm" disabled={isSubmitting || generatedToken !== null}>{isSubmitting ? "Generando…" : "Generar token"}</Button>
              ) : (
                <Button type="submit" size="sm" disabled={isSubmitting}>Siguiente</Button>
              )}
            </div>
          </div>
        </form>
      </ModuleDialog>

      <ModuleDialog
        open={generatedToken !== null}
        onOpenChange={(open) => {
          if (!open) handleCloseGeneratedToken();
        }}
        busy={!isGeneratedTokenConfirmed}
        title="Token generado"
        description="Copiar ahora. El token completo solo se muestra una vez."
      >
        <div className="flex min-h-0 flex-col gap-3">
          <Input className="font-mono text-sm" readOnly value={generatedToken ?? ""} aria-label="Token particular generado por admin" />
          <div className="clinical-alert-error px-3 py-2">
            <p className="text-sm font-semibold">IMPORTANTE: el token completo solo se muestra una vez.</p>
            <p className="mt-1 text-xs">Antes de cerrar este bloque, verificá que el token haya sido copiado si necesitás respaldo operativo.</p>
          </div>
          <p className="text-xs text-vetneb-ink">
            {generatedTokenRecipientEmail ? `Email enviado a: ${generatedTokenRecipientEmail}` : "El backend informó envío correcto del email."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyManualMessage()}>Copiar mensaje para enviar</Button>
          {copyStatusMessage ? <p className="clinical-alert-success px-3 py-1.5 text-xs">{copyStatusMessage}</p> : null}
          {copyErrorMessage ? <p className="clinical-alert-error px-3 py-1.5 text-xs" role="alert">{copyErrorMessage}</p> : null}
          <label className="flex items-start gap-2 text-xs text-vetneb-ink">
            <input type="checkbox" className="mt-0.5" checked={isGeneratedTokenConfirmed} onChange={(event) => setIsGeneratedTokenConfirmed(event.target.checked)} />
            <span>Confirmo que registré el token visible o que no necesito copia adicional.</span>
          </label>
          <div className="flex justify-end border-t border-vetneb-line/70 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={handleCloseGeneratedToken} disabled={!isGeneratedTokenConfirmed}>Cerrar token visible</Button>
          </div>
        </div>
      </ModuleDialog>

      {selectedToken ? (
        <ModuleDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          busy={revokingTokenId === selectedToken.id || isSelectedTrackingUpdating}
          title={`Token ****${selectedToken.tokenLast4}`}
          description={formatTokenTitle(clinicOptions, selectedToken)}
          footer={
            <Button type="button" variant="destructive" size="sm" disabled={revokingTokenId === selectedToken.id} onClick={() => void handleDeleteToken(selectedToken)}>
              {revokingTokenId === selectedToken.id ? "Eliminando…" : "Eliminar token"}
            </Button>
          }
        >
          <div className="flex min-h-0 flex-col gap-3">
            <div role="tablist" aria-label="Detalle del token" className="flex gap-1 rounded-lg border border-vetneb-line/70 p-1">
              <Button type="button" size="sm" variant={detailTab === "summary" ? "default" : "ghost"} role="tab" aria-selected={detailTab === "summary"} onClick={() => setDetailTab("summary")}>Resumen</Button>
              <Button type="button" size="sm" variant={detailTab === "tracking" ? "default" : "ghost"} role="tab" aria-selected={detailTab === "tracking"} onClick={() => setDetailTab("tracking")}>Seguimiento</Button>
            </div>

            {errorMessage ? (
              <p className="clinical-alert-error px-2.5 py-1.5 text-xs" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {detailTab === "summary" ? (
              <div role="tabpanel" aria-label="Resumen del token" className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={selectedToken.isActive ? "default" : "outline"} className="h-5 px-1.5 text-[0.6875rem]">{selectedToken.isActive ? "Activo" : "Inactivo"}</Badge>
                  <Badge variant={selectedToken.hasLinkedReport ? "default" : "outline"} className="h-5 px-1.5 text-[0.6875rem]">{selectedToken.hasLinkedReport ? "Informe vinculado" : "Sin informe"}</Badge>
                </div>
                <dl className="grid grid-cols-1 divide-y divide-vetneb-line/55 rounded-lg border border-vetneb-line/70 text-xs sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="space-y-1 p-2.5">
                    <dt className="text-[0.6875rem] text-muted-foreground">Clínica / origen</dt>
                    <dd className="font-medium">{formatTokenClinicLink(clinicOptions, selectedToken.clinicId)}</dd>
                    <dd className="text-muted-foreground">{formatTokenSource(selectedToken)}</dd>
                  </div>
                  <div className="space-y-1 p-2.5">
                    <dt className="text-[0.6875rem] text-muted-foreground">Paciente / tutor</dt>
                    <dd className="font-medium">{selectedToken.petName} · {selectedToken.tutorLastName}</dd>
                    <dd className="text-muted-foreground">{selectedToken.petSpecies} · {selectedToken.petBreed} · {selectedToken.petSex} · {selectedToken.petAge}</dd>
                  </div>
                </dl>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div><dt className="text-[0.6875rem] text-muted-foreground">Muestra</dt><dd className="truncate">{selectedToken.sampleLocation}</dd></div>
                  <div><dt className="text-[0.6875rem] text-muted-foreground">Evolución</dt><dd className="truncate">{selectedToken.sampleEvolution}</dd></div>
                  <div><dt className="text-[0.6875rem] text-muted-foreground">Extracción</dt><dd>{formatDate(selectedToken.extractionDate)}</dd></div>
                  <div><dt className="text-[0.6875rem] text-muted-foreground">Envío</dt><dd>{formatDate(selectedToken.shippingDate)}</dd></div>
                  <div><dt className="text-[0.6875rem] text-muted-foreground">Último acceso</dt><dd>{selectedToken.lastLoginAt ? formatDate(selectedToken.lastLoginAt) : "—"}</dd></div>
                  <div><dt className="text-[0.6875rem] text-muted-foreground">Token seguro</dt><dd className="font-mono">Token ****{selectedToken.tokenLast4}</dd></div>
                </dl>
                {selectedToken.detailsLesion ? (
                  <div className="rounded-lg border border-vetneb-line/65 px-2.5 py-2 text-xs">
                    <p className="text-[0.6875rem] text-muted-foreground">Detalle de lesión</p>
                    <p className="line-clamp-2">{selectedToken.detailsLesion}</p>
                  </div>
                ) : null}
                {selectedToken.hasLinkedReport && selectedToken.reportId ? (
                  <div className="border-t border-vetneb-line/65 pt-2">
                    <p className="mb-1.5 text-xs font-semibold">Informe vinculado</p>
                    <ReportFileActions reportId={selectedToken.reportId} scope="admin" align="start" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {detailTab === "tracking" ? (
              <div role="tabpanel" aria-label="Seguimiento del token" className="space-y-3">
                {trackingLoadingTokenId === selectedToken.id ? (
                  <p className="surface-empty py-3 text-xs">Cargando seguimiento…</p>
                ) : null}
                {trackingLoadError ? (
                  <div className="clinical-alert-warning px-3 py-2 text-xs" role="alert">
                    <p>{trackingLoadError}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => {
                      setTrackingLoadedTokenIds((current) => {
                        const next = { ...current };
                        delete next[selectedToken.id];
                        return next;
                      });
                      setTrackingRetryNonce((current) => current + 1);
                    }}>Reintentar</Button>
                  </div>
                ) : null}
                {selectedTrackingCase ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-vetneb-line/70 px-2.5 py-2 text-xs">
                      <p className="text-[0.6875rem] text-muted-foreground">Etapa actual</p>
                      <p className="font-semibold">{getTrackingStageLabel(selectedTrackingCase.currentStage)}</p>
                      <p className="mt-1 text-muted-foreground">Impacta la estimación del informe. Estimación: {formatDate(selectedTrackingCase.estimatedDeliveryAt)}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="field-label">Entrega en laboratorio</span>
                        <Input id={`admin-tracking-lab-received-${selectedTrackingCase.id}`} type="date" value={selectedLabReceivedDraft} onChange={(event) => handleLabReceivedDraftChange(selectedTrackingCase, event.target.value)} disabled={isSelectedTrackingUpdating} />
                        <Button type="button" variant="outline" size="sm" className="mt-1.5 w-full" onClick={() => void handleLabReceivedAtUpdate(selectedToken.id, selectedTrackingCase)} disabled={!selectedHasLabReceivedChange || isSelectedTrackingUpdating}>Actualizar entrega</Button>
                      </label>
                      <label className="block">
                        <span className="field-label">Etapa</span>
                        <select id={`admin-tracking-stage-${selectedTrackingCase.id}`} className="field-select" value={selectedTrackingStageDraft ?? selectedTrackingCase.currentStage} onChange={(event) => handleTrackingStageDraftChange(selectedTrackingCase, event.target.value as AdminStudyTrackingStage)} disabled={isSelectedTrackingUpdating}>
                          {TRACKING_STAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <Button type="button" variant="outline" size="sm" className="mt-1.5 w-full" onClick={() => void handleTrackingStageUpdate(selectedToken.id, selectedTrackingCase)} disabled={!selectedHasTrackingStageChange || isSelectedTrackingUpdating}>{isSelectedTrackingUpdating ? "Actualizando..." : "Actualizar estado"}</Button>
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-vetneb-line/70 px-2.5 py-2 text-xs">
                      <span>{selectedTrackingCase.specialStainRequired ? "Alerta: Solicitud de tinción especial" : "Sin alerta de tinción especial."}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleSpecialStainChange(selectedToken.id, selectedTrackingCase)} disabled={isSelectedTrackingUpdating}>{selectedTrackingCase.specialStainRequired ? "Resolver tinción especial" : "Solicitar tinción especial"}</Button>
                    </div>
                  </div>
                ) : null}
                {!selectedTrackingCase && trackingLoadedTokenIds[selectedToken.id] && !trackingLoadError ? (
                  <p className="surface-empty py-3 text-xs">Sin seguimiento vinculado para este token.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </ModuleDialog>
      ) : null}
    </Card>
  );
}
