"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { changeAdminClinicUserRole, getAdminUsersRoles } from "@/lib/api";
import type {
  AdminRoleUserRole,
  AdminRoleUserSummary,
  AdminRoleUserType,
  AdminUsersRolesSnapshot,
  ClinicUserRole,
} from "@/types";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";

const MOBILE_PAGE_SIZE = 3;

function formatRole(value: AdminRoleUserRole) {
  if (value === "admin") return "Admin";
  if (value === "clinic_owner") return "Owner";
  return "Staff";
}

function nextRole(value: ClinicUserRole): ClinicUserRole {
  return value === "clinic_owner" ? "clinic_staff" : "clinic_owner";
}

function userKey(user: AdminRoleUserSummary) {
  return `${user.userType}-${user.userId}`;
}

export function AdminMobileUsersModule() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminUsersRolesSnapshot | null>(null);
  const [userType, setUserType] = useState<AdminRoleUserType | "all">("all");
  const [role, setRole] = useState<AdminRoleUserRole | "all">("all");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [changingUserKey, setChangingUserKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const query = useMemo(
    () => ({
      ...(userType !== "all" ? { userType } : {}),
      ...(role !== "all" ? { role } : {}),
      limit: MOBILE_PAGE_SIZE,
      offset,
    }),
    [offset, role, userType],
  );

  function loadUsers() {
    if (!isMobileViewport) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          setSnapshot(await getAdminUsersRoles(query));
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar usuarios y roles.");
        }
      })();
    });
  }

  async function handleRoleChange(
    user: Extract<AdminRoleUserSummary, { userType: "clinic" }>,
  ) {
    const targetRole = nextRole(user.role);
    if (!window.confirm(`¿Cambiar el rol de ${user.username} a ${formatRole(targetRole)}? El cambio quedará registrado en auditoría.`)) return;

    const key = userKey(user);
    setError(null);
    setChangingUserKey(key);
    try {
      const result = await changeAdminClinicUserRole(user.userId, targetRole);
      setSnapshot((current) => current ? {
        ...current,
        users: current.users.map((entry) => entry.userType === "clinic" && entry.userId === result.user.userId ? result.user : entry),
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el rol del usuario.");
    } finally {
      setChangingUserKey(null);
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobileViewport, query]);

  const users = snapshot?.users ?? [];
  const page = Math.floor(offset / MOBILE_PAGE_SIZE) + 1;
  const pageCount = snapshot
    ? Math.max(1, Math.ceil(snapshot.total / MOBILE_PAGE_SIZE))
    : 1;
  const rangeStart = users.length ? offset + 1 : 0;
  const rangeEnd = offset + users.length;
  const hasNextPage = snapshot ? rangeEnd < snapshot.total : false;
  const disabled = isPending || changingUserKey !== null;

  return (
    <section
      data-admin-mobile-ops-module="users"
      aria-label="Usuarios y roles administrativos"
      className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card md:hidden"
    >
      <header className="flex min-h-10 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-vetneb-line/70 px-2 py-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-vetneb-ink">
            {snapshot ? `${snapshot.total} usuarios` : "Usuarios"}
          </p>
          <p className={`truncate text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`} role={error ? "alert" : undefined}>
            {error ?? "Roles y permisos"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={loadUsers}
          disabled={disabled || !isMobileViewport}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Actualizar
        </Button>
      </header>

      <div className="grid min-h-12 shrink-0 grid-cols-2 gap-2 overflow-hidden border-b border-vetneb-line/70 bg-muted/15 px-2 py-1">
        <label className="grid min-w-0 gap-0.5 text-[10px] font-medium text-muted-foreground">
          Tipo
          <select
            className="field-select h-7 text-xs"
            value={userType}
            disabled={disabled}
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
        <label className="grid min-w-0 gap-0.5 text-[10px] font-medium text-muted-foreground">
          Rol
          <select
            className="field-select h-7 text-xs"
            value={role}
            disabled={disabled}
            onChange={(event) => {
              setOffset(0);
              setRole(event.target.value as AdminRoleUserRole | "all");
            }}
          >
            <option value="all">Todos</option>
            <option value="admin">Admin</option>
            <option value="clinic_owner">Owner</option>
            <option value="clinic_staff">Staff</option>
          </select>
        </label>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-3 overflow-hidden">
        {users.length ? (
          users.map((user) => {
            const key = userKey(user);
            const isChanging = changingUserKey === key;
            return (
              <article
                key={key}
                data-admin-mobile-ops-item="true"
                className="flex min-h-0 items-center gap-2 overflow-hidden border-b border-vetneb-line/70 px-2 py-1 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-xs font-semibold text-vetneb-ink">{user.username}</p>
                    <Badge variant={user.role === "admin" ? "default" : user.role === "clinic_owner" ? "secondary" : "outline"} className="h-5 shrink-0 px-1.5 text-[10px]">
                      {formatRole(user.role)}
                    </Badge>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    ID {user.userId} · {user.userType === "admin" ? "Administración" : user.clinicName ?? `Clínica #${user.clinicId}`}
                  </p>
                </div>
                {user.userType === "clinic" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={disabled}
                    aria-busy={isChanging ? true : undefined}
                    onClick={() => void handleRoleChange(user)}
                  >
                    {isChanging ? "Cambiando..." : "Cambiar"}
                  </Button>
                ) : (
                  <Badge variant="default" className="h-5 shrink-0 px-1.5 text-[10px]">Admin</Badge>
                )}
              </article>
            );
          })
        ) : (
          <div className="col-span-full row-span-3 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {error ? "Error al cargar usuarios" : isPending ? "Cargando usuarios..." : "Sin usuarios"}
          </div>
        )}
      </div>

      <AdminMobileOpsPager
        ariaLabel="Paginación de usuarios"
        page={page}
        pageCount={pageCount}
        rangeLabel={users.length ? `${rangeStart}–${rangeEnd} de ${snapshot?.total ?? 0}` : "Sin usuarios"}
        previousDisabled={offset === 0}
        nextDisabled={!hasNextPage}
        disabled={disabled}
        onPrevious={() => setOffset(Math.max(0, offset - MOBILE_PAGE_SIZE))}
        onNext={() => setOffset(offset + MOBILE_PAGE_SIZE)}
      />
    </section>
  );
}
