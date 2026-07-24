export type ClinicStudyTrackingQueryRepository<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams,
> = {
  getClinicScopedStudyTrackingCase: (
    id: number,
    clinicId: number,
  ) => Promise<TCase | null | undefined>;
  listStudyTrackingCases: (params: TCaseListParams) => Promise<TCase[]>;
  listStudyTrackingNotifications: (
    params: TNotificationListParams,
  ) => Promise<TNotification[]>;
};

export type AdminStudyTrackingQueryRepository<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams,
> = ClinicStudyTrackingQueryRepository<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams
> & {
  getStudyTrackingCaseById: (
    id: number,
  ) => Promise<TCase | null | undefined>;
};

export type ParticularStudyTrackingQueryRepository<
  TCase,
  TNotification,
  TNotificationListParams,
> = {
  getParticularStudyTrackingCase: (
    particularTokenId: number,
  ) => Promise<TCase | null | undefined>;
  listStudyTrackingNotifications: (
    params: TNotificationListParams,
  ) => Promise<TNotification[]>;
};
