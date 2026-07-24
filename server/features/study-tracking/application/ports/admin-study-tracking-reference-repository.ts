export type AdminStudyTrackingReferenceRepository<
  TClinic,
  TReport,
  TParticularToken,
> = {
  getClinicById: (clinicId: number) => Promise<TClinic | null>;
  getReportById: (reportId: number) => Promise<TReport | null>;
  getParticularTokenById: (
    tokenId: number,
  ) => Promise<TParticularToken | null | undefined>;
  updateParticularTokenReport: (
    tokenId: number,
    reportId: number | null,
  ) => Promise<TParticularToken | null | undefined>;
};
