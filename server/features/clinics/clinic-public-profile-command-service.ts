import {
  parseClinicPublicProfilePatch,
  validateClinicPublicAvatar,
  type ClinicPublicAvatarFile,
} from "./domain/index.ts";
import type {
  UpsertClinicPublicProfileInput,
} from "../public-professionals/infrastructure/index.ts";

export type ClinicPublicProfilePublication = {
  isPublic: boolean;
  hasRequiredPublicFields: boolean;
  hasQualitySupplement: boolean;
  qualityScore: number;
  isSearchEligible: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  publicationErrors: string[];
};

type ClinicPublicProfileData = {
  clinic: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  search: Record<string, unknown> | null;
};

type PatchClinicPublicProfileResult = Record<
  string,
  unknown
> & {
  avatarStoragePath?: string | null;
};

type RemoveClinicPublicAvatarResult = {
  previousAvatarStoragePath: string | null;
  profile: Record<string, unknown>;
};

type ClinicPublicProfileResponseBuilder = (input: {
  clinic: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  avatarUrl: string | null;
}) => Record<string, unknown>;

type ClinicPublicProfilePublicationEvaluator = (input: {
  clinic: Record<string, unknown>;
  profile: {
    displayName: string | null;
    avatarStoragePath: string | null;
    aboutText: string | null;
    specialtyText: string | null;
    servicesText: string | null;
    email: string | null;
    phone: string | null;
    publicAddress: string | null;
    mapLink: string | null;
    locality: string | null;
    country: string | null;
    isPublic: boolean;
  };
}) => ClinicPublicProfilePublication;

export type ClinicPublicProfileCommandServiceOverrides = {
  getClinicPublicProfileByClinicId?: (
    clinicId: number,
  ) => Promise<ClinicPublicProfileData | null>;
  buildClinicPublicProfileResponse?:
    ClinicPublicProfileResponseBuilder;
  evaluateClinicPublicProfilePublication?:
    ClinicPublicProfilePublicationEvaluator;
  minPublicProfileQualityScore?: number;
  patchClinicPublicProfile?: (
    clinicId: number,
    input: UpsertClinicPublicProfileInput,
  ) => Promise<PatchClinicPublicProfileResult>;
  removeClinicPublicAvatar?: (
    clinicId: number,
  ) => Promise<RemoveClinicPublicAvatarResult>;
  syncClinicPublicSearch?: (
    clinicId: number,
  ) => Promise<Record<string, unknown> | null>;
  createSignedStorageUrl?: (
    storagePath: string,
  ) => Promise<string>;
  uploadClinicAvatar?: (input: {
    clinicId: number;
    file: Buffer;
    fileName: string;
    mimeType: string;
  }) => Promise<string>;
  deleteStorageObject?: (
    storagePath: string,
  ) => Promise<void>;
};

type ClinicPublicProfileCommandServiceDeps = Required<
  ClinicPublicProfileCommandServiceOverrides
>;

let defaultDepsPromise:
  | Promise<ClinicPublicProfileCommandServiceDeps>
  | undefined;

async function loadDefaultDeps(): Promise<ClinicPublicProfileCommandServiceDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = Promise.all([
      import(
        "../public-professionals/infrastructure/index.ts"
      ),
      import("../../lib/supabase.ts"),
    ]).then(([publicProfiles, storage]) => ({
      getClinicPublicProfileByClinicId:
        publicProfiles.getClinicPublicProfileByClinicId,
      buildClinicPublicProfileResponse:
        publicProfiles.buildClinicPublicProfileResponse as unknown as ClinicPublicProfileResponseBuilder,
      evaluateClinicPublicProfilePublication:
        publicProfiles.evaluateClinicPublicProfilePublication as unknown as ClinicPublicProfilePublicationEvaluator,
      minPublicProfileQualityScore:
        publicProfiles.MIN_PUBLIC_PROFILE_QUALITY_SCORE,
      patchClinicPublicProfile:
        publicProfiles.patchClinicPublicProfile,
      removeClinicPublicAvatar:
        publicProfiles.removeClinicPublicAvatar,
      syncClinicPublicSearch:
        publicProfiles.syncClinicPublicSearch,
      createSignedStorageUrl:
        storage.createSignedStorageUrl,
      uploadClinicAvatar: storage.uploadClinicAvatar,
      deleteStorageObject: storage.deleteStorageObject,
    }));
  }

  return defaultDepsPromise;
}

async function resolveDep<
  Key extends keyof ClinicPublicProfileCommandServiceDeps,
>(
  key: Key,
  overrides: ClinicPublicProfileCommandServiceOverrides,
): Promise<ClinicPublicProfileCommandServiceDeps[Key]> {
  const override = overrides[key];

  if (override !== undefined) {
    return override as ClinicPublicProfileCommandServiceDeps[Key];
  }

  return (await loadDefaultDeps())[key];
}

function buildPublicationProfile(
  profile: Record<string, unknown> | null,
  patch: UpsertClinicPublicProfileInput,
) {
  return {
    displayName:
      patch.displayName ??
      (profile?.displayName as
        | string
        | null
        | undefined) ??
      null,
    avatarStoragePath:
      patch.avatarStoragePath ??
      (profile?.avatarStoragePath as
        | string
        | null
        | undefined) ??
      null,
    aboutText:
      patch.aboutText ??
      (profile?.aboutText as
        | string
        | null
        | undefined) ??
      null,
    specialtyText:
      patch.specialtyText ??
      (profile?.specialtyText as
        | string
        | null
        | undefined) ??
      null,
    servicesText:
      patch.servicesText ??
      (profile?.servicesText as
        | string
        | null
        | undefined) ??
      null,
    email:
      patch.email ??
      (profile?.email as string | null | undefined) ??
      null,
    phone:
      patch.phone ??
      (profile?.phone as string | null | undefined) ??
      null,
    publicAddress:
      patch.publicAddress ??
      (profile?.publicAddress as
        | string
        | null
        | undefined) ??
      null,
    mapLink:
      patch.mapLink ??
      (profile?.mapLink as
        | string
        | null
        | undefined) ??
      null,
    locality:
      patch.locality ??
      (profile?.locality as
        | string
        | null
        | undefined) ??
      null,
    country:
      patch.country ??
      (profile?.country as
        | string
        | null
        | undefined) ??
      null,
    isPublic:
      patch.isPublic ??
      (profile?.isPublic as boolean | undefined) ??
      false,
  };
}

async function buildPublicationRejection(
  publication: ClinicPublicProfilePublication,
  overrides: ClinicPublicProfileCommandServiceOverrides,
) {
  const minimumQualityScore = await resolveDep(
    "minPublicProfileQualityScore",
    overrides,
  );

  return {
    publication,
    minimumQualityScore,
  };
}

type PublicationRejection = {
  ok: false;
  reason: "publication";
  publication: ClinicPublicProfilePublication;
  minimumQualityScore: number;
};

export type PatchClinicPublicProfileCommandResult =
  | {
      ok: true;
      profile: Record<string, unknown>;
      search: Record<string, unknown> | null;
    }
  | {
      ok: false;
      reason: "validation";
      error: string;
    }
  | PublicationRejection;

export async function patchClinicPublicProfileCommand(
  input: {
    clinicId: number;
    clinic: Record<string, unknown>;
    body: Record<string, unknown> | undefined;
  },
  overrides: ClinicPublicProfileCommandServiceOverrides = {},
): Promise<PatchClinicPublicProfileCommandResult> {
  const getClinicPublicProfileByClinicId = await resolveDep(
    "getClinicPublicProfileByClinicId",
    overrides,
  );
  const currentData =
    await getClinicPublicProfileByClinicId(input.clinicId);
  const parsed = parseClinicPublicProfilePatch(input.body);

  if (!parsed.ok) {
    return {
      ok: false,
      reason: "validation",
      error: parsed.error,
    };
  }

  const evaluateClinicPublicProfilePublication =
    await resolveDep(
      "evaluateClinicPublicProfilePublication",
      overrides,
    );
  const publication =
    evaluateClinicPublicProfilePublication({
      clinic: input.clinic,
      profile: buildPublicationProfile(
        currentData?.profile ?? null,
        parsed.data,
      ),
    });

  if (
    publication.isPublic &&
    publication.publicationErrors.length > 0
  ) {
    return {
      ok: false,
      reason: "publication",
      ...(await buildPublicationRejection(
        publication,
        overrides,
      )),
    };
  }

  const patchClinicPublicProfile = await resolveDep(
    "patchClinicPublicProfile",
    overrides,
  );
  const profile = await patchClinicPublicProfile(
    input.clinicId,
    parsed.data,
  );
  const syncClinicPublicSearch = await resolveDep(
    "syncClinicPublicSearch",
    overrides,
  );
  const search = await syncClinicPublicSearch(
    input.clinicId,
  );

  let avatarUrl: string | null = null;

  if (
    typeof profile.avatarStoragePath === "string" &&
    profile.avatarStoragePath
  ) {
    const createSignedStorageUrl = await resolveDep(
      "createSignedStorageUrl",
      overrides,
    );
    avatarUrl = await createSignedStorageUrl(
      profile.avatarStoragePath,
    );
  }

  const buildClinicPublicProfileResponse = await resolveDep(
    "buildClinicPublicProfileResponse",
    overrides,
  );

  return {
    ok: true,
    profile: buildClinicPublicProfileResponse({
      clinic: input.clinic,
      profile,
      avatarUrl,
    }),
    search,
  };
}

export type UploadClinicPublicAvatarCommandResult =
  | {
      ok: true;
      profile: Record<string, unknown>;
      search: Record<string, unknown> | null;
    }
  | {
      ok: false;
      reason: "avatar_validation";
      error: string;
    };

export async function uploadClinicPublicAvatarCommand(
  input: {
    clinicId: number;
    clinic: Record<string, unknown>;
    file: ClinicPublicAvatarFile;
  },
  overrides: ClinicPublicProfileCommandServiceOverrides = {},
): Promise<UploadClinicPublicAvatarCommandResult> {
  const validation = validateClinicPublicAvatar(input.file);

  if (validation.error) {
    return {
      ok: false,
      reason: "avatar_validation",
      error: validation.error,
    };
  }

  const getClinicPublicProfileByClinicId = await resolveDep(
    "getClinicPublicProfileByClinicId",
    overrides,
  );
  const currentData =
    await getClinicPublicProfileByClinicId(input.clinicId);
  const previousAvatarStoragePath =
    (currentData?.profile?.avatarStoragePath as
      | string
      | null
      | undefined) ?? null;
  const uploadClinicAvatar = await resolveDep(
    "uploadClinicAvatar",
    overrides,
  );
  const avatarStoragePath = await uploadClinicAvatar({
    clinicId: input.clinicId,
    file: input.file.buffer,
    fileName: input.file.originalname,
    mimeType: input.file.mimetype,
  });
  const patchClinicPublicProfile = await resolveDep(
    "patchClinicPublicProfile",
    overrides,
  );
  const profile = await patchClinicPublicProfile(
    input.clinicId,
    {
      avatarStoragePath,
    },
  );
  const syncClinicPublicSearch = await resolveDep(
    "syncClinicPublicSearch",
    overrides,
  );
  const search = await syncClinicPublicSearch(
    input.clinicId,
  );

  if (
    previousAvatarStoragePath &&
    previousAvatarStoragePath !== avatarStoragePath
  ) {
    const deleteStorageObject = await resolveDep(
      "deleteStorageObject",
      overrides,
    );
    await deleteStorageObject(
      previousAvatarStoragePath,
    );
  }

  const createSignedStorageUrl = await resolveDep(
    "createSignedStorageUrl",
    overrides,
  );
  const avatarUrl = await createSignedStorageUrl(
    avatarStoragePath,
  );
  const buildClinicPublicProfileResponse = await resolveDep(
    "buildClinicPublicProfileResponse",
    overrides,
  );

  return {
    ok: true,
    profile: buildClinicPublicProfileResponse({
      clinic: input.clinic,
      profile,
      avatarUrl,
    }),
    search,
  };
}

export type DeleteClinicPublicAvatarCommandResult =
  | {
      ok: true;
      profile: Record<string, unknown>;
      search: Record<string, unknown> | null;
    }
  | {
      ok: false;
      reason: "avatar_not_found";
    }
  | PublicationRejection;

export async function deleteClinicPublicAvatarCommand(
  input: {
    clinicId: number;
    clinic: Record<string, unknown>;
  },
  overrides: ClinicPublicProfileCommandServiceOverrides = {},
): Promise<DeleteClinicPublicAvatarCommandResult> {
  const getClinicPublicProfileByClinicId = await resolveDep(
    "getClinicPublicProfileByClinicId",
    overrides,
  );
  const currentData =
    await getClinicPublicProfileByClinicId(input.clinicId);

  if (!currentData?.profile?.avatarStoragePath) {
    return {
      ok: false,
      reason: "avatar_not_found",
    };
  }

  const evaluateClinicPublicProfilePublication =
    await resolveDep(
      "evaluateClinicPublicProfilePublication",
      overrides,
    );
  const publication =
    evaluateClinicPublicProfilePublication({
      clinic: input.clinic,
      profile: {
        ...buildPublicationProfile(
          currentData.profile,
          {},
        ),
        avatarStoragePath: null,
      },
    });

  if (
    publication.isPublic &&
    publication.publicationErrors.length > 0
  ) {
    return {
      ok: false,
      reason: "publication",
      ...(await buildPublicationRejection(
        publication,
        overrides,
      )),
    };
  }

  const removeClinicPublicAvatar = await resolveDep(
    "removeClinicPublicAvatar",
    overrides,
  );
  const result = await removeClinicPublicAvatar(
    input.clinicId,
  );
  const syncClinicPublicSearch = await resolveDep(
    "syncClinicPublicSearch",
    overrides,
  );
  const search = await syncClinicPublicSearch(
    input.clinicId,
  );

  if (result.previousAvatarStoragePath) {
    const deleteStorageObject = await resolveDep(
      "deleteStorageObject",
      overrides,
    );
    await deleteStorageObject(
      result.previousAvatarStoragePath,
    );
  }

  const buildClinicPublicProfileResponse = await resolveDep(
    "buildClinicPublicProfileResponse",
    overrides,
  );

  return {
    ok: true,
    profile: buildClinicPublicProfileResponse({
      clinic: input.clinic,
      profile: result.profile,
      avatarUrl: null,
    }),
    search,
  };
}
