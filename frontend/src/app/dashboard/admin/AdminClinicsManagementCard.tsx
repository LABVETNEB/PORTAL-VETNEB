"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { KeyRound, Plus, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  changeAdminClinicUserRole,
  createAdminClinicWithUser,
  getAdminClinics,
  updateAdminClinic,
  updateAdminClinicUserCredentials,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminClinicManagementSummary,
  AdminClinicsSnapshot,
  ClinicUserRole,
} from "@/types";

const PAGE_SIZE = 50;

type CreateClinicForm = {
  clinicName: string;
  contactEmail: string;
  contactPhone: string;
  username: string;
  password: string;
  role: ClinicUserRole;
};

type ClinicDraft = {
  clinicName: string;
  contactEmail: string;
  contactPhone: string;
};

type UserDraft = {
  username: string;
  password: string;
  role: ClinicUserRole;
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
    role: "clinic_owner",
  };
}

function formatRole(value: ClinicUserRole) {
  return value === "clinic_owner" ? "Owner clínica" : "Staff clínica";
}

function getRoleVariant(
  value: ClinicUserRole,
): "default" | "secondary" | "destructive" | "outline" {
  return value === "clinic_owner" ? "secondary" : "outline";
}

function getUserDraftKey(userId: number) {
  return String(userId);
}

function getClinicDraft(clinic: AdminClinicManagementSummary): ClinicDraft {
  return {
    clinicName: clinic.clinicName,
    contactEmail: clinic.contactEmail ?? "",
    contactPhone: clinic.contactPhone ?? "",
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

export function AdminClinicsManagementCard() {
  const [snapshot, setSnapshot] = useState<AdminClinicsSnapshot | null>(null);
  const [createForm, setCreateForm] = useState<CreateClinicForm>(
    getInitialCreateForm,
  );
  const [clinicDrafts, setClinicDrafts] = useState<Record<number, ClinicDraft>>(
    {},
  );
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => getClinicUserRows(snapshot), [snapshot]);
  const isBusy = isPending || activeActionKey !== null;

  function applySnapshot(nextSnapshot: AdminClinicsSnapshot) {
    const nextClinicDrafts: Record<number, ClinicDraft> = {};
    const nextUserDrafts: Record<string, UserDraft> = {};

    for (const clinic of nextSnapshot.clinics) {
      nextClinicDrafts[clinic.clinicId] = getClinicDraft(clinic);

      for (const user of clinic.users) {
        nextUserDrafts[getUserDraftKey(user.userId)] = {
          username: user.username,
          password: "",
          role: user.role,
        };
      }
    }

    setSnapshot(nextSnapshot);
    setClinicDrafts(nextClinicDrafts);
    setUserDrafts(nextUserDrafts);
  }

  function loadClinics() {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          applySnapshot(await getAdminClinics({ limit: PAGE_SIZE, offset: 0 }));
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las clínicas.",
          );
        }
      })();
    });
  }

  function updateCreateField<K extends keyof CreateClinicForm>(
    key: K,
    value: CreateClinicForm[K],
  ) {
    setCreateForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleCreateClinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

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
        role: createForm.role,
      });

      setCreateForm(getInitialCreateForm());
      setSuccessMessage(
        `Clínica creada: ${result.clinic.clinicName} con usuario ${result.user.username}.`,
      );
      loadClinics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear la clínica.",
      );
    } finally {
      setActiveActionKey(null);
    }
  }

  async function handleUpdateClinic(clinic: AdminClinicManagementSummary) {
    const draft = clinicDrafts[clinic.clinicId];

    if (!draft || isBusy) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setActiveActionKey(`clinic-${clinic.clinicId}`);

    try {
      const result = await updateAdminClinic(clinic.clinicId, {
        clinicName: draft.clinicName,
        contactEmail: draft.contactEmail.trim() || null,
        contactPhone: draft.contactPhone.trim() || null,
      });

      setSuccessMessage(`Clínica actualizada: ${result.clinic.clinicName}.`);
      loadClinics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar la clínica.",
      );
    } finally {
      setActiveActionKey(null);
    }
  }

  async function handleUpdateCredentials(userId: number) {
    const key = getUserDraftKey(userId);
    const draft = userDrafts[key];
    const currentUser = snapshot?.clinics
      .flatMap((clinic) => clinic.users)
      .find((user) => user.userId === userId);

    if (!draft || !currentUser || isBusy) {
      return;
    }

    const payload: { username?: string; password?: string } = {};

    if (draft.username.trim() !== currentUser.username) {
      payload.username = draft.username;
    }

    if (draft.password.trim()) {
      const confirmed = window.confirm(
        "La contraseña se reemplaza; no se puede consultar la actual. ¿Confirmás el cambio?",
      );

      if (!confirmed) {
        return;
      }

      payload.password = draft.password;
    }

    if (!payload.username && !payload.password) {
      setError("No hay cambios de usuario o credencial para guardar.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setActiveActionKey(`credentials-${userId}`);

    try {
      const result = await updateAdminClinicUserCredentials(userId, payload);

      setSuccessMessage(`Credenciales actualizadas para ${result.user.username}.`);
      loadClinics();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron actualizar las credenciales.",
      );
    } finally {
      setActiveActionKey(null);
    }
  }

  async function handleChangeRole(userId: number) {
    const key = getUserDraftKey(userId);
    const draft = userDrafts[key];
    const currentUser = snapshot?.clinics
      .flatMap((clinic) => clinic.users)
      .find((user) => user.userId === userId);

    if (!draft || !currentUser || isBusy) {
      return;
    }

    if (draft.role === currentUser.role) {
      setError("No hay cambio de rol para guardar.");
      return;
    }

    const confirmed = window.confirm(
      `¿Cambiar el rol de ${currentUser.username} de ${formatRole(
        currentUser.role,
      )} a ${formatRole(draft.role)}?`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setActiveActionKey(`role-${userId}`);

    try {
      const result = await changeAdminClinicUserRole(userId, draft.role);

      setSuccessMessage(
        `Rol actualizado: ${result.user.username} ahora es ${formatRole(
          result.user.role,
        )}.`,
      );
      loadClinics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el rol.");
    } finally {
      setActiveActionKey(null);
    }
  }

  useEffect(() => {
    loadClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card id="admin-clinics" className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-base">Clínicas</CardTitle>
        <Button type="button" onClick={loadClinics} disabled={isBusy}>
          <RefreshCw aria-hidden="true" />
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
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
              type="password"
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

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Rol inicial</span>
            <select
              className="field-select"
              value={createForm.role}
              disabled={isBusy}
              onChange={(event) =>
                updateCreateField("role", event.target.value as ClinicUserRole)
              }
            >
              <option value="clinic_owner">Owner clínica</option>
              <option value="clinic_staff">Staff clínica</option>
            </select>
          </label>

          <div className="flex items-end xl:col-span-5">
            <p className="text-xs text-muted-foreground">
              La contraseña se reemplaza; no se puede consultar la actual.
            </p>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full"
              disabled={isBusy}
            >
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
          <div className="clinical-alert-success">
            {successMessage}
          </div>
        ) : null}

        <div className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clínica</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map(({ clinic, user }) => {
                  const clinicDraft =
                    clinicDrafts[clinic.clinicId] ?? getClinicDraft(clinic);
                  const userDraft = user
                    ? userDrafts[getUserDraftKey(user.userId)] ?? {
                        username: user.username,
                        password: "",
                        role: user.role,
                      }
                    : null;

                  return (
                    <TableRow
                      key={`${clinic.clinicId}-${user?.userId ?? "empty"}`}
                    >
                      <TableCell className="min-w-[220px] align-top">
                        <div className="space-y-2">
                          <Input
                            value={clinicDraft.clinicName}
                            disabled={isBusy}
                            maxLength={255}
                            onChange={(event) =>
                              setClinicDrafts((current) => ({
                                ...current,
                                [clinic.clinicId]: {
                                  ...clinicDraft,
                                  clinicName: event.target.value,
                                },
                              }))
                            }
                          />
                          <span className="block font-mono text-xs text-muted-foreground">
                            Clínica #{clinic.clinicId}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="min-w-[220px] align-top">
                        <div className="space-y-2">
                          <Input
                            type="email"
                            value={clinicDraft.contactEmail}
                            disabled={isBusy}
                            maxLength={255}
                            onChange={(event) =>
                              setClinicDrafts((current) => ({
                                ...current,
                                [clinic.clinicId]: {
                                  ...clinicDraft,
                                  contactEmail: event.target.value,
                                },
                              }))
                            }
                          />
                          <Input
                            value={clinicDraft.contactPhone}
                            disabled={isBusy}
                            maxLength={50}
                            placeholder="Teléfono opcional"
                            onChange={(event) =>
                              setClinicDrafts((current) => ({
                                ...current,
                                [clinic.clinicId]: {
                                  ...clinicDraft,
                                  contactPhone: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </TableCell>

                      <TableCell className="min-w-[220px] align-top">
                        {user && userDraft ? (
                          <div className="space-y-2">
                            <Input
                              value={userDraft.username}
                              disabled={isBusy}
                              minLength={3}
                              maxLength={100}
                              onChange={(event) =>
                                setUserDrafts((current) => ({
                                  ...current,
                                  [getUserDraftKey(user.userId)]: {
                                    ...userDraft,
                                    username: event.target.value,
                                  },
                                }))
                              }
                            />
                            <Input
                              type="password"
                              value={userDraft.password}
                              disabled={isBusy}
                              minLength={8}
                              autoComplete="new-password"
                              placeholder="Nueva contraseña"
                              onChange={(event) =>
                                setUserDrafts((current) => ({
                                  ...current,
                                  [getUserDraftKey(user.userId)]: {
                                    ...userDraft,
                                    password: event.target.value,
                                  },
                                }))
                              }
                            />
                            <span className="block font-mono text-xs text-muted-foreground">
                              Usuario #{user.userId}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Sin usuario de clínica
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="min-w-[170px] align-top">
                        {user && userDraft ? (
                          <div className="space-y-2">
                            <Badge variant={getRoleVariant(user.role)}>
                              {formatRole(user.role)}
                            </Badge>
                            <select
                              className="field-select"
                              value={userDraft.role}
                              disabled={isBusy}
                              onChange={(event) =>
                                setUserDrafts((current) => ({
                                  ...current,
                                  [getUserDraftKey(user.userId)]: {
                                    ...userDraft,
                                    role: event.target.value as ClinicUserRole,
                                  },
                                }))
                              }
                            >
                              <option value="clinic_owner">Owner clínica</option>
                              <option value="clinic_staff">Staff clínica</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="align-top text-xs text-muted-foreground">
                        <div className="space-y-1">
                          <p>Creada: {formatDateTime(clinic.createdAt)}</p>
                          <p>Actualizada: {formatDateTime(clinic.updatedAt)}</p>
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-col items-stretch gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void handleUpdateClinic(clinic)}
                          >
                            <Save aria-hidden="true" />
                            {activeActionKey === `clinic-${clinic.clinicId}`
                              ? "Guardando..."
                              : "Guardar clínica"}
                          </Button>
                          {user ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleUpdateCredentials(user.userId)
                                }
                              >
                                <KeyRound aria-hidden="true" />
                                {activeActionKey === `credentials-${user.userId}`
                                  ? "Guardando..."
                                  : "Guardar acceso"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => void handleChangeRole(user.userId)}
                              >
                                <ShieldCheck aria-hidden="true" />
                                {activeActionKey === `role-${user.userId}`
                                  ? "Cambiando..."
                                  : "Cambiar rol"}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="clinical-table-state">
                    {isPending
                      ? "Cargando clínicas..."
                      : "No hay clínicas para mostrar."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
