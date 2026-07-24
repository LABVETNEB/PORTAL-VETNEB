export type ClinicStudyTrackingReferenceRepository<
  TClinic,
  TReport,
  TParticularToken,
> = {
  getClinicById: (clinicId: number) => Promise<TClinic | null>;
  getClinicScopedReportById: (
    reportId: number,
    clinicId: number,
  ) => Promise<TReport | null | undefined>;
  getParticularTokenById: (
    tokenId: number,
  ) => Promise<TParticularToken | null | undefined>;
  updateParticularTokenReport: (
    tokenId: number,
    reportId: number | null,
  ) => Promise<TParticularToken | null | undefined>;
};
