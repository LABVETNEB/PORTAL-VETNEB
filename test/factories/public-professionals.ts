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

export function clonePublicProfessionalFixtureRow(
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
