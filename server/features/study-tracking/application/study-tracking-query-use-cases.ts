import type {
  AdminStudyTrackingQueryRepository,
  ClinicStudyTrackingQueryRepository,
  ParticularStudyTrackingQueryRepository,
} from "./ports/study-tracking-query-repository.ts";

export type ClinicStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams,
> = ClinicStudyTrackingQueryRepository<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams
>;

export type AdminStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams,
> = AdminStudyTrackingQueryRepository<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams
>;

export type ParticularStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TNotificationListParams,
> = ParticularStudyTrackingQueryRepository<
  TCase,
  TNotification,
  TNotificationListParams
>;

export function createClinicStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams,
>(
  repository: ClinicStudyTrackingQueryRepository<
    TCase,
    TNotification,
    TCaseListParams,
    TNotificationListParams
  >,
): ClinicStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams
> {
  return {
    getClinicScopedStudyTrackingCase: (id, clinicId) =>
      repository.getClinicScopedStudyTrackingCase(id, clinicId),
    listStudyTrackingCases: (params) =>
      repository.listStudyTrackingCases(params),
    listStudyTrackingNotifications: (params) =>
      repository.listStudyTrackingNotifications(params),
  };
}

export function createAdminStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams,
>(
  repository: AdminStudyTrackingQueryRepository<
    TCase,
    TNotification,
    TCaseListParams,
    TNotificationListParams
  >,
): AdminStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TCaseListParams,
  TNotificationListParams
> {
  return {
    getClinicScopedStudyTrackingCase: (id, clinicId) =>
      repository.getClinicScopedStudyTrackingCase(id, clinicId),
    getStudyTrackingCaseById: (id) =>
      repository.getStudyTrackingCaseById(id),
    listStudyTrackingCases: (params) =>
      repository.listStudyTrackingCases(params),
    listStudyTrackingNotifications: (params) =>
      repository.listStudyTrackingNotifications(params),
  };
}

export function createParticularStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TNotificationListParams,
>(
  repository: ParticularStudyTrackingQueryRepository<
    TCase,
    TNotification,
    TNotificationListParams
  >,
): ParticularStudyTrackingQueryUseCases<
  TCase,
  TNotification,
  TNotificationListParams
> {
  return {
    getParticularStudyTrackingCase: (particularTokenId) =>
      repository.getParticularStudyTrackingCase(particularTokenId),
    listStudyTrackingNotifications: (params) =>
      repository.listStudyTrackingNotifications(params),
  };
}
