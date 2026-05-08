"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { getAdminUsersRoles } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminRoleUserRole,
  AdminRoleUserSummary,
  AdminRoleUserType,
  AdminUsersRolesSnapshot,
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

export function AdminUsersRolesReadOnlyCard() {
  const [snapshot, setSnapshot] = useState<AdminUsersRolesSnapshot | null>(null);
  const [userType, setUserType] = useState<AdminRoleUserType | "all">("all");
  const [role, setRole] = useState<AdminRoleUserRole | "all">("all");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    loadUsersRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.users.length < snapshot.total
    : false;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Usuarios y roles</CardTitle>
          <CardDescription>
            Vista read-only de usuarios Admin y clínica. No permite edición,
            revocación ni acciones destructivas.
          </CardDescription>
        </div>

        <Button type="button" onClick={loadUsersRoles} disabled={isPending}>
          {isPending ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-400">Total filtrado</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {snapshot?.total ?? "—"}
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-400">Admins</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {snapshot?.totals.adminUsers ?? "—"}
            </p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-400">Clínicas</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {snapshot?.totals.clinicUsers ?? "—"}
            </p>
          </div>

          <label className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <span className="text-xs text-gray-400">Tipo usuario</span>
            <select
              className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
              value={userType}
              onChange={(event) => {
                setOffset(0);
                setUserType(event.target.value as AdminRoleUserType | "all");
              }}
            >
              <option value="all">Todos</option>
              <option value="admin">Admin</option>
              <option value="clinic">Clínica</option>
            </select>
          </label>

          <label className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <span className="text-xs text-gray-400">Rol</span>
            <select
              className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
              value={role}
              onChange={(event) => {
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot?.users.length ? (
                snapshot.users.map((user) => (
                  <TableRow key={`${user.userType}-${user.userId}`}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-gray-700">
                          {user.username}
                        </span>
                        <span className="font-mono text-xs text-gray-400">
                          #{user.userId}
                        </span>
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
                    <TableCell className="text-sm text-gray-500">
                      {formatClinic(user)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {formatDateTime(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {formatDateTime(user.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-gray-400"
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

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-gray-400">
            Endpoint: <code>GET /api/admin/users-roles</code>. Campos sensibles
            como <code>passwordHash</code>, <code>authProId</code> y tokens no
            se renderizan.
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasPreviousPage || isPending}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!hasNextPage || isPending}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}