export type ClinicPublicProfileData = {
  clinic: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  search: Record<string, unknown> | null;
};

export type ClinicPublicProfileResponseBuilder = (input: {
  clinic: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  avatarUrl: string | null;
}) => Record<string, unknown>;

export type ClinicPublicProfileQueryServiceOverrides = {
  getClinicPublicProfileByClinicId?: (
    clinicId: number,
  ) => Promise<ClinicPublicProfileData | null>;
  buildClinicPublicProfileResponse?:
    ClinicPublicProfileResponseBuilder;
  createSignedStorageUrl?: (
    storagePath: string,
  ) => Promise<string>;
};

type ClinicPublicProfileQueryServiceDeps = Required<
  ClinicPublicProfileQueryServiceOverrides
>;

let defaultDepsPromise:
  | Promise<ClinicPublicProfileQueryServiceDeps>
  | undefined;

async function loadDefaultDeps(): Promise<ClinicPublicProfileQueryServiceDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = Promise.all([
      import(
        "../public-professionals/index.ts"
      ),
      import("../../lib/supabase.ts"),
    ]).then(([publicProfiles, storage]) => ({
      getClinicPublicProfileByClinicId:
        publicProfiles.getClinicPublicProfileByClinicId,
      buildClinicPublicProfileResponse:
        publicProfiles.buildClinicPublicProfileResponse as unknown as ClinicPublicProfileResponseBuilder,
      createSignedStorageUrl: storage.createSignedStorageUrl,
    }));
  }

  return defaultDepsPromise;
}

async function resolveDep<
  Key extends keyof ClinicPublicProfileQueryServiceDeps,
>(
  key: Key,
  overrides: ClinicPublicProfileQueryServiceOverrides,
): Promise<ClinicPublicProfileQueryServiceDeps[Key]> {
  const override = overrides[key];

  if (override) {
    return override as ClinicPublicProfileQueryServiceDeps[Key];
  }

  return (await loadDefaultDeps())[key];
}

function serializeSearch(
  search: Record<string, unknown> | null,
) {
  if (!search) {
    return null;
  }

  return {
    clinicId: search.clinicId,
    isPublic: search.isPublic,
    hasRequiredPublicFields:
      search.hasRequiredPublicFields,
    isSearchEligible: search.isSearchEligible,
    profileQualityScore: search.profileQualityScore,
    updatedAt: search.updatedAt,
    searchText: search.searchText,
  };
}

export type ClinicPublicProfileQueryResult =
  | {
      ok: true;
      profile: Record<string, unknown>;
      search: ReturnType<typeof serializeSearch>;
    }
  | {
      ok: false;
      reason: "clinic_not_found";
    };

export async function getClinicPublicProfileQuery(
  clinicId: number,
  overrides: ClinicPublicProfileQueryServiceOverrides = {},
): Promise<ClinicPublicProfileQueryResult> {
  const getClinicPublicProfileByClinicId = await resolveDep(
    "getClinicPublicProfileByClinicId",
    overrides,
  );
  const data =
    await getClinicPublicProfileByClinicId(clinicId);

  if (!data?.clinic) {
    return {
      ok: false,
      reason: "clinic_not_found",
    };
  }

  let avatarUrl: string | null = null;
  const avatarStoragePath =
    typeof data.profile?.avatarStoragePath === "string"
      ? data.profile.avatarStoragePath
      : null;

  if (avatarStoragePath) {
    const createSignedStorageUrl = await resolveDep(
      "createSignedStorageUrl",
      overrides,
    );
    avatarUrl = await createSignedStorageUrl(
      avatarStoragePath,
    );
  }

  const buildClinicPublicProfileResponse = await resolveDep(
    "buildClinicPublicProfileResponse",
    overrides,
  );

  return {
    ok: true,
    profile: buildClinicPublicProfileResponse({
      clinic: data.clinic,
      profile: data.profile,
      avatarUrl,
    }),
    search: serializeSearch(data.search),
  };
}
