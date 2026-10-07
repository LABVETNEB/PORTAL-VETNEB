"use client";

import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, EyeOff, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BACKEND_CONNECTION_ERROR_MESSAGE,
  createAdminClinicWithUser,
  deleteAdminClinic,
  getAdminClinics,
  updateAdminClinic,
  updateAdminClinicUserCredentials,
  type AdminClinicsSortDirection,
  type AdminClinicsSortKey,
} from "@/lib/api";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import {
  DASHBOARD_PAGER_RESERVATION,
  DASHBOARD_TOUCH_PAGER_RESERVATION,
} from "@/components/dashboard/DashboardPager";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingState } from "@/components/dashboard/LoadingState";
import type {
  AdminClinicManagementSummary,
  AdminClinicsSnapshot,
} from "@/types";
import type { ClinicDraft, CredentialsPayload } from "./ClinicEditDrawer";

// ClinicEditDrawer uses @radix-ui/react-dialog which declares "use client" in
// its package source. Importing it statically causes a webpack SSR crash
// (__webpack_modules__[moduleId] is not a function) because Next.js includes
// the module in the server bundle where its initializer is not a valid factory.
// Loading it dynamically with ssr:false keeps it out of the server bundle.
const ClinicEditDrawer = dynamic(
  () => import("./ClinicEditDrawer").then((m) => m.ClinicEditDrawer),
  { ssr: false },
);

// Server pagination is now sized by the measured rows container (Zero-Scroll
// adaptive contract, R-02/PR-SRV-0). The legacy PAGE_SIZE survives only as the
// pre-measurement fallback; a media query no longer decides cardinality.
const CLINICS_FALLBACK_ROWS = 9;
// Hybrid cap: the effective `limit` never exceeds this superset ceiling even on
// very tall viewports; recompute of offset always clamps against it.
const CLINICS_SUPERSET_CAP = 36;
// Fixed header row height of the desktop table (`[&_th]:h-9`), discounted from
// the measured region so the row math never counts the header as a data row.
const CLINICS_TABLE_HEADER_PX = 36;
// Fallback item height used until a real row is measured.
const CLINICS_ROW_HEIGHT_FALLBACK_PX = 36;

type CreateClinicForm = {
  clinicName: string;
  contactEmail: string;
  contactPhone: string;
  username: string;
  password: string;
};

type ClinicUserRow = {
  clinic: AdminClinicManagementSummary;
  user: AdminClinicManagementSummary["users"][number] | null;
  extraUsers: number;
};

// C04: explicit column sort executed by the server over the whole collection.
// null = no request, so the server keeps its historical order.
type ClinicsColumnSort = {
  sort: AdminClinicsSortKey;
  direction: AdminClinicsSortDirection;
} | null;

function nextClinicsColumnSort(
  current: ClinicsColumnSort,
  key: AdminClinicsSortKey,
): ClinicsColumnSort {
  return {
    sort: key,
    direction: current?.sort === key && current.direction === "asc" ? "desc" : "asc",
  };
}

function clinicsAriaSort(
  current: ClinicsColumnSort,
  key: AdminClinicsSortKey,
): "ascending" | "descending" | "none" {
  if (current?.sort !== key) return "none";
  return current.direction === "asc" ? "ascending" : "descending";
}

function ClinicsSortHeaderButton({
  label,
  title,
  ariaSort,
  onToggle,
}: {
  label: string;
  title: string;
  ariaSort: "ascending" | "descending" | "none";
  onToggle: () => void;
}) {
  const Icon = ariaSort === "ascending" ? ArrowUp : ariaSort === "descending" ? ArrowDown : ArrowUpDown;

  return (
    <button
      type="button"
      title={title}
      onClick={onToggle}
      data-admin-clinics-sort-button="true"
      className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
    >
      {label}
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
    </button>
  );
}

function getInitialCreateForm(): CreateClinicForm {
  return {
    clinicName: "",
    contactEmail: "",
    contactPhone: "",
    username: "",
    password: "",
  };
}

// Single-viewport App Shell: ONE row per clinic (not per user). The legacy
// one-row-per-user flattening made a page of clinics overflow the viewport when
// clinics had multiple users; the primary user is shown with a "+N" hint and the
// full user list stays available in the edit drawer.
function getClinicUserRows(snapshot: AdminClinicsSnapshot | null): ClinicUserRow[] {
  return (snapshot?.clinics ?? []).map((clinic) => ({
    clinic,
    user: clinic.users[0] ?? null,
    extraUsers: Math.max(0, clinic.users.length - 1),
  }));
}

function formatAdminClinicsError(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return BACKEND_CONNECTION_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes("failed to fetch")
      ? BACKEND_CONNECTION_ERROR_MESSAGE
      : error.message;
  }

  return fallback;
}

export function AdminClinicsManagementCard() {
  const [snapshot, setSnapshot] = useState<AdminClinicsSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [columnSort, setColumnSort] = useState<ClinicsColumnSort>(null);
  // The order the rendered rows actually have: set only together with the
  // snapshot of the latest request, so aria-sort never runs ahead of the rows.
  const [appliedSort, setAppliedSort] = useState<ClinicsColumnSort>(null);
  const [createForm, setCreateForm] = useState<CreateClinicForm>(getInitialCreateForm);
  const [editingClinic, setEditingClinic] = useState<AdminClinicManagementSummary | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // One collapsed runtime feeds both presentations, so the visible container
  // (desktop table region or mobile list region) drives a single cardinality.
  const [desktopBodyNode, setDesktopBodyNode] = useState<HTMLElement | null>(
    null,
  );
  const [mobileBodyNode, setMobileBodyNode] = useState<HTMLElement | null>(null);

  const latestRequestRef = useRef(0);
  const snapshotRef = useRef<AdminClinicsSnapshot | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);


  // Desktop context (detected by the discounted table header) keeps a floor of
  // nine rows — the pre-adaptive fixed page size — so a transiently collapsed
  // container can never feed back into a one-row page (VIS-ADMIN-001). The
  // mobile list (no table header) keeps a floor of one so it can shrink freely
  // on short phones.
  // One owner per canvas. The two presentations are mutually exclusive by
  // media query, so exactly one reports `measured` — a function of the
  // viewport alone, with no row content, page or history in it.
  const mobileCapacity = useDashboardCanvasCapacity({
    canvasNode: mobileBodyNode,
    fallbackItems: CLINICS_FALLBACK_ROWS,
    minItems: 1,
    maxItems: CLINICS_SUPERSET_CAP,
  });
  const desktopCapacity = useDashboardCanvasCapacity({
    canvasNode: desktopBodyNode,
    fallbackItems: CLINICS_FALLBACK_ROWS,
    minItems: CLINICS_FALLBACK_ROWS,
    maxItems: CLINICS_SUPERSET_CAP,
  });
  const rowsPerPage = mobileCapacity.measured
    ? mobileCapacity.capacity
    : desktopCapacity.measured
      ? desktopCapacity.capacity
      : CLINICS_FALLBACK_ROWS;

  // Effective server page size: at least the measured rows, capped at the
  // superset ceiling. The hook already clamps to [1, CLINICS_SUPERSET_CAP].
  const effectiveLimit = rowsPerPage;

  const rows = useMemo(() => getClinicUserRows(snapshot), [snapshot]);

  const totalClinics = snapshot?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + effectiveLimit < totalClinics;
  const page = Math.floor(offset / effectiveLimit) + 1;
  const pageCount = Math.max(1, Math.ceil(totalClinics / effectiveLimit));
  const isBusy = isPending || activeActionKey !== null;

  // Sort headers exist only in the desktop table; the mobile list has none, so
  // it never carries a hidden order and keeps the historical server order.
  const requestedSort = mobileCapacity.measured ? null : columnSort;

  // The effective order also changes when the viewport enters or leaves the
  // mobile list, so the window restarts at the first page exactly as for a
  // user-driven order change. Adjusted while rendering, before any request is
  // built, so none carries the old offset; columnSort itself is untouched.
  const [orderOfOffset, setOrderOfOffset] = useState<ClinicsColumnSort>(null);
  if (orderOfOffset !== requestedSort) {
    setOrderOfOffset(requestedSort);
    setOffset(0);
  }

  const pageQuery = useMemo(
    () => ({
      limit: effectiveLimit,
      offset,
      ...(submittedSearch ? { search: submittedSearch } : {}),
    }),
    [effectiveLimit, offset, submittedSearch],
  );
  const query = useMemo(
    () => (requestedSort ? { ...pageQuery, ...requestedSort } : pageQuery),
    [pageQuery, requestedSort],
  );

  function loadClinics() {
    setError(null);

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    const sortOfRequest = requestedSort;

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminClinics(query);
          if (requestId !== latestRequestRef.current) return;
          setSnapshot(result);
          setAppliedSort(sortOfRequest);
        } catch (err) {
          if (requestId !== latestRequestRef.current) return;
          setError(
            formatAdminClinicsError(err, "No se pudieron cargar las clínicas."),
          );
        }
      })();
    });
  }

  // Jumps back to the first page after a mutation that can change result
  // ordering (create). If offset is already 0, `query` won't change on its
  // own, so a manual reload is needed; otherwise the offset change below
  // flows into `query` and the effect below reloads once.
  function resetToFirstPageAndReload() {
    if (offset === 0) {
      loadClinics();
    } else {
      setOffset(0);
    }
  }

  function updateCreateField<K extends keyof CreateClinicForm>(
    key: K,
    value: CreateClinicForm[K],
  ) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function handleCreateDialogOpenChange(open: boolean) {
    setIsCreateOpen(open);
    if (!open) setIsCreatePasswordVisible(false);
  }

  async function handleCreateClinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) return;

    setError(null);
    setSuccessMessage(null);
    setActiveActionKey("create-clinic");

    try {
      const result = await createAdminClinicWithUser({
        clinicName: createForm.clinicName,
        contactEmail: createForm.contactEmail,
        contactPhone: createForm.contactPhone.trim() || null,
        username: createForm.username,
        password: createForm.password,
      });

      setCreateForm(getInitialCreateForm());
      setSuccessMessage(
        `Clínica creada: ${result.clinic.clinicName} con usuario ${result.user.username}.`,
      );
      setIsCreatePasswordVisible(false);
      setIsCreateOpen(false);
      resetToFirstPageAndReload();
    } catch (err) {
      setError(formatAdminClinicsError(err, "No se pudo crear la clínica."));
    } finally {
      setActiveActionKey(null);
    }
  }

  async function handleSaveClinic(clinicId: number, draft: ClinicDraft): Promise<void> {
    const result = await updateAdminClinic(clinicId, {
      clinicName: draft.clinicName,
      contactEmail: draft.contactEmail.trim() || null,
      contactPhone: draft.contactPhone.trim() || null,
    });
    setSuccessMessage(`Clínica actualizada: ${result.clinic.clinicName}.`);
    loadClinics();
  }

  async function handleSaveCredentials(
    userId: number,
    payload: CredentialsPayload,
  ): Promise<void> {
    const result = await updateAdminClinicUserCredentials(userId, payload);
    setSuccessMessage(`Credenciales actualizadas para ${result.user.username}.`);
    loadClinics();
  }

  async function handleDeleteClinic(
    clinicId: number,
    confirmedName: string,
  ): Promise<void> {
    const result = await deleteAdminClinic(clinicId, {
      confirmClinicName: confirmedName,
    });
    setSuccessMessage(`${result.clinic.clinicName} fue eliminada definitivamente.`);
    setEditingClinic(null);
    loadClinics();
  }

  // Search is server-side and debounced; a cardinality change (resize/zoom)
  // never touches the search state, so it never resets the offset here.
  //
  // Arms only when the live typed value actually differs from the already
  // submitted one — a semantic comparison, not an effect-invocation counter.
  // React Strict Mode (development only) runs a component's mount-time
  // effects twice; a "ran once" ref/boolean is consumed by whichever
  // invocation runs first and is indistinguishable from a real second run to
  // the one that follows, so it arms a phantom timer on every mount that
  // silently resets `offset` ~300ms later — racing a real page-2 navigation
  // that happens within that window (same defect class fixed in
  // AdminUsersRolesReadOnlyCard.tsx). Comparing values instead is immune by
  // construction: both Strict Mode invocations of the same render see the
  // identical (unchanged) pair and reach the identical (skip) decision.
  useEffect(() => {
    if (searchQuery.trim() === submittedSearch) {
      return;
    }

    const timer = setTimeout(() => {
      setOffset(0);
      setSubmittedSearch(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, submittedSearch]);

  // Recompute offset when the effective limit changes so the same first
  // record stays visible; clamp against the known total (PR-SRV-0 §6).
  const previousLimitRef = useRef(effectiveLimit);
  useEffect(() => {
    if (previousLimitRef.current === effectiveLimit) {
      return;
    }
    previousLimitRef.current = effectiveLimit;

    setOffset((currentOffset) => {
      let nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;
      const total = snapshotRef.current?.total;
      if (typeof total === "number") {
        const lastValidOffset = Math.max(
          0,
          (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,
        );
        nextOffset = Math.min(nextOffset, lastValidOffset);
      }
      nextOffset = Math.max(0, nextOffset);
      return nextOffset === currentOffset ? currentOffset : nextOffset;
    });
  }, [effectiveLimit]);

  useEffect(() => {
    loadClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function goToPreviousPage() {
    setError(null);
    setOffset(Math.max(offset - effectiveLimit, 0));
  }

  function goToNextPage() {
    setError(null);
    setOffset(offset + effectiveLimit);
  }

  // A new order restarts at its first page, as a new search does; the limit
  // is untouched.
  function toggleColumnSort(key: AdminClinicsSortKey) {
    setError(null);
    setColumnSort((current) => nextClinicsColumnSort(current, key));
    setOffset(0);
  }

  return (
    <Card
      id="admin-clinics"
      data-dashboard-b12-module-card="true"
      className="dashboard-surface flex min-h-0 flex-1 flex-col"
    >
      {/* The internal "Clínicas" descriptor is retired at every width
          (pre-C05 below md, desktop/tablet space pass from md up). Below md
          this band keeps the actions with the mobile search under them; from
          md up the actions live in the search row of the card body. */}
      <CardHeader className="shrink-0 flex flex-col gap-2 border-b border-vetneb-line/70 px-4 py-2 md:hidden">
        <div className="mb-0 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setIsCreateOpen(true)}
            disabled={isBusy}
          >
            <Plus aria-hidden="true" />
            Nueva clínica
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => loadClinics()}
            disabled={isBusy}
            aria-busy={isPending ? true : undefined}
          >
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {isPending ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
        <div className="relative max-w-xs shrink-0 md:hidden">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            data-dashboard-filter-field="true"
            className="h-8 pl-8 text-sm"
            placeholder="Buscar clínica..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isBusy}
            aria-label="Buscar clínicas"
          />
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4 pt-2 md:pb-2">
        <ModuleDialog
          open={isCreateOpen}
          onOpenChange={handleCreateDialogOpenChange}
          title="Nueva clínica"
          description="Alta de clínica con su usuario de acceso inicial."
          busy={activeActionKey === "create-clinic"}
        >
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={(event) => void handleCreateClinic(event)}
        >
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs text-muted-foreground">Nombre clínica</span>
            <Input
              value={createForm.clinicName}
              disabled={isBusy}
              maxLength={255}
              required
              onChange={(event) =>
                updateCreateField("clinicName", event.target.value)
              }
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Email contacto</span>
            <Input
              type="email"
              value={createForm.contactEmail}
              disabled={isBusy}
              maxLength={255}
              required
              onChange={(event) =>
                updateCreateField("contactEmail", event.target.value)
              }
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Teléfono</span>
            <Input
              value={createForm.contactPhone}
              disabled={isBusy}
              maxLength={50}
              onChange={(event) =>
                updateCreateField("contactPhone", event.target.value)
              }
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Usuario de acceso</span>
            <Input
              value={createForm.username}
              disabled={isBusy}
              minLength={3}
              maxLength={100}
              required
              onChange={(event) =>
                updateCreateField("username", event.target.value)
              }
            />
          </label>

          <div className="space-y-1.5">
            <label
              htmlFor="create-clinic-password"
              className="text-xs text-muted-foreground"
            >
              Contraseña inicial
            </label>
            <div className="relative">
              <Input
                id="create-clinic-password"
                type={isCreatePasswordVisible ? "text" : "password"}
                value={createForm.password}
                disabled={isBusy}
                minLength={8}
                required
                autoComplete="new-password"
                aria-describedby="create-clinic-password-hint"
                className="pr-10"
                onChange={(event) =>
                  updateCreateField("password", event.target.value)
                }
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:opacity-55"
                onClick={() => setIsCreatePasswordVisible((current) => !current)}
                disabled={isBusy}
                aria-label={isCreatePasswordVisible ? "Ocultar contraseña inicial" : "Mostrar contraseña inicial"}
                aria-pressed={isCreatePasswordVisible}
                aria-controls="create-clinic-password"
              >
                {isCreatePasswordVisible ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <p id="create-clinic-password-hint" className="text-xs text-muted-foreground">
              La contraseña anterior no se puede consultar. Para recuperación,
              cargue una nueva contraseña y guárdela.
            </p>
          </div>

          <div className="flex items-end md:col-span-2">
            <Button type="submit" className="w-full" disabled={isBusy} aria-busy={activeActionKey === "create-clinic" ? true : undefined}>
              {activeActionKey === "create-clinic" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {activeActionKey === "create-clinic" ? "Creando..." : "Crear clínica"}
            </Button>
          </div>
        </form>
        </ModuleDialog>

        {error ? (
          <div role="alert" className="clinical-alert-error">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="clinical-alert-success">{successMessage}</div>
        ) : null}

        <div
          data-admin-clinics-desktop-toolbar="true"
          className="hidden items-center gap-2 md:flex"
        >
          <div className="relative min-w-0 max-w-md flex-1">
            <Search
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              data-dashboard-filter-field="true"
              className="h-8 pl-8 text-sm"
              placeholder="Buscar clínica por nombre, email o usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isBusy}
              aria-label="Buscar clínicas"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => setIsCreateOpen(true)}
            disabled={isBusy}
          >
            <Plus aria-hidden="true" />
            Nueva clínica
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => loadClinics()}
            disabled={isBusy}
            aria-busy={isPending ? true : undefined}
          >
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {isPending ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>

        <div
          ref={setDesktopBodyNode}
          data-dashboard-adaptive-rows-canvas="true"
              data-dashboard-row-pitch="compact"
              data-dashboard-canvas-reserve="table-head-dense"
          className="dashboard-table-responsive hidden min-h-0 flex-1 md:block"
        >
          <Table className="text-[0.8125rem] [&_th]:h-9 [&_th]:px-3 [&_td]:px-3">
            <TableHeader>
              <TableRow>
                <TableHead aria-sort={clinicsAriaSort(appliedSort, "name")}>
                  <ClinicsSortHeaderButton
                    label="Clínica"
                    title="Ordenar por nombre de clínica"
                    ariaSort={clinicsAriaSort(appliedSort, "name")}
                    onToggle={() => toggleColumnSort("name")}
                  />
                </TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead aria-sort={clinicsAriaSort(appliedSort, "createdAt")}>
                  <ClinicsSortHeaderButton
                    label="Fechas"
                    title="Ordenar por fecha de creación"
                    ariaSort={clinicsAriaSort(appliedSort, "createdAt")}
                    onToggle={() => toggleColumnSort("createdAt")}
                  />
                </TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map(({ clinic, user, extraUsers }, index) => (
                  <TableRow
                    key={`${clinic.clinicId}-${user?.userId ?? "empty"}`}
                  >
                    <TableCell className="py-1">
                      <span className="flex items-center gap-1.5">
                        <span className="max-w-[13rem] truncate font-medium">
                          {clinic.clinicName}
                        </span>
                        <span className="shrink-0 font-mono text-[0.62rem] text-muted-foreground">
                          #{clinic.clinicId}
                        </span>
                      </span>
                    </TableCell>

                    <TableCell className="py-1">
                      <span className="block max-w-[14rem] truncate">
                        {clinic.contactEmail ?? "—"}
                      </span>
                    </TableCell>

                    <TableCell className="py-1">
                      {user ? (
                        <span className="inline-flex max-w-[12rem] items-center gap-1">
                          <span className="truncate">{user.username}</span>
                          {extraUsers > 0 ? (
                            <span className="shrink-0 text-[0.66rem] text-muted-foreground">
                              +{extraUsers}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Sin usuario
                        </span>
                      )}
                    </TableCell>

                    <TableCell
                      className="whitespace-nowrap py-1 text-xs text-muted-foreground"
                      title={`Creada: ${formatDateTime(clinic.createdAt)} · Actualizada: ${formatDateTime(clinic.updatedAt)}`}
                    >
                      {formatDateTime(clinic.updatedAt)}
                    </TableCell>

                    <TableCell className="py-1 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy || editingClinic !== null}
                        onClick={() => setEditingClinic(clinic)}
                        aria-label={`Editar clínica ${clinic.clinicName}`}
                        className="h-8"
                      >
                        <Pencil aria-hidden="true" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : isPending ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-3">
                    <LoadingState
                      variant="table"
                      compact
                      rows={3}
                      className="border-0 bg-transparent shadow-none rounded-none"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="clinical-table-state">
                    {searchQuery.trim() ? (
                      <EmptyState
                        title={`Sin resultados para "${searchQuery}"`}
                        description="No hay clínicas que coincidan con la búsqueda."
                        size="sm"
                        className="border-0 bg-transparent"
                      />
                    ) : (
                      <EmptyState
                        title="Sin clínicas"
                        description="No hay clínicas para mostrar."
                        size="sm"
                        className="border-0 bg-transparent"
                      />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Always mounted from md up: a pager that only appeared with data
            would hand its reserved height back to the canvas before the first
            response and re-page the table once it mounted. */}
        <nav
          data-dashboard-adaptive-reserved-region="pager"
          className="hidden shrink-0 items-center justify-center gap-2 overflow-hidden border-t border-vetneb-line/65 text-xs text-muted-foreground md:flex"
          style={DASHBOARD_PAGER_RESERVATION}
          aria-label="Paginación de clínicas"
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={goToPreviousPage}
            disabled={isBusy || !hasPrev}
            aria-label="Página anterior"
          >
            Anterior
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={goToNextPage}
            disabled={isBusy || !hasNext}
            aria-label="Página siguiente"
          >
            Siguiente
          </Button>
        </nav>

        <div
          className="flex min-h-0 flex-1 flex-col gap-2 md:hidden"
          data-admin-mobile-core-module="clinics"
        >
          <div
            ref={setMobileBodyNode}
            data-dashboard-adaptive-rows-canvas="true"
              data-dashboard-row-pitch="regular"
            className="min-h-0 flex-1 divide-y divide-vetneb-line/60 overflow-hidden rounded-lg border border-vetneb-line/75"
            data-admin-clinics-mobile-list="true"
          >
          {rows.length ? (
            rows.map(({ clinic, user, extraUsers }, index) => (
              <article
                key={`mobile-${clinic.clinicId}-${user?.userId ?? "empty"}`}
                className="flex min-h-9 items-center justify-between gap-2 px-2.5 py-0.5"
                data-admin-clinic-mobile-card="true"
                data-admin-mobile-core-item="true"
                    data-dashboard-adaptive-row="true"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-semibold leading-tight text-vetneb-ink">
                    {clinic.clinicName}
                  </h3>
                  <p className="truncate text-[0.68rem] text-muted-foreground">
                    {clinic.contactEmail ?? "Sin email de contacto"}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy || editingClinic !== null}
                  onClick={() => setEditingClinic(clinic)}
                  aria-label={`Editar clínica ${clinic.clinicName}, ver usuario${extraUsers > 0 ? "s" : ""} y fecha de actualización`}
                  className="h-9 shrink-0 px-2.5"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Editar
                </Button>
              </article>
            ))
          ) : isPending ? (
            <LoadingState
              variant="table"
              compact
              rows={3}
              className="border-0 bg-transparent shadow-none rounded-none"
            />
          ) : (
            <div className="clinical-table-state rounded-lg border border-vetneb-line/70 bg-card/90 p-3">
              {searchQuery.trim() ? (
                <EmptyState
                  title={`Sin resultados para "${searchQuery}"`}
                  description="No hay clínicas que coincidan con la búsqueda."
                  size="sm"
                  className="border-0 bg-transparent"
                />
              ) : (
                <EmptyState
                  title="Sin clínicas"
                  description="No hay clínicas para mostrar."
                  size="sm"
                  className="border-0 bg-transparent"
                />
              )}
            </div>
          )}
          </div>

          {totalClinics > 0 ? (
            <div
              className="dashboard-pager flex shrink-0 items-center justify-center gap-1.5 overflow-hidden border-t border-vetneb-line/65 text-xs text-muted-foreground"
              style={DASHBOARD_TOUCH_PAGER_RESERVATION}
              data-admin-mobile-core-pager="true"
              data-dashboard-adaptive-reserved-region="pager"
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-2.5 text-xs"
                onClick={goToPreviousPage}
                disabled={isBusy || !hasPrev}
                aria-label="Página anterior"
              >
                Anterior
              </Button>
              <span className="min-w-16 text-center tabular-nums">
                Pág. {page} / {pageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-2.5 text-xs"
                onClick={goToNextPage}
                disabled={isBusy || !hasNext}
                aria-label="Página siguiente"
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </div>
        <ClinicEditDrawer
          clinic={editingClinic}
          onSaveClinic={handleSaveClinic}
          onSaveCredentials={handleSaveCredentials}
          onDeleteClinic={handleDeleteClinic}
          onClose={() => setEditingClinic(null)}
        />
      </CardContent>
    </Card>
  );
}
