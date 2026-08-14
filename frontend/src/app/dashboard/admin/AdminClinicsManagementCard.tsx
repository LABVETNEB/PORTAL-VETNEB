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
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
} from "@/lib/api";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import {
  DASHBOARD_INLINE_PAGER_RESERVATION,
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
  const pageStart = totalClinics > 0 ? offset + 1 : 0;
  const pageEnd = Math.min(offset + effectiveLimit, totalClinics);
  const hasPrev = offset > 0;
  const hasNext = offset + effectiveLimit < totalClinics;
  const page = Math.floor(offset / effectiveLimit) + 1;
  const pageCount = Math.max(1, Math.ceil(totalClinics / effectiveLimit));
  const isBusy = isPending || activeActionKey !== null;

  const query = useMemo(
    () => ({
      limit: effectiveLimit,
      offset,
      ...(submittedSearch ? { search: submittedSearch } : {}),
    }),
    [effectiveLimit, offset, submittedSearch],
  );

  function loadClinics() {
    setError(null);

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminClinics(query);
          if (requestId !== latestRequestRef.current) return;
          setSnapshot(result);
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
  const isFirstSearchRender = useRef(true);

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setOffset(0);
      setSubmittedSearch(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  return (
    <Card id="admin-clinics" className="dashboard-surface flex min-h-0 flex-1 flex-col">
      <CardHeader className="shrink-0 flex flex-col gap-2 border-b border-vetneb-line/70 px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-[0.95rem] leading-tight">Clínicas</CardTitle>
          <p className="text-[0.72rem] text-muted-foreground">
            Administración de clínicas registradas · alto volumen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4 pt-3">
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

        <div className="hidden items-center justify-between gap-2 md:flex">
          <div className="relative max-w-xs flex-1">
            <Search
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="Buscar clínica por nombre, email o usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isBusy}
              aria-label="Buscar clínicas"
            />
          </div>
          {totalClinics > 0 ? (
            <div
              data-dashboard-adaptive-reserved-region="pager"
              className="flex shrink-0 items-center gap-2 overflow-hidden text-xs text-muted-foreground"
              style={DASHBOARD_INLINE_PAGER_RESERVATION}
            >
              <span className="tabular-nums">
                {pageStart}–{pageEnd} de {totalClinics}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={goToPreviousPage}
                disabled={isBusy || !hasPrev}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={goToNextPage}
                disabled={isBusy || !hasNext}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
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
                <TableHead>Clínica</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Fechas</TableHead>
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

        <div
          className="flex min-h-0 flex-1 flex-col gap-2 md:hidden"
          data-admin-mobile-core-module="clinics"
        >
          <div className="relative max-w-xs shrink-0">
            <Search
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="Buscar clínica..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isBusy}
              aria-label="Buscar clínicas"
            />
          </div>

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
