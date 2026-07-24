export type StudyTrackingNotificationPort<TInput, TResult = unknown> = {
  sendSpecialStainRequiredEmail: (input: TInput) => Promise<TResult>;
};
