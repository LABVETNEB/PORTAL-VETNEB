import type { AuditWriteInput } from "../../lib/audit.ts";
import type {
  AdminClinicUserCredentialsCommandInput,
  AdminClinicUserCredentialsUpdateInput,
  AdminClinicUserCredentialsUpdateResult,
} from "../clinics/index.ts";
import {
  createAdminUsersRolesUseCases,
  type AdminClinicUserRoleChangeInput,
  type AdminClinicUserRoleChangeResult,
  type AdminUsersRolesQuery,
  type AdminUsersRolesSnapshot,
} from "./application/index.ts";

type AdminSessionRecord = {
  id: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type SessionAdminUserRecord = {
  id: number;
  username: string;
};

type AdminSessionWithUserRecord = {
  session: AdminSessionRecord;
  adminUser: SessionAdminUserRecord | null;
};

export type AdminUsersRolesRouteCompositionOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionWithUser?: (
    tokenHash: string,
  ) => Promise<AdminSessionWithUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getAdminUsersRolesSnapshot?: (
    params: AdminUsersRolesQuery,
  ) => Promise<AdminUsersRolesSnapshot>;
  changeClinicUserRole?: (
    input: AdminClinicUserRoleChangeInput,
  ) => Promise<AdminClinicUserRoleChangeResult>;
  updateAdminClinicUserCredentials?: (
    input: AdminClinicUserCredentialsUpdateInput,
  ) => Promise<AdminClinicUserCredentialsUpdateResult>;
  hashPassword?: (password: string) => Promise<string>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

type AdminUsersRolesDefaultDeps = Required<
  Pick<
    AdminUsersRolesRouteCompositionOptions,
    | "deleteAdminSession"
    | "getAdminSessionWithUser"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "getAdminUsersRolesSnapshot"
    | "changeClinicUserRole"
    | "hashPassword"
    | "writeAuditLog"
  >
>;

export type AdminUsersRolesResolvedRouteDeps =
  AdminUsersRolesDefaultDeps &
    Pick<
      AdminUsersRolesRouteCompositionOptions,
      "updateAdminClinicUserCredentials"
    >;

let defaultDepsPromise:
  | Promise<AdminUsersRolesDefaultDeps>
  | undefined;

async function loadDefaultDeps(): Promise<AdminUsersRolesDefaultDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const [db, authSecurity, audit, repository] = await Promise.all([
        import("../../db.ts"),
        import("../../lib/auth-security.ts"),
        import("../../lib/audit.ts"),
        import("./infrastructure/index.ts"),
      ]);

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionWithUser: db.getAdminSessionWithUser,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getAdminUsersRolesSnapshot:
          repository.getAdminUsersRolesSnapshot,
        changeClinicUserRole: repository.changeClinicUserRole,
        hashPassword: authSecurity.hashPassword,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise;
}

export function createAdminUsersRolesRouteComposition(
  options: AdminUsersRolesRouteCompositionOptions,
) {
  const now = options.now ?? (() => Date.now());

  async function resolveDeps(): Promise<AdminUsersRolesResolvedRouteDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionWithUser &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.getAdminUsersRolesSnapshot &&
      !!options.changeClinicUserRole &&
      !!options.hashPassword &&
      !!options.writeAuditLog;

    const defaultDeps = hasAllInjectedDeps
      ? undefined
      : await loadDefaultDeps();

    return {
      deleteAdminSession:
        options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
      getAdminSessionWithUser:
        options.getAdminSessionWithUser ??
        defaultDeps!.getAdminSessionWithUser,
      updateAdminSessionLastAccess:
        options.updateAdminSessionLastAccess ??
        defaultDeps!.updateAdminSessionLastAccess,
      hashSessionToken:
        options.hashSessionToken ?? defaultDeps!.hashSessionToken,
      getAdminUsersRolesSnapshot:
        options.getAdminUsersRolesSnapshot ??
        defaultDeps!.getAdminUsersRolesSnapshot,
      changeClinicUserRole:
        options.changeClinicUserRole ??
        defaultDeps!.changeClinicUserRole,
      updateAdminClinicUserCredentials:
        options.updateAdminClinicUserCredentials,
      hashPassword: options.hashPassword ?? defaultDeps!.hashPassword,
      writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
    };
  }

  const usersRolesUseCases = createAdminUsersRolesUseCases({
    getAdminUsersRolesSnapshot: async (query) =>
      (await resolveDeps()).getAdminUsersRolesSnapshot(query),
    changeClinicUserRole: async (input) =>
      (await resolveDeps()).changeClinicUserRole(input),
  });

  async function updateAdminClinicUserCredentials(
    input: AdminClinicUserCredentialsCommandInput,
    deps: AdminUsersRolesResolvedRouteDeps,
  ): Promise<AdminClinicUserCredentialsUpdateResult> {
    const { updateAdminClinicUserCredentialsCommand } = await import(
      "../clinics/index.ts"
    );

    return updateAdminClinicUserCredentialsCommand(input, {
      hashPassword: deps.hashPassword,
      updateAdminClinicUserCredentials:
        deps.updateAdminClinicUserCredentials,
    });
  }

  return {
    now,
    resolveDeps,
    usersRolesUseCases,
    updateAdminClinicUserCredentials,
  };
}
