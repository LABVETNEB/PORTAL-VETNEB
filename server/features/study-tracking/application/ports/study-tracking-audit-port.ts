export type StudyTrackingAuditPort<TRequest, TInput> = {
  writeAuditLog: (request: TRequest, input: TInput) => Promise<void>;
};
