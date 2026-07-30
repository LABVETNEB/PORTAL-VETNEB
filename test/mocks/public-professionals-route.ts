import {
  buildPublicProfessionalFixtureRow,
  clonePublicProfessionalFixtureRow,
  type PublicProfessionalFixtureRow,
} from "../factories/public-professionals.ts";

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
