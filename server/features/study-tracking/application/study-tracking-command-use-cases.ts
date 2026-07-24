import type {
  AdminStudyTrackingCommandRepository,
  ClinicStudyTrackingCommandRepository,
  ParticularStudyTrackingCommandRepository,
} from "./ports/study-tracking-command-repository.ts";

export function createClinicStudyTrackingCommandUseCases<
  TCase,
  TNotification,
  TCreateCaseInput,
  TUpdateCaseInput,
  TCreateNotificationInput,
  TMarkNotificationReadParams,
  TMarkAllNotificationsReadParams,
  TMarkAllNotificationsReadResult,
>(
  repository: ClinicStudyTrackingCommandRepository<
    TCase,
    TNotification,
    TCreateCaseInput,
    TUpdateCaseInput,
    TCreateNotificationInput,
    TMarkNotificationReadParams,
    TMarkAllNotificationsReadParams,
    TMarkAllNotificationsReadResult
  >,
) {
  return {
    createStudyTrackingCase: (input: TCreateCaseInput) =>
      repository.createStudyTrackingCase(input),
    updateStudyTrackingCase: (id: number, input: TUpdateCaseInput) =>
      repository.updateStudyTrackingCase(id, input),
    createStudyTrackingNotification: (input: TCreateNotificationInput) =>
      repository.createStudyTrackingNotification(input),
    markStudyTrackingNotificationReadScoped: (
      params: TMarkNotificationReadParams,
    ) => repository.markStudyTrackingNotificationReadScoped(params),
    markAllStudyTrackingNotificationsReadScoped: (
      params: TMarkAllNotificationsReadParams,
    ) => repository.markAllStudyTrackingNotificationsReadScoped(params),
  };
}

export function createAdminStudyTrackingCommandUseCases<
  TCase,
  TNotification,
  TCreateCaseInput,
  TUpdateCaseInput,
  TCreateNotificationInput,
  TMarkAllNotificationsReadParams,
  TMarkAllNotificationsReadResult,
>(
  repository: AdminStudyTrackingCommandRepository<
    TCase,
    TNotification,
    TCreateCaseInput,
    TUpdateCaseInput,
    TCreateNotificationInput,
    TMarkAllNotificationsReadParams,
    TMarkAllNotificationsReadResult
  >,
) {
  return {
    createStudyTrackingCase: (input: TCreateCaseInput) =>
      repository.createStudyTrackingCase(input),
    updateStudyTrackingCase: (id: number, input: TUpdateCaseInput) =>
      repository.updateStudyTrackingCase(id, input),
    createStudyTrackingNotification: (input: TCreateNotificationInput) =>
      repository.createStudyTrackingNotification(input),
    markStudyTrackingNotificationRead: (id: number) =>
      repository.markStudyTrackingNotificationRead(id),
    markAllStudyTrackingNotificationsRead: (
      params?: TMarkAllNotificationsReadParams,
    ) => repository.markAllStudyTrackingNotificationsRead(params),
  };
}

export function createParticularStudyTrackingCommandUseCases<
  TNotification,
  TMarkNotificationReadParams,
  TMarkAllNotificationsReadParams,
  TMarkAllNotificationsReadResult,
>(
  repository: ParticularStudyTrackingCommandRepository<
    TNotification,
    TMarkNotificationReadParams,
    TMarkAllNotificationsReadParams,
    TMarkAllNotificationsReadResult
  >,
) {
  return {
    markStudyTrackingNotificationReadScoped: (
      params: TMarkNotificationReadParams,
    ) => repository.markStudyTrackingNotificationReadScoped(params),
    markAllStudyTrackingNotificationsReadScoped: (
      params: TMarkAllNotificationsReadParams,
    ) => repository.markAllStudyTrackingNotificationsReadScoped(params),
  };
}
