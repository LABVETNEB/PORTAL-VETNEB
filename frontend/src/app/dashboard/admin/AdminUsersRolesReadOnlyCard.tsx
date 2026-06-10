"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  getAdminUsersRoles,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminRoleUserRole,
  AdminRoleUserSummary,
  AdminRoleUserType,
  AdminUsersRolesSnapshot,
  ClinicUserRole,
} from "@/types";

const PAGE_SIZE = 25;

function formatUserType(value: AdminRoleUserType) {
  return value === "admin" ? "Admin" : "Clínica";
}

function formatRole(value: AdminRoleUserRole) {
  if (value === "admin") return "Admin";
  if (value === "clinic_owner") return "Owner clínica";
  return "Staff clínica";
}

function getUserTypeVariant(
  value: AdminRoleUserType,
): "default" | "secondary" | "destructive" | "outline" {
  return value === "admin" ? "default" : "secondary";
}

function getRoleVariant(
  value: AdminRoleUserRole,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "admin") return "default";
  if (value === "clinic_owner") return "secondary";
  return "outline";
}

function formatClinic(user: AdminRoleUserSummary) {
  if (user.userType === "admin") return "—";

  return user.clinicName ? `${user.clinicName} #${user.clinicId}` : `#${user.clinicId}`;
}

function getNextClinicRole(role: ClinicUserRole): ClinicUserRole {
  return role === "clinic_owner" ? "clinic_staff" : "clinic_owner";
}

function getUserKey(user: AdminRoleUserSummary) {
  return `${user.userType}-${user.userId}`;
}

function formatRoleChangeError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo cambiar el rol del usuario.";

  if (
    message.includes("último clinic_owner") ||
    message.includes("ultimo clinic_owner") ||
    message.includes("last clinic_owner")
  ) {
    return "No se puede degradar el último Owner clínica. Asigná otro Owner clínica antes de cambiar este rol.";
  }

  if (message.includes("Usuario de clínica no encontrado")) {
    return "El usuario de clínica ya no existe o no está disponible. Actualizá la lista e intentá nuevamente.";
  }

  if (message.includes("role inválido") || message.includes("rol inválido")) {
    return "El rol seleccionado no es válido. Solo se permiten Owner clínica y Staff clínica.";
  }

  return message;
}

export function AdminUsersRolesReadOnlyCard() {
  const [snapshot, setSnapshot] = useState<AdminUsersRolesSnapshot | null>(null);
  const [userType, setUserType] = useState<AdminRoleUserType | "all">("all");
  const [role, setRole] = useState<AdminRoleUserRole | "all">("all");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [roleChangeMessage, setRoleChangeMessage] = useState<string | null>(null);
  const [changingUserKey, setChangingUserKey] = useState<string | null>(null);
  const [changedUserKey, setChangedUserKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const query = useMemo(
    () => ({
      ...(userType !== "all" ? { userType } : {}),
      ...(role !== "all" ? { role } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [offset, role, userType],
  );

  const isMutatingRole = changingUserKey !== null;
  const disableUserActions = isPending || isMutatingRole;

  function loadUsersRoles() {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminUsersRoles(query);
          setSnapshot(result);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar usuarios y roles.",
          );
        }
      })();
    });
  }

  function resetFiltersFeedback() {
    setError(null);
    setRoleChangeMessage(null);
    setChangedUserKey(null);
  }

  async function handleChangeClinicRole(
    user: Extract<AdminRoleUserSummary, { userType: "clinic" }>,
  ) {
    if (disableUserActions) {
      return;
    }

    const nextRole = getNextClinicRole(user.role);
    const confirmed = window.confirm(
      `¿Cambiar el rol de ${user.username} de ${formatRole(user.role)} a ${formatRole(nextRole)}?`,
    );

    if (!confirmed) {
      return;
    }

    const userKey = getUserKey(user);

    setError(null);
    setRoleChangeMessage(null);
    setChangedUserKey(null);
    setChangingUserKey(userKey);

    try {
      const result = await changeAdminClinicUserRole(user.userId, nextRole);

      setSnapshot((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          users: current.users.map((entry) =>
            entry.userType === "clinic" && entry.userId === result.user.userId
              ? result.user
              : entry,
          ),
        };
      });

      setChangedUserKey(userKey);
      setRoleChangeMessage(
        `Rol actualizado: ${result.user.username} ahora es ${formatRole(result.user.role)}.`,
      );
    } catch (err) {
      setError(formatRoleChangeError(err));
    } finally {
      setChangingUserKey(null);
    }
  }

  useEffect(() => {
    loadUsersRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.users.length < snapshot.total
    : false;

  return (
    <Card className="dashboard-surface">
      <CardHeader className="flex flex-col gap-3 border-b border-vetneb-line/70 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Usuarios y roles</CardTitle>
        </div>

        <Button
          type="button"
          onClick={loadUsersRoles}
          disabled={isPending || isMutatingRole}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        <div className="dashboard-filter-stats-grid-5">
          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Total filtrado</p>
            <p className="mt-1 text-2xl font-bold text-vetneb-ink">
              {snapshot?.total ?? "—"}
            </p>
          </div>

          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Admins</p>
            <p className="mt-1 text-2xl font-bold text-vetneb-ink">
              {snapshot?.totals.adminUsers ?? "—"}
            </p>
          </div>

          <div className="surface-soft">
            <p className="text-xs text-muted-foreground">Clínicas</p>
            <p className="mt-1 text-2xl font-bold text-vetneb-ink">
              {snapshot?.totals.clinicUsers ?? "—"}
            </p>
          </div>

          <label className="surface-soft">
            <span className="text-xs text-muted-foreground">Tipo usuario</span>
            <select
              className="field-select mt-2"
              value={userType}
              disabled={disableUserActions}
              onChange={(event) => {
                resetFiltersFeedback();
                setOffset(0);
                setUserType(event.target.value as AdminRoleUserType | "all");
              }}
            >
              <option value="all">Todos</option>
              <option value="admin">Admin</option>
              <option value="clinic">Clínica</option>
            </select>
          </label>

          <label className="surface-soft">
            <span className="text-xs text-muted-foreground">Rol</span>
            <select
              className="field-select mt-2"
              value={role}
              disabled={disableUserActions}
              onChange={(event) => {
                resetFiltersFeedback();
                setOffset(0);
                setRole(event.target.value as AdminRoleUserRole | "all");
              }}
            >
              <option value="all">Todos</option>
              <option value="admin">Admin</option>
              <option value="clinic_owner">Owner clínica</option>
              <option value="clinic_staff">Staff clínica</option>
            </select>
          </label>
        </div>

        {error ? (
          <div className="clinical-alert-error">
            {error}
          </div>
        ) : null}

        {roleChangeMessage ? (
          <div className="clinical-alert-success">
            {roleChangeMessage}
          </div>
        ) : null}

        <div className="dashboard-table-responsive">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot?.users.length ? (
                snapshot.users.map((user) => {
                  const userKey = getUserKey(user);
                  const isChanging = changingUserKey === userKey;
                  const wasChanged = changedUserKey === userKey;

                  return (
                    <TableRow
                      key={userKey}
                      className={wasChanged ? "bg-vetneb-teal/10" : undefined}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-vetneb-ink/88">
                            {user.username}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            #{user.userId}
                          </span>
                          {wasChanged ? (
                            <span className="text-xs font-medium text-vetneb-teal">
                              Actualizado
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getUserTypeVariant(user.userType)}>
                          {formatUserType(user.userType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleVariant(user.role)}>
                          {formatRole(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatClinic(user)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(user.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.userType === "clinic" ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disableUserActions}
                            onClick={() => void handleChangeClinicRole(user)}
                          >
                            {isChanging
                              ? "Cambiando..."
                              : `Cambiar a ${formatRole(getNextClinicRole(user.role))}`}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No editable
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="clinical-table-state"
                  >
                    {isPending
                      ? "Cargando usuarios y roles..."
                      : "No hay usuarios para los filtros seleccionados."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="dashboard-table-pagination">
          <div className="dashboard-table-pagination-controls">
            <Button
              type="button"
              variant="outline"
              disabled={!hasPreviousPage || disableUserActions}
              onClick={() => {
                resetFiltersFeedback();
                setOffset(Math.max(offset - PAGE_SIZE, 0));
              }}
              className="flex-1 sm:flex-none"
            >
              Anterior
            </Button>
            <span
              className="dashboard-pagination-context"
              aria-live="polite"
              aria-atomic="true"
            >
              Pág.&nbsp;{Math.floor(offset / PAGE_SIZE) + 1}
              {snapshot ? ` / ${Math.max(1, Math.ceil(snapshot.total / PAGE_SIZE))}` : null}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={!hasNextPage || disableUserActions}
              onClick={() => {
                resetFiltersFeedback();
                setOffset(offset + PAGE_SIZE);
              }}
              className="flex-1 sm:flex-none"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
