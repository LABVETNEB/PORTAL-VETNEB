"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PAGE_SIZE = 50;

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

function getClinicUserRows(snapshot: AdminClinicsSnapshot | null): ClinicUserRow[] {
  const rows: ClinicUserRow[] = [];

  for (const clinic of snapshot?.clinics ?? []) {
    if (!clinic.users.length) {
      rows.push({ clinic, user: null });
      continue;
    }

    for (const user of clinic.users) {
      rows.push({ clinic, user });
    }
  }

  return rows;
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
    <Card id="admin-clinics" className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-base">Clínicas</CardTitle>
        <Button type="button" onClick={() => loadClinics()} disabled={isBusy}>
          <RefreshCw aria-hidden="true" />
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        <form
          className="surface-soft grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6"
          onSubmit={(event) => void handleCreateClinic(event)}
        >
          <label className="space-y-1 xl:col-span-2">
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

          <label className="space-y-1">
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

          <label className="space-y-1">
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

          <label className="space-y-1">
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

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Contraseña inicial</span>
            <Input
              type="text"
              value={createForm.password}
              disabled={isBusy}
              minLength={8}
              required
              autoComplete="new-password"
              onChange={(event) =>
                updateCreateField("password", event.target.value)
              }
            />
          </label>

          <div className="flex items-end xl:col-span-5">
            <p className="text-xs text-muted-foreground">
              La contraseña anterior no se puede consultar. Para recuperación,
              cargue una nueva contraseña visible y guárdela.
            </p>
          </div>

          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={isBusy}>
              <Plus aria-hidden="true" />
              {activeActionKey === "create-clinic" ? "Creando..." : "Crear clínica"}
            </Button>
          </div>
        </form>

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
              className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
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
              <span>
                {pageStart}–{pageEnd} de {totalClinics}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
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
                className="h-7 w-7 p-0"
                onClick={() => loadClinics(currentOffset + PAGE_SIZE)}
                disabled={isBusy || !hasNext}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden">
          <Table>
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
                rows.map(({ clinic, user }) => (
                  <TableRow
                    key={`${clinic.clinicId}-${user?.userId ?? "empty"}`}
                  >
                    <TableCell className="align-top">
                      <div>
                        <span className="block text-sm font-medium">
                          {clinic.clinicName}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          #{clinic.clinicId}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top text-sm">
                      <div className="space-y-0.5">
                        <span className="block">{clinic.contactEmail ?? "—"}</span>
                        {clinic.contactPhone ? (
                          <span className="block text-xs text-muted-foreground">
                            {clinic.contactPhone}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="align-top text-sm">
                      {user ? (
                        <div>
                          <span className="block">{user.username}</span>
                          <span className="block font-mono text-xs text-muted-foreground">
                            #{user.userId}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin usuario
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-top text-xs text-muted-foreground">
                      <div className="space-y-0.5">
                        <p>Creada: {formatDateTime(clinic.createdAt)}</p>
                        <p>Actualizada: {formatDateTime(clinic.updatedAt)}</p>
                      </div>
                    </TableCell>

                    <TableCell className="align-top text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy || editingClinic !== null}
                        onClick={() => setEditingClinic(clinic)}
                        aria-label={`Editar clínica ${clinic.clinicName}`}
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
