"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminRoleUserRole,
  AdminRoleUserSummary,
  AdminRoleUserType,
  AdminUsersRolesSnapshot,
  ClinicUserRole,
} from "@/types";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";

// Server pagination is now sized by the measured rows container (Zero-Scroll
// adaptive contract). Nine compact rows survive only as the pre-measurement
// fallback established for the admin modules.
const USERS_ROLES_FALLBACK_ROWS = 9;
// Hybrid cap: the effective `limit` never exceeds this superset ceiling even on
// very tall viewports; recompute of offset always clamps against it.
const USERS_ROLES_SUPERSET_CAP = 36;
// Fixed header row height of the desktop table (`[&_th]:h-8`), discounted from
// the measured region so the row math never counts the header as a data row.
const USERS_ROLES_TABLE_HEADER_PX = 32;
// Fallback item height used until a real row is measured. Mobile rows use
// `min-h-10`, so the pre-measurement limit must not overestimate capacity.
const USERS_ROLES_ROW_HEIGHT_FALLBACK_PX = 40;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [jumpPageInput, setJumpPageInput] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [roleChangeMessage, setRoleChangeMessage] = useState<string | null>(null);
  const [changingUserKey, setChangingUserKey] = useState<string | null>(null);
  const [changedUserKey, setChangedUserKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // One collapsed runtime feeds both presentations, so the visible container
  // (desktop table region or mobile list region) drives a single cardinality.
  const [desktopBodyNode, setDesktopBodyNode] = useState<HTMLElement | null>(
    null,
  );
  const [mobileBodyNode, setMobileBodyNode] = useState<HTMLElement | null>(null);

  const latestRequestRef = useRef(0);
  const snapshotRef = useRef<AdminUsersRolesSnapshot | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);


  // The desktop table has two-line rows (~41px). Nine of them are the
  // established "nine populated rows" contract at 1440×900 / 1366×768, and that
  // floor used to be unconditional — so at 1280×720, where the measured region
  // is 347px and only seven rows fit, the ninth row overflowed the region by
  // 58px, painted over the pager and swallowed the hit-test of "Siguiente":
  // pagination was unreachable with a real dataset. The floor is now conditional
  // on the region actually being able to host nine rows, so it is preserved
  // exactly where the contract lives and yields where the pixels do not exist.
  // No viewport name, width breakpoint or media query participates: the decision
  // comes from the same measured region the fit itself uses.
  //
  // The gap is 0 on desktop because the measured region carries no padding of
  // its own (see the rows region below), so its border box IS the usable box:
  // subtracting a further cushion would floor 1366×768 to eight rows even
  // though nine fit with clearance to spare. The mobile list keeps the hook
  // default and a floor of one so it can shrink freely on short phones.
  // SRV-2 desktop floor, resolved: it raised `minItems` to the nine-row App
  // Shell page only when nine rows PHYSICALLY fit — and in that case the fit is
  // already nine or more, so the clamp could never raise anything. With the
  // desktop safety gap at 0 the two arithmetics were identical, which makes the
  // floor provably equivalent to `minItems: 1`. Kept as 1 rather than restated,
  // so no dead branch survives to be mistaken for a contract.
  // One owner per canvas. The two presentations are mutually exclusive by
  // media query, so exactly one reports `measured` — a function of the
  // viewport alone, with no row content, page or history in it.
  const mobileCapacity = useDashboardCanvasCapacity({
    canvasNode: mobileBodyNode,
    fallbackItems: USERS_ROLES_FALLBACK_ROWS,
    minItems: 1,
    maxItems: USERS_ROLES_SUPERSET_CAP,
  });
  const desktopCapacity = useDashboardCanvasCapacity({
    canvasNode: desktopBodyNode,
    fallbackItems: USERS_ROLES_FALLBACK_ROWS,
    minItems: 1,
    maxItems: USERS_ROLES_SUPERSET_CAP,
  });
  const rowsPerPage = mobileCapacity.measured
    ? mobileCapacity.capacity
    : desktopCapacity.measured
      ? desktopCapacity.capacity
      : USERS_ROLES_FALLBACK_ROWS;

  // Effective server page size: at least the measured rows, capped at the
  // superset ceiling. The hook already clamps to [1, USERS_ROLES_SUPERSET_CAP].
  const effectiveLimit = rowsPerPage;

  // 300ms debounce (matches the AdminClinicsManagementCard search pattern) so
  // a fast typist doesn't fire one request per keystroke against 5000 rows.
  // Skips the mount run: firing on mount would reset offset to 0 shortly after
  // load and race a page-2 navigation that happens within the debounce window.
  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setOffset(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const query = useMemo(
    () => ({
      ...(userType !== "all" ? { userType } : {}),
      ...(role !== "all" ? { role } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      limit: effectiveLimit,
      offset,
    }),
    [debouncedSearch, effectiveLimit, offset, role, userType],
  );

  const isMutatingRole = changingUserKey !== null;
  const disableUserActions = isPending || isMutatingRole;

  function loadUsersRoles() {
    setError(null);

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    startTransition(() => {
      void (async () => {
        try {
          const result = await getAdminUsersRoles(query);
          if (requestId !== latestRequestRef.current) return;
          setSnapshot(result);
        } catch (err) {
          if (requestId !== latestRequestRef.current) return;
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

  // Recompute offset when the effective limit changes so the same first record
  // stays visible; clamp against the known total.
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
    loadUsersRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const users = snapshot?.users ?? [];
  const hasPreviousPage = offset > 0;
  const hasNextPage = snapshot
    ? offset + snapshot.users.length < snapshot.total
    : false;
  const page = Math.floor(offset / effectiveLimit) + 1;
  const pageCount = snapshot
    ? Math.max(1, Math.ceil(snapshot.total / effectiveLimit))
    : 1;
  const rangeStart = users.length ? offset + 1 : 0;
  const rangeEnd = offset + users.length;

  function goToPreviousPage() {
    resetFiltersFeedback();
    setOffset(Math.max(offset - effectiveLimit, 0));
  }

  function goToNextPage() {
    resetFiltersFeedback();
    setOffset(offset + effectiveLimit);
  }

  function goToPage(targetPage: number) {
    const clampedPage = Math.min(Math.max(targetPage, 1), pageCount);
    resetFiltersFeedback();
    setOffset((clampedPage - 1) * effectiveLimit);
  }

  function handleJumpToPage() {
    const parsedPage = Number.parseInt(jumpPageInput, 10);
    if (!Number.isFinite(parsedPage)) {
      setJumpPageInput(String(page));
      return;
    }
    goToPage(parsedPage);
  }

  // Keep the jump input aligned with the current page whenever it changes
  // externally (Anterior/Siguiente, filters, or a successful jump).
  useEffect(() => {
    setJumpPageInput(String(page));
  }, [page]);

  return (
    <>
      <Card className="dashboard-surface hidden min-h-0 flex-1 flex-col overflow-hidden shadow-none hover:shadow-none md:flex">
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
          <label className="grid min-w-0 flex-[2] gap-1 text-[11px] font-medium text-muted-foreground md:gap-0.5">
            Buscar
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-8 pl-7 text-xs leading-none md:h-7"
                placeholder="Buscar usuario o clínica"
                value={searchQuery}
                disabled={disableUserActions}
                onChange={(event) => {
                  resetFiltersFeedback();
                  setSearchQuery(event.target.value);
                }}
                aria-label="Buscar usuario o clínica"
              />
            </div>
          </label>

          <label className="grid min-w-0 flex-1 gap-1 text-[11px] font-medium text-muted-foreground sm:max-w-48 md:gap-0.5">
            Tipo usuario
            <select
              className="field-select h-8 py-1 text-xs leading-none md:h-7"
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
              className="field-select h-8 py-1 text-xs leading-none md:h-7"
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
            {effectiveLimit} por página
          </span>
        </div>

        {/* Measured rows region. It carries no vertical padding of its own: the
            4px it used to add on each side were inside the box the fit is
            derived from but outside the space the table could use, so nine rows
            (32 + 9×41 = 401px) overflowed the 402.69px region at 1366×768 by
            2.81px while the math believed they fitted. Reclaiming those 8px —
            strictly local to this card, no row content, header or shell
            touched — is what lets the nine-row contract hold honestly there and
            lets 1280×720 fall to its real capacity instead of clipping. */}
        <div
          ref={setDesktopBodyNode}
          data-dashboard-adaptive-rows-canvas="true"
              data-dashboard-row-pitch="compact"
              data-dashboard-canvas-reserve="table-head-dense"
          className="min-h-0 flex-1"
        >
          {users.length ? (
            <div className="dashboard-table-responsive dashboard-fitted-table px-3 sm:px-4">
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
                    <TableHead className="hidden w-[10.5rem] xl:table-cell">Creado</TableHead>
                    <TableHead className="w-[10.5rem]">Actualizado</TableHead>
                    <TableHead className="w-[8.5rem] text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => {
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
                        <TableCell className="hidden truncate text-xs tabular-nums text-muted-foreground xl:table-cell">
                          {formatDateTime(user.createdAt)}
                        </TableCell>
                        <TableCell className="truncate text-xs tabular-nums text-muted-foreground">
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
          ) : (
            <div className="mx-3 flex min-h-20 items-center justify-center rounded-md border border-vetneb-line/70 bg-muted/20 px-4 text-center text-xs text-muted-foreground sm:mx-4">
              {isPending
                ? "Cargando usuarios y roles..."
                : "No hay usuarios para los filtros seleccionados."}
            </div>
          )}
        </div>

        <footer
          data-dashboard-adaptive-reserved-region="pager"
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
              onClick={goToPreviousPage}
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
              onClick={goToNextPage}
              className="h-7 px-2 text-xs flex-1 sm:flex-none"
            >
              Siguiente
            </Button>
            <div className="hidden items-center gap-1 md:flex">
              <Input
                type="number"
                min={1}
                max={pageCount}
                value={jumpPageInput}
                disabled={disableUserActions || pageCount <= 1}
                onChange={(event) => setJumpPageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleJumpToPage();
                  }
                }}
                aria-label="Ir a la página"
                className="h-7 w-14 px-1.5 text-xs leading-none"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disableUserActions || pageCount <= 1}
                onClick={handleJumpToPage}
                className="h-7 px-2 text-xs"
              >
                Ir
              </Button>
            </div>
          </div>
        </footer>
      </CardContent>
      </Card>

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
            <p
              className={`truncate text-[11px] ${
                error
                  ? "text-destructive"
                  : roleChangeMessage
                    ? "text-vetneb-teal"
                    : "text-muted-foreground"
              }`}
              role={error ? "alert" : roleChangeMessage ? "status" : undefined}
            >
              {error ?? roleChangeMessage ?? "Roles y permisos"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={loadUsersRoles}
            disabled={disableUserActions}
            aria-busy={isPending ? true : undefined}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            Actualizar
          </Button>
        </header>

        <div className="shrink-0 border-b border-vetneb-line/70 bg-muted/15 px-2 py-1">
          <label className="grid min-w-0 gap-0.5 text-[10px] font-medium text-muted-foreground">
            Buscar
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-9 pl-7 text-xs leading-none"
                placeholder="Buscar usuario o clínica"
                value={searchQuery}
                disabled={disableUserActions}
                onChange={(event) => {
                  resetFiltersFeedback();
                  setSearchQuery(event.target.value);
                }}
                aria-label="Buscar usuario o clínica"
              />
            </div>
          </label>
        </div>

        <div className="grid min-h-12 shrink-0 grid-cols-2 gap-2 overflow-hidden border-b border-vetneb-line/70 bg-muted/15 px-2 py-1">
          <label className="grid min-w-0 gap-0.5 text-[10px] font-medium text-muted-foreground">
            Tipo
            <select
              className="field-select h-9 items-center px-2 py-1 text-xs leading-none"
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
          <label className="grid min-w-0 gap-0.5 text-[10px] font-medium text-muted-foreground">
            Rol
            <select
              className="field-select h-9 items-center px-2 py-1 text-xs leading-none"
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

        <div
          ref={setMobileBodyNode}
          data-dashboard-adaptive-rows-canvas="true"
              data-dashboard-row-pitch="regular"
          className="min-h-0 flex-1 divide-y divide-vetneb-line/70 overflow-hidden"
        >
          {users.length ? (
            users.map((user, index) => {
              const userKey = getUserKey(user);
              const isChanging = changingUserKey === userKey;

              return (
                <article
                  key={userKey}
                  data-admin-mobile-ops-item="true"
                  data-dashboard-adaptive-row="true"
                  className="flex min-h-10 items-center gap-2 overflow-hidden px-2 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 truncate text-xs font-semibold text-vetneb-ink">
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
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      No editable
                    </span>
                  )}
                </article>
              );
            })
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
              {error
                ? "Error al cargar usuarios"
                : isPending
                  ? "Cargando usuarios..."
                  : "Sin usuarios"}
            </div>
          )}
        </div>

        <AdminMobileOpsPager
          ariaLabel="Paginación de usuarios"
          page={page}
          pageCount={pageCount}
          rangeLabel={
            users.length
              ? `${rangeStart}–${rangeEnd} de ${snapshot?.total ?? 0}`
              : "Sin usuarios"
          }
          previousDisabled={!hasPreviousPage}
          nextDisabled={!hasNextPage}
          disabled={disableUserActions}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
        />
      </section>
    </>
  );
}
