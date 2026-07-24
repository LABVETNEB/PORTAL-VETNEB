export type ClinicStudyTrackingCommandRepository<
  TCase,
  TNotification,
  TCreateCaseInput,
  TUpdateCaseInput,
  TCreateNotificationInput,
  TMarkNotificationReadParams,
  TMarkAllNotificationsReadParams,
  TMarkAllNotificationsReadResult,
> = {
  createStudyTrackingCase: (input: TCreateCaseInput) => Promise<TCase>;
  updateStudyTrackingCase: (
    id: number,
    input: TUpdateCaseInput,
  ) => Promise<TCase | null | undefined>;
  createStudyTrackingNotification: (
    input: TCreateNotificationInput,
  ) => Promise<TNotification>;
  markStudyTrackingNotificationReadScoped: (
    params: TMarkNotificationReadParams,
  ) => Promise<TNotification | null | undefined>;
  markAllStudyTrackingNotificationsReadScoped: (
    params: TMarkAllNotificationsReadParams,
  ) => Promise<TMarkAllNotificationsReadResult>;
};

export type AdminStudyTrackingCommandRepository<
  TCase,
  TNotification,
  TCreateCaseInput,
  TUpdateCaseInput,
  TCreateNotificationInput,
  TMarkAllNotificationsReadParams,
  TMarkAllNotificationsReadResult,
> = {
  createStudyTrackingCase: (input: TCreateCaseInput) => Promise<TCase>;
  updateStudyTrackingCase: (
    id: number,
    input: TUpdateCaseInput,
  ) => Promise<TCase | null | undefined>;
  createStudyTrackingNotification: (
    input: TCreateNotificationInput,
  ) => Promise<TNotification>;
  markStudyTrackingNotificationRead: (
    id: number,
  ) => Promise<TNotification | null | undefined>;
  markAllStudyTrackingNotificationsRead: (
    params?: TMarkAllNotificationsReadParams,
  ) => Promise<TMarkAllNotificationsReadResult>;
};

export type ParticularStudyTrackingCommandRepository<
  TNotification,
  TMarkNotificationReadParams,
  TMarkAllNotificationsReadParams,
  TMarkAllNotificationsReadResult,
> = {
  markStudyTrackingNotificationReadScoped: (
    params: TMarkNotificationReadParams,
  ) => Promise<TNotification | null | undefined>;
  markAllStudyTrackingNotificationsReadScoped: (
    params: TMarkAllNotificationsReadParams,
  ) => Promise<TMarkAllNotificationsReadResult>;
};
