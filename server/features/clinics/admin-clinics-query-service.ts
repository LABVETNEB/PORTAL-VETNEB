import type {
  AdminClinicsSnapshot,
  AdminClinicSummary,
} from "./infrastructure/index.ts";

export type {
  AdminClinicsSnapshot,
  AdminClinicSummary,
} from "./infrastructure/index.ts";

export type AdminClinicsListParams = {
  limit?: number;
  offset?: number;
  search?: string;
};

export type AdminClinicsQueryServiceOverrides = {
  listAdminClinics?: (
    params: AdminClinicsListParams,
  ) => Promise<AdminClinicsSnapshot>;
  getAdminClinicById?: (
    clinicId: number,
  ) => Promise<AdminClinicSummary | null>;
};

type AdminClinicsQueryServiceDeps = Required<
  AdminClinicsQueryServiceOverrides
>;

let defaultDepsPromise:
  | Promise<AdminClinicsQueryServiceDeps>
  | undefined;

async function loadDefaultDeps(): Promise<AdminClinicsQueryServiceDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = import("./infrastructure/index.ts").then(
      (repository) => ({
        listAdminClinics: repository.listAdminClinics,
        getAdminClinicById: repository.getAdminClinicById,
      }),
    );
  }

  return defaultDepsPromise;
}

async function resolveListAdminClinics(
  overrides: AdminClinicsQueryServiceOverrides,
) {
  return (
    overrides.listAdminClinics ??
    (await loadDefaultDeps()).listAdminClinics
  );
}

async function resolveGetAdminClinicById(
  overrides: AdminClinicsQueryServiceOverrides,
) {
  return (
    overrides.getAdminClinicById ??
    (await loadDefaultDeps()).getAdminClinicById
  );
}

export async function listAdminClinicsQuery(
  params: AdminClinicsListParams,
  overrides: AdminClinicsQueryServiceOverrides = {},
) {
  const listAdminClinics = await resolveListAdminClinics(overrides);

  return listAdminClinics(params);
}

export async function getAdminClinicQuery(
  clinicId: number,
  overrides: AdminClinicsQueryServiceOverrides = {},
) {
  const getAdminClinicById =
    await resolveGetAdminClinicById(overrides);

  return getAdminClinicById(clinicId);
}
