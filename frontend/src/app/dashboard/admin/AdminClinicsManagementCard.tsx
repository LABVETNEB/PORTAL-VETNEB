"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
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

// Enterprise density without breaking the App Shell no-scroll contract: denser
// rows/header let a full page fit the 1366×768 minimum viewport, so the server
// page size is raised from 5 to a conservative value that leaves one dense-row
// margin in the 1366×768 viewport without internal scroll. True 25/50/100 needs
// the no-scroll contract relaxation (audit §3) and is deferred.
const PAGE_SIZE = 9;

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
  const [currentOffset, setCurrentOffset] = useState(0);
  const [createForm, setCreateForm] = useState<CreateClinicForm>(getInitialCreateForm);
  const [editingClinic, setEditingClinic] = useState<AdminClinicManagementSummary | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => getClinicUserRows(snapshot), [snapshot]);

  const totalClinics = snapshot?.total ?? 0;
  const pageStart = totalClinics > 0 ? currentOffset + 1 : 0;
  const pageEnd = Math.min(currentOffset + PAGE_SIZE, totalClinics);
  const hasPrev = currentOffset > 0;
  const hasNext = currentOffset + PAGE_SIZE < totalClinics;
  const isBusy = isPending || activeActionKey !== null;

  function loadClinics(offset = currentOffset, search = searchQuery) {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const trimmedSearch = search.trim();
          setSnapshot(
            await getAdminClinics({
              limit: PAGE_SIZE,
              offset,
              ...(trimmedSearch ? { search: trimmedSearch } : {}),
            }),
          );
          setCurrentOffset(offset);
        } catch (err) {
          setError(
            formatAdminClinicsError(err, "No se pudieron cargar las clínicas."),
          );
        }
      })();
    });
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
      loadClinics(0);
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

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      loadClinics(0, searchQuery);
      return;
    }

    const timer = setTimeout(() => {
      loadClinics(0, searchQuery);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {pageStart}–{pageEnd} de {totalClinics}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => loadClinics(currentOffset - PAGE_SIZE)}
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
                onClick={() => loadClinics(currentOffset + PAGE_SIZE)}
                disabled={isBusy || !hasNext}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>

        <div className="dashboard-table-responsive">
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
                rows.map(({ clinic, user, extraUsers }) => (
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
