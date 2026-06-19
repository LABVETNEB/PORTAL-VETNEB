"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { changeAdminClinicUserRole, getAdminUsersRoles } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminRoleUserRole,
  AdminRoleUserSummary,
  AdminRoleUserType,
  AdminUsersRolesSnapshot,
  ClinicUserRole,
} from "@/types";

// Nine compact rows are the viewport-safe contract established for the admin
// modules while dashboard-main intentionally remains non-scrollable.
const PAGE_SIZE = 9;

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

function getClinicMetadata(user: AdminRoleUserSummary) {
  if (user.userType === "admin") return null;

  return [
    `Clínica #${user.clinicId}`,
    user.clinicLocality?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");
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

type RoleBadgeProps = {
  role: AdminRoleUserRole;
};

function AdminRoleBadge({ role }: RoleBadgeProps) {
  return (
    <Badge
      variant={getRoleVariant(role)}
      className="h-5 max-w-full truncate px-1.5 text-[11px] font-medium"
    >
      {formatRole(role)}
    </Badge>
  );
}

type UserTypeBadgeProps = {
  userType: AdminRoleUserType;
};

function AdminUserTypeBadge({ userType }: UserTypeBadgeProps) {
  return (
    <Badge
      variant={getUserTypeVariant(userType)}
      className="h-5 px-1.5 text-[11px] font-medium"
    >
      {formatUserType(userType)}
    </Badge>
  );
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
      `¿Cambiar el rol de ${user.username} de ${formatRole(user.role)} a ${formatRole(nextRole)}? El cambio quedará registrado en auditoría.`,
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

  const users = snapshot?.users ?? [];
  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.users.length < snapshot.total
    : false;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = snapshot ? Math.max(1, Math.ceil(snapshot.total / PAGE_SIZE)) : 1;
  const rangeStart = users.length ? offset + 1 : 0;
  const rangeEnd = offset + users.length;

  return (
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden shadow-none hover:shadow-none">
      <CardHeader className="flex min-h-12 shrink-0 flex-row items-center justify-between gap-3 space-y-0 border-b border-vetneb-line/70 px-3 py-2 sm:px-4 md:min-h-10 md:py-1.5">
        <div className="min-w-0">
          <CardTitle className="text-base">Usuarios y roles</CardTitle>
          <p
            className={`line-clamp-2 text-xs sm:truncate ${
              error
                ? "text-destructive"
                : roleChangeMessage
                  ? "text-vetneb-teal"
                  : "text-muted-foreground"
            }`}
            role={error ? "alert" : roleChangeMessage ? "status" : undefined}
            title={error ?? roleChangeMessage ?? undefined}
          >
            {error ??
              roleChangeMessage ??
              "Permisos administrativos y de clínica con cambios auditados."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-2.5 text-xs md:h-7 md:px-2"
          onClick={loadUsersRoles}
          disabled={isPending || isMutatingRole}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="grid min-h-11 shrink-0 grid-cols-3 border-b border-vetneb-line/70 md:min-h-9">
          <div className="flex items-center justify-between gap-2 px-3 py-1 sm:px-4 md:py-0.5">
            <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
              Total filtrado
            </span>
            <strong className="text-xl font-semibold tabular-nums text-vetneb-ink md:text-lg">
              {snapshot?.total ?? "—"}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-2 border-x border-vetneb-line/70 px-3 py-1 sm:px-4 md:py-0.5">
            <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
              Admins
            </span>
            <strong className="text-xl font-semibold tabular-nums text-vetneb-ink md:text-lg">
              {snapshot?.totals.adminUsers ?? "—"}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-1 sm:px-4 md:py-0.5">
            <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
              Clínicas
            </span>
            <strong className="text-xl font-semibold tabular-nums text-vetneb-ink md:text-lg">
              {snapshot?.totals.clinicUsers ?? "—"}
            </strong>
          </div>
        </div>

        <div
          className="flex min-h-12 shrink-0 items-end gap-2 border-b border-vetneb-line/70 bg-muted/15 px-3 py-2 sm:px-4 md:min-h-10 md:py-1"
          aria-label="Filtros de usuarios y roles"
        >
          <label className="grid min-w-0 flex-1 gap-1 text-[11px] font-medium text-muted-foreground sm:max-w-48 md:gap-0.5">
            Tipo usuario
            <select
              className="field-select h-8 text-xs md:h-7"
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

          <label className="grid min-w-0 flex-1 gap-1 text-[11px] font-medium text-muted-foreground sm:max-w-48 md:gap-0.5">
            Rol
            <select
              className="field-select h-8 text-xs md:h-7"
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

          <span className="ml-auto hidden pb-2 text-[11px] text-muted-foreground md:inline">
            {PAGE_SIZE} por página
          </span>
        </div>

        <div className="min-h-0 flex-1 py-2 md:py-1">
          {users.length ? (
            <>
              <div className="dashboard-table-responsive dashboard-fitted-table hidden px-3 md:block sm:px-4">
                <Table
                  className="table-fixed text-[13px] [&_td]:h-8 [&_td]:px-2 [&_td]:py-0.5 [&_th]:h-8 [&_th]:px-2 [&_th]:text-xs [&_th]:font-semibold"
                  aria-label="Tabla de usuarios y roles administrativos"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[18%]">Usuario</TableHead>
                      <TableHead className="w-[10%]">Tipo</TableHead>
                      <TableHead className="w-[14%]">Rol</TableHead>
                      <TableHead>Clínica</TableHead>
                      <TableHead className="hidden w-[9.5rem] xl:table-cell">Creado</TableHead>
                      <TableHead className="w-[9.5rem]">Actualizado</TableHead>
                      <TableHead className="w-[8.5rem] text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const userKey = getUserKey(user);
                      const isChanging = changingUserKey === userKey;
                      const wasChanged = changedUserKey === userKey;

                      return (
                        <TableRow
                          key={userKey}
                          className={wasChanged ? "bg-vetneb-teal/10" : undefined}
                        >
                          <TableCell>
                            <p className="truncate font-semibold text-vetneb-ink/90">
                              {user.username}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              ID {user.userId}{wasChanged ? " · Actualizado" : ""}
                            </p>
                          </TableCell>
                          <TableCell>
                            <AdminUserTypeBadge userType={user.userType} />
                          </TableCell>
                          <TableCell>
                            <AdminRoleBadge role={user.role} />
                          </TableCell>
                          <TableCell>
                            <p className="truncate text-xs text-vetneb-ink/85">
                              {user.userType === "clinic"
                                ? user.clinicName || `Clínica #${user.clinicId}`
                                : "Administración VETNEB"}
                            </p>
                            {getClinicMetadata(user) ? (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {getClinicMetadata(user)}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="hidden truncate text-xs text-muted-foreground xl:table-cell">
                            {formatDateTime(user.createdAt)}
                          </TableCell>
                          <TableCell className="truncate text-xs text-muted-foreground">
                            {formatDateTime(user.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {user.userType === "clinic" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={disableUserActions}
                                aria-busy={isChanging ? true : undefined}
                                onClick={() => void handleChangeClinicRole(user)}
                              >
                                {isChanging ? "Cambiando..." : "Cambiar rol"}
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                No editable
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-vetneb-line/70 border-y border-vetneb-line/70 md:hidden">
                {users.map((user) => {
                  const userKey = getUserKey(user);
                  const isChanging = changingUserKey === userKey;

                  return (
                    <div key={userKey} className="flex min-h-10 items-center gap-2 px-3 py-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-vetneb-ink">
                            {user.username}
                          </p>
                          <AdminRoleBadge role={user.role} />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          ID {user.userId} · {formatClinic(user)}
                        </p>
                      </div>
                      {user.userType === "clinic" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          disabled={disableUserActions}
                          aria-busy={isChanging ? true : undefined}
                          onClick={() => void handleChangeClinicRole(user)}
                        >
                          {isChanging ? "Cambiando..." : "Cambiar"}
                        </Button>
                      ) : (
                        <AdminUserTypeBadge userType={user.userType} />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mx-3 flex min-h-20 items-center justify-center rounded-md border border-vetneb-line/70 bg-muted/20 px-4 text-center text-xs text-muted-foreground sm:mx-4">
              {isPending
                ? "Cargando usuarios y roles..."
                : "No hay usuarios para los filtros seleccionados."}
            </div>
          )}
        </div>

        <footer
          className="dashboard-table-pagination min-h-10 shrink-0 border-t border-vetneb-line/70 px-3 py-1.5 text-xs text-muted-foreground sm:px-4 md:min-h-8 md:py-1"
          aria-label="Paginación de usuarios y roles"
        >
          <span aria-live="polite">
            {users.length ? `${rangeStart}–${rangeEnd} de ${snapshot?.total ?? 0}` : "Sin usuarios"}
          </span>
          <div className="dashboard-table-pagination-controls">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPreviousPage || disableUserActions}
              onClick={() => {
                resetFiltersFeedback();
                setOffset(Math.max(offset - PAGE_SIZE, 0));
              }}
              className="h-7 px-2 text-xs flex-1 sm:flex-none"
            >
              Anterior
            </Button>
            <span
              className="dashboard-pagination-context"
              aria-live="polite"
              aria-atomic="true"
            >
              Pág. {page} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNextPage || disableUserActions}
              onClick={() => {
                resetFiltersFeedback();
                setOffset(offset + PAGE_SIZE);
              }}
              className="h-7 px-2 text-xs flex-1 sm:flex-none"
            >
              Siguiente
            </Button>
          </div>
        </footer>
      </CardContent>
    </Card>
  );
}
