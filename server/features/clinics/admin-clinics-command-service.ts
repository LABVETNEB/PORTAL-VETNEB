import { confirmClinicNameMatches } from "./domain/index.ts";
import type {
  AdminClinicCreateInput,
  AdminClinicCreateResult,
  AdminClinicDeleteInput,
  AdminClinicSummary,
  AdminClinicUpdateInput,
  AdminClinicUserCredentialsUpdateInput,
  AdminClinicUserCredentialsUpdateResult,
} from "./infrastructure/index.ts";

export type {
  AdminClinicCreateInput,
  AdminClinicCreateResult,
  AdminClinicDeleteInput,
  AdminClinicSummary,
  AdminClinicUpdateInput,
  AdminClinicUserCredentialsUpdateInput,
  AdminClinicUserCredentialsUpdateResult,
} from "./infrastructure/index.ts";

export type AdminClinicCreateCommandInput = Omit<
  AdminClinicCreateInput,
  "passwordHash"
> & {
  password: string;
};

export type AdminClinicUserCredentialsCommandInput = Omit<
  AdminClinicUserCredentialsUpdateInput,
  "passwordHash"
> & {
  password?: string;
};

export type AdminClinicsCommandServiceOverrides = {
  createAdminClinicWithUser?: (
    input: AdminClinicCreateInput,
  ) => Promise<AdminClinicCreateResult>;
  updateAdminClinic?: (
    input: AdminClinicUpdateInput,
  ) => Promise<AdminClinicSummary | null>;
  getAdminClinicById?: (
    clinicId: number,
  ) => Promise<AdminClinicSummary | null>;
  deleteAdminClinic?: (
    input: AdminClinicDeleteInput,
  ) => Promise<AdminClinicSummary | null>;
  updateAdminClinicUserCredentials?: (
    input: AdminClinicUserCredentialsUpdateInput,
  ) => Promise<AdminClinicUserCredentialsUpdateResult>;
};

export type HashPassword = (
  password: string,
) => Promise<string>;

type AdminClinicsCommandServiceDeps = Required<
  AdminClinicsCommandServiceOverrides
>;

let defaultDepsPromise:
  | Promise<AdminClinicsCommandServiceDeps>
  | undefined;

async function loadDefaultDeps(): Promise<AdminClinicsCommandServiceDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = import("./infrastructure/index.ts").then(
      (repository) => ({
        createAdminClinicWithUser:
          repository.createAdminClinicWithUser,
        updateAdminClinic: repository.updateAdminClinic,
        getAdminClinicById: repository.getAdminClinicById,
        deleteAdminClinic: repository.deleteAdminClinic,
        updateAdminClinicUserCredentials:
          repository.updateAdminClinicUserCredentials,
      }),
    );
  }

  return defaultDepsPromise;
}

async function resolveDep<
  Key extends keyof AdminClinicsCommandServiceDeps,
>(
  key: Key,
  overrides: AdminClinicsCommandServiceOverrides,
): Promise<AdminClinicsCommandServiceDeps[Key]> {
  const override = overrides[key];

  if (override) {
    return override as AdminClinicsCommandServiceDeps[Key];
  }

  return (await loadDefaultDeps())[key];
}

export async function createAdminClinicCommand(
  input: AdminClinicCreateCommandInput,
  deps: AdminClinicsCommandServiceOverrides & {
    hashPassword: HashPassword;
  },
) {
  const createAdminClinicWithUser = await resolveDep(
    "createAdminClinicWithUser",
    deps,
  );
  const passwordHash = await deps.hashPassword(input.password);
  const { password: _password, ...clinicInput } = input;

  return createAdminClinicWithUser({
    ...clinicInput,
    passwordHash,
  });
}

export async function updateAdminClinicCommand(
  input: AdminClinicUpdateInput,
  overrides: AdminClinicsCommandServiceOverrides = {},
) {
  const updateAdminClinic = await resolveDep(
    "updateAdminClinic",
    overrides,
  );

  return updateAdminClinic(input);
}

export type DeleteAdminClinicCommandResult =
  | {
      ok: true;
      clinic: AdminClinicSummary;
    }
  | {
      ok: false;
      reason: "not_found" | "confirmation_mismatch";
    };

export async function deleteAdminClinicCommand(
  input: {
    clinicId: number;
    confirmClinicName: string;
  },
  overrides: AdminClinicsCommandServiceOverrides = {},
): Promise<DeleteAdminClinicCommandResult> {
  const getAdminClinicById = await resolveDep(
    "getAdminClinicById",
    overrides,
  );
  const clinic = await getAdminClinicById(input.clinicId);

  if (!clinic) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (
    !confirmClinicNameMatches(
      input.confirmClinicName,
      clinic.clinicName,
    )
  ) {
    return {
      ok: false,
      reason: "confirmation_mismatch",
    };
  }

  const deleteAdminClinic = await resolveDep(
    "deleteAdminClinic",
    overrides,
  );
  const deletedClinic = await deleteAdminClinic({
    clinicId: input.clinicId,
  });

  return deletedClinic
    ? {
        ok: true,
        clinic: deletedClinic,
      }
    : {
        ok: false,
        reason: "not_found",
      };
}

export async function updateAdminClinicUserCredentialsCommand(
  input: AdminClinicUserCredentialsCommandInput,
  deps: AdminClinicsCommandServiceOverrides & {
    hashPassword: HashPassword;
  },
) {
  const updateAdminClinicUserCredentials = await resolveDep(
    "updateAdminClinicUserCredentials",
    deps,
  );
  const passwordHash =
    input.password === undefined
      ? undefined
      : await deps.hashPassword(input.password);
  const { password: _password, ...credentialsInput } = input;

  return updateAdminClinicUserCredentials({
    ...credentialsInput,
    passwordHash,
  });
}

export type AdminClinicsPostgresErrorKind =
  | "username_conflict"
  | "schema_mismatch"
  | "active_dependency"
  | "unknown";

export type SanitizedPostgresErrorMetadata = {
  errorName: string;
  errorCode: string;
  constraintName: string | null;
  tableName: string | null;
  columnName: string | null;
};

export function classifyAdminClinicsPostgresError(
  error: unknown,
): {
  kind: AdminClinicsPostgresErrorKind;
  metadata: SanitizedPostgresErrorMetadata;
} {
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const errorCode =
    typeof record.code === "string" ? record.code : "unknown";
  const metadata = {
    errorName:
      typeof record.name === "string"
        ? record.name
        : "UnknownError",
    errorCode,
    constraintName:
      typeof record.constraint_name === "string"
        ? record.constraint_name
        : null,
    tableName:
      typeof record.table_name === "string"
        ? record.table_name
        : null,
    columnName:
      typeof record.column_name === "string"
        ? record.column_name
        : null,
  };

  const kindByCode: Record<
    string,
    AdminClinicsPostgresErrorKind
  > = {
    "23505": "username_conflict",
    "23502": "schema_mismatch",
    "23503": "active_dependency",
  };

  return {
    kind: kindByCode[errorCode] ?? "unknown",
    metadata,
  };
}
