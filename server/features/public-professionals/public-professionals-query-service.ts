
export type PublicProfessionalRow = {
  clinicId: number;
  displayName: string;
  avatarStoragePath: string | null;
  aboutText: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  publicAddress?: string | null;
  mapLink?: string | null;
  locality: string | null;
  country: string | null;
  updatedAt: Date;
  profileQualityScore?: number;
  rank?: number;
  similarity?: number;
  score?: number;
};

export type SearchPublicProfessionalsInput = {
  query?: string;
  locality?: string;
  country?: string;
  limit: number;
  offset: number;
};

export type SearchPublicProfessionalsResult = {
  rows: PublicProfessionalRow[];
  total: number;
  limit: number;
  offset: number;
};

export type SearchPublicProfessionalsFn = (
  input: SearchPublicProfessionalsInput,
) => Promise<SearchPublicProfessionalsResult>;

export type GetPublicProfessionalByClinicIdFn = (
  clinicId: number,
) => Promise<PublicProfessionalRow | null | undefined>;

export type CreateSignedStorageUrlFn = (
  path: string,
) => Promise<string | null>;

export type PublicProfessionalsQueryDeps = {
  searchPublicProfessionals: SearchPublicProfessionalsFn;
  getPublicProfessionalByClinicId: GetPublicProfessionalByClinicIdFn;
  createSignedStorageUrl: CreateSignedStorageUrlFn;
};

export type PublicProfessionalsQueryOverrides = {
  searchPublicProfessionals?: SearchPublicProfessionalsFn;
  getPublicProfessionalByClinicId?: GetPublicProfessionalByClinicIdFn;
  createSignedStorageUrl?: CreateSignedStorageUrlFn;
};

let defaultDepsPromise:
  | Promise<PublicProfessionalsQueryDeps>
  | undefined;

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

async function resolvePublicAvatarUrl(
  row: PublicProfessionalRow,
  createSignedStorageUrl: CreateSignedStorageUrlFn,
) {
  if (!row.avatarStoragePath) {
    return null;
  }

  try {
    return await createSignedStorageUrl(row.avatarStoragePath);
  } catch {
    console.warn("[PUBLIC_PROFESSIONAL_AVATAR_URL_ERROR]", {
      clinicId: row.clinicId,
      hasAvatar: true,
    });

    return null;
  }
}

export async function serializePublicProfessional(
  row: PublicProfessionalRow,
  createSignedStorageUrl: CreateSignedStorageUrlFn,
) {
  const avatarUrl = await resolvePublicAvatarUrl(
    row,
    createSignedStorageUrl,
  );

  const publicAddress = normalizeText(row.publicAddress) ?? null;
  const mapLink = normalizeText(row.mapLink) ?? null;

  return {
    clinicId: row.clinicId,
    displayName: row.displayName,
    avatarUrl,
    specialtyText: row.specialtyText,
    servicesText: row.servicesText,
    email: row.email,
    phone: row.phone,
    locality: row.locality,
    country: row.country,
    aboutText: row.aboutText,
    ...(publicAddress ? { publicAddress } : {}),
    ...(mapLink ? { mapLink } : {}),
    updatedAt: row.updatedAt,
    relevance: {
      rank: row.rank ?? 0,
      similarity: row.similarity ?? 0,
      score: row.score ?? 0,
    },
    profileQualityScore: row.profileQualityScore ?? null,
  };
}

export async function loadDefaultPublicProfessionalsQueryDeps():
Promise<PublicProfessionalsQueryDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const [publicProfiles, supabase] = await Promise.all([
        import("./infrastructure/index.ts"),
        import("../../lib/supabase.ts"),
      ]);

      return {
        searchPublicProfessionals:
          publicProfiles.searchPublicProfessionals,
        getPublicProfessionalByClinicId:
          publicProfiles.getPublicProfessionalByClinicId,
        createSignedStorageUrl:
          supabase.createSignedStorageUrl,
      };
    })();
  }

  return defaultDepsPromise;
}

export async function resolvePublicProfessionalsQueryDeps(
  overrides: PublicProfessionalsQueryOverrides,
): Promise<PublicProfessionalsQueryDeps> {
  if (
    overrides.searchPublicProfessionals &&
    overrides.getPublicProfessionalByClinicId &&
    overrides.createSignedStorageUrl
  ) {
    return {
      searchPublicProfessionals:
        overrides.searchPublicProfessionals,
      getPublicProfessionalByClinicId:
        overrides.getPublicProfessionalByClinicId,
      createSignedStorageUrl:
        overrides.createSignedStorageUrl,
    };
  }

  const defaults =
    await loadDefaultPublicProfessionalsQueryDeps();

  return {
    searchPublicProfessionals:
      overrides.searchPublicProfessionals ??
      defaults.searchPublicProfessionals,
    getPublicProfessionalByClinicId:
      overrides.getPublicProfessionalByClinicId ??
      defaults.getPublicProfessionalByClinicId,
    createSignedStorageUrl:
      overrides.createSignedStorageUrl ??
      defaults.createSignedStorageUrl,
  };
}

export async function searchPublicProfessionalsDirectory(
  input: SearchPublicProfessionalsInput,
  deps: PublicProfessionalsQueryDeps,
) {
  const result = await deps.searchPublicProfessionals(input);

  const professionals = await Promise.all(
    result.rows.map((row) =>
      serializePublicProfessional(
        row,
        deps.createSignedStorageUrl,
      ),
    ),
  );

  return {
    professionals,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function getPublicProfessionalDetail(
  clinicId: number,
  deps: PublicProfessionalsQueryDeps,
) {
  const row =
    await deps.getPublicProfessionalByClinicId(clinicId);

  if (!row) {
    return null;
  }

  return serializePublicProfessional(
    row,
    deps.createSignedStorageUrl,
  );
}
