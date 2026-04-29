export type PublicProfessionalFixtureRow = {
  clinicId: number;
  displayName: string;
  avatarStoragePath: string | null;
  aboutText: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  locality: string | null;
  country: string | null;
  updatedAt: Date;
  profileQualityScore: number;
  rank: number;
  similarity: number;
  score: number;
};

export type PublicProfessionalsRouteFixtureStubs = {
  searchPublicProfessionals: () => Promise<{
    rows: PublicProfessionalFixtureRow[];
    total: number;
    limit: number;
    offset: number;
  }>;
  getPublicProfessionalByClinicId: (
    clinicId: number,
  ) => Promise<PublicProfessionalFixtureRow | null>;
  createSignedStorageUrl: (path: string) => Promise<string>;
  searchRateLimitWindowMs: number;
  searchRateLimitMaxAttempts: number;
  detailRateLimitWindowMs: number;
  detailRateLimitMaxAttempts: number;
  now: () => number;
};

function clonePublicProfessionalFixtureRow(
  row: PublicProfessionalFixtureRow,
): PublicProfessionalFixtureRow {
  return {
    ...row,
    updatedAt: new Date(row.updatedAt.getTime()),
  };
}

export function buildPublicProfessionalFixtureRow(
  overrides: Partial<PublicProfessionalFixtureRow> = {},
): PublicProfessionalFixtureRow {
  return clonePublicProfessionalFixtureRow({
    clinicId: 123,
    displayName: "Clinica Publica Fixture",
    avatarStoragePath: null,
    aboutText: "Perfil publico fixture",
    specialtyText: "Histopatologia",
    servicesText: "Biopsias",
    email: "fixture@example.com",
    phone: "3411234567",
    locality: "Rosario",
    country: "AR",
    updatedAt: new Date("2026-04-29T20:00:00.000Z"),
    profileQualityScore: 0.9,
    rank: 0.4,
    similarity: 0.3,
    score: 0.7,
    ...overrides,
  });
}

export function buildPublicProfessionalsRouteFixtureStubs(
  options: {
    row?: PublicProfessionalFixtureRow;
    searchRows?: PublicProfessionalFixtureRow[];
    limit?: number;
    offset?: number;
    searchRateLimitMaxAttempts?: number;
    detailRateLimitMaxAttempts?: number;
    searchRateLimitWindowMs?: number;
    detailRateLimitWindowMs?: number;
    now?: () => number;
  } = {},
): PublicProfessionalsRouteFixtureStubs {
  const detailRow = clonePublicProfessionalFixtureRow(
    options.row ?? buildPublicProfessionalFixtureRow(),
  );
  const searchRows = (options.searchRows ?? [detailRow]).map((row) =>
    clonePublicProfessionalFixtureRow(row),
  );

  return {
    searchPublicProfessionals: async () => {
      const rows = searchRows.map((row) =>
        clonePublicProfessionalFixtureRow(row),
      );

      return {
        rows,
        total: rows.length,
        limit: options.limit ?? 20,
        offset: options.offset ?? 0,
      };
    },
    getPublicProfessionalByClinicId: async (clinicId: number) =>
      clinicId === detailRow.clinicId
        ? clonePublicProfessionalFixtureRow(detailRow)
        : null,
    createSignedStorageUrl: async (path: string) => `signed:${path}`,
    searchRateLimitWindowMs: options.searchRateLimitWindowMs ?? 60_000,
    searchRateLimitMaxAttempts: options.searchRateLimitMaxAttempts ?? 1,
    detailRateLimitWindowMs: options.detailRateLimitWindowMs ?? 60_000,
    detailRateLimitMaxAttempts: options.detailRateLimitMaxAttempts ?? 1,
    now: options.now ?? (() => 10_000),
  };
}
